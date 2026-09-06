"""Gold: balance hidrico anual simplificado por masa (disparado por agua infiltrada)."""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset

from include.gold import balance_hidrico_baleares as gold

AGUA_INF_ASSET = Asset("pladi://gold/agua_infiltrada_masa_subterranea")
BALANCE_ASSET = Asset("pladi://gold/balance_hidrico_baleares")


@dag(
    dag_id="balance_hidrico_baleares",
    schedule=[AGUA_INF_ASSET],
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["gold", "dma"],
    default_args={
        "owner": "pladi",
        "retries": 3,
        "retry_delay": timedelta(minutes=5),
    },
    description="Gold: balance hidrico anual simplificado por masa (modelo DMA)",
)
def balance_hidrico_dag():
    @task
    def aggregate() -> Asset:
        gold.aggregate()
        return BALANCE_ASSET

    aggregate()


balance_hidrico_dag()
