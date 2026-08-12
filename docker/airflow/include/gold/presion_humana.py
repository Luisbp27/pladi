"""Carga IPH desde silver IBESTAT → PostGIS gold.presion_humana."""
from __future__ import annotations

import os
import tempfile

import polars as pl
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import BUCKET, get_s3_client, silver_path

UPSERT_SQL = """
    INSERT INTO gold.presion_humana (
        cod_provincia_ine, nombre_provincia, nombre_isla,
        anio, mes, iph
    ) VALUES (
        %(cod_provincia_ine)s, %(nombre_provincia)s, %(nombre_isla)s,
        %(anio)s, %(mes)s, %(iph)s
    )
    ON CONFLICT (nombre_isla, anio, mes) DO UPDATE SET
        iph = EXCLUDED.iph,
        updated_at = now()
"""


def _read_silver(client) -> pl.DataFrame:
    prefix = silver_path("ibestat") + "indice_presion_humana/"
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
        "cod_provincia_ine", "nombre_provincia", "nombre_isla",
        "anio", "mes", "iph",
    ]
    rows = df.select(columns).to_dicts()

    for row in rows:
        cur.execute(UPSERT_SQL, row)
    conn.commit()
    cur.close()
    conn.close()

    return "gold.presion_humana"
