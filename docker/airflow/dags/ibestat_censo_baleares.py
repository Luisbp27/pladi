"""Ingesta IBESTAT: Censo de Baleares."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import ibestat_censo_baleares as bronze
from include.gold import censo_municipal as gold
from include.silver import ibestat_censo_baleares as silver


@dag(
    dag_id="ibestat_censo_baleares",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ibestat"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta IBESTAT: censo de poblacion de Baleares (extract -> clean -> gold)",
)
def censo_baleares():
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


censo_baleares()
