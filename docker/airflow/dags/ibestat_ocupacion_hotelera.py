"""Ingesta IBESTAT: Ocupacion Hotelera."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import ibestat_ocupacion_hotelera as bronze
from include.gold import ocupacion_turistica as gold
from include.silver import ibestat_ocupacion_hotelera as silver


@dag(
    dag_id="ibestat_ocupacion_hotelera",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ibestat"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta IBESTAT: ocupacion hotelera (extract -> clean -> gold)",
)
def ocupacion_hotelera():
    @task
    def extract() -> str:
        return bronze.extract()

    @task
    def clean(source_path: str | None = None) -> str:
        return silver.clean(source_path)

    @task
    def load_gold(source_path: str | None = None) -> str:
        return gold.load()

    extract() >> clean() >> load_gold()


ocupacion_hotelera()
