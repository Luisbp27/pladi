"""ML: retrain del modelo de consumo urbano (67 GBM por municipio) -> MinIO + registry.

- Trigger: AssetAny de los golds que alimentan el panel (consumo, IPH, ocupacion, lluvia)
  + trigger manual como fallback.
- Guardrail: no publica si el MAPE del holdout supera el de la version activa + 2pp.
- El bundle queda en s3://pladi/ml/simulacion/v{version}/ y la version se activa en
  ml.model_versions (la FastAPI la descarga al arrancar).
"""
from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import polars as pl
from airflow.decorators import dag, task
from airflow.sdk.definitions.asset import Asset, AssetAny

from include.ml import entrenar, panel as panel_mod, publicar

ABAST_ASSET = Asset("pladi://gold/abastecimiento_urbano_baleares")
PRESION_ASSET = Asset("pladi://gold/presion_humana")
OCUP_ASSET = Asset("pladi://gold/ocupacion_turistica")
LLUVIA_ASSET = Asset("pladi://gold/lluvia_masa_subterranea")

PANEL_PATH = "/tmp/pladi_ml_panel.parquet"


@dag(
    dag_id="modelo_consumo_urbano",
    schedule=AssetAny(ABAST_ASSET, PRESION_ASSET, OCUP_ASSET, LLUVIA_ASSET),
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ml", "gold"],
    default_args={
        "owner": "pladi",
        "retries": 2,
        "retry_delay": timedelta(minutes=5),
    },
    description="ML: entrena el modelo de consumo urbano (67 GBM) y publica el bundle a MinIO + registry (guardrail MAPE)",
)
def modelo_consumo_urbano():
    @task
    def construir_panel() -> str:
        df = panel_mod.construir_panel()
        Path(PANEL_PATH).parent.mkdir(parents=True, exist_ok=True)
        df.write_parquet(PANEL_PATH)
        return f"panel OK: {df.height} filas x {df.width} columnas | base_anio {int(df['anio'].max())}"

    @task
    def entrenar_y_publicar(panel_info: str) -> dict:
        if not Path(PANEL_PATH).exists():
            raise RuntimeError("panel no disponible (revisa construir_panel)")
        panel = pl.read_parquet(PANEL_PATH)
        with tempfile.TemporaryDirectory(prefix="pladi-bundle-") as tmp:
            resumen = entrenar.entrenar(panel, Path(tmp))
            if resumen["n_modelos"] == 0:
                raise RuntimeError("0 modelos entrenados: revisa el panel y las fuentes gold")
            return publicar.publicar(Path(tmp), resumen)

    panel_info = construir_panel()
    entrenar_y_publicar(panel_info)


modelo_consumo_urbano()
