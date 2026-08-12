"""Ingesta AEMET: Estaciones meteorologicas."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import aemet_estaciones as bronze
from include.silver import aemet_estaciones as silver


@dag(
    dag_id="aemet_estaciones",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["aemet"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta AEMET: catalogo de estaciones meteorologicas (extract -> clean)",
)
def estaciones():
    @task
    def extract() -> str:
        return bronze.extract()

    @task
    def clean(source_path: str | None = None) -> str:
        return silver.clean(source_path)

    extract() >> clean()


estaciones()
