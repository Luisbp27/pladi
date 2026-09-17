"""Carga poblacion municipal (padron IBESTAT 1998-2025) desde silver → PostGIS gold.censo_municipal_baleares."""
from __future__ import annotations

import os
import tempfile

import polars as pl
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import BUCKET, get_s3_client, silver_path

UPSERT_SQL = """
    INSERT INTO gold.censo_municipal_baleares (
        cod_provincia_ine, nombre_provincia,
        cod_municipio_ine, nombre_municipio,
        anio, poblacion
    ) VALUES (
        %(cod_provincia_ine)s, %(nombre_provincia)s,
        %(cod_municipio_ine)s, %(nombre_municipio)s,
        %(anio)s, %(poblacion)s
    )
    ON CONFLICT (cod_municipio_ine, anio) DO UPDATE SET
        nombre_municipio = EXCLUDED.nombre_municipio,
        cod_provincia_ine = EXCLUDED.cod_provincia_ine,
        nombre_provincia = EXCLUDED.nombre_provincia,
        poblacion = EXCLUDED.poblacion,
        updated_at = now()
"""


def _read_silver(client) -> pl.DataFrame:
    prefix = silver_path("ibestat") + "censo_baleares/"
    with tempfile.TemporaryDirectory() as tmpdir:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                local_file = os.path.join(tmpdir, os.path.relpath(key, prefix))
                os.makedirs(os.path.dirname(local_file), exist_ok=True)
                client.download_file(BUCKET, key, local_file)
        return pl.read_delta(tmpdir)


def load(**context) -> str:
    client = get_s3_client()
    df = _read_silver(client)

    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = pg_hook.get_conn()
    cur = conn.cursor()

    columns = [
        "cod_provincia_ine", "nombre_provincia",
        "cod_municipio_ine", "nombre_municipio",
        "anio", "poblacion",
    ]
    rows = df.select(columns).to_dicts()

    for row in rows:
        cur.execute(UPSERT_SQL, row)
    conn.commit()
    cur.close()
    conn.close()

    return "gold.censo_municipal_baleares"
