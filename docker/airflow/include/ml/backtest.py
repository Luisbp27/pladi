"""Backtest walk-forward del modelo activo (drift monitoring, metodologia del notebook 20).

Entrena con datos < T y evalua el anio T, para T >= 2021 (1 anio hacia adelante,
lag actualizado recursivamente). Los resultados se escriben en ml.backtests con el
umbral de degradacion (MAPE del holdout de la version activa x 1.5).
"""
from __future__ import annotations

import numpy as np
import polars as pl
from sklearn.ensemble import GradientBoostingRegressor

from include.ml.entrenar import PARAMS, _metricas, _predict_recursivo
from include.ml.panel import FEATURES, TRAIN_DESDE

UMBRAL_FACTOR = 1.5


def correr(panel: pl.DataFrame) -> list[dict]:
    resultados: list[dict] = []
    anios = sorted(panel["anio"].unique().to_list())
    for t in [a for a in anios if a >= 2021]:
        filas: list[dict] = []
        for cod_t, g in panel.partition_by("cod_municipio", as_dict=True).items():
            cod = int(cod_t[0])
            train = g.filter(
                (pl.col("anio") >= TRAIN_DESDE)
                & (pl.col("anio") < t)
                & pl.col("lag1").is_not_null()
            )
            test = g.filter(pl.col("anio") == t)
            if train.height < 4 or test.height == 0:
                continue
            m = GradientBoostingRegressor(**PARAMS)
            m.fit(train.select(FEATURES).to_numpy(), train["consumo_hm3"].to_numpy())
            pred = _predict_recursivo(m, train, test)
            filas.append(
                {
                    "cod_municipio": cod,
                    **_metricas(test["consumo_hm3"].to_numpy(), np.asarray(pred, dtype=float)),
                }
            )
        if not filas:
            continue
        resultados.append(
            {
                "ventana": str(t),
                "n_municipios": len(filas),
                "mape_medio": round(float(np.mean([r["mape"] for r in filas])), 3),
                "mae_medio": round(float(np.mean([r["mae"] for r in filas])), 3),
                "detalle": {str(r["cod_municipio"]): round(r["mape"], 2) for r in filas},
            }
        )
    return resultados
