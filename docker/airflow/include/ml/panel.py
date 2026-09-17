"""Construccion del tablon analitico (replica del notebook 08) desde las tablas gold.

Features finales: anio, iph_media, ocupacion_media, lluvia_anual_mm, lag1.
- IPH agregado por isla NUTS (Eivissa+Formentera comparten serie) en UN UNICO factor
  (`iph_media`): la ablacion 2026-09-12 (notebook 21) descarta quitar el IPH
  (sin ambos IPH el MAPE sube +1,82 pp > +0,3 pp) y descarta `iph_max`
  (redundante con |r|>0.85; +0,18 pp, dentro del umbral).
- Ocupacion: media anual por municipio, imputada a 0 (municipios sin turismo).
  Se conserva como feature (quitarla cuesta +3,57 pp) aunque no sea palanca de UI:
  su efecto causal sobre el consumo anual no esta identificado.
- Lluvia: suma anual por masa -> media de las masas del municipio; nulos = media global.
- lag1 = consumo del anio anterior (recursivo en prediccion).
- `poblacion` = padron municipal (gold.censo_municipal_baleares, 1998-2025). NO es feature:
  es el denominador del target per capita (decision 2026-09-12, notebook 22).
"""
from __future__ import annotations

import polars as pl
from airflow.providers.postgres.hooks.postgres import PostgresHook

FEATURES = ["anio", "iph_media", "ocupacion_media", "lluvia_anual_mm", "lag1"]
TRAIN_DESDE = 2016
TEST_START = 2022
ANIO_MIN = 2015

ISLA_MAP = {
    71: "Eivissa i Formentera",
    72: "Eivissa i Formentera",
    73: "Mallorca",
    74: "Menorca",
}


def _read_sql(sql: str) -> pl.DataFrame:
    hook = PostgresHook(postgres_conn_id="postgis_pladi")
    return pl.from_pandas(hook.get_pandas_df(sql))


def construir_panel() -> pl.DataFrame:
    abast = _read_sql(
        "SELECT cod_municipio, anio, consumo_hm3 FROM gold.abastecimiento_urbano_baleares"
    ).select(["cod_municipio", "anio", "consumo_hm3"])
    presion = _read_sql(
        "SELECT nombre_isla, anio, iph FROM gold.presion_humana WHERE iph IS NOT NULL"
    )
    ocup = _read_sql(
        "SELECT cod_municipio_ine, anio, ocupacion_plazas_pct FROM gold.ocupacion_turistica"
    )
    lluvia = _read_sql(
        "SELECT cod_masa, anio, precipitacion_mm FROM gold.lluvia_masa_subterranea"
    )
    mma = _read_sql("SELECT cod_masa, cod_municipio FROM public.municipio_masa_subterranea")
    mun = _read_sql(
        "SELECT cod_municipio, cod_provincia, nombre_municipio FROM public.municipio"
    ).select(["cod_municipio", "cod_provincia", "nombre_municipio"]).with_columns(
        pl.col("cod_provincia").cast(pl.Int64)
    )
    poblacion = _read_sql(
        "SELECT cod_municipio_ine AS cod_municipio, anio, poblacion "
        "FROM gold.censo_municipal_baleares"
    ).with_columns(
        pl.col("anio").cast(pl.Int64),
        pl.col("poblacion").cast(pl.Float64),
    )

    isla_map = pl.DataFrame({"cod_provincia": list(ISLA_MAP), "isla": list(ISLA_MAP.values())})

    iph = presion.group_by(["nombre_isla", "anio"]).agg(iph_media=pl.col("iph").mean())
    ocup_m = ocup.group_by(["cod_municipio_ine", "anio"]).agg(
        ocupacion_media=pl.col("ocupacion_plazas_pct").mean()
    )
    ll_m = (
        lluvia.group_by(["cod_masa", "anio"])
        .agg(lluvia_anual_mm=pl.col("precipitacion_mm").sum())
        .join(mma, on="cod_masa")
        .group_by(["cod_municipio", "anio"])
        .agg(lluvia_anual_mm=pl.col("lluvia_anual_mm").mean())
    )

    panel = (
        abast.join(mun, on="cod_municipio", how="left")
        .join(isla_map, on="cod_provincia", how="left")
        .join(iph, left_on=["isla", "anio"], right_on=["nombre_isla", "anio"], how="left")
        .join(
            ocup_m,
            left_on=["cod_municipio", "anio"],
            right_on=["cod_municipio_ine", "anio"],
            how="left",
        )
        .join(ll_m, on=["cod_municipio", "anio"], how="left")
        .join(poblacion, on=["cod_municipio", "anio"], how="left")
        .select(
            [
                "cod_municipio",
                "nombre_municipio",
                "isla",
                "anio",
                "consumo_hm3",
                "iph_media",
                "ocupacion_media",
                "lluvia_anual_mm",
                "poblacion",
            ]
        )
        .with_columns(
            pl.col("cod_municipio").cast(pl.Int64),
            pl.col("ocupacion_media").fill_null(0.0),
            pl.col("lluvia_anual_mm").fill_null(pl.col("lluvia_anual_mm").mean()),
        )
        .sort(["cod_municipio", "anio"])
    )
    panel = panel.with_columns(lag1=pl.col("consumo_hm3").shift(1).over("cod_municipio"))
    panel = panel.filter(pl.col("anio") >= ANIO_MIN)
    faltantes = panel.filter(pl.col("poblacion").is_null())
    if faltantes.height:
        municipios = sorted(faltantes["cod_municipio"].unique().to_list())
        raise ValueError(f"sin poblacion (padron) para {faltantes.height} filas: {municipios}")
    return panel
