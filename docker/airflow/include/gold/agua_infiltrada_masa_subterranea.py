"""Gold: agua infiltrada mensual por masa (lluvia x coeficiente de infiltracion).

agua_infiltrada_m3 = lluvia_mm x SUM(area_km2 x coef) x 1000
Coeficiente en tanto por uno (infiltracion_epoca_material).
Masas sin coeficientes de infiltracion quedan fuera.
"""
from __future__ import annotations

from airflow.providers.postgres.hooks.postgres import PostgresHook

UPSERT_SQL = """
    INSERT INTO gold.agua_infiltrada_masa_subterranea (cod_masa, anio, mes, agua_infiltrada_m3)
    SELECT
        l.cod_masa,
        l.anio,
        l.mes,
        ROUND((l.precipitacion_mm * i.factor_area * 1000)::numeric, 3) AS agua_infiltrada_m3
    FROM gold.lluvia_masa_subterranea l
    JOIN (
        SELECT cod_masa, SUM(area_km2 * infiltracion_lluvia_porcentaje) AS factor_area
        FROM public.infiltracion_epoca_material
        GROUP BY cod_masa
    ) i USING (cod_masa)
    ON CONFLICT (cod_masa, anio, mes) DO UPDATE SET
        agua_infiltrada_m3 = EXCLUDED.agua_infiltrada_m3,
        updated_at = now()
"""


def aggregate(**context) -> str:
    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = pg_hook.get_conn()
    cur = conn.cursor()
    cur.execute(UPSERT_SQL)
    conn.commit()

    cur.execute("SELECT count(*) FROM gold.agua_infiltrada_masa_subterranea")
    filas = cur.fetchone()[0]
    cur.close()
    conn.close()

    return f"gold.agua_infiltrada_masa_subterranea ({filas} filas)"
