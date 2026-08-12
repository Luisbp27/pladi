"""Gold: abastecimiento urbano Baleares (silver 4 islas → PostGIS)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.gold import abastecimiento_urbano_baleares as gold


@dag(
    dag_id="abastecimiento_urbano_baleares",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["gold", "dgrh"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Gold: agrega abastecimiento urbano de las 4 islas → PostGIS",
)
def abastecimiento_urbano_baleares_dag():
    @task
    def aggregate() -> str:
        return gold.aggregate()

    aggregate()


abastecimiento_urbano_baleares_dag()
