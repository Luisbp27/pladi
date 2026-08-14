"""Gold: lluvia mensual por masa subterranea (fusion AEMET + Open-Meteo)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from include.gold import lluvia_masa_subterranea as gold


@dag(
    dag_id="lluvia_masa_subterranea",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["gold", "aemet", "openmeteo"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Gold: precipitacion mensual por masa subterranea (fusion AEMET + Open-Meteo) -> PostGIS",
)
def lluvia_masa_subterranea_dag():
    @task
    def aggregate() -> str:
        return gold.aggregate()

    aggregate()


lluvia_masa_subterranea_dag()
