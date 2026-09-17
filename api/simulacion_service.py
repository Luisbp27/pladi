"""Carga de modelos joblib (registry ml.model_versions + MinIO) y prediccion recursiva para /simulacion."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

from config import settings
from database import get_pool
from model_store import BundleError, download_and_verify, escribir_puntero, leer_puntero

logger = logging.getLogger("pladi.simulacion")

_state: dict | None = None
_version: str | None = None


class ModelosError(Exception):
    """Modelos no disponibles (sin entrenar o sin montar el volumen)."""


def _load_state(root: Path) -> dict:
    meta_path = root / "metadata.json"
    if not meta_path.exists():
        raise ModelosError(f"metadata.json no encontrado en {root}")
    meta = json.loads(meta_path.read_text())

    features: list[str] = meta["features"]
    modelos: dict[str, Any] = {}
    dir_mun = root / "municipio"
    if dir_mun.is_dir():
        for f in sorted(dir_mun.glob("*.joblib")):
            modelos[f.stem] = joblib.load(f)

    mape = {str(k): float(v) for k, v in meta.get("mape_por_municipio", {}).items()}

    elasticidades: dict[str, Any] = {}
    el_path = root / "elasticidades.json"
    if el_path.exists():
        data = json.loads(el_path.read_text())
        elasticidades = {
            "iph": float(data.get("iph", 0.0)),
            "ocupacion": float(data.get("ocupacion", 0.0)),
            "lluvia": float(data.get("lluvia", 0.0)),
            "censo": float(data.get("censo", 0.0)),
            "nota": str(data.get("nota", "")),
            "censo_origen": str(data.get("censo_origen", "")),
        }

    state = {
        "features": features,
        "features_modelo": meta.get("features_modelo") or features,
        "target_transform": meta.get("target_transform"),
        "poblacion_base": {str(k): float(v) for k, v in meta.get("poblacion_base", {}).items()},
        "modelos": modelos,
        "mape": mape,
        "elasticidades": elasticidades,
        "params": meta.get("params", {}),
        "base_anio": meta.get("base_anio"),
        "train_desde": meta.get("train_desde"),
        "test_start": meta.get("test_start"),
        "modelo": meta.get("modelo"),
    }
    if not modelos:
        raise ModelosError(f"ningun modelo joblib en {dir_mun}")
    return state


async def load() -> None:
    """Resuelve la version activa (registry), descarga y carga los modelos al arrancar."""
    global _state, _version

    row = None
    try:
        pool = await get_pool()
        if settings.model_version:
            row = await pool.fetchrow(
                "SELECT id, artifact_uri, estado FROM ml.model_versions WHERE id = $1",
                settings.model_version,
            )
            if row is None:
                raise ModelosError(f"version pineada no existe en el registry: {settings.model_version}")
        else:
            row = await pool.fetchrow(
                "SELECT id, artifact_uri, estado FROM ml.model_versions "
                "WHERE estado = 'active' ORDER BY activado_en DESC LIMIT 1"
            )
    except ModelosError:
        raise
    except Exception as e:
        logger.warning("registry ml.model_versions no disponible (%s) — modo local", e)
        row = None

    version: str | None = None
    if row is not None:
        try:
            dir_modelos = await asyncio.to_thread(download_and_verify, dict(row))
            version = row["id"]
        except BundleError as e:
            raise ModelosError(f"no se pudo preparar el bundle {row['id']}: {e}") from e
    else:
        dir_modelos = Path(settings.models_dir)

    try:
        _state = await asyncio.to_thread(_load_state, dir_modelos)
    except ModelosError as e:
        puntero = await asyncio.to_thread(leer_puntero)
        prev_dir = Path(puntero["dir"]) if puntero and puntero.get("dir") else None
        if prev_dir and prev_dir != dir_modelos and prev_dir.exists():
            logger.warning(
                "fallo al cargar '%s' (%s) — volviendo a la version anterior %s",
                version or "local",
                e,
                puntero.get("version"),
            )
            _state = await asyncio.to_thread(_load_state, prev_dir)
            version = puntero.get("version")
        else:
            raise

    _version = version
    if version:
        await asyncio.to_thread(
            escribir_puntero,
            {
                "version": version,
                "dir": str(dir_modelos),
                "cargado_en": datetime.now(timezone.utc).isoformat(),
            },
        )
    logger.info(
        "modelos cargados: %d | version: %s | features: %s",
        len(_state["modelos"]),
        version or "local",
        _state["features"],
    )


def version_info() -> dict:
    """Metadatos de la version servida (endpoint /simulacion/version y /health)."""
    st = _get_state()
    mape_vals = list(st["mape"].values())
    return {
        "version": _version,
        "modelo": st.get("modelo"),
        "n_modelos": len(st["modelos"]),
        "mape_medio": round(sum(mape_vals) / len(mape_vals), 2) if mape_vals else None,
        "features": st["features"],
        "target_transform": st.get("target_transform"),
        "params": st.get("params", {}),
        "base_anio": st.get("base_anio"),
        "train_desde": st.get("train_desde"),
        "test_start": st.get("test_start"),
        "elasticidades": st["elasticidades"],
    }


def _get_state() -> dict:
    if _state is None:
        raise ModelosError("modelos no cargados")
    return _state


def tiene_modelos() -> bool:
    return _state is not None and bool(_state["modelos"])


def elasticidades() -> dict[str, Any]:
    return dict(_get_state()["elasticidades"])


def _norm(cod: str) -> str:
    """Los modelos se entrenaron con codigos int (sin ceros a la izquierda): '07001' -> '7001'."""
    return str(cod).lstrip("0") or "0"


def predecir_recursivo(cod_municipio: str, base_row: dict, hasta: int, pct: dict) -> list[dict]:
    """Proyecta el consumo anual desde base_anio+1 hasta `hasta` (inclusive).

    - base_row: features del ultimo anio observado (claves = features del modelo).
    - pct: variaciones relativas {'iph': x, 'censo': y, 'lluvia': z} (0.1 = +10%).

    Metodo (shift estatico sobre el nivel congelado):
      1. Base: prediccion del modelo con features congeladas en el ultimo anio y `anio`
         limitado al ultimo ano de entrenamiento. Los arboles GB no extrapolan: el nivel
         resultante es practicamente constante en todo el horizonte (la unica variacion
         es el lag recursivo alimentado con la prediccion anterior).
      2. Si el bundle es `target_transform="per_capita"`, el modelo predice consumo/poblacion:
         el lag se normaliza por la poblacion base y la prediccion se reescala x poblacion base
         (poblacion congelada, igual que el resto de features).
      3. Escenario: el nivel base se multiplica por (1 + delta), con
         delta = e_iph*pct_iph + e_censo*pct_censo + e_lluvia*pct_lluvia. Las elasticidades
         se miden en el DAG con perturbacion simetrica +-10% sobre la fila base (los modelos
         que se sirven); `censo` es un coeficiente externo documentado (OLS). La ocupacion
         NO entra en el delta: su efecto causal anual no esta identificado.
      4. La banda lo/hi (+-MAPE del municipio, ensanchada 3 pp/ano) es el UNICO elemento
         que evoluciona con el horizonte; la proyeccion central es un shift estatico.
    """
    st = _get_state()
    cod = _norm(cod_municipio)
    if cod not in st["modelos"]:
        raise ModelosError(f"sin modelo para el municipio {cod_municipio}")
    modelo = st["modelos"][cod]
    features = st.get("features_modelo") or st["features"]
    per_capita = st.get("target_transform") == "per_capita"
    pob_base = float(st.get("poblacion_base", {}).get(cod, 0.0)) if per_capita else 0.0
    if per_capita and pob_base <= 0:
        raise ModelosError(f"sin poblacion base para el municipio {cod_municipio}")
    mape = st["mape"].get(cod, 10.0) / 100.0  # el metadata guarda el MAPE en %
    el = st["elasticidades"]

    base_anio = int(base_row["anio"])
    cap_anio = float(base_anio)  # ultimo ano de entrenamiento de los modelos de produccion
    delta = (
        float(el.get("iph", 0.0)) * float(pct.get("iph", 0.0))
        + float(el.get("censo", 0.0)) * float(pct.get("censo", 0.0))
        + float(el.get("lluvia", 0.0)) * float(pct.get("lluvia", 0.0))
    )
    lag = float(base_row["lag1"])
    if per_capita:
        lag = lag / pob_base

    out: list[dict] = []
    for anio in range(base_anio + 1, hasta + 1):
        x: dict[str, float] = {}
        for f in features:
            if f == "anio":
                x[f] = min(float(anio), cap_anio)
            elif f in ("lag1", "lag1_pc"):
                x[f] = lag
            else:
                x[f] = float(base_row[f])

        p_modelo = max(float(modelo.predict([[x[f] for f in features]])[0]), 0.0)
        if per_capita:
            p_modelo *= pob_base
        p = max(p_modelo * (1.0 + delta), 0.0)
        banda = mape + 0.03 * (anio - base_anio - 1)
        out.append(
            {
                "anio": anio,
                "consumo_hm3": round(p, 3),
                "lo": round(p * (1.0 - banda), 3),
                "hi": round(p * (1.0 + banda), 3),
            }
        )
        lag = (p / pob_base) if per_capita else p
    return out
