"""Entrenamiento del modelo de consumo urbano (replica de los notebooks 11 y 14).

- 67 GradientBoostingRegressor por municipio (params fijos, random_state=42).
- Evaluacion: holdout 2022..base_anio con prediccion recursiva (lag actualizado).
- Modelos de PRODUCCION: reentrenados con el historico completo (train < base_anio+1)
  para que la proyeccion no extrapole la feature `anio` fuera del rango (los arboles
  se congelan en la hoja limite). El MAPE documentado es el del holdout.
- Elasticidades: perturbacion +-10% sobre la mediana de features (notebook 14);
  ocupacion solo en municipios con turismo.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import polars as pl
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from include.ml.panel import FEATURES, TRAIN_DESDE, TEST_START

PARAMS = {"n_estimators": 100, "learning_rate": 0.05, "max_depth": 2, "random_state": 42}
FEAT_ELAST = [f for f in FEATURES if f not in ("anio", "lag1")]


def _metricas(test: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    test, pred = np.asarray(test, float), np.asarray(pred, float)
    return dict(
        mae=float(mean_absolute_error(test, pred)),
        mape=float(np.mean(np.abs((test - pred) / test)) * 100),
        rmse=float(mean_squared_error(test, pred) ** 0.5),
        r2=float(r2_score(test, pred)),
    )


def _predict_recursivo(model, hist: pl.DataFrame, test: pl.DataFrame) -> list[float]:
    if hist.height < 2:
        return [float(hist["consumo_hm3"].mean())] * test.height
    last = float(hist["consumo_hm3"].to_list()[-1])
    preds: list[float] = []
    for row in test.sort("anio").iter_rows(named=True):
        x = [float(row[f]) for f in FEATURES]
        x[FEATURES.index("lag1")] = last
        p = max(float(model.predict([x])[0]), 0.0)
        preds.append(p)
        last = p
    return preds


def _elasticidad(model, base_row: dict[str, float], f: str, delta: float = 0.10) -> float:
    y0 = float(model.predict([list(base_row.values())])[0])
    if y0 == 0.0:
        return 0.0
    x1 = base_row.copy()
    x1[f] = x1[f] * (1 + delta)
    y1 = float(model.predict([list(x1.values())])[0])
    return ((y1 - y0) / y0) / delta


def _elasticidades(panel: pl.DataFrame, modelos: dict[int, object]) -> dict[str, float]:
    elast: dict[str, list[float]] = {f: [] for f in FEAT_ELAST}
    ocup_elast: list[float] = []
    for cod, m in modelos.items():
        g = panel.filter(
            (pl.col("cod_municipio") == cod)
            & (pl.col("anio") >= TRAIN_DESDE)
            & (pl.col("anio") < TEST_START)
            & pl.col("lag1").is_not_null()
        )
        if g.height == 0:
            continue
        base_row = {f: float(g.select(pl.col(f).median()).item()) for f in FEATURES}
        tiene_turismo = float(g.select(pl.col("ocupacion_media").max()).item()) > 0
        for f in FEAT_ELAST:
            e = _elasticidad(m, base_row, f)
            elast[f].append(e)
            if f == "ocupacion_media" and tiene_turismo:
                ocup_elast.append(e)
    return {
        "iph": float(np.mean(elast["iph_media"])) if elast["iph_media"] else 0.0,
        "ocupacion": float(np.mean(ocup_elast)) if ocup_elast else 0.0,
        "lluvia": float(np.mean(elast["lluvia_anual_mm"])) if elast["lluvia_anual_mm"] else 0.0,
        "nota": (
            "elasticidades medias del modelo (perturbacion +-10% sobre la mediana de "
            "features); ocupacion solo municipios con turismo"
        ),
    }


def entrenar(panel: pl.DataFrame, out_dir: Path) -> dict:
    """Entrena y serializa. Devuelve el resumen para publicar/registrar."""
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "municipio").mkdir(exist_ok=True)

    base_anio = int(panel["anio"].max())
    prod_test_start = base_anio + 1

    filas: list[dict] = []
    eval_modelos: dict[int, object] = {}
    prod_modelos: dict[int, object] = {}
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
            m = GradientBoostingRegressor(**PARAMS)
            m.fit(train.select(FEATURES).to_numpy(), train["consumo_hm3"].to_numpy())
            eval_modelos[cod] = m
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
            m = GradientBoostingRegressor(**PARAMS)
            m.fit(train_prod.select(FEATURES).to_numpy(), train_prod["consumo_hm3"].to_numpy())
            prod_modelos[cod] = m
            joblib.dump(m, out_dir / "municipio" / f"{cod}.joblib")

    mape_por_mun = {str(r["cod_municipio"]): round(float(r["mape"]), 2) for r in filas}
    mape_medio = float(np.mean([r["mape"] for r in filas])) if filas else float("nan")
    mae_medio = float(np.mean([r["mae"] for r in filas])) if filas else float("nan")

    # elasticidades medidas con los modelos de EVALUACION (ventana 2016-2021),
    # como en el notebook 14 (no con los de produccion reentrenados)
    elasticidades = _elasticidades(panel, eval_modelos)

    metadata = {
        "modelo": "GradientBoostingRegressor",
        "params": PARAMS,
        "features": FEATURES,
        "target": "consumo_hm3",
        "base_anio": base_anio,
        "train_desde": TRAIN_DESDE,
        "test_start": TEST_START,
        "n_modelos": len(prod_modelos),
        "mape_por_municipio": mape_por_mun,
        "nota": (
            f"modelos de produccion reentrenados con datos {TRAIN_DESDE}-{base_anio}; "
            f"el MAPE por municipio proviene del holdout {TEST_START}-{base_anio}"
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
