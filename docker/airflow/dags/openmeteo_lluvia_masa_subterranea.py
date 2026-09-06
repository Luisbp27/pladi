"""Ingesta Open-Meteo: lluvia por masa subterranea (extract -> clean)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset

from include.bronze import openmeteo_lluvia_masa_subterranea as bronze
from include.silver import openmeteo_lluvia_masa_subterranea as silver

OPENMETEO_ASSET = Asset("pladi://silver/openmeteo/lluvia_masa_subterranea")


@dag(
    dag_id="openmeteo_lluvia_masa_subterranea",
    schedule="@monthly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["openmeteo"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta Open-Meteo: precipitacion diaria por masa subterranea sin estacion AEMET",
)
def openmeteo_lluvia_masa_subterranea():
    @task
    def extract() -> str:
        return bronze.extract()

    @task
    def clean(source_path: str | None = None) -> Asset:
        silver.clean(source_path)
        return OPENMETEO_ASSET

    clean(source_path=extract())


openmeteo_lluvia_masa_subterranea()
