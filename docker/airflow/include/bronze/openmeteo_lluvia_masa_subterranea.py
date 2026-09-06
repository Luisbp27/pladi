"""Extrae precipitacion Open-Meteo por masa -> MinIO bronze/openmeteo/masa/.

Cubre las masas SIN estacion AEMET valida. Incremental: pide desde
(ultima fecha en silver - 30 dias) para capturar revisiones.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone

import polars as pl
import requests
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import BUCKET, bronze_path, get_s3_client
from include.silver.ibestat import DELTA_STORAGE_OPTIONS

ARCHIVE_URL = (
    "https://archive-api.open-meteo.com/v1/archive"
    "?latitude={lat}&longitude={lon}&start_date={ini}&end_date={fin}"
    "&daily=precipitation_sum&timezone=Europe/Madrid"
)

SILVER_PATH = "s3://{bucket}/silver/openmeteo/lluvia_masa_subterranea/"
CATALOGO_PATH = "s3://{bucket}/silver/aemet/estaciones/"


def _read_silver_delta(path: str) -> pl.DataFrame | None:
    try:
        return pl.read_delta(path, storage_options=DELTA_STORAGE_OPTIONS)
    except Exception:
        return None


def _get_valid_stations() -> list[str]:
    df = _read_silver_delta(CATALOGO_PATH.format(bucket=BUCKET))
    if df is None:
        raise ValueError("No existe silver/aemet/estaciones — ejecuta aemet_estaciones primero")
    return df["indicativo"].unique().to_list()


def _get_masas_sin_estacion(pg_hook, validas: list[str]) -> list[dict]:
    conn = pg_hook.get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.cod_masa,
               ST_Y(ST_PointOnSurface(m.geometry)) AS lat,
               ST_X(ST_PointOnSurface(m.geometry)) AS lon
        FROM public.masa_subterranea m
        WHERE NOT EXISTS (
            SELECT 1 FROM public.masa_subterranea_estacion_aemet e
            WHERE e.cod_masa = m.cod_masa AND e.cod_estacion = ANY(%s)
        )
        ORDER BY m.cod_masa
        """,
        (validas,),
    )
    rows = [{"cod_masa": r[0], "lat": r[1], "lon": r[2]} for r in cur.fetchall()]
    conn.close()
    return rows


def _detect_start() -> datetime:
    df = _read_silver_delta(SILVER_PATH.format(bucket=BUCKET))
    if df is None or df.height == 0:
        return datetime(2015, 1, 1)
    return datetime.fromordinal(df["fecha"].max().toordinal()) - timedelta(days=30)


def _get_openmeteo(url: str) -> dict:
    for attempt in range(70):
        resp = requests.get(url, timeout=(15, 120))
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                wait = min(int(retry_after), 60)
            elif "Hourly" in resp.text:
                wait = 60
            else:
                wait = min(2**attempt, 30)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Demasiados 429 en {url}")


def extract(**context) -> str:
    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    validas = _get_valid_stations()
    masas = _get_masas_sin_estacion(pg_hook, validas)

    start = _detect_start()
    fin = datetime.now().date()
    if start.date() > fin:
        return bronze_path("openmeteo") + "masa/"

    client = get_s3_client()
    prefix = bronze_path("openmeteo") + "masa/"
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    for masa in masas:
        url = ARCHIVE_URL.format(
            lat=round(masa["lat"], 4),
            lon=round(masa["lon"], 4),
            ini=start.strftime("%Y-%m-%d"),
            fin=fin.strftime("%Y-%m-%d"),
        )
        resp = _get_openmeteo(url)
        key = f"{prefix}{masa['cod_masa']}_{ts}.json"
        client.put_object(
            Bucket=BUCKET, Key=key, Body=json.dumps(resp)
        )
        time.sleep(1.0)

    return prefix
