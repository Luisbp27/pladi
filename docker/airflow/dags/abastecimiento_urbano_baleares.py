"""Gold: abastecimiento urbano Baleares (silver 4 islas → PostGIS)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset

from include.gold import abastecimiento_urbano_baleares as gold

DGRH_ASSET = Asset("pladi://silver/dgrh/abastecimiento_urbano")
GOLD_ASSET = Asset("pladi://gold/abastecimiento_urbano_baleares")


@dag(
    dag_id="abastecimiento_urbano_baleares",
    schedule=[DGRH_ASSET],
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["gold", "dgrh"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Gold: agrega abastecimiento urbano de las 4 islas → PostGIS",
)
def abastecimiento_urbano_baleares_dag():
    @task
    def aggregate() -> Asset:
        gold.aggregate()
        return GOLD_ASSET

    aggregate()


abastecimiento_urbano_baleares_dag()
