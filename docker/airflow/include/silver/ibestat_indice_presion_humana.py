"""Limpia datos de indice presion humana -> MinIO silver/ibestat/."""
from __future__ import annotations

import tempfile

import polars as pl

from include.config import BUCKET, get_s3_client, silver_path
from include.parsers.ibestat import read_ibestat_csv
from include.silver.ibestat import DELTA_STORAGE_OPTIONS, filter_valid, parse_time_period

NUTS_ISLA = {
    "ES532": "Mallorca",
    "ES533": "Menorca",
    "ES531": "Eivissa i Formentera",
}


def clean(source_path: str, **context) -> str:
    client = get_s3_client()

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=True) as tmp:
        client.download_file(BUCKET, source_path, tmp.name)
        df = read_ibestat_csv(tmp.name)

    df = filter_valid(df)

    df = df.filter(pl.col("cod_territorio").is_in(list(NUTS_ISLA.keys())))

    times = df["cod_tiempo"].unique().to_list()
    time_map = {}
    for t in times:
        parsed = parse_time_period(t)
        time_map[t] = (parsed["anio"], parsed["mes"])

    df = df.with_columns([
        pl.col("cod_tiempo").replace_strict(
            {t: v[0] for t, v in time_map.items()}
        ).alias("anio"),
        pl.col("cod_tiempo").replace_strict(
            {t: v[1] for t, v in time_map.items()}
        ).alias("mes"),
    ])

    df = df.group_by(["cod_territorio", "anio", "mes"]).agg(
        pl.col("obs_value").mean().cast(pl.Int64).alias("iph")
    )

    df = df.with_columns([
        pl.col("cod_territorio").replace_strict(NUTS_ISLA).alias("nombre_isla"),
        pl.lit("07").alias("cod_provincia_ine"),
        pl.lit("Illes Balears").alias("nombre_provincia"),
    ])

    df = df.select([
        "cod_provincia_ine", "nombre_provincia",
        "nombre_isla", "anio", "mes", "iph",
    ])

    output_path = f"{silver_path("ibestat")}indice_presion_humana/"
    df.write_delta(
        output_path,
        mode="overwrite",
        storage_options=DELTA_STORAGE_OPTIONS,
    )

    return output_path
