"""Limpia datos de censo baleares -> MinIO silver/ibestat/."""
from __future__ import annotations

import tempfile

import polars as pl

from include.config import BUCKET, get_s3_client, silver_path
from include.parsers.ibestat import read_ibestat_csv
from include.silver.ibestat import DELTA_STORAGE_OPTIONS, enrich_geo, filter_municipal, filter_valid, parse_time_period


def clean(source_path: str, **context) -> str:
    client = get_s3_client()

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=True) as tmp:
        client.download_file(BUCKET, source_path, tmp.name)
        df = read_ibestat_csv(tmp.name)

    df = df.filter(pl.col("cod_sexo") == "_T")
    df = filter_valid(df)
    df = filter_municipal(df)

    df = df.group_by(["cod_territorio", "cod_tiempo"]).agg(
        pl.col("obs_value").sum().cast(pl.Int64).alias("poblacion")
    )

    times = df["cod_tiempo"].unique().to_list()
    time_map = {t: parse_time_period(t)["anio"] for t in times}
    df = df.with_columns(
        pl.col("cod_tiempo").replace_strict(time_map).alias("anio")
    )

    df = df.rename({"cod_territorio": "cod_municipio_ine"})
    df = df.select(["cod_municipio_ine", "anio", "poblacion"])

    from airflow.providers.postgres.hooks.postgres import PostgresHook

    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    df = enrich_geo(df, pg_hook)

    df = df.select([
        "cod_provincia_ine", "nombre_provincia",
        "cod_municipio_ine", "nombre_municipio",
        "anio", "poblacion",
    ])

    output_path = f"s3://{BUCKET}/{silver_path("ibestat")}censo_baleares/"
    df.write_delta(
        output_path,
        mode="overwrite",
        storage_options=DELTA_STORAGE_OPTIONS,
    )

    return output_path
