"""Gold: lluvia mensual por masa subterranea (fusion AEMET + Open-Meteo)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset, AssetAny

from include.gold import lluvia_masa_subterranea as gold

LLUVIA_ASSET = Asset("pladi://gold/lluvia_masa_subterranea")
AEMET_HIST_ASSET = Asset("pladi://silver/aemet/historico_meteo")
OPENMETEO_ASSET = Asset("pladi://silver/openmeteo/lluvia_masa_subterranea")


@dag(
    dag_id="lluvia_masa_subterranea",
    schedule=AssetAny(AEMET_HIST_ASSET, OPENMETEO_ASSET),
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["gold", "aemet", "openmeteo"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Gold: precipitacion mensual por masa subterranea (fusion AEMET + Open-Meteo) -> PostGIS",
)
def lluvia_masa_subterranea_dag():
    @task
    def aggregate() -> Asset:
        gold.aggregate()
        return LLUVIA_ASSET

    aggregate()


lluvia_masa_subterranea_dag()
