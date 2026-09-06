"""Gold: balance hidrico anual simplificado por masa (modelo DMA).

Fiel al prompt "Balance Hidrico Simplificado de Masas Subterraneas":
- Entradas: infiltracion lluvia real + climaticas escaladas + fijas (RP x pct)
- Salidas: abastecimiento urbano + climaticas + fijas
- disponibilidad = (suma_entradas - intrusion) - (salida_mar + salida_zzhh), cap 0
- explotacion = extraccion / disponibilidad; clasificacion DMA
- Rango temporal: interseccion de anos con infiltracion y con extraccion
"""
from __future__ import annotations

from airflow.providers.postgres.hooks.postgres import PostgresHook

UPSERT_SQL = """
WITH pesos AS (
    SELECT cod_municipio, cod_masa,
           abastecimiento_agua_media_ponderada_anual_hm3
           / NULLIF(SUM(abastecimiento_agua_media_ponderada_anual_hm3)
                    OVER (PARTITION BY cod_municipio), 0) AS peso
    FROM public.municipio_masa_subterranea
    WHERE abastecimiento_agua_media_ponderada_anual_hm3 > 0
),
extraccion AS (
    SELECT a.anio, p.cod_masa, SUM(a.consumo_hm3 * p.peso) AS extraccion_hm3
    FROM gold.abastecimiento_urbano_baleares a
    JOIN pesos p USING (cod_municipio)
    GROUP BY a.anio, p.cod_masa
),
infiltracion AS (
    SELECT cod_masa, anio, SUM(agua_infiltrada_m3) / 1e6 AS inf_lluvia_hm3
    FROM gold.agua_infiltrada_masa_subterranea
    GROUP BY cod_masa, anio
),
calc AS (
    SELECT
        i.cod_masa,
        i.anio,
        b.recurso_potencial_hm3 AS rp,
        ROUND(i.inf_lluvia_hm3::numeric, 3) AS infiltracion_lluvia_hm3,
        ROUND((CASE WHEN b.infiltracion_lluvia = 0 THEN 0
                     ELSE i.inf_lluvia_hm3 * b.infiltracion_torrentes / b.infiltracion_lluvia
                END)::numeric, 3) AS infiltracion_torrentes_hm3,
        ROUND((b.recurso_potencial_hm3 * b.retorno_riegos / 100)::numeric, 3) AS retorno_riegos_hm3,
        ROUND((b.recurso_potencial_hm3 * b.perdida_redes_abastecimiento / 100)::numeric, 3) AS perdida_redes_abastecimiento_hm3,
        ROUND((b.recurso_potencial_hm3 * b.perdida_redes_alcantarillado / 100)::numeric, 3) AS perdida_redes_alcantarillado_hm3,
        ROUND((b.recurso_potencial_hm3 * b.intrusion_salina / 100)::numeric, 3) AS intrusion_salina_hm3,
        ROUND((CASE WHEN b.infiltracion_lluvia = 0 THEN 0
                     ELSE i.inf_lluvia_hm3 * b.torrentes / b.infiltracion_lluvia
                END)::numeric, 3) AS torrentes_hm3,
        ROUND((CASE WHEN b.infiltracion_lluvia = 0 THEN 0
                     ELSE i.inf_lluvia_hm3 * b.manantiales / b.infiltracion_lluvia
                END)::numeric, 3) AS manantiales_hm3,
        ROUND((b.recurso_potencial_hm3 * b.humedales / 100)::numeric, 3) AS humedales_hm3,
        ROUND((b.recurso_potencial_hm3 * b.salida_mar / 100)::numeric, 3) AS salida_mar_hm3,
        ROUND((b.recurso_potencial_hm3 * b.salida_zzhh / 100)::numeric, 3) AS salida_zzhh_hm3,
        ROUND(e.extraccion_hm3::numeric, 3) AS extraccion_hm3
    FROM infiltracion i
    JOIN extraccion e ON e.cod_masa = i.cod_masa AND e.anio = i.anio
    JOIN public.balance_masas_subterraneas_porcentajes b ON b.cod_masa = i.cod_masa
),
calc2 AS (
    SELECT *,
           infiltracion_lluvia_hm3 + infiltracion_torrentes_hm3 + retorno_riegos_hm3
             + perdida_redes_abastecimiento_hm3 + perdida_redes_alcantarillado_hm3
             + intrusion_salina_hm3 AS suma_entradas_hm3,
           extraccion_hm3 + torrentes_hm3 + manantiales_hm3 + humedales_hm3
             + salida_mar_hm3 + salida_zzhh_hm3 AS suma_salidas_hm3
    FROM calc
),
calc3 AS (
    SELECT *,
           suma_entradas_hm3 - rp AS diferencia_vs_rp_hm3,
           GREATEST(
               (suma_entradas_hm3 - intrusion_salina_hm3)
               - (salida_mar_hm3 + salida_zzhh_hm3),
               0
           ) AS disponibilidad_hm3
    FROM calc2
),
calc4 AS (
    SELECT *,
           extraccion_hm3 / NULLIF(disponibilidad_hm3, 0) AS explotacion_porcentaje,
           CASE
               WHEN disponibilidad_hm3 IS NULL THEN NULL
               WHEN disponibilidad_hm3 = 0 THEN 'mal_estado'
               WHEN extraccion_hm3 / NULLIF(disponibilidad_hm3, 0) < 0.8 THEN 'buen_estado'
               WHEN extraccion_hm3 / NULLIF(disponibilidad_hm3, 0) <= 1.0 THEN 'en_riesgo'
               ELSE 'mal_estado'
           END AS estado_cuantitativo
    FROM calc3
)
INSERT INTO gold.balance_hidrico_baleares (
    cod_masa, anio,
    infiltracion_lluvia_hm3, infiltracion_torrentes_hm3, retorno_riegos_hm3,
    perdida_redes_abastecimiento_hm3, perdida_redes_alcantarillado_hm3,
    intrusion_salina_hm3, suma_entradas_hm3, diferencia_vs_rp_hm3,
    abastecimiento_urbano_hm3, torrentes_hm3, manantiales_hm3, humedales_hm3,
    salida_mar_hm3, salida_zzhh_hm3, suma_salidas_hm3,
    disponibilidad_hm3, extraccion_hm3, explotacion_porcentaje, estado_cuantitativo
)
SELECT
    cod_masa, anio,
    infiltracion_lluvia_hm3, infiltracion_torrentes_hm3, retorno_riegos_hm3,
    perdida_redes_abastecimiento_hm3, perdida_redes_alcantarillado_hm3,
    intrusion_salina_hm3,
    ROUND(suma_entradas_hm3::numeric, 3), ROUND(diferencia_vs_rp_hm3::numeric, 3),
    extraccion_hm3, torrentes_hm3, manantiales_hm3, humedales_hm3,
    salida_mar_hm3, salida_zzhh_hm3,
    ROUND(suma_salidas_hm3::numeric, 3),
    ROUND(disponibilidad_hm3::numeric, 3),
    ROUND(extraccion_hm3::numeric, 3),
    ROUND(explotacion_porcentaje::numeric, 3),
    estado_cuantitativo
FROM calc4
ON CONFLICT (cod_masa, anio) DO UPDATE SET
    infiltracion_lluvia_hm3 = EXCLUDED.infiltracion_lluvia_hm3,
    infiltracion_torrentes_hm3 = EXCLUDED.infiltracion_torrentes_hm3,
    retorno_riegos_hm3 = EXCLUDED.retorno_riegos_hm3,
    perdida_redes_abastecimiento_hm3 = EXCLUDED.perdida_redes_abastecimiento_hm3,
    perdida_redes_alcantarillado_hm3 = EXCLUDED.perdida_redes_alcantarillado_hm3,
    intrusion_salina_hm3 = EXCLUDED.intrusion_salina_hm3,
    suma_entradas_hm3 = EXCLUDED.suma_entradas_hm3,
    diferencia_vs_rp_hm3 = EXCLUDED.diferencia_vs_rp_hm3,
    abastecimiento_urbano_hm3 = EXCLUDED.abastecimiento_urbano_hm3,
    torrentes_hm3 = EXCLUDED.torrentes_hm3,
    manantiales_hm3 = EXCLUDED.manantiales_hm3,
    humedales_hm3 = EXCLUDED.humedales_hm3,
    salida_mar_hm3 = EXCLUDED.salida_mar_hm3,
    salida_zzhh_hm3 = EXCLUDED.salida_zzhh_hm3,
    suma_salidas_hm3 = EXCLUDED.suma_salidas_hm3,
    disponibilidad_hm3 = EXCLUDED.disponibilidad_hm3,
    extraccion_hm3 = EXCLUDED.extraccion_hm3,
    explotacion_porcentaje = EXCLUDED.explotacion_porcentaje,
    estado_cuantitativo = EXCLUDED.estado_cuantitativo,
    updated_at = now()
"""


def aggregate(**context) -> str:
    pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = pg_hook.get_conn()
    cur = conn.cursor()
    cur.execute(UPSERT_SQL)
    conn.commit()

    cur.execute("SELECT count(*) FROM gold.balance_hidrico_baleares")
    filas = cur.fetchone()[0]
    cur.close()
    conn.close()

    return f"gold.balance_hidrico_baleares ({filas} filas)"
