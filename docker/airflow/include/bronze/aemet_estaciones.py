"""Extrae catalogo de estaciones AEMET -> MinIO bronze/aemet/estaciones/."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from airflow.models import Variable

from include.bronze.aemet import aemet_request
from include.config import BUCKET, bronze_path, get_s3_client

INVENTARIO_URL = (
    "https://opendata.aemet.es/opendata/api/valores/climatologicos/"
    "inventarioestaciones/todasestaciones"
)


def extract(**context) -> str:
    api_key = Variable.get("AEMET_API_KEY", default_var=None)
    if not api_key:
        raise ValueError("Variable AEMET_API_KEY no definida en Airflow")

    meta = aemet_request(f"{INVENTARIO_URL}?api_key={api_key}")
    if meta.get("datos") is None:
        raise ValueError("Inventario de estaciones AEMET sin datos")

    data = aemet_request(meta["datos"])

    client = get_s3_client()
    prefix = bronze_path("aemet") + "estaciones/"
    key = f"{prefix}{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    client.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False),
    )

    return prefix
