"""Helpers compartidos para conformacion de datos DGRH (silver layer).

Enriquece el DataFrame normalizado con la dimension geografica
(public.municipio + public.provincia) a partir del nombre literal
de municipio que viene en los ficheros fuente.
"""
from __future__ import annotations

import polars as pl

# Nombres literales de los ficheros DGRH que no casan directo con la dimension.
# Clave: nombre tal cual llega del fichero (lowercase).
# Valor: nombre canonico en public.municipio (lowercase).
ALIASES = {
    "ciutadella": "ciutadella de menorca",
    "lloret de vista alegre": "lloret de vistalegre",
    "santa maria del camí": "santa maría del camí",
    "es migjorn gran": "migjorn gran, es",
}


def enrich_geo(df: pl.DataFrame, pg_hook) -> pl.DataFrame:
    conn = pg_hook.get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.cod_municipio, m.nombre_municipio, m.cod_provincia, p.nombre_provincia
        FROM public.municipio m
        JOIN public.provincia p USING (cod_provincia)
        """
    )
    info = {row[0]: (row[1], row[2], row[3]) for row in cur.fetchall()}
    cur.close()
    conn.close()

    name_to_code = {}
    for code, (nombre, _, _) in info.items():
        key = nombre.lower()
        name_to_code[key] = code
        if ", " in key:
            parts = key.split(", ")
            name_to_code[f"{parts[1]} {parts[0]}"] = code

    for alias, canon in ALIASES.items():
        name_to_code[alias] = name_to_code.get(canon)

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

    df = df.drop("municipio")

    return df
