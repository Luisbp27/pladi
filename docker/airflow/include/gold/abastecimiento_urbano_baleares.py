"""Agrega abastecimiento urbano Baleares (4 islas) → PostGIS gold."""
import os
import tempfile

import polars as pl
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import get_s3_client, silver_path

SILVER_SOURCES = [
    "dgrh_abastecimiento_urbano_mallorca",
    "dgrh_abastecimiento_urbano_menorca",
    "dgrh_abastecimiento_urbano_ibiza",
    "dgrh_abastecimiento_urbano_formentera",
]

UPSERT_SQL = """
    INSERT INTO gold.abastecimiento_urbano_baleares (
        cod_municipio, nombre_municipio, cod_provincia, nombre_provincia, anio,
        subterranea_hm3, desalinizada_hm3, indiferenciada_hm3,
        superficial_hm3, potabilizada_hm3, rechazo_hm3,
        otros_destinos_hm3, total_suministrado_hm3, consumo_hm3
    ) VALUES (
        %(cod_municipio)s, %(nombre_municipio)s, %(cod_provincia)s, %(nombre_provincia)s, %(anio)s,
        %(subterranea_hm3)s, %(desalinizada_hm3)s, %(indiferenciada_hm3)s,
        %(superficial_hm3)s, %(potabilizada_hm3)s, %(rechazo_hm3)s,
        %(otros_destinos_hm3)s, %(total_suministrado_hm3)s, %(consumo_hm3)s
    )
    ON CONFLICT (cod_municipio, anio) DO UPDATE SET
        nombre_municipio = EXCLUDED.nombre_municipio,
        cod_provincia = EXCLUDED.cod_provincia,
        nombre_provincia = EXCLUDED.nombre_provincia,
        subterranea_hm3 = EXCLUDED.subterranea_hm3,
        desalinizada_hm3 = EXCLUDED.desalinizada_hm3,
        indiferenciada_hm3 = EXCLUDED.indiferenciada_hm3,
        superficial_hm3 = EXCLUDED.superficial_hm3,
        potabilizada_hm3 = EXCLUDED.potabilizada_hm3,
        rechazo_hm3 = EXCLUDED.rechazo_hm3,
        otros_destinos_hm3 = EXCLUDED.otros_destinos_hm3,
        total_suministrado_hm3 = EXCLUDED.total_suministrado_hm3,
        consumo_hm3 = EXCLUDED.consumo_hm3,
        updated_at = now()
"""


def _read_silver_sources(client):
    dfs = []
    for source in SILVER_SOURCES:
        prefix = silver_path("dgrh") + source + "/"
        with tempfile.TemporaryDirectory() as tmpdir:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket="pladi", Prefix=prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    local_file = os.path.join(
                        tmpdir, os.path.relpath(key, prefix)
                    )
                    os.makedirs(os.path.dirname(local_file), exist_ok=True)
                    client.download_file("pladi", key, local_file)
            df = pl.read_delta(tmpdir)
            dfs.append(df)
    return pl.concat(dfs, how="diagonal_relaxed")


def _build_municipio_mapping(cur):
    cur.execute("SELECT cod_municipio, nombre_municipio FROM public.municipio")
    name_to_code = {}
    for code, name in cur.fetchall():
        key = name.lower()
        name_to_code[key] = code
        if ", " in key:
            parts = key.split(", ")
            name_to_code[f"{parts[1]} {parts[0]}"] = code

    name_to_code["ciutadella"] = name_to_code.get("ciutadella de menorca")
    name_to_code["lloret de vista alegre"] = name_to_code.get(
        "lloret de vistalegre"
    )
    name_to_code["santa maria del camí"] = name_to_code.get(
        "santa maría del camí"
    )

    return name_to_code


def _enrich_metadata(df, cur):
    cur.execute(
        """
        SELECT m.cod_municipio, m.nombre_municipio, m.cod_provincia, p.nombre_provincia
        FROM public.municipio m
        JOIN public.provincia p USING (cod_provincia)
        """
    )
    info = {
        row[0]: (row[1], row[2], row[3]) for row in cur.fetchall()
    }

    df = df.with_columns([
        pl.col("cod_municipio")
        .replace_strict({k: v[0] for k, v in info.items()})
        .alias("nombre_municipio"),
        pl.col("cod_municipio")
        .replace_strict({k: v[1] for k, v in info.items()})
        .alias("cod_provincia"),
        pl.col("cod_municipio")
        .replace_strict({k: v[2] for k, v in info.items()})
        .alias("nombre_provincia"),
    ])

    return df


def aggregate(**context) -> str:
    client = get_s3_client()
    df = _read_silver_sources(client)

    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = pg_hook.get_conn()
    cur = conn.cursor()

    name_to_code = _build_municipio_mapping(cur)

    df = df.rename({"anyo": "anio"})
    df = df.with_columns(
        pl.col("municipio")
        .str.to_lowercase()
        .replace_strict(name_to_code, default=None)
        .alias("cod_municipio")
    )

    unmatched = df.filter(pl.col("cod_municipio").is_null())
    if unmatched.height > 0:
        unmatched_names = (
            unmatched.select("municipio").unique().to_series().to_list()
        )
        raise ValueError(
            f"Municipios sin correspondencia en PostGIS: {unmatched_names}"
        )

    df = _enrich_metadata(df, cur)
    df = df.drop("municipio")

    columns = [
        "cod_municipio", "nombre_municipio", "cod_provincia", "nombre_provincia", "anio",
        "subterranea_hm3", "desalinizada_hm3", "indiferenciada_hm3",
        "superficial_hm3", "potabilizada_hm3", "rechazo_hm3",
        "otros_destinos_hm3", "total_suministrado_hm3", "consumo_hm3",
    ]
    rows = df.select(columns).to_dicts()

    for row in rows:
        cur.execute(UPSERT_SQL, row)
    conn.commit()
    cur.close()
    conn.close()

    return "gold.abastecimiento_urbano_baleares"
