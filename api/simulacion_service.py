"""Carga de modelos joblib (notebook 11) y prediccion recursiva para /simulacion."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import joblib

from config import settings

logger = logging.getLogger("pladi.simulacion")

_state: dict | None = None


class ModelosError(Exception):
    """Modelos no disponibles (sin entrenar o sin montar el volumen)."""


def _load_state() -> dict:
    root = Path(settings.models_dir)
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

    elasticidades: dict[str, float] = {}
    el_path = root / "elasticidades.json"
    if el_path.exists():
        data = json.loads(el_path.read_text())
        elasticidades = {
            "iph": float(data.get("iph", 0.0)),
            "ocupacion": float(data.get("ocupacion", 0.0)),
            "lluvia": float(data.get("lluvia", 0.0)),
        }

    state = {
        "features": features,
        "modelos": modelos,
        "mape": mape,
        "elasticidades": elasticidades,
        "params": meta.get("params", {}),
    }
    if not modelos:
        raise ModelosError(f"ningun modelo joblib en {dir_mun}")
    return state


async def load() -> None:
    """Carga los modelos al arrancar la API (threadpool para no bloquear el loop)."""
    global _state
    _state = await asyncio.to_thread(_load_state)
    logger.info("modelos cargados: %d | features: %s", len(_state["modelos"]), _state["features"])


def _get_state() -> dict:
    if _state is None:
        raise ModelosError("modelos no cargados")
    return _state


def tiene_modelos() -> bool:
    return _state is not None and bool(_state["modelos"])


def elasticidades() -> dict[str, float]:
    return dict(_get_state()["elasticidades"])


def _norm(cod: str) -> str:
    """Los modelos se entrenaron con codigos int (sin ceros a la izquierda): '07001' -> '7001'."""
    return str(cod).lstrip("0") or "0"


def predecir_recursivo(cod_municipio: str, base_row: dict, hasta: int, pct: dict) -> list[dict]:
    """Proyecta el consumo anual desde base_anio+1 hasta `hasta` (inclusive).

    - base_row: features del ultimo anio observado (claves = features del modelo).
    - pct: variaciones relativas {'iph': x, 'ocupacion': y, 'lluvia': z} (0.1 = +10%).

    Metodo (hibrido honesto):
      1. Baseline: prediccion recursiva del modelo con features congeladas en el
         ultimo anio y `anio` limitado al ultimo ano de entrenamiento (los arboles
         no extrapolan fuera del rango: se congelan en la hoja limite).
      2. Escenario: ajuste multiplicativo con las elasticidades medidas in-range
         (14_interpretabilidad): delta = e_iph*pct_iph + e_ocup*pct_ocup + e_lluvia*pct_lluvia.
         El lag recursivo usa el valor ya ajustado (compounding).
      La banda lo/hi usa el MAPE del municipio y se ensancha con el horizonte.
    """
    st = _get_state()
    cod = _norm(cod_municipio)
    if cod not in st["modelos"]:
        raise ModelosError(f"sin modelo para el municipio {cod_municipio}")
    modelo = st["modelos"][cod]
    features = st["features"]
    mape = st["mape"].get(cod, 10.0) / 100.0  # el metadata guarda el MAPE en %
    el = st["elasticidades"]

    base_anio = int(base_row["anio"])
    cap_anio = float(base_anio)  # ultimo ano de entrenamiento de los modelos de produccion
    delta = (
        float(el.get("iph", 0.0)) * float(pct.get("iph", 0.0))
        + float(el.get("ocupacion", 0.0)) * float(pct.get("ocupacion", 0.0))
        + float(el.get("lluvia", 0.0)) * float(pct.get("lluvia", 0.0))
    )
    lag = float(base_row["lag1"])

    out: list[dict] = []
    for anio in range(base_anio + 1, hasta + 1):
        x: dict[str, float] = {}
        for f in features:
            if f == "anio":
                x[f] = min(float(anio), cap_anio)
            elif f == "lag1":
                x[f] = lag
            else:
                x[f] = float(base_row[f])

        p_modelo = max(float(modelo.predict([[x[f] for f in features]])[0]), 0.0)
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
        lag = p
    return out
