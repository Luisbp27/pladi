"""Limpia catalogo de estaciones AEMET -> MinIO silver/aemet/estaciones/.

Enriquece cada estacion con el municipio y la provincia de la dimension
geografica via spatial join (ST_Contains) con public.municipio.
"""
from __future__ import annotations

import os
import tempfile

import polars as pl

from include.config import BUCKET, get_s3_client, silver_path
from include.silver.ibestat import DELTA_STORAGE_OPTIONS


def _dms_to_decimal(value: str) -> float:
    value = value.strip()
    hemi = value[-1].upper()
    num = value[:-1]
    if len(num) % 2 == 1:
        num = "0" + num
    deg = int(num[:2])
    minutes = int(num[2:4]) if len(num) >= 4 else 0
    seconds = int(num[4:6]) if len(num) >= 6 else 0
    dec = deg + minutes / 60 + seconds / 3600
    if hemi in ("S", "W"):
        dec = -dec
    return dec


def clean(source_path: str, **context) -> str:
    client = get_s3_client()

    with tempfile.TemporaryDirectory() as tmpdir:
        paginator = client.get_paginator("list_objects_v2")
        files = []
        for page in paginator.paginate(Bucket=BUCKET, Prefix=source_path):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                local = os.path.join(tmpdir, os.path.basename(key))
                client.download_file(BUCKET, key, local)
                files.append(local)

        if not files:
            raise ValueError(f"No hay ficheros en bronze: {source_path}")

        df = pl.concat([pl.read_json(f) for f in files]).unique(
            subset=["indicativo"], keep="last"
        )

    df = df.filter(
        pl.col("provincia").str.to_uppercase().is_in(["BALEARES", "ILLES BALEARS"])
    )

    df = df.with_columns([
        pl.col("latitud").map_elements(
            _dms_to_decimal, return_dtype=pl.Float64
        ).alias("lat"),
        pl.col("longitud").map_elements(
            _dms_to_decimal, return_dtype=pl.Float64
        ).alias("lon"),
    ])

    from airflow.providers.postgres.hooks.postgres import PostgresHook

    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = pg_hook.get_conn()
    cur = conn.cursor()

    geo = {}
    for row in df.iter_rows(named=True):
        indicativo = row["indicativo"]
        cur.execute(
            """
            SELECT m.cod_municipio, m.nombre_municipio, m.cod_provincia, p.nombre_provincia
            FROM public.municipio m
            JOIN public.provincia p USING (cod_provincia)
            WHERE ST_Contains(m.geometry, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            LIMIT 1
            """,
            (row["lon"], row["lat"]),
        )
        res = cur.fetchone()
        if res is None:
            # Fallback: municipio mas cercano (estaciones en el borde/islotes)
            cur.execute(
                """
                SELECT m.cod_municipio, m.nombre_municipio, m.cod_provincia, p.nombre_provincia
                FROM public.municipio m
                JOIN public.provincia p USING (cod_provincia)
                ORDER BY m.geometry <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                LIMIT 1
                """,
                (row["lon"], row["lat"]),
            )
            res = cur.fetchone()
            if res is None:
                raise ValueError(
                    f"Estacion sin municipio asignable: {indicativo}"
                )
        geo[indicativo] = res
    conn.close()

    df = df.with_columns([
        pl.col("indicativo")
        .replace_strict({k: v[0] for k, v in geo.items()})
        .alias("cod_municipio"),
        pl.col("indicativo")
        .replace_strict({k: v[1] for k, v in geo.items()})
        .alias("nombre_municipio"),
        pl.col("indicativo")
        .replace_strict({k: v[2] for k, v in geo.items()})
        .alias("cod_provincia"),
        pl.col("indicativo")
        .replace_strict({k: v[3] for k, v in geo.items()})
        .alias("nombre_provincia"),
    ])
    df = df.drop(["latitud", "longitud", "provincia"])

    output_path = f"s3://{BUCKET}/{silver_path("aemet")}estaciones/"
    df.write_delta(
        output_path,
        mode="overwrite",
        storage_options=DELTA_STORAGE_OPTIONS,
    )

    return output_path
