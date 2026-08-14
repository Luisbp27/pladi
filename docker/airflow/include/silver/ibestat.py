"""Helpers compartidos para limpieza de datos IBESTAT (silver layer)."""
from __future__ import annotations

import os

import polars as pl

DELTA_STORAGE_OPTIONS = {
    "AWS_ENDPOINT_URL": "http://minio:9000",
    "AWS_ACCESS_KEY_ID": os.environ.get("MINIO_ROOT_USER", "pladi"),
    "AWS_SECRET_ACCESS_KEY": os.environ.get("MINIO_ROOT_PASSWORD", "pladi2024"),
    "AWS_REGION": "us-east-1",
    "AWS_ALLOW_HTTP": "true",
    "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
}


def parse_time_period(cod_tiempo: str | int) -> dict[str, int | None]:
    cod_tiempo = str(cod_tiempo)
    if "-" not in cod_tiempo:
        return {"anio": int(cod_tiempo)}
    parts = cod_tiempo.split("-")
    if len(parts) == 2:
        anio = int(parts[0])
        mes_part = parts[1].lstrip("M")
        if mes_part.isdigit():
            return {"anio": anio, "mes": int(mes_part)}
        return {"anio": anio}
    if len(parts) == 3:
        return {"anio": int(parts[0]), "mes": int(parts[1]), "dia": int(parts[2])}
    return {"anio": int(cod_tiempo)}


def filter_valid(df: pl.DataFrame) -> pl.DataFrame:
    if "obs_value" not in df.columns:
        return df
    return df.filter(pl.col("obs_value").is_not_null())


def filter_municipal(df: pl.DataFrame) -> pl.DataFrame:
    if "cod_territorio" not in df.columns:
        return df
    df = df.with_columns(pl.col("cod_territorio").cast(pl.Utf8))
    return df.filter(
        pl.col("cod_territorio").str.len_chars() == 5,
        pl.col("cod_territorio").str.starts_with("07"),
    )


def enrich_geo(df: pl.DataFrame, pg_hook) -> pl.DataFrame:
    import polars as pl

    conn = pg_hook.get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.cod_municipio, m.nombre_municipio, m.cod_provincia, p.nombre_provincia
        FROM public.municipio m
        JOIN public.provincia p USING (cod_provincia)
        """
    )
    geo = {row[0]: (row[1], row[2], row[3]) for row in cur.fetchall()}
    cur.close()
    conn.close()

    df = df.with_columns([
        pl.col("cod_municipio_ine")
        .replace_strict({k: v[0] for k, v in geo.items()})
        .alias("nombre_municipio"),
        pl.col("cod_municipio_ine")
        .replace_strict({k: v[1] for k, v in geo.items()})
        .alias("cod_provincia_ine"),
        pl.col("cod_municipio_ine")
        .replace_strict({k: v[2] for k, v in geo.items()})
        .alias("nombre_provincia"),
    ])

    return df
