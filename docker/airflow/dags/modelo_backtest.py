"""ML: backtest walk-forward del modelo activo -> ml.backtests (drift monitoring).

- Trigger: AssetAny de los mismos golds que el retrain (llega un dato nuevo -> evalua).
- Degradacion: mape_medio de una ventana > mape_holdout de la version activa x 1.5.
- Si alguna ventana degrada, el DAG FALLA (el DAG rojo en la UI de Airflow es la alerta).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.sdk.definitions.asset import Asset, AssetAny

from include.ml import backtest as bt
from include.ml.backtest import UMBRAL_FACTOR
from include.ml.panel import construir_panel
from include.ml.registry import ensure_schema

ABAST_ASSET = Asset("pladi://gold/abastecimiento_urbano_baleares")
PRESION_ASSET = Asset("pladi://gold/presion_humana")
OCUP_ASSET = Asset("pladi://gold/ocupacion_turistica")
LLUVIA_ASSET = Asset("pladi://gold/lluvia_masa_subterranea")


@dag(
    dag_id="modelo_backtest",
    schedule=AssetAny(ABAST_ASSET, PRESION_ASSET, OCUP_ASSET, LLUVIA_ASSET),
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ml", "gold"],
    default_args={
        "owner": "pladi",
        "retries": 2,
        "retry_delay": timedelta(minutes=5),
    },
    description="ML: backtest walk-forward del modelo activo -> ml.backtests (falla si degrada)",
)
def modelo_backtest():
    @task
    def correr_backtest() -> str:
        panel = construir_panel()
        hook = PostgresHook(postgres_conn_id="postgis_pladi")
        conn = hook.get_conn()
        try:
            with conn.cursor() as cur:
                ensure_schema(cur)
                cur.execute(
                    "SELECT id, mape_holdout_medio FROM ml.model_versions "
                    "WHERE estado = 'active' LIMIT 1"
                )
                activa = cur.fetchone()
                if activa is None:
                    return "sin version activa en el registry: backtest omitido"
                if activa[1] is None:
                    return "version activa sin mape_holdout_medio: backtest omitido"

                filas = bt.correr(panel)
                degradadas: list[str] = []
                for r in filas:
                    umbral = round(float(activa[1]) * UMBRAL_FACTOR, 3)
                    degradado = r["mape_medio"] > umbral
                    if degradado:
                        degradadas.append(r["ventana"])
                    cur.execute(
                        """
                        INSERT INTO ml.backtests (
                            version_id, ventana, n_municipios, mape_medio, mae_medio,
                            umbral_mape, degradado, detalle
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            activa[0],
                            r["ventana"],
                            r["n_municipios"],
                            r["mape_medio"],
                            r["mae_medio"],
                            umbral,
                            degradado,
                            json.dumps(r["detalle"]),
                        ),
                    )
            conn.commit()
        finally:
            conn.close()

        if degradadas:
            raise RuntimeError(
                f"DRIFT: el modelo {activa[0]} degrada en las ventanas {degradadas} "
                f"(umbral = mape_holdout {activa[1]} x {UMBRAL_FACTOR})"
            )
        return f"backtest OK ({len(filas)} ventanas) para la version {activa[0]}"

    correr_backtest()


modelo_backtest()
