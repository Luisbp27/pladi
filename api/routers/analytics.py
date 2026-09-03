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


async def _last_ocupacion_month() -> tuple[int, int]:
    """Ultimo mes consolidado presente en gold.ocupacion_turistica."""
    row = await _qrow(
        "SELECT anio, mes FROM gold.ocupacion_turistica ORDER BY anio * 12 + mes DESC LIMIT 1"
    )
    if not row:
        return _last_closed_month()
    return int(row["anio"]), int(row["mes"])


@router.get("/resumen")
async def resumen(
    isla: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
):
    anio_fin, mes_fin, ah_actual, ah_hist_desde = _ah_params()
    oc_anio, oc_mes = await _last_ocupacion_month()

    def nombre_isla_iph(nombre: str) -> str:
        if nombre in ("Eivissa", "Formentera"):
            return "Eivissa i Formentera"
        return nombre

    # IPH pico del año en curso (nivel isla NUTS)
    async def iph_pico(nombre_isla: str | None = None) -> dict | None:
        if nombre_isla:
            return await _qrow(
                """
                SELECT nombre_isla, anio, mes, iph
                FROM gold.presion_humana
                WHERE nombre_isla = $1 AND anio = $2 AND iph IS NOT NULL
                ORDER BY iph DESC LIMIT 1
                """,
                nombre_isla,
                anio_fin,
            )
        # Baleares: pico real del total (suma mensual de las 3 series NUTS, mes del pico)
        return await _qrow(
            """
            WITH mensual AS (
                SELECT anio, mes, SUM(iph) AS iph
                FROM gold.presion_humana
                WHERE anio = $1 AND iph IS NOT NULL
                GROUP BY anio, mes
            )
            SELECT 'Baleares' AS nombre_isla, anio, mes,
                   ROUND(iph::numeric, 0) AS iph
            FROM mensual
            ORDER BY iph DESC LIMIT 1
            """,
            anio_fin,
        )

    # ── Modo municipio ──────────────────────────────────────────────────
    if municipio:
        base = await _qrow(
            """
            SELECT m.cod_municipio, m.nombre_municipio, p.nombre_provincia AS isla
            FROM public.municipio m
            JOIN public.provincia p USING (cod_provincia)
            WHERE m.cod_municipio = $1
            """,
            municipio,
        )
        if not base:
            raise HTTPException(404, "municipio no encontrado")

        pob = await _q(
            """
            SELECT anio, poblacion FROM gold.censo_municipal_baleares
            WHERE cod_municipio_ine = $1 ORDER BY anio DESC LIMIT 2
            """,
            municipio,
        )
        poblacion = pob[0]["poblacion"] if pob else None
        var_pct = None
        if len(pob) == 2 and pob[1]["poblacion"]:
            var_pct = round((pob[0]["poblacion"] - pob[1]["poblacion"]) / pob[1]["poblacion"] * 100, 1)

        consumo = await _qrow(
            """
            SELECT ROUND(consumo_hm3::numeric, 2) AS consumo_hm3
            FROM gold.abastecimiento_urbano_baleares
            WHERE cod_municipio = $1 AND anio = 2024
            """,
            municipio,
        )
        ocupa = await _qrow(
            """
            SELECT ROUND((AVG(ocupacion_plazas_pct) * 100)::numeric, 1) AS ocupacion_media_pct
            FROM gold.ocupacion_turistica
            WHERE cod_municipio_ine = $1 AND anio = $2 AND mes = $3
            """,
            municipio, oc_anio, oc_mes,
        )
        lluvia = await _qrow(
            """
            WITH munis_masas AS (
                SELECT cod_masa FROM public.municipio_masa_subterranea
                WHERE cod_municipio = $1
            )
            SELECT ROUND((AVG(total) / 1e6)::numeric, 4) AS infiltracion_ah_media_hm3
            FROM (
                SELECT l.cod_masa, SUM(l.agua_infiltrada_m3) AS total
                FROM gold.agua_infiltrada_masa_subterranea l
                JOIN munis_masas mm USING (cod_masa)
                WHERE (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) = $2
                  AND (l.anio < $3 OR (l.anio = $3 AND l.mes <= $4))
                GROUP BY l.cod_masa
            ) t
            """,
            municipio, ah_actual, anio_fin, mes_fin,
        )
        n_pozos = await _qrow(
            """
            SELECT COUNT(*) AS n
            FROM public.pozos p
            JOIN public.municipio m ON m.cod_municipio = $1
            WHERE ST_Contains(m.geometry, p.geometry)
            """,
            municipio,
        )
        n_masas = await _qrow(
            """
            SELECT COUNT(*) AS n FROM public.municipio_masa_subterranea
            WHERE cod_municipio = $1
            """,
            municipio,
        )
        iph = await iph_pico(nombre_isla_iph(base["isla"]))

        return {
            "modo": "municipio",
            "municipio": base["nombre_municipio"],
            "isla": base["isla"],
            "mes_cerrado": f"{anio_fin}-{mes_fin:02d}",
            "ah_actual": ah_actual,
            "poblacion": poblacion,
            "poblacion_anio": pob[0]["anio"] if pob else None,
            "poblacion_var_pct": var_pct,
            "consumo_hm3": (consumo or {}).get("consumo_hm3"),
            "ocupacion_media_pct": (ocupa or {}).get("ocupacion_media_pct"),
            "ocupacion_mes_cerrado": f"{oc_anio}-{oc_mes:02d}",
            "infiltracion_ah_media_hm3": (lluvia or {}).get("infiltracion_ah_media_hm3"),
            "n_pozos": (n_pozos or {}).get("n"),
            "n_masas": (n_masas or {}).get("n"),
            "iph_pico": iph,
        }

    # ── Modo isla / Baleares ────────────────────────────────────────────
    isla_sql_outer = ""
    params: list = [anio_fin, mes_fin, ah_hist_desde, ah_actual]
    if isla:
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        isla_sql_outer = "AND isla = $5"
        params.append(isla)

    # KPIs de infiltracion por masa (acumulado AH actual vs media historica)
    lluvia = await _q(
        f"""
        WITH {MASA_ISLA_CTE},
        ah_sums AS (
            SELECT l.cod_masa, mi.isla, l.anio, l.mes,
                   (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) AS ah,
                   l.agua_infiltrada_m3
            FROM gold.agua_infiltrada_masa_subterranea l
            JOIN masa_isla mi USING (cod_masa)
        ),
        hist AS (
            SELECT cod_masa, AVG(total) AS media_ah
            FROM (
                SELECT cod_masa, ah, SUM(agua_infiltrada_m3) AS total
                FROM ah_sums
                WHERE ah BETWEEN $3 AND {ah_actual} - 1
                GROUP BY cod_masa, ah
            ) t
            GROUP BY cod_masa
        ),
        act AS (
            SELECT cod_masa, SUM(agua_infiltrada_m3) AS total_ah
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
            ROUND((SUM(total_ah) / 1e6)::numeric, 4) AS infiltracion_ah_hm3,
            ROUND((SUM(media_ah) / 1e6)::numeric, 4) AS infiltracion_ah_media_hm3,
            ROUND(((SUM(total_ah) - SUM(media_ah)) / NULLIF(SUM(media_ah), 0) * 100)::numeric, 1) AS desviacion_pct,
            COUNT(*) FILTER (WHERE (total_ah - media_ah) / NULLIF(media_ah, 0) < -0.15) AS masas_en_deficit,
            COUNT(*) AS masas_total
        FROM masa_stats
        WHERE 1=1 {isla_sql_outer}
        """,
        *params,
    )
    resumen_dict = lluvia[0] if lluvia else {}

    # Ocupacion media del ultimo mes consolidado (por isla si filtro;
    # en Baleares: media de las medias por isla para no sesgar por Mallorca)
    if isla:
        ocupa_sql = """
            SELECT ROUND((AVG(ocupacion_plazas_pct) * 100)::numeric, 1) AS ocupacion_media_pct
            FROM gold.ocupacion_turistica
            WHERE anio = $1 AND mes = $2 AND nombre_provincia = $3
        """
        ocupa_params: list = [oc_anio, oc_mes, isla]
    else:
        ocupa_sql = """
            SELECT ROUND((AVG(media_isla))::numeric, 1) AS ocupacion_media_pct
            FROM (
                SELECT nombre_provincia, AVG(ocupacion_plazas_pct) * 100 AS media_isla
                FROM gold.ocupacion_turistica
                WHERE anio = $1 AND mes = $2
                GROUP BY nombre_provincia
            ) t
        """
        ocupa_params = [oc_anio, oc_mes]
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

    iph = await iph_pico(nombre_isla_iph(isla) if isla else None)

    return {
        "modo": "isla",
        "mes_cerrado": f"{anio_fin}-{mes_fin:02d}",
        "ah_actual": ah_actual,
        "infiltracion_ah_hm3": resumen_dict.get("infiltracion_ah_hm3"),
        "infiltracion_ah_media_hm3": resumen_dict.get("infiltracion_ah_media_hm3"),
        "desviacion_pct": resumen_dict.get("desviacion_pct"),
        "masas_en_deficit": resumen_dict.get("masas_en_deficit"),
        "masas_total": resumen_dict.get("masas_total"),
        "iph_pico": iph,
        "ocupacion_media_pct": (ocupacion or {}).get("ocupacion_media_pct"),
        "ocupacion_mes_cerrado": f"{oc_anio}-{oc_mes:02d}",
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


@router.get("/municipios")
async def municipios(isla: str | None = Query(default=None)):
    if isla and isla not in ISLAS:
        raise HTTPException(400, f"isla no valida: {isla}")
    rows = await _q(
        """
        SELECT m.cod_municipio, m.nombre_municipio, p.nombre_provincia AS isla
        FROM public.municipio m
        JOIN public.provincia p USING (cod_provincia)
        """ + ("WHERE p.nombre_provincia = $1 " if isla else "")
        + "ORDER BY m.nombre_municipio",
        *([isla] if isla else []),
    )
    return {"municipios": rows}


@router.get("/masas")
async def masas(isla: str | None = Query(default=None)):
    if isla and isla not in ISLAS:
        raise HTTPException(400, f"isla no valida: {isla}")
    rows = await _q(
        f"""
        WITH {MASA_ISLA_CTE}
        SELECT m.cod_masa, m.nombre_masa, mi.isla
        FROM public.masa_subterranea m
        JOIN masa_isla mi USING (cod_masa)
        """ + ("WHERE mi.isla = $1 " if isla else "")
        + "ORDER BY m.nombre_masa",
        *([isla] if isla else []),
    )
    return {"masas": rows}


@router.get("/abastecimiento")
async def abastecimiento(
    isla: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
):
    if municipio:
        serie = await _q(
            """
            SELECT anio,
                   ROUND(subterranea_hm3::numeric, 2) AS subterranea_hm3,
                   ROUND(desalinizada_hm3::numeric, 2) AS desalinizada_hm3,
                   ROUND(indiferenciada_hm3::numeric, 2) AS indiferenciada_hm3,
                   ROUND(superficial_hm3::numeric, 2) AS superficial_hm3,
                   ROUND(potabilizada_hm3::numeric, 2) AS potabilizada_hm3,
                   ROUND(otros_destinos_hm3::numeric, 2) AS otros_destinos_hm3,
                   ROUND(total_suministrado_hm3::numeric, 2) AS total_suministrado_hm3,
                   ROUND(consumo_hm3::numeric, 2) AS consumo_hm3
            FROM gold.abastecimiento_urbano_baleares
            WHERE cod_municipio = $1
            ORDER BY anio
            """,
            municipio,
        )
        meta = await _qrow(
            "SELECT nombre_municipio FROM public.municipio WHERE cod_municipio = $1",
            municipio,
        )
        return {
            "isla": (meta or {}).get("nombre_municipio", municipio),
            "municipio": municipio,
            "serie": serie,
            "top_municipios": [],
        }

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

    # Poblacion censal anual por serie NUTS (Eivissa i Formentera agrupadas)
    poblacion = await _q(
        """
        SELECT c.anio, c.nombre_provincia, SUM(c.poblacion) AS poblacion
        FROM gold.censo_municipal_baleares c
        GROUP BY c.anio, c.nombre_provincia
        ORDER BY c.anio, c.nombre_provincia
        """
    )

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
        return {"isla": isla, "serie": serie, "referencia": referencia, "poblacion": poblacion}

    serie = await _q(
        """
        SELECT nombre_isla, anio, mes, iph FROM gold.presion_humana
        WHERE anio >= 2015 ORDER BY nombre_isla, anio, mes
        """
    )
    return {"isla": "Baleares", "serie": serie, "referencia": [], "poblacion": poblacion}


@router.get("/ocupacion")
async def ocupacion(
    isla: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
):
    if municipio:
        tipo_sql = ""
        params: list = [municipio]
        if tipo:
            if tipo not in ("hotelera", "apartamentos"):
                raise HTTPException(400, "tipo debe ser hotelera o apartamentos")
            tipo_sql = " AND tipo_alojamiento = $2"
            params.append(tipo)
        serie = await _q(
            f"""
            SELECT nombre_municipio AS isla, tipo_alojamiento AS tipo,
                   anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
            FROM gold.ocupacion_turistica
            WHERE cod_municipio_ine = $1 {tipo_sql}
            GROUP BY nombre_municipio, tipo_alojamiento, anio, mes
            ORDER BY tipo, anio, mes
            """,
            *params,
        )
        return {"isla": municipio, "municipio": municipio, "serie": serie}

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

    if isla:
        serie = await _q(
            f"""
            SELECT nombre_provincia AS isla, tipo_alojamiento AS tipo,
                   anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
            FROM gold.ocupacion_turistica
            WHERE 1=1 {isla_sql}
            GROUP BY nombre_provincia, tipo_alojamiento, anio, mes
            ORDER BY tipo, anio, mes
            """,
            *params,
        )
        return {"isla": isla, "serie": serie}

    # Baleares: media de todas las islas por tipo y mes
    serie = await _q(
        f"""
        SELECT tipo_alojamiento AS tipo,
               anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
        FROM gold.ocupacion_turistica
        WHERE 1=1 {isla_sql}
        GROUP BY tipo_alojamiento, anio, mes
        ORDER BY tipo, anio, mes
        """,
        *params,
    )
    return {"isla": "Baleares", "serie": serie}


@router.get("/ocupacion/ranking")
async def ocupacion_ranking(
    isla: str | None = Query(default=None),
    anio: int | None = Query(default=None),
    tipo: str | None = Query(default=None),
):
    if isla and isla not in ISLAS:
        raise HTTPException(400, f"isla no valida: {isla}")
    if tipo and tipo not in ("hotelera", "apartamentos"):
        raise HTTPException(400, "tipo debe ser hotelera o apartamentos")
    if anio is None:
        anio_max = await _qrow(
            "SELECT MAX(anio) AS anio FROM gold.ocupacion_turistica"
        )
        anio = anio_max["anio"]

    isla_sql = "AND o.nombre_provincia = $2" if isla else ""
    tipo_sql = "AND o.tipo_alojamiento = $3" if tipo else ""
    params: list = [anio]
    if isla:
        params.append(isla)
    if tipo:
        params.append(tipo)

    rows = await _q(
        f"""
        SELECT o.cod_municipio_ine, o.nombre_municipio, o.nombre_provincia AS isla,
               ROUND((AVG(o.ocupacion_plazas_pct) * 100)::numeric, 1) AS ocupacion_media_pct,
               COUNT(*) AS meses_con_datos
        FROM gold.ocupacion_turistica o
        WHERE o.anio = $1 {isla_sql} {tipo_sql}
        GROUP BY o.cod_municipio_ine, o.nombre_municipio, o.nombre_provincia
        ORDER BY ocupacion_media_pct DESC NULLS LAST
        """,
        *params,
    )
    return {"anio": anio, "tipo": tipo or "ambos", "municipios": rows}


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

        inf = await _qrow(
            """
            WITH hist AS (
                SELECT AVG(total) AS media_ah FROM (
                    SELECT (anio + CASE WHEN mes >= 9 THEN 1 ELSE 0 END) AS ah,
                           SUM(agua_infiltrada_m3) AS total
                    FROM gold.agua_infiltrada_masa_subterranea
                    WHERE cod_masa = $1
                      AND (anio + CASE WHEN mes >= 9 THEN 1 ELSE 0 END) BETWEEN $2 AND $3 - 1
                    GROUP BY ah
                ) t
            ),
            act AS (
                SELECT SUM(agua_infiltrada_m3) AS total_ah
                FROM gold.agua_infiltrada_masa_subterranea
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
            SELECT l.agua_infiltrada_m3, r.media_m3
            FROM gold.agua_infiltrada_masa_subterranea l,
                 (SELECT ROUND(AVG(agua_infiltrada_m3)::numeric, 2) AS media_m3
                  FROM gold.agua_infiltrada_masa_subterranea
                  WHERE cod_masa = $1 AND mes = $2 AND anio BETWEEN 2015 AND 2025) r
            WHERE l.cod_masa = $1 AND l.anio = $3 AND l.mes = $2
            LIMIT 1
            """,
            cod, mes_fin, anio_fin,
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
            SELECT anio, mes, ROUND((agua_infiltrada_m3 / 1e6)::numeric, 4) AS agua_infiltrada_hm3
            FROM gold.agua_infiltrada_masa_subterranea
            WHERE cod_masa = $1
              AND (anio * 12 + mes) > $2 * 12 + $3 - 24
            ORDER BY anio, mes
            """,
            cod, anio_fin, mes_fin,
        )
        bal = await _qrow(
            """
            SELECT anio, disponibilidad_hm3, extraccion_hm3,
                   explotacion_porcentaje, estado_cuantitativo
            FROM gold.balance_hidrico_baleares
            WHERE cod_masa = $1
            ORDER BY anio DESC LIMIT 1
            """,
            cod,
        )
        return {
            "tipo": "masa",
            "nombre": base["nombre_masa"],
            "isla": base["isla"],
            "infiltracion_ah_hm3": round(inf["total_ah"] / 1e6, 4) if inf and inf["total_ah"] is not None else None,
            "infiltracion_ah_media_hm3": round(inf["media_ah"] / 1e6, 4) if inf and inf["media_ah"] is not None else None,
            "desviacion_pct": (
                round((inf["total_ah"] - inf["media_ah"]) / inf["media_ah"] * 100, 1)
                if inf and inf["total_ah"] is not None and inf["media_ah"]
                else None
            ),
            "infiltracion_ultimo_mes_hm3": round(float(ult_mes["agua_infiltrada_m3"]) / 1e6, 4) if ult_mes and ult_mes["agua_infiltrada_m3"] is not None else None,
            "infiltracion_media_ultimo_mes_hm3": round(float(ult_mes["media_m3"]) / 1e6, 4) if ult_mes and ult_mes["media_m3"] is not None else None,
            "n_municipios": munis["n_municipios"] if munis else 0,
            "demanda_hm3": munis["demanda_hm3"] if munis else None,
            "sparkline_infiltracion": spark,
            "balance": bal,
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
        # Ocupacion con ventana propia del municipio (su ultimo mes con datos)
        ocupa = await _qrow(
            """
            SELECT anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
            FROM gold.ocupacion_turistica
            WHERE cod_municipio_ine = $1
              AND (anio, mes) = (
                  SELECT anio, mes FROM gold.ocupacion_turistica
                  WHERE cod_municipio_ine = $1
                  ORDER BY anio * 12 + mes DESC LIMIT 1
              )
            GROUP BY anio, mes
            """,
            cod,
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
            SELECT ROUND((AVG(total) / 1e6)::numeric, 4) AS infiltracion_ah_media_hm3
            FROM (
                SELECT l.cod_masa, SUM(l.agua_infiltrada_m3) AS total
                FROM gold.agua_infiltrada_masa_subterranea l
                JOIN munis_masas mm USING (cod_masa)
                WHERE (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) = $2
                  AND (l.anio < $3 OR (l.anio = $3 AND l.mes <= $4))
                GROUP BY l.cod_masa
            ) t
            """,
            cod, ah_actual, anio_fin, mes_fin,
        )
        n_pozos = await _qrow(
            """
            SELECT COUNT(*) AS n
            FROM public.pozos p
            JOIN public.municipio m ON m.cod_municipio = $1
            WHERE ST_Contains(m.geometry, p.geometry)
            """,
            cod,
        )
        spark = await _q(
            """
            SELECT anio, mes, ROUND(AVG(ocupacion_plazas_pct)::numeric * 100, 1) AS ocupacion_pct
            FROM gold.ocupacion_turistica
            WHERE cod_municipio_ine = $1
              AND (anio * 12 + mes) > (
                  SELECT MAX(anio * 12 + mes) - 12
                  FROM gold.ocupacion_turistica
                  WHERE cod_municipio_ine = $1
              )
            GROUP BY anio, mes ORDER BY anio, mes
            """,
            cod,
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
            "ocupacion_mes_cerrado": f"{ocupa['anio']}-{ocupa['mes']:02d}" if ocupa else None,
            "n_masas": len(masas),
            "masas": masas,
            "infiltracion_ah_media_hm3": lluvia_masas["infiltracion_ah_media_hm3"] if lluvia_masas else None,
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
            WITH ah_sums AS (
                SELECT l.cod_masa, l.anio, l.mes,
                       (l.anio + CASE WHEN l.mes >= 9 THEN 1 ELSE 0 END) AS ah,
                       l.agua_infiltrada_m3
                FROM gold.agua_infiltrada_masa_subterranea l
                JOIN public.masa_subterranea m ON m.cod_masa = l.cod_masa
                WHERE m.id_unidad_demanda = $1
            ),
            hist AS (
                SELECT cod_masa, AVG(total) AS media_ah
                FROM (
                    SELECT cod_masa, ah, SUM(agua_infiltrada_m3) AS total
                    FROM ah_sums
                    WHERE ah BETWEEN $2 AND $3 - 1
                    GROUP BY cod_masa, ah
                ) t
                GROUP BY cod_masa
            ),
            act AS (
                SELECT cod_masa, SUM(agua_infiltrada_m3) AS total_ah
                FROM ah_sums
                WHERE ah = $3
                  AND (anio < $4 OR (anio = $4 AND mes <= $5))
                GROUP BY cod_masa
            )
            SELECT
                ROUND((AVG(act.total_ah) / 1e6)::numeric, 4) AS infiltracion_ah_media_hm3,
                ROUND(((AVG(act.total_ah) - AVG(h.media_ah)) / NULLIF(AVG(h.media_ah), 0) * 100)::numeric, 1) AS desviacion_pct
            FROM act
            JOIN hist h USING (cod_masa)
            """,
            cod_id, ah_hist_desde, ah_actual, anio_fin, mes_fin,
        )
        masas_ud = await _q(
            """
            SELECT cod_masa, nombre_masa
            FROM public.masa_subterranea
            WHERE id_unidad_demanda = $1
            ORDER BY nombre_masa
            """,
            cod_id,
        )
        bal_ud = await _qrow(
            """
            SELECT
                b.anio,
                ROUND(SUM(b.disponibilidad_hm3)::numeric, 3) AS disponibilidad_hm3,
                ROUND(SUM(b.extraccion_hm3)::numeric, 3) AS extraccion_hm3,
                ROUND((SUM(b.extraccion_hm3) / NULLIF(SUM(b.disponibilidad_hm3), 0))::numeric, 3) AS explotacion_porcentaje,
                COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'buen_estado') AS n_buen_estado,
                COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'en_riesgo') AS n_en_riesgo,
                COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'mal_estado') AS n_mal_estado
            FROM gold.balance_hidrico_baleares b
            JOIN public.masa_subterranea m ON m.cod_masa = b.cod_masa
            WHERE m.id_unidad_demanda = $1
              AND b.anio = (SELECT MAX(anio) FROM gold.balance_hidrico_baleares)
            GROUP BY b.anio
            """,
            cod_id,
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
            "infiltracion_ah_media_hm3": (lluvia or {}).get("infiltracion_ah_media_hm3"),
            "desviacion_pct": (lluvia or {}).get("desviacion_pct"),
            "masas": masas_ud,
            "balance": bal_ud,
        }

    raise HTTPException(404, f"tipo de entidad desconocido: {tipo}")


@router.get("/infiltrada")
async def infiltrada(
    isla: str | None = Query(default=None),
    masa: str | None = Query(default=None),
):
    if masa:
        serie = await _q(
            """
            SELECT anio, mes, ROUND((agua_infiltrada_m3 / 1e6)::numeric, 4) AS agua_infiltrada_hm3
            FROM gold.agua_infiltrada_masa_subterranea
            WHERE cod_masa = $1 AND anio >= 2015
            ORDER BY anio, mes
            """,
            masa,
        )
        referencia = await _q(
            """
            SELECT mes, ROUND((AVG(agua_infiltrada_m3 / 1e6))::numeric, 4) AS media_hm3
            FROM gold.agua_infiltrada_masa_subterranea
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
        SELECT anio, mes, ROUND((SUM(l.agua_infiltrada_m3 / 1e6))::numeric, 4) AS agua_infiltrada_hm3
        FROM gold.agua_infiltrada_masa_subterranea l
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
        SELECT mes, ROUND((SUM(l.agua_infiltrada_m3 / 1e6) / COUNT(DISTINCT l.anio))::numeric, 4) AS media_hm3
        FROM gold.agua_infiltrada_masa_subterranea l
        JOIN masa_isla mi USING (cod_masa)
        WHERE anio BETWEEN 2015 AND 2025 {isla_sql}
        GROUP BY mes ORDER BY mes
        """,
        *params,
    )
    return {"isla": isla or "Baleares", "serie": serie, "referencia": referencia}


@router.get("/infiltrada/ranking")
async def infiltrada_ranking(isla: str | None = Query(default=None)):
    anio_fin, mes_fin, ah_actual, ah_hist_desde = _ah_params()
    isla_sql = ""
    params: list = [ah_hist_desde, ah_actual, anio_fin, mes_fin]
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
                   l.agua_infiltrada_m3
            FROM gold.agua_infiltrada_masa_subterranea l
            JOIN masa_isla mi USING (cod_masa)
        ),
        hist AS (
            SELECT cod_masa, AVG(total) AS media_ah
            FROM (
                SELECT cod_masa, ah, SUM(agua_infiltrada_m3) AS total
                FROM ah_sums
                WHERE ah BETWEEN $1 AND $2 - 1
                GROUP BY cod_masa, ah
            ) t
            GROUP BY cod_masa
        ),
        act AS (
            SELECT cod_masa, SUM(agua_infiltrada_m3) AS total_ah
            FROM ah_sums
            WHERE ah = $2 AND (anio < $3 OR (anio = $3 AND mes <= $4))
            GROUP BY cod_masa
        )
        SELECT mi.cod_masa, m.nombre_masa, mi.isla,
               ROUND((act.total_ah / 1e6)::numeric, 4) AS ah_actual_hm3,
               ROUND((h.media_ah / 1e6)::numeric, 4) AS ah_media_hm3,
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


@router.get("/uds")
async def uds(isla: str | None = Query(default=None)):
    if isla and isla not in ISLAS:
        raise HTTPException(400, f"isla no valida: {isla}")
    rows = await _q(
        """
        SELECT ud.id_unidad_demanda, ud.nombre, p.nombre_provincia AS isla
        FROM public.unidad_demanda ud
        JOIN public.provincia p USING (cod_provincia)
        """ + ("WHERE p.nombre_provincia = $1 " if isla else "")
        + "ORDER BY ud.nombre",
        *([isla] if isla else []),
    )
    return {"uds": rows}


_BALANCE_SUMS = """
        anio,
        ROUND(SUM(infiltracion_lluvia_hm3)::numeric, 3) AS infiltracion_lluvia_hm3,
        ROUND(SUM(infiltracion_torrentes_hm3)::numeric, 3) AS infiltracion_torrentes_hm3,
        ROUND(SUM(retorno_riegos_hm3)::numeric, 3) AS retorno_riegos_hm3,
        ROUND(SUM(perdida_redes_abastecimiento_hm3)::numeric, 3) AS perdida_redes_abastecimiento_hm3,
        ROUND(SUM(perdida_redes_alcantarillado_hm3)::numeric, 3) AS perdida_redes_alcantarillado_hm3,
        ROUND(SUM(intrusion_salina_hm3)::numeric, 3) AS intrusion_salina_hm3,
        ROUND(SUM(suma_entradas_hm3)::numeric, 3) AS suma_entradas_hm3,
        ROUND(SUM(diferencia_vs_rp_hm3)::numeric, 3) AS diferencia_vs_rp_hm3,
        ROUND(SUM(abastecimiento_urbano_hm3)::numeric, 3) AS abastecimiento_urbano_hm3,
        ROUND(SUM(torrentes_hm3)::numeric, 3) AS torrentes_hm3,
        ROUND(SUM(manantiales_hm3)::numeric, 3) AS manantiales_hm3,
        ROUND(SUM(humedales_hm3)::numeric, 3) AS humedales_hm3,
        ROUND(SUM(salida_mar_hm3)::numeric, 3) AS salida_mar_hm3,
        ROUND(SUM(salida_zzhh_hm3)::numeric, 3) AS salida_zzhh_hm3,
        ROUND(SUM(suma_salidas_hm3)::numeric, 3) AS suma_salidas_hm3,
        ROUND(SUM(disponibilidad_hm3)::numeric, 3) AS disponibilidad_hm3,
        ROUND(SUM(extraccion_hm3)::numeric, 3) AS extraccion_hm3,
        ROUND((SUM(extraccion_hm3) / NULLIF(SUM(disponibilidad_hm3), 0))::numeric, 3) AS explotacion_porcentaje,
        COUNT(*) FILTER (WHERE estado_cuantitativo = 'buen_estado') AS n_buen_estado,
        COUNT(*) FILTER (WHERE estado_cuantitativo = 'en_riesgo') AS n_en_riesgo,
        COUNT(*) FILTER (WHERE estado_cuantitativo = 'mal_estado') AS n_mal_estado
"""


@router.get("/balance")
async def balance(
    nivel: str = Query(default="masa"),
    isla: str | None = Query(default=None),
    entidad: str | None = Query(default=None),
):
    if nivel not in ("masa", "ud"):
        raise HTTPException(400, "nivel debe ser masa o ud")
    if isla and isla not in ISLAS:
        raise HTTPException(400, f"isla no valida: {isla}")

    if nivel == "masa" and entidad:
        serie = await _q(
            """
            SELECT * FROM gold.balance_hidrico_baleares
            WHERE cod_masa = $1 ORDER BY anio
            """,
            entidad,
        )
        meta = await _qrow(
            """
            SELECT m.cod_masa, m.nombre_masa, p.nombre_provincia AS isla
            FROM public.masa_subterranea m
            JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
            JOIN public.provincia p USING (cod_provincia)
            WHERE m.cod_masa = $1
            """,
            entidad,
        )
        return {"nivel": "masa", "masa": meta, "serie": serie}

    if nivel == "ud" and entidad:
        try:
            ud_id = int(entidad)
        except ValueError:
            raise HTTPException(404, "unidad de demanda no encontrada")
        serie = await _q(
            f"""
            SELECT {_BALANCE_SUMS}
            FROM gold.balance_hidrico_baleares b
            JOIN public.masa_subterranea m ON m.cod_masa = b.cod_masa
            WHERE m.id_unidad_demanda = $1
            GROUP BY anio ORDER BY anio
            """,
            ud_id,
        )
        meta = await _qrow(
            """
            SELECT ud.id_unidad_demanda, ud.nombre, p.nombre_provincia AS isla
            FROM public.unidad_demanda ud
            JOIN public.provincia p USING (cod_provincia)
            WHERE ud.id_unidad_demanda = $1
            """,
            ud_id,
        )
        return {"nivel": "ud", "ud": meta, "serie": serie}

    # Agregado por isla (o Baleares)
    if nivel == "masa":
        isla_sql = "AND mi.isla = $1" if isla else ""
        params: list = [isla] if isla else []
        serie = await _q(
            f"""
            WITH {MASA_ISLA_CTE},
            b AS (
                SELECT b.* FROM gold.balance_hidrico_baleares b
                JOIN masa_isla mi USING (cod_masa)
                WHERE 1=1 {isla_sql}
            )
            SELECT {_BALANCE_SUMS} FROM b GROUP BY anio ORDER BY anio
            """,
            *params,
        )
    else:
        isla_sql = "AND p.nombre_provincia = $1" if isla else ""
        params: list = [isla] if isla else []
        serie = await _q(
            f"""
            WITH b AS (
                SELECT b.* FROM gold.balance_hidrico_baleares b
                JOIN public.masa_subterranea m ON m.cod_masa = b.cod_masa
                JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
                JOIN public.provincia p USING (cod_provincia)
                WHERE 1=1 {isla_sql}
            )
            SELECT {_BALANCE_SUMS} FROM b GROUP BY anio ORDER BY anio
            """,
            *params,
        )

    return {"nivel": nivel, "isla": isla or "Baleares", "serie": serie}


@router.get("/balance/ranking")
async def balance_ranking(
    nivel: str = Query(default="masa"),
    isla: str | None = Query(default=None),
    anio: int | None = Query(default=None),
):
    if nivel not in ("masa", "ud"):
        raise HTTPException(400, "nivel debe ser masa o ud")
    if isla and isla not in ISLAS:
        raise HTTPException(400, f"isla no valida: {isla}")

    if anio is None:
        anio_max = await _qrow(
            "SELECT MAX(anio) AS anio FROM gold.balance_hidrico_baleares"
        )
        anio = anio_max["anio"]

    if nivel == "masa":
        isla_sql = "AND mi.isla = $2" if isla else ""
        rows = await _q(
            f"""
            WITH {MASA_ISLA_CTE}
            SELECT b.cod_masa, m.nombre_masa, mi.isla,
                   b.explotacion_porcentaje, b.disponibilidad_hm3,
                   b.extraccion_hm3, b.estado_cuantitativo
            FROM gold.balance_hidrico_baleares b
            JOIN public.masa_subterranea m USING (cod_masa)
            JOIN masa_isla mi USING (cod_masa)
            WHERE b.anio = $1 {isla_sql}
            ORDER BY b.explotacion_porcentaje DESC NULLS LAST
            """,
            anio, *([isla] if isla else []),
        )
        return {"anio": anio, "nivel": "masa", "masas": rows}

    isla_sql = "AND p.nombre_provincia = $2" if isla else ""
    rows = await _q(
        f"""
        SELECT ud.id_unidad_demanda, ud.nombre, p.nombre_provincia AS isla,
               ROUND((SUM(b.extraccion_hm3) / NULLIF(SUM(b.disponibilidad_hm3), 0))::numeric, 3) AS explotacion_porcentaje,
               ROUND(SUM(b.disponibilidad_hm3)::numeric, 3) AS disponibilidad_hm3,
               ROUND(SUM(b.extraccion_hm3)::numeric, 3) AS extraccion_hm3,
               COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'buen_estado') AS n_buen_estado,
               COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'en_riesgo') AS n_en_riesgo,
               COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'mal_estado') AS n_mal_estado
        FROM gold.balance_hidrico_baleares b
        JOIN public.masa_subterranea m ON m.cod_masa = b.cod_masa
        JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
        JOIN public.provincia p USING (cod_provincia)
        WHERE b.anio = $1 {isla_sql}
        GROUP BY ud.id_unidad_demanda, ud.nombre, p.nombre_provincia
        ORDER BY explotacion_porcentaje DESC NULLS LAST
        """,
        anio, *([isla] if isla else []),
    )
    return {"anio": anio, "nivel": "ud", "uds": rows}
