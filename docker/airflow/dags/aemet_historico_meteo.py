"""Ingesta AEMET: Historico meteorologico."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import aemet_historico_meteo as bronze
from include.silver import aemet_historico_meteo as silver


@dag(
    dag_id="aemet_historico_meteo",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
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
    def clean(source_path: str | None = None) -> str:
        return silver.clean(source_path)

    extract() >> clean()


historico_meteo()
