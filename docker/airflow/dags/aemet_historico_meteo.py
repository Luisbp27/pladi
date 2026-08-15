"""Ingesta AEMET: Historico meteorologico."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset

from include.bronze import aemet_historico_meteo as bronze
from include.silver import aemet_historico_meteo as silver

AEMET_HIST_ASSET = Asset("pladi://silver/aemet/historico_meteo")


@dag(
    dag_id="aemet_historico_meteo",
    schedule="@monthly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["aemet"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta AEMET: datos historicos meteorologicos (extract -> clean)",
)
def historico_meteo():
    @task
    def extract() -> str:
        return bronze.extract()

    @task
    def clean(source_path: str | None = None) -> Asset:
        silver.clean(source_path)
        return AEMET_HIST_ASSET

    clean(source_path=extract())


historico_meteo()
