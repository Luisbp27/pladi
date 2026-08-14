"""Ingesta IBESTAT: Indice de Presion Humana."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import ibestat_indice_presion_humana as bronze
from include.gold import presion_humana as gold
from include.silver import ibestat_indice_presion_humana as silver


@dag(
    dag_id="ibestat_indice_presion_humana",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ibestat"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta IBESTAT: indice de presion humana (extract -> clean -> gold)",
)
def indice_presion_humana():
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


indice_presion_humana()
