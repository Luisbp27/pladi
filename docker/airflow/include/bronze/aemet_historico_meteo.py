"""Extrae historico diario AEMET -> MinIO bronze/aemet/historico_meteo/.

Incremental: comprueba la ultima fecha presente en silver y solo pide a
AEMET lo que falta (con solape desde el primer dia del mes de esa fecha).
Ventanas de maximo 6 meses por estacion (limite de la API).
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone

import polars as pl
from airflow.models import Variable

from include.bronze.aemet import aemet_request
from include.config import BUCKET, bronze_path, get_s3_client
from include.silver.ibestat import DELTA_STORAGE_OPTIONS

DIARIOS_URL = (
    "https://opendata.aemet.es/opendata/api/valores/climatologicos/diarios/"
    "datos/fechaini/{ini}/fechafin/{fin}/estacion/{idema}"
)

SILVER_PATH = "s3://{bucket}/silver/aemet/historico_meteo/"
CATALOGO_PATH = "s3://{bucket}/silver/aemet/estaciones/"


def _read_silver_delta(path: str) -> pl.DataFrame:
    try:
        return pl.read_delta(path, storage_options=DELTA_STORAGE_OPTIONS)
    except Exception:
        return None


def _get_catalog() -> list[str]:
    df = _read_silver_delta(CATALOGO_PATH.format(bucket=BUCKET))
    if df is None:
        raise ValueError("No existe silver/aemet/estaciones — ejecuta aemet_estaciones primero")
    return sorted(df["indicativo"].unique().to_list())


def _detect_range() -> tuple[datetime, datetime]:
    end = datetime.now().replace(day=1) - timedelta(days=1)  # ultimo dia mes anterior
    df = _read_silver_delta(SILVER_PATH.format(bucket=BUCKET))
    if df is None or df.height == 0:
        return datetime(2015, 1, 1), end
    last = df["fecha"].max()
    start = datetime(last.year, last.month, 1)  # solape: desde el dia 1 del mes
    return start, end


def _aemet_get(url: str) -> list:
    meta = aemet_request(url)
    if meta.get("datos") is None:
        return []
    return aemet_request(meta["datos"])


def extract(**context) -> str:
    api_key = Variable.get("AEMET_API_KEY", default_var=None)
    if not api_key:
        raise ValueError("Variable AEMET_API_KEY no definida en Airflow")

    start, end = _detect_range()
    if start > end:
        return bronze_path("aemet") + "historico_meteo/"

    estaciones = _get_catalog()
    client = get_s3_client()
    prefix = bronze_path("aemet") + "historico_meteo/"
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    for idema in estaciones:
        window_ini = start
        while window_ini <= end:
            window_fin = min(end, window_ini + timedelta(days=180))
            url = DIARIOS_URL.format(
                ini=window_ini.strftime("%Y-%m-%dT00:00:00UTC"),
                fin=window_fin.strftime("%Y-%m-%dT00:00:00UTC"),
                idema=idema,
            )
            data = _aemet_get(f"{url}?api_key={api_key}")
            if data:
                key = f"{prefix}{idema}_{window_ini:%Y%m%d}_{ts}.json"
                client.put_object(
                    Bucket=BUCKET,
                    Key=key,
                    Body=json.dumps(data, ensure_ascii=False),
                )
            time.sleep(0.5)
            window_ini = window_fin + timedelta(days=1)
        time.sleep(0.5)

    return prefix
