"""Gold: precipitacion mensual por masa (fusion AEMET + Open-Meteo).

- Masas con estacion AEMET valida: media de los acumulados mensuales
  de sus estaciones.
- Masas sin estacion valida: acumulado mensual Open-Meteo (centroide).

Ventana: 2015-01 -> ultimo mes cerrado.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import polars as pl
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import BUCKET
from include.silver.ibestat import DELTA_STORAGE_OPTIONS

AEMET_DAILY = f"s3://{BUCKET}/silver/aemet/historico_meteo/"
OPENMETEO_DAILY = f"s3://{BUCKET}/silver/openmeteo/lluvia_masa_subterranea/"
CATALOGO = f"s3://{BUCKET}/silver/aemet/estaciones/"

UPSERT_SQL = """
    INSERT INTO gold.lluvia_masa_subterranea (
        cod_masa, anio, mes, precipitacion_mm, fuente
    ) VALUES (
        %(cod_masa)s, %(anio)s, %(mes)s, %(precipitacion_mm)s, %(fuente)s
    )
    ON CONFLICT (cod_masa, anio, mes) DO UPDATE SET
        precipitacion_mm = EXCLUDED.precipitacion_mm,
        fuente = EXCLUDED.fuente,
        updated_at = now()
"""


def _read_delta(path: str) -> pl.DataFrame:
    return pl.read_delta(path, storage_options=DELTA_STORAGE_OPTIONS)


def _last_closed_month() -> tuple[int, int]:
    last_day = datetime.now().replace(day=1) - timedelta(days=1)
    return last_day.year, last_day.month


def _masa_station_map(pg_hook, validas: list[str]) -> dict[str, list[str]]:
    conn = pg_hook.get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT cod_masa, cod_estacion
        FROM public.masa_subterranea_estacion_aemet
        WHERE cod_estacion = ANY(%s)
        ORDER BY cod_masa, cod_estacion
        """,
        (validas,),
    )
    mapping: dict[str, list[str]] = {}
    for masa, estacion in cur.fetchall():
        mapping.setdefault(masa, []).append(estacion)
    conn.close()
    return mapping


def aggregate(**context) -> str:
    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    anio_fin, mes_fin = _last_closed_month()

    catalogo = _read_delta(CATALOGO)
    validas = catalogo["indicativo"].unique().to_list()
    mapping = _masa_station_map(pg_hook, validas)

    # ── AEMET: media de acumulados mensuales por estacion ──────────────
    aemet = _read_delta(AEMET_DAILY)
    aemet = aemet.filter(pl.col("prec_mm").is_not_null())
    aemet = aemet.with_columns([
        pl.col("fecha").dt.year().alias("anio"),
        pl.col("fecha").dt.month().alias("mes"),
    ])
    aemet = aemet.filter(
        (pl.col("anio") >= 2015)
        & ((pl.col("anio") < anio_fin) | ((pl.col("anio") == anio_fin) & (pl.col("mes") <= mes_fin)))
    )
    estacion_mensual = aemet.group_by(["indicativo", "anio", "mes"]).agg(
        pl.col("prec_mm").sum().alias("prec")
    )
    estacion_mensual = estacion_mensual.join(
        pl.DataFrame(
            [
                {"cod_masa": m, "indicativo": e}
                for m, ests in mapping.items()
                for e in ests
            ]
        ),
        on="indicativo",
        how="inner",
    )
    masa_mensual_aemet = estacion_mensual.group_by(["cod_masa", "anio", "mes"]).agg(
        pl.col("prec").mean().round(2).alias("precipitacion_mm")
    ).with_columns(pl.lit("aemet").alias("fuente"))

    # ── Open-Meteo: acumulado mensual por masa ─────────────────────────
    om = _read_delta(OPENMETEO_DAILY)
    om = om.with_columns([
        pl.col("fecha").dt.year().alias("anio"),
        pl.col("fecha").dt.month().alias("mes"),
    ])
    om = om.filter(
        (pl.col("anio") >= 2015)
        & ((pl.col("anio") < anio_fin) | ((pl.col("anio") == anio_fin) & (pl.col("mes") <= mes_fin)))
    )
    # solo masas sin estacion valida
    om = om.filter(~pl.col("cod_masa").is_in(list(mapping.keys())))
    masa_mensual_om = om.group_by(["cod_masa", "anio", "mes"]).agg(
        pl.col("precipitacion_mm").sum().round(2).alias("precipitacion_mm")
    ).with_columns(pl.lit("openmeteo").alias("fuente"))

    merged = pl.concat([masa_mensual_aemet, masa_mensual_om], how="diagonal_relaxed")

    conn = pg_hook.get_conn()
    cur = conn.cursor()
    rows = merged.to_dicts()
    for row in rows:
        cur.execute(UPSERT_SQL, row)
    conn.commit()
    cur.close()
    conn.close()

    return f"gold.lluvia_masa_subterranea ({len(rows)} filas)"
