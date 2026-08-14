"""Endpoints analiticos para dashboards (datos gold + dimensiones)."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query

from database import get_pool

router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["analytics"],
)

ISLAS = {"Mallorca", "Menorca", "Eivissa", "Formentera"}

# CTE compartido: isla de cada masa (via unidad de demanda -> provincia)
MASA_ISLA_CTE = """
    masa_isla AS (
        SELECT m.cod_masa, p.nombre_provincia AS isla
        FROM public.masa_subterranea m
        JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
        JOIN public.provincia p USING (cod_provincia)
    )
"""


async def _q(query: str, *params) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


async def _qrow(query: str, *params) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)
    return dict(row) if row else None


def _last_closed_month() -> tuple[int, int]:
    today = date.today()
    if today.month == 1:
        return today.year - 1, 12
    return today.year, today.month - 1


def _ah_params():
    """Año hidrológico en curso y rango de AH históricos completos."""
    anio, mes = _last_closed_month()
    ah_actual = anio + (1 if mes >= 9 else 0)
    ah_hist_desde = 2016  # primer AH completo (sep-2015..ago-2016)
    return anio, mes, ah_actual, ah_hist_desde


@router.get("/resumen")
async def resumen(isla: str | None = Query(default=None)):
    anio_fin, mes_fin, ah_actual, ah_hist_desde = _ah_params()
    isla_sql = ""
    isla_sql_outer = ""
    params: list = [anio_fin, mes_fin, ah_hist_desde, ah_actual]
    if isla:
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        isla_sql_outer = "AND isla = $5"
        params.append(isla)

    # KPIs de lluvia por masa (acumulado AH actual vs media historica)
    lluvia = await _q(
        f"""
        WITH {MASA_ISLA_CTE},
        ah_sums AS (
            SELECT l.cod_masa, mi.isla, l.anio, l.mes,
                   (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) AS ah,
                   l.precipitacion_mm
            FROM gold.lluvia_masa_subterranea l
            JOIN masa_isla mi USING (cod_masa)
        ),
        hist AS (
            SELECT cod_masa, AVG(total) AS media_ah
            FROM (
                SELECT cod_masa, ah, SUM(precipitacion_mm) AS total
                FROM ah_sums
                WHERE ah BETWEEN $3 AND {ah_actual} - 1
                GROUP BY cod_masa, ah
            ) t
            GROUP BY cod_masa
        ),
        act AS (
            SELECT cod_masa, SUM(precipitacion_mm) AS total_ah
            FROM ah_sums
            WHERE ah = $4
              AND (anio < $1 OR (anio = $1 AND mes <= $2))
            GROUP BY cod_masa
        ),
        masa_stats AS (
            SELECT mi.cod_masa, mi.isla, act.total_ah, h.media_ah,
                   ROUND(((act.total_ah - h.media_ah) / NULLIF(h.media_ah, 0) * 100)::numeric, 1) AS desviacion_pct
            FROM masa_isla mi
            JOIN act ON act.cod_masa = mi.cod_masa
            LEFT JOIN hist h ON h.cod_masa = mi.cod_masa
        )
        SELECT
            ROUND(AVG(total_ah)::numeric, 1) AS lluvia_ah_mm,
            ROUND(AVG(media_ah)::numeric, 1) AS lluvia_ah_media_mm,
            ROUND(((AVG(total_ah) - AVG(media_ah)) / NULLIF(AVG(media_ah), 0) * 100)::numeric, 1) AS desviacion_pct,
            COUNT(*) FILTER (WHERE (total_ah - media_ah) / NULLIF(media_ah, 0) < -0.15) AS masas_en_deficit,
            COUNT(*) AS masas_total
        FROM masa_stats
        WHERE 1=1 {isla_sql_outer}
        """,
        *params,
    )
    resumen_dict = lluvia[0] if lluvia else {}

    # IPH pico del año en curso
    iph = await _qrow(
        """
        SELECT nombre_isla, anio, mes, iph
        FROM gold.presion_humana
        WHERE anio = $1 AND iph IS NOT NULL
        ORDER BY iph DESC LIMIT 1
        """,
        anio_fin,
    )

    # Ocupacion media del ultimo mes cerrado (por isla si filtro)
    ocupa_sql = """
        SELECT ROUND((AVG(ocupacion_plazas_pct) * 100)::numeric, 1) AS ocupacion_media_pct
        FROM gold.ocupacion_turistica
        WHERE anio = $1 AND mes = $2
    """
    ocupa_params: list = [anio_fin, mes_fin]
    if isla:
        ocupa_sql += " AND nombre_provincia = $3"
        ocupa_params.append(isla)
    ocupacion = await _qrow(ocupa_sql, *ocupa_params)

    # Poblacion ultimo censo
    pob = await _qrow(
        """
        WITH ult AS (SELECT MAX(anio) AS anio FROM gold.censo_municipal_baleares)
        SELECT SUM(poblacion) AS poblacion, (SELECT anio FROM ult) AS anio
        FROM gold.censo_municipal_baleares c, ult
        WHERE c.anio = ult.anio
        """ + (" AND nombre_provincia = $1" if isla else ""),
        *([isla] if isla else []),
    )

    # Consumo urbano 2024 (ultimo anio disponible)
    consumo = await _qrow(
        """
        SELECT ROUND(SUM(consumo_hm3)::numeric, 2) AS consumo_hm3
        FROM gold.abastecimiento_urbano_baleares
        WHERE anio = 2024
        """ + (" AND nombre_provincia = $1" if isla else ""),
        *([isla] if isla else []),
    )

    return {
        "mes_cerrado": f"{anio_fin}-{mes_fin:02d}",
        "ah_actual": ah_actual,
        "lluvia_ah_mm": resumen_dict.get("lluvia_ah_mm"),
        "lluvia_ah_media_mm": resumen_dict.get("lluvia_ah_media_mm"),
        "desviacion_pct": resumen_dict.get("desviacion_pct"),
        "masas_en_deficit": resumen_dict.get("masas_en_deficit"),
        "masas_total": resumen_dict.get("masas_total"),
        "iph_pico": iph,
        "ocupacion_media_pct": (ocupacion or {}).get("ocupacion_media_pct"),
        "poblacion": (pob or {}).get("poblacion"),
        "poblacion_anio": (pob or {}).get("anio"),
        "consumo_hm3": (consumo or {}).get("consumo_hm3"),
    }


@router.get("/lluvia")
async def lluvia(
    isla: str | None = Query(default=None),
    masa: str | None = Query(default=None),
):
    if masa:
        serie = await _q(
            """
            SELECT anio, mes, precipitacion_mm
            FROM gold.lluvia_masa_subterranea
            WHERE cod_masa = $1 AND anio >= 2015
            ORDER BY anio, mes
            """,
            masa,
        )
        referencia = await _q(
            """
            SELECT mes, ROUND(AVG(precipitacion_mm)::numeric, 1) AS media_mm
            FROM gold.lluvia_masa_subterranea
            WHERE cod_masa = $1 AND anio BETWEEN 2015 AND 2025
            GROUP BY mes ORDER BY mes
            """,
            masa,
        )
        meta = await _qrow(
            """
            SELECT m.cod_masa, m.nombre_masa, p.nombre_provincia AS isla
            FROM public.masa_subterranea m
            JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
            JOIN public.provincia p USING (cod_provincia)
            WHERE m.cod_masa = $1
            """,
            masa,
        )
        return {"masa": meta, "serie": serie, "referencia": referencia}

    isla_sql = ""
    params: list = []
    if isla:
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        isla_sql = "AND mi.isla = $1"
        params = [isla]

    serie = await _q(
        f"""
        WITH {MASA_ISLA_CTE}
        SELECT anio, mes, ROUND(AVG(precipitacion_mm)::numeric, 1) AS precipitacion_mm
        FROM gold.lluvia_masa_subterranea l
        JOIN masa_isla mi USING (cod_masa)
        WHERE anio >= 2015 {isla_sql}
        GROUP BY anio, mes
        ORDER BY anio, mes
        """,
        *params,
    )
    referencia = await _q(
        f"""
        WITH {MASA_ISLA_CTE}
        SELECT mes, ROUND(AVG(precipitacion_mm)::numeric, 1) AS media_mm
        FROM gold.lluvia_masa_subterranea l
        JOIN masa_isla mi USING (cod_masa)
        WHERE anio BETWEEN 2015 AND 2025 {isla_sql}
        GROUP BY mes ORDER BY mes
        """,
        *params,
    )
    return {"isla": isla or "Baleares", "serie": serie, "referencia": referencia}


@router.get("/lluvia/ranking")
async def lluvia_ranking(isla: str | None = Query(default=None)):
    anio_fin, mes_fin, ah_actual, ah_hist_desde = _ah_params()
    isla_sql = ""
    params: list = [anio_fin, mes_fin, ah_hist_desde, ah_actual]
    if isla:
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        isla_sql = "AND mi.isla = $5"
        params.append(isla)

    rows = await _q(
        f"""
        WITH {MASA_ISLA_CTE},
        ah_sums AS (
            SELECT l.cod_masa, mi.isla, l.anio, l.mes,
                   (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) AS ah,
                   l.precipitacion_mm
            FROM gold.lluvia_masa_subterranea l
            JOIN masa_isla mi USING (cod_masa)
        ),
        hist AS (
            SELECT cod_masa, AVG(total) AS media_ah
            FROM (
                SELECT cod_masa, ah, SUM(precipitacion_mm) AS total
                FROM ah_sums
                WHERE ah BETWEEN $3 AND $4 - 1
                GROUP BY cod_masa, ah
            ) t
            GROUP BY cod_masa
        ),
        act AS (
            SELECT cod_masa, SUM(precipitacion_mm) AS total_ah
            FROM ah_sums
            WHERE ah = $4 AND (anio < $1 OR (anio = $1 AND mes <= $2))
            GROUP BY cod_masa
        )
        SELECT mi.cod_masa, m.nombre_masa, mi.isla,
               ROUND(act.total_ah::numeric, 1) AS ah_actual_mm,
               ROUND(h.media_ah::numeric, 1) AS ah_media_mm,
               ROUND(((act.total_ah - h.media_ah) / NULLIF(h.media_ah, 0) * 100)::numeric, 1) AS desviacion_pct
        FROM masa_isla mi
        JOIN public.masa_subterranea m USING (cod_masa)
        JOIN act ON act.cod_masa = mi.cod_masa
        LEFT JOIN hist h ON h.cod_masa = mi.cod_masa
        WHERE h.media_ah IS NOT NULL {isla_sql}
        ORDER BY desviacion_pct DESC
        """,
        *params,
    )
    return {"ah_actual": ah_actual, "masas": rows}


@router.get("/abastecimiento")
async def abastecimiento(isla: str | None = Query(default=None)):
    isla_sql = ""
    params: list = []
    if isla:
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        isla_sql = "AND nombre_provincia = $1"
        params = [isla]

    serie = await _q(
        f"""
        SELECT anio,
               ROUND(SUM(subterranea_hm3)::numeric, 2) AS subterranea_hm3,
               ROUND(SUM(desalinizada_hm3)::numeric, 2) AS desalinizada_hm3,
               ROUND(SUM(indiferenciada_hm3)::numeric, 2) AS indiferenciada_hm3,
               ROUND(SUM(superficial_hm3)::numeric, 2) AS superficial_hm3,
               ROUND(SUM(potabilizada_hm3)::numeric, 2) AS potabilizada_hm3,
               ROUND(SUM(otros_destinos_hm3)::numeric, 2) AS otros_destinos_hm3,
               ROUND(SUM(total_suministrado_hm3)::numeric, 2) AS total_suministrado_hm3,
               ROUND(SUM(consumo_hm3)::numeric, 2) AS consumo_hm3
        FROM gold.abastecimiento_urbano_baleares
        WHERE 1=1 {isla_sql}
        GROUP BY anio ORDER BY anio
        """,
        *params,
    )
    top = await _q(
        f"""
        SELECT cod_municipio, nombre_municipio, ROUND(consumo_hm3::numeric, 2) AS consumo_hm3
        FROM gold.abastecimiento_urbano_baleares
        WHERE anio = 2024 {isla_sql}
        ORDER BY consumo_hm3 DESC LIMIT 5
        """,
        *params,
    )
    return {"isla": isla or "Baleares", "serie": serie, "top_municipios": top}


@router.get("/presion")
async def presion(isla: str | None = Query(default=None)):
    if isla in ("Eivissa", "Formentera"):
        nombre_isla = "Eivissa i Formentera"
    elif isla in ("Mallorca", "Menorca"):
        nombre_isla = isla
    else:
        nombre_isla = None

    if nombre_isla:
        serie = await _q(
            """
            SELECT anio, mes, iph FROM gold.presion_humana
            WHERE nombre_isla = $1 AND anio >= 2015
            ORDER BY anio, mes
            """,
            nombre_isla,
        )
        referencia = await _q(
            """
            SELECT mes, ROUND(AVG(iph)::numeric) AS media_iph
            FROM gold.presion_humana
            WHERE nombre_isla = $1 AND anio BETWEEN 2015 AND 2025
            GROUP BY mes ORDER BY mes
            """,
            nombre_isla,
        )
        return {"isla": isla, "serie": serie, "referencia": referencia}

    serie = await _q(
        """
        SELECT nombre_isla, anio, mes, iph FROM gold.presion_humana
        WHERE anio >= 2015 ORDER BY nombre_isla, anio, mes
        """
    )
    return {"isla": "Baleares", "serie": serie, "referencia": []}


@router.get("/ocupacion")
async def ocupacion(
    isla: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
):
    isla_sql = ""
    params: list = []
    if isla:
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        isla_sql = "AND nombre_provincia = $1"
        params = [isla]
    if tipo:
        if tipo not in ("hotelera", "apartamentos"):
            raise HTTPException(400, "tipo debe ser hotelera o apartamentos")
        isla_sql += f" AND tipo_alojamiento = ${len(params) + 1}"
        params.append(tipo)

    serie = await _q(
        f"""
        SELECT nombre_provincia AS isla, tipo_alojamiento AS tipo,
               anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
        FROM gold.ocupacion_turistica
        WHERE 1=1 {isla_sql}
        GROUP BY nombre_provincia, tipo_alojamiento, anio, mes
        ORDER BY isla, tipo, anio, mes
        """,
        *params,
    )
    return {"isla": isla or "Baleares", "serie": serie}


@router.get("/entidad/{tipo}/{cod}")
async def entidad(tipo: str, cod: str):
    anio_fin, mes_fin, ah_actual, ah_hist_desde = _ah_params()

    if tipo == "masa":
        base = await _qrow(
            """
            SELECT m.cod_masa, m.nombre_masa, p.nombre_provincia AS isla
            FROM public.masa_subterranea m
            JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
            JOIN public.provincia p USING (cod_provincia)
            WHERE m.cod_masa = $1
            """,
            cod,
        )
        if not base:
            raise HTTPException(404, "masa no encontrada")

        lluvia = await _qrow(
            """
            WITH hist AS (
                SELECT AVG(total) AS media_ah FROM (
                    SELECT (anio + CASE WHEN mes >= 9 THEN 1 ELSE 0 END) AS ah,
                           SUM(precipitacion_mm) AS total
                    FROM gold.lluvia_masa_subterranea
                    WHERE cod_masa = $1
                      AND (anio + CASE WHEN mes >= 9 THEN 1 ELSE 0 END) BETWEEN $2 AND $3 - 1
                    GROUP BY ah
                ) t
            ),
            act AS (
                SELECT SUM(precipitacion_mm) AS total_ah
                FROM gold.lluvia_masa_subterranea
                WHERE cod_masa = $1
                  AND (anio + CASE WHEN mes >= 9 THEN 1 ELSE 0 END) = $3
                  AND (anio < $4 OR (anio = $4 AND mes <= $5))
            )
            SELECT act.total_ah, hist.media_ah
            FROM act, hist
            """,
            cod, ah_hist_desde, ah_actual, anio_fin, mes_fin,
        )
        ult_mes = await _qrow(
            """
            SELECT l.precipitacion_mm, r.media_mm
            FROM gold.lluvia_masa_subterranea l,
                 (SELECT ROUND(AVG(precipitacion_mm)::numeric, 1) AS media_mm
                  FROM gold.lluvia_masa_subterranea
                  WHERE cod_masa = $1 AND mes = $2 AND anio BETWEEN 2015 AND 2025) r
            WHERE l.cod_masa = $1 AND l.anio = $3 AND l.mes = $2
            LIMIT 1
            """,
            cod, mes_fin, anio_fin,
        )
        fuentes = await _q(
            """
            SELECT DISTINCT fuente FROM gold.lluvia_masa_subterranea
            WHERE cod_masa = $1
            """,
            cod,
        )
        n_est = await _qrow(
            "SELECT COUNT(*) AS n FROM public.masa_subterranea_estacion_aemet WHERE cod_masa = $1",
            cod,
        )
        munis = await _qrow(
            """
            SELECT COUNT(*) AS n_municipios,
                   ROUND(SUM(abastecimiento_agua_media_ponderada_anual_hm3)::numeric, 2) AS demanda_hm3
            FROM public.municipio_masa_subterranea WHERE cod_masa = $1
            """,
            cod,
        )
        spark = await _q(
            """
            SELECT anio, mes, precipitacion_mm FROM gold.lluvia_masa_subterranea
            WHERE cod_masa = $1
              AND (anio * 12 + mes) > $2 * 12 + $3 - 24
            ORDER BY anio, mes
            """,
            cod, anio_fin, mes_fin,
        )
        return {
            "tipo": "masa",
            "nombre": base["nombre_masa"],
            "isla": base["isla"],
            "lluvia_ah_mm": round(lluvia["total_ah"], 1) if lluvia and lluvia["total_ah"] is not None else None,
            "lluvia_ah_media_mm": round(lluvia["media_ah"], 1) if lluvia and lluvia["media_ah"] is not None else None,
            "desviacion_pct": (
                round((lluvia["total_ah"] - lluvia["media_ah"]) / lluvia["media_ah"] * 100, 1)
                if lluvia and lluvia["total_ah"] is not None and lluvia["media_ah"]
                else None
            ),
            "lluvia_ultimo_mes_mm": ult_mes["precipitacion_mm"] if ult_mes else None,
            "lluvia_media_ultimo_mes_mm": ult_mes["media_mm"] if ult_mes else None,
            "fuentes": [f["fuente"] for f in fuentes],
            "n_estaciones": n_est["n"] if n_est else 0,
            "n_municipios": munis["n_municipios"] if munis else 0,
            "demanda_hm3": munis["demanda_hm3"] if munis else None,
            "sparkline_lluvia": spark,
        }

    if tipo == "municipio":
        base = await _qrow(
            "SELECT cod_municipio, nombre_municipio, nombre_provincia AS isla "
            "FROM public.municipio m JOIN public.provincia p USING (cod_provincia) "
            "WHERE m.cod_municipio = $1",
            cod,
        )
        if not base:
            raise HTTPException(404, "municipio no encontrado")

        pob = await _q(
            """
            SELECT anio, poblacion FROM gold.censo_municipal_baleares
            WHERE cod_municipio_ine = $1 ORDER BY anio DESC LIMIT 2
            """,
            cod,
        )
        poblacion_actual = pob[0]["poblacion"] if pob else None
        var_pct = None
        if len(pob) == 2 and pob[1]["poblacion"]:
            var_pct = round((pob[0]["poblacion"] - pob[1]["poblacion"]) / pob[1]["poblacion"] * 100, 1)

        consumo = await _q(
            """
            SELECT anio, consumo_hm3 FROM gold.abastecimiento_urbano_baleares
            WHERE cod_municipio = $1 AND anio BETWEEN 2020 AND 2024
            ORDER BY anio
            """,
            cod,
        )
        ocupa = await _qrow(
            """
            SELECT ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
            FROM gold.ocupacion_turistica
            WHERE cod_municipio_ine = $1 AND anio = $2 AND mes = $3
            """,
            cod, anio_fin, mes_fin,
        )
        masas = await _q(
            """
            SELECT mm.cod_masa, m.nombre_masa
            FROM public.municipio_masa_subterranea mm
            JOIN public.masa_subterranea m USING (cod_masa)
            WHERE mm.cod_municipio = $1
            """,
            cod,
        )
        lluvia_masas = await _qrow(
            """
            WITH munis_masas AS (
                SELECT cod_masa FROM public.municipio_masa_subterranea
                WHERE cod_municipio = $1
            )
            SELECT ROUND(AVG(total)::numeric, 1) AS lluvia_ah_media_mm
            FROM (
                SELECT l.cod_masa, SUM(l.precipitacion_mm) AS total
                FROM gold.lluvia_masa_subterranea l
                JOIN munis_masas mm USING (cod_masa)
                WHERE (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) = $2
                  AND (l.anio < $3 OR (l.anio = $3 AND l.mes <= $4))
                GROUP BY l.cod_masa
            ) t
            """,
            cod, ah_actual, anio_fin, mes_fin,
        )
        n_pozos = await _qrow(
            "SELECT COUNT(*) AS n FROM public.pozos WHERE cod_municipio = $1", cod
        )
        spark = await _q(
            """
            SELECT anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
            FROM gold.ocupacion_turistica
            WHERE cod_municipio_ine = $1
              AND (anio * 12 + mes) > $2 * 12 + $3 - 12
            GROUP BY anio, mes ORDER BY anio, mes
            """,
            cod, anio_fin, mes_fin,
        )
        return {
            "tipo": "municipio",
            "nombre": base["nombre_municipio"],
            "isla": base["isla"],
            "poblacion": poblacion_actual,
            "poblacion_anio": pob[0]["anio"] if pob else None,
            "poblacion_var_pct": var_pct,
            "consumo_serie": consumo,
            "ocupacion_ultimo_mes_pct": ocupa["ocupacion_pct"] if ocupa else None,
            "n_masas": len(masas),
            "masas": masas,
            "lluvia_ah_media_mm": lluvia_masas["lluvia_ah_media_mm"] if lluvia_masas else None,
            "n_pozos": n_pozos["n"] if n_pozos else 0,
            "sparkline_ocupacion": spark,
        }

    if tipo == "pozo":
        base = await _qrow(
            """
            SELECT p.cod_pozo, p.nombre, p.cod_masa, m.nombre_masa,
                   p.cod_municipio, mu.nombre_municipio, p.cota_terreno_m,
                   p.uso_principal, p.tipo, p.red_piezometrica, p.red_cualitativa,
                   p.frecuencia_medicion_piezometrica_iso8601,
                   p.frecuencia_muestreo_cualitativa_iso8601
            FROM public.pozos p
            LEFT JOIN public.masa_subterranea m USING (cod_masa)
            LEFT JOIN public.municipio mu USING (cod_municipio)
            WHERE p.cod_pozo = $1
            """,
            cod,
        )
        if not base:
            raise HTTPException(404, "pozo no encontrado")
        return {"tipo": "pozo", "ficha": base}

    if tipo == "ud":
        try:
            cod_id = int(cod)
        except ValueError:
            raise HTTPException(404, "unidad de demanda no encontrada")

        base = await _qrow(
            """
            SELECT ud.id_unidad_demanda, ud.nombre, p.nombre_provincia AS isla, ud.area_km2
            FROM public.unidad_demanda ud
            JOIN public.provincia p USING (cod_provincia)
            WHERE ud.id_unidad_demanda = $1
            """,
            cod_id,
        )
        if not base:
            raise HTTPException(404, "unidad de demanda no encontrada")

        munis = await _qrow(
            """
            SELECT COUNT(*) AS n_municipios, ROUND(SUM(mu.area_km2)::numeric, 1) AS area_municipios_km2
            FROM public.municipio mu
            WHERE ST_Intersects(mu.geometry, (SELECT geometry FROM public.unidad_demanda WHERE id_unidad_demanda = $1))
            """,
            cod_id,
        )
        poblacion = await _qrow(
            """
            WITH ult AS (SELECT MAX(anio) AS anio FROM gold.censo_municipal_baleares)
            SELECT SUM(c.poblacion) AS poblacion
            FROM gold.censo_municipal_baleares c
            CROSS JOIN ult
            JOIN public.municipio mu ON mu.cod_municipio = c.cod_municipio_ine
            WHERE c.anio = ult.anio
              AND ST_Intersects(mu.geometry, (SELECT geometry FROM public.unidad_demanda WHERE id_unidad_demanda = $1))
            """,
            cod_id,
        )
        consumo = await _qrow(
            """
            SELECT ROUND(SUM(a.consumo_hm3)::numeric, 2) AS consumo_hm3
            FROM gold.abastecimiento_urbano_baleares a
            JOIN public.municipio mu ON mu.cod_municipio = a.cod_municipio
            WHERE a.anio = 2024
              AND ST_Intersects(mu.geometry, (SELECT geometry FROM public.unidad_demanda WHERE id_unidad_demanda = $1))
            """,
            cod_id,
        )
        masas = await _qrow(
            """
            SELECT COUNT(*) AS n_masas
            FROM public.masa_subterranea WHERE id_unidad_demanda = $1
            """,
            cod_id,
        )
        lluvia = await _qrow(
            """
            SELECT ROUND(AVG(total)::numeric, 1) AS lluvia_ah_media_mm
            FROM (
                SELECT l.cod_masa, SUM(l.precipitacion_mm) AS total
                FROM gold.lluvia_masa_subterranea l
                JOIN public.masa_subterranea m ON m.cod_masa = l.cod_masa
                WHERE m.id_unidad_demanda = $1
                  AND (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) = $2
                  AND (l.anio < $3 OR (l.anio = $3 AND l.mes <= $4))
                GROUP BY l.cod_masa
            ) t
            """,
            cod_id, ah_actual, anio_fin, mes_fin,
        )
        return {
            "tipo": "ud",
            "nombre": base["nombre"],
            "isla": base["isla"],
            "area_km2": base["area_km2"],
            "n_municipios": munis["n_municipios"] if munis else None,
            "poblacion": poblacion["poblacion"] if poblacion else None,
            "consumo_2024_hm3": consumo["consumo_hm3"] if consumo else None,
            "n_masas": masas["n_masas"] if masas else 0,
            "lluvia_ah_media_mm": lluvia["lluvia_ah_media_mm"] if lluvia else None,
        }

    raise HTTPException(404, f"tipo de entidad desconocido: {tipo}")
