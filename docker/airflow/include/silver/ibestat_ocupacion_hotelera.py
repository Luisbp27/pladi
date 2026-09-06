"""Limpia datos de ocupacion hotelera -> MinIO silver/ibestat/."""
from __future__ import annotations

import tempfile

import polars as pl

from include.config import BUCKET, get_s3_client, silver_path
from include.parsers.ibestat import read_ibestat_csv
from include.silver.ibestat import DELTA_STORAGE_OPTIONS, enrich_geo, filter_municipal, filter_valid, parse_time_period

MEDIDAS_MAP = {
    "GRADO_OCUPACION_PLAZA_TURISTICA": "ocupacion_plazas_pct",
    "GRADO_OCUPACION_HABITACION_TURISTICA": "ocupacion_habitaciones_pct",
    "GRADO_OCUPACION_PLAZA_TURISTICA_FIN_SEMANA": "ocupacion_finde_pct",
}


def clean(source_path: str, **context) -> str:
    client = get_s3_client()

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=True) as tmp:
        client.download_file(BUCKET, source_path, tmp.name)
        df = read_ibestat_csv(tmp.name)

    df = filter_valid(df)
    df = filter_municipal(df)

    from airflow.providers.postgres.hooks.postgres import PostgresHook

    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")

    times = df["cod_tiempo"].unique().to_list()
    time_map = {}
    for t in times:
        parsed = parse_time_period(t)
        if "mes" in parsed:
            time_map[t] = (parsed["anio"], parsed["mes"])

    df = df.filter(pl.col("cod_tiempo").is_in(list(time_map.keys())))

    df = df.with_columns([
        pl.col("cod_tiempo").replace_strict(
            {t: v[0] for t, v in time_map.items()}
        ).alias("anio"),
        pl.col("cod_tiempo").replace_strict(
            {t: v[1] for t, v in time_map.items()}
        ).alias("mes"),
    ])

    df = df.with_columns(
        (pl.col("obs_value") / 100.0).round(4)
    )

    df = df.with_columns(
        pl.col("cod_medida").replace_strict(MEDIDAS_MAP, default=pl.col("cod_medida"))
    )

    df = df.pivot(
        on="cod_medida",
        values="obs_value",
        index=["cod_territorio", "anio", "mes"],
    )

    df = df.rename({"cod_territorio": "cod_municipio_ine"})

    expected_cols = ["ocupacion_plazas_pct", "ocupacion_habitaciones_pct", "ocupacion_finde_pct"]
    for col in expected_cols:
        if col not in df.columns:
            df = df.with_columns(pl.lit(None, dtype=pl.Float64).alias(col))

    df = enrich_geo(df, pg_hook)

    df = df.select([
        "cod_provincia_ine", "nombre_provincia",
        "cod_municipio_ine", "nombre_municipio",
        "anio", "mes",
        "ocupacion_plazas_pct", "ocupacion_habitaciones_pct", "ocupacion_finde_pct",
    ])

    output_path = f"s3://{BUCKET}/{silver_path("ibestat")}ocupacion_hotelera/"
    df.write_delta(
        output_path,
        mode="overwrite",
        storage_options=DELTA_STORAGE_OPTIONS,
    )

    return output_path
