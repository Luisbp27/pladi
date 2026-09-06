"""Carga ocupacion turistica desde silver IBESTAT → PostGIS gold.ocupacion_turistica.

Unifica hotelera y apartamentos en una sola tabla.
"""
from __future__ import annotations

import os
import tempfile

import polars as pl
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import BUCKET, get_s3_client, silver_path

SILVER_SOURCES = [
    ("ocupacion_hotelera", "hotelera"),
    ("ocupacion_apartamentos_turisticos", "apartamentos"),
]

UPSERT_SQL = """
    INSERT INTO gold.ocupacion_turistica (
        cod_provincia_ine, nombre_provincia,
        cod_municipio_ine, nombre_municipio,
        anio, mes, tipo_alojamiento, ocupacion_plazas_pct
    ) VALUES (
        %(cod_provincia_ine)s, %(nombre_provincia)s,
        %(cod_municipio_ine)s, %(nombre_municipio)s,
        %(anio)s, %(mes)s, %(tipo_alojamiento)s, %(ocupacion_plazas_pct)s
    )
    ON CONFLICT (cod_municipio_ine, anio, mes, tipo_alojamiento) DO UPDATE SET
        nombre_municipio = EXCLUDED.nombre_municipio,
        cod_provincia_ine = EXCLUDED.cod_provincia_ine,
        nombre_provincia = EXCLUDED.nombre_provincia,
        ocupacion_plazas_pct = EXCLUDED.ocupacion_plazas_pct,
        updated_at = now()
"""


def _read_silver(client, source_id: str) -> pl.DataFrame:
    prefix = silver_path("ibestat") + source_id + "/"
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

    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = pg_hook.get_conn()
    cur = conn.cursor()

    for source_id, tipo in SILVER_SOURCES:
        df = _read_silver(client, source_id)

        if "ocupacion_plazas_pct" not in df.columns:
            continue

        df = df.with_columns(pl.lit(tipo).alias("tipo_alojamiento"))

        columns = [
            "cod_provincia_ine", "nombre_provincia",
            "cod_municipio_ine", "nombre_municipio",
            "anio", "mes", "tipo_alojamiento", "ocupacion_plazas_pct",
        ]
        rows = df.select(columns).to_dicts()

        for row in rows:
            cur.execute(UPSERT_SQL, row)
        conn.commit()

    cur.close()
    conn.close()

    return "gold.ocupacion_turistica"
