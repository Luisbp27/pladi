"""Entrenamiento del modelo de consumo urbano (target per capita).

- 67 GradientBoostingRegressor por municipio (params fijos, random_state=42) sobre
  `consumo_hm3 / poblacion` (target per capita, decision 2026-09-12: mejora el MAPE del
  holdout de 8,863 a 7,948 sin quitar features; poblacion como feature empeoraba +1,0 pp).
- Evaluacion: holdout 2022..base_anio con prediccion recursiva (lag per capita actualizado)
  y poblacion CONGELADA en el ultimo anio de train (replica de la proyeccion de produccion).
- Modelos de PRODUCCION: reentrenados con el historico completo (train < base_anio+1) para
  que la proyeccion no extrapole la feature `anio` fuera del rango (los arboles se congelan
  en la hoja limite).
- Elasticidades (2026-09-12): perturbacion SIMETRICA +-10% (diferencia central) medida con
  los modelos de PRODUCCION en la fila base (punto de aplicacion del escenario); ocupacion
  solo en municipios con turismo real. La elasticidad `censo` es un coeficiente externo
  documentado (OLS, no la estima el arbol).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import polars as pl
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from include.ml.panel import FEATURES, TRAIN_DESDE, TEST_START

PARAMS = {"n_estimators": 100, "learning_rate": 0.05, "max_depth": 2, "random_state": 42}
TARGET_TRANSFORM = "per_capita"
# El modelo consume el lag en terminos per capita (el target tambien lo es).
FEATURES_MODELO = [f for f in FEATURES if f != "lag1"] + ["lag1_pc"]
FEAT_ELAST = [f for f in FEATURES if f not in ("anio", "lag1")]

# Elasticidad censo: coeficiente externo documentado (no la estima el arbol).
# OLS en niveles consumo_hm3 ~ poblacion con el padron municipal 2024+2025
# (67 municipios, 134 obs): pendiente 0,071 hm3/1000 hab, R2=0,93, elasticidad en la
# media b*x/y = 0,79 (0,81 en el analisis original), per capita mediana ~177-184
# L/hab/dia. Alternativa de planificacion: ~1,0.
CENSO_ELASTICIDAD = 0.81
CENSO_ORIGEN = (
    "OLS niveles consumo_hm3 ~ poblacion (padron municipal 2024+2025, 67 municipios, 134 obs): "
    "b=0,071 hm3/1000 hab, R2=0,93, elasticidad en la media=0,79 (0,81 en el analisis original); "
    "alternativa de planificacion ~1,0. Reproducido en notebooks/21 y 22"
)


def _metricas(test: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    test, pred = np.asarray(test, float), np.asarray(pred, float)
    return dict(
        mae=float(mean_absolute_error(test, pred)),
        mape=float(np.mean(np.abs((test - pred) / test)) * 100),
        rmse=float(mean_squared_error(test, pred) ** 0.5),
        r2=float(r2_score(test, pred)),
    )


def _con_target_pc(df: pl.DataFrame) -> pl.DataFrame:
    """Anade target y lag en terminos per capita (consumo / poblacion)."""
    return df.with_columns(
        (pl.col("consumo_hm3") / pl.col("poblacion")).alias("y_pc"),
        (pl.col("lag1") / pl.col("poblacion")).alias("lag1_pc"),
    )


def _predict_recursivo(model, hist: pl.DataFrame, test: pl.DataFrame) -> list[float]:
    """Prediccion recursiva per capita con la poblacion congelada en el ultimo anio de `hist`.

    Devuelve hm3 (prediccion per capita x poblacion base) para poder comparar con el target real.
    """
    if hist.height < 2:
        return [float(hist["consumo_hm3"].mean())] * test.height
    pob_base = float(hist["poblacion"].to_list()[-1])
    last_pc = float(hist["consumo_hm3"].to_list()[-1]) / pob_base
    preds: list[float] = []
    for row in test.sort("anio").iter_rows(named=True):
        x = [last_pc if f == "lag1_pc" else float(row[f]) for f in FEATURES_MODELO]
        p_pc = max(float(model.predict([x])[0]), 0.0)
        preds.append(p_pc * pob_base)
        last_pc = p_pc
    return preds


def _elasticidad(model, base_row: dict[str, float], f: str, delta: float = 0.10) -> float:
    """Elasticidad por diferencia central (perturbacion simetrica +-delta) en la fila base."""
    y0 = float(model.predict([list(base_row.values())])[0])
    if y0 == 0.0:
        return 0.0
    xp = base_row.copy()
    xp[f] = xp[f] * (1 + delta)
    xm = base_row.copy()
    xm[f] = xm[f] * (1 - delta)
    yp = float(model.predict([list(xp.values())])[0])
    ym = float(model.predict([list(xm.values())])[0])
    return ((yp - ym) / y0) / (2 * delta)


def _elasticidades(panel: pl.DataFrame, modelos: dict[int, object]) -> dict[str, Any]:
    """Elasticidades con los modelos de PRODUCCION en la fila base (punto de aplicacion).

    - base_row = features del ultimo anio observado (`base_anio`) del municipio, con el lag
      en terminos per capita (igual que el modelo).
    - flag de turismo real: municipios con alguna ocupacion > 0 en la ventana de train
      (el resto tiene la feature imputada a 0).
    - `censo` no se mide con el arbol: es un coeficiente externo documentado.
    """
    base_anio = int(panel["anio"].max())
    elast: dict[str, list[float]] = {f: [] for f in FEAT_ELAST}
    ocup_elast: list[float] = []
    for cod, m in modelos.items():
        g = panel.filter((pl.col("cod_municipio") == cod) & (pl.col("anio") >= TRAIN_DESDE))
        base = g.filter(pl.col("anio") == base_anio)
        if g.height == 0 or base.height == 0:
            continue
        row = base.row(0, named=True)
        base_row = {
            "anio": float(row["anio"]),
            "iph_media": float(row["iph_media"]),
            "ocupacion_media": float(row["ocupacion_media"]),
            "lluvia_anual_mm": float(row["lluvia_anual_mm"]),
            "lag1_pc": float(row["lag1"]) / float(row["poblacion"]),
        }
        tiene_turismo = float(g.select(pl.col("ocupacion_media").max()).item()) > 0.0
        for f in FEAT_ELAST:
            e = _elasticidad(m, base_row, f)
            elast[f].append(e)
            if f == "ocupacion_media" and tiene_turismo:
                ocup_elast.append(e)
    return {
        "iph": float(np.mean(elast["iph_media"])) if elast["iph_media"] else 0.0,
        "ocupacion": float(np.mean(ocup_elast)) if ocup_elast else 0.0,
        "lluvia": float(np.mean(elast["lluvia_anual_mm"])) if elast["lluvia_anual_mm"] else 0.0,
        "censo": CENSO_ELASTICIDAD,
        "nota": (
            "elasticidades medias de los modelos de PRODUCCION (target per capita), perturbacion "
            "simetrica +-10% (diferencia central) sobre la fila base (ultimo anio observado); "
            "ocupacion solo municipios con turismo real; censo = coeficiente externo (no lo "
            "estima el arbol)"
        ),
        "censo_origen": CENSO_ORIGEN,
    }


def entrenar(panel: pl.DataFrame, out_dir: Path) -> dict:
    """Entrena y serializa. Devuelve el resumen para publicar/registrar."""
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "municipio").mkdir(exist_ok=True)

    base_anio = int(panel["anio"].max())
    prod_test_start = base_anio + 1

    filas: list[dict] = []
    prod_modelos: dict[int, object] = {}
    poblacion_base: dict[str, float] = {}
    skipped: list[int] = []
    for cod_t, g in panel.partition_by("cod_municipio", as_dict=True).items():
        cod = int(cod_t[0])
        train = g.filter(
            (pl.col("anio") >= TRAIN_DESDE)
            & (pl.col("anio") < TEST_START)
            & pl.col("lag1").is_not_null()
        )
        test = g.filter(pl.col("anio") >= TEST_START)
        if train.height < 4:
            skipped.append(cod)
            pred = [float(train["consumo_hm3"].mean())] * test.height
        else:
            tr = _con_target_pc(train)
            m = GradientBoostingRegressor(**PARAMS)
            m.fit(tr.select(FEATURES_MODELO).to_numpy(), tr["y_pc"].to_numpy())
            pred = _predict_recursivo(m, train, test)
        filas.append(
            {
                "cod_municipio": cod,
                **_metricas(test["consumo_hm3"].to_numpy(), np.asarray(pred, dtype=float)),
            }
        )

        # modelos de produccion: reentrenados con el historico completo (notebook 11)
        train_prod = g.filter(
            (pl.col("anio") >= TRAIN_DESDE)
            & (pl.col("anio") < prod_test_start)
            & pl.col("lag1").is_not_null()
        )
        if train_prod.height >= 4:
            trp = _con_target_pc(train_prod)
            m = GradientBoostingRegressor(**PARAMS)
            m.fit(trp.select(FEATURES_MODELO).to_numpy(), trp["y_pc"].to_numpy())
            prod_modelos[cod] = m
            poblacion_base[str(cod)] = float(train_prod["poblacion"].to_list()[-1])
            joblib.dump(m, out_dir / "municipio" / f"{cod}.joblib")

    mape_por_mun = {str(r["cod_municipio"]): round(float(r["mape"]), 2) for r in filas}
    mape_medio = float(np.mean([r["mape"] for r in filas])) if filas else float("nan")
    mae_medio = float(np.mean([r["mae"] for r in filas])) if filas else float("nan")

    # elasticidades medidas con los modelos de PRODUCCION (los que se sirven),
    # en la fila base (punto de aplicacion del escenario) y perturbacion simetrica ±10%
    elasticidades = _elasticidades(panel, prod_modelos)

    metadata = {
        "modelo": "GradientBoostingRegressor",
        "params": PARAMS,
        "features": FEATURES,
        "features_modelo": FEATURES_MODELO,
        "target": "consumo_hm3",
        "target_transform": TARGET_TRANSFORM,
        "poblacion_base": poblacion_base,
        "base_anio": base_anio,
        "train_desde": TRAIN_DESDE,
        "test_start": TEST_START,
        "n_modelos": len(prod_modelos),
        "mape_por_municipio": mape_por_mun,
        "nota": (
            f"modelos de produccion con target per capita (consumo/poblacion) reentrenados con "
            f"datos {TRAIN_DESDE}-{base_anio}; el MAPE por municipio proviene del holdout "
            f"{TEST_START}-{base_anio} con poblacion congelada en el anio base"
        ),
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    (out_dir / "elasticidades.json").write_text(
        json.dumps(elasticidades, ensure_ascii=False, indent=2)
    )

    return {
        "mape_medio": round(mape_medio, 3),
        "mae_medio": round(mae_medio, 3),
        "n_modelos": len(prod_modelos),
        "skipped": skipped,
        "base_anio": base_anio,
        "metadata": metadata,
        "elasticidades": elasticidades,
        "filas": filas,
    }
