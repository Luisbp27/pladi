"""Ingesta IBESTAT: Ocupacion Apartamentos Turisticos."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import ibestat_ocupacion_apartamentos_turisticos as bronze
from include.gold import ocupacion_turistica as gold
from include.silver import ibestat_ocupacion_apartamentos_turisticos as silver


@dag(
    dag_id="ibestat_ocupacion_apartamentos_turisticos",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ibestat"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta IBESTAT: ocupacion apartamentos turisticos (extract -> clean -> gold)",
)
def ocupacion_apartamentos_turisticos():
    @task
    def extract() -> str:
        return bronze.extract()

    @task
    def clean(source_path: str | None = None) -> str:
        return silver.clean(source_path)

    @task
    def load_gold(source_path: str | None = None) -> str:
        return gold.load()

    extract_result = extract()
    clean_result = clean(source_path=extract_result)
    load_gold(source_path=clean_result)


ocupacion_apartamentos_turisticos()
