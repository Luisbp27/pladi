"""Gold: agua infiltrada mensual por masa (disparado por actualizacion de lluvia)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset

from include.gold import agua_infiltrada_masa_subterranea as gold

LLUVIA_ASSET = Asset("pladi://gold/lluvia_masa_subterranea")
AGUA_INF_ASSET = Asset("pladi://gold/agua_infiltrada_masa_subterranea")


@dag(
    dag_id="agua_infiltrada_masa_subterranea",
    schedule=[LLUVIA_ASSET],
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["gold", "dma"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Gold: agua infiltrada mensual por masa (lluvia x coeficiente de infiltracion)",
)
def agua_infiltrada_dag():
    @task
    def aggregate() -> Asset:
        gold.aggregate()
        return AGUA_INF_ASSET

    aggregate()


agua_infiltrada_dag()
