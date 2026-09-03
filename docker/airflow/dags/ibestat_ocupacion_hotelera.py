"""Ingesta IBESTAT: Ocupacion Hotelera."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset
from include.bronze import ibestat_ocupacion_hotelera as bronze
from include.gold import ocupacion_turistica as gold
from include.silver import ibestat_ocupacion_hotelera as silver

GOLD_ASSET = Asset("pladi://gold/ocupacion_turistica")


@dag(
    dag_id="ibestat_ocupacion_hotelera",
    schedule="@monthly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
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
    def load_gold(source_path: str | None = None) -> Asset:
        gold.load()
        return GOLD_ASSET

    extract_result = extract()
    clean_result = clean(source_path=extract_result)
    load_gold(source_path=clean_result)


ocupacion_hotelera()
