"""Ingesta DGRH: Abastecimiento Urbano Menorca."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.bronze import dgrh_abastecimiento_urbano_menorca as bronze
from include.silver import dgrh_abastecimiento_urbano_menorca as silver


@dag(
    dag_id="dgrh_abastecimiento_urbano_menorca",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["dgrh"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Ingesta DGRH: abastecimiento urbano de Menorca (extract -> clean)",
)
def abastecimiento_urbano_menorca():
    @task
    def extract() -> str:
        return bronze.extract()

    @task
    def clean(source_path: str | None = None) -> str:
        return silver.clean(source_path)

    clean(source_path=extract())


abastecimiento_urbano_menorca()
