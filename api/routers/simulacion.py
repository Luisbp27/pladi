"""Endpoints de simulacion: consumo urbano proyectado + cruce con el balance hidrico."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from balance_service import proyectar_balance
from database import get_pool
from simulacion_service import (
    ModelosError,
    elasticidades,
    predecir_recursivo,
    tiene_modelos,
    version_info,
)

router = APIRouter(
    prefix="/api/v1/simulacion",
    tags=["simulacion"],
)

ISLAS = {"Mallorca", "Menorca", "Eivissa", "Formentera"}
NUTS_ISLA = {"Eivissa": "Eivissa i Formentera", "Formentera": "Eivissa i Formentera"}
COLORES = ["#3b82f6", "#f59e0b", "#a855f7", "#22c55e", "#0ea5e9"]
MAX_HORIZONTE = 10
MAX_ESCENARIOS = 5

MASA_ISLA_JOIN = """
    JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
    JOIN public.provincia p ON p.cod_provincia = ud.cod_provincia
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


def _parse_escenarios(raw: str) -> list[dict]:
    try:
        escenarios = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        raise HTTPException(400, f"escenarios invalido (JSON): {e}") from e
    if not isinstance(escenarios, list) or not escenarios:
        raise HTTPException(400, "escenarios debe ser una lista no vacia")
    if len(escenarios) > MAX_ESCENARIOS:
        raise HTTPException(400, f"maximo {MAX_ESCENARIOS} escenarios")
    for e in escenarios:
        if not isinstance(e, dict) or "id" not in e:
            raise HTTPException(400, "cada escenario necesita id")
        # las claves antiguas con ocupacion_pct se aceptan pero se ignoran (no hay
        # efecto causal identificado de la ocupacion anual sobre el consumo)
        for k in ("iph_pct", "censo_pct", "lluvia_pct"):
            v = float(e.get(k, 0.0))
            if not -50.0 <= v <= 50.0:
                raise HTTPException(400, f"{k} fuera de rango [-50%, +50%]")
            e[k] = v / 100.0  # el front envia puntos porcentuales; el servicio trabaja en fraccion
        e["nombre"] = str(e.get("nombre") or e["id"])
    return escenarios


async def _resolver_ambito(isla: str | None, municipio: str | None) -> tuple[list[dict], str]:
    if municipio:
        m = await _qrow(
            "SELECT cod_municipio, nombre_municipio, cod_provincia FROM public.municipio WHERE cod_municipio = $1",
            municipio,
        )
        if m is None:
            raise HTTPException(404, f"municipio no encontrado: {municipio}")
        return [m], m["nombre_municipio"]
    if isla:
        if isla == "Baleares":
            municipios = await _q(
                "SELECT cod_municipio, nombre_municipio, cod_provincia FROM public.municipio "
                "ORDER BY cod_provincia, nombre_municipio"
            )
            return municipios, "Baleares"
        if isla not in ISLAS:
            raise HTTPException(400, f"isla no valida: {isla}")
        prov = await _qrow(
            "SELECT cod_provincia, nombre_provincia FROM public.provincia WHERE nombre_provincia = $1", isla
        )
        if prov is None:
            raise HTTPException(404, f"isla no encontrada: {isla}")
        municipios = await _q(
            "SELECT cod_municipio, nombre_municipio, cod_provincia FROM public.municipio "
            "WHERE cod_provincia = $1 ORDER BY nombre_municipio",
            prov["cod_provincia"],
        )
        return municipios, isla
    raise HTTPException(400, "indica isla o municipio")


async def _serie_historica(isla: str | None, municipio: str | None) -> tuple[list[dict], int]:
    if municipio:
        serie = await _q(
            "SELECT anio, ROUND(consumo_hm3::numeric, 3) AS consumo_hm3 "
            "FROM gold.abastecimiento_urbano_baleares WHERE cod_municipio = $1 ORDER BY anio",
            municipio,
        )
    elif isla == "Baleares":
        serie = await _q(
            "SELECT anio, ROUND(SUM(consumo_hm3)::numeric, 3) AS consumo_hm3 "
            "FROM gold.abastecimiento_urbano_baleares GROUP BY anio ORDER BY anio"
        )
    else:
        serie = await _q(
            "SELECT anio, ROUND(SUM(consumo_hm3)::numeric, 3) AS consumo_hm3 "
            "FROM gold.abastecimiento_urbano_baleares WHERE nombre_provincia = $1 GROUP BY anio ORDER BY anio",
            isla,
        )
    if not serie:
        raise HTTPException(404, "sin serie historica de consumo para el ambito")
    base_anio = int(serie[-1]["anio"])
    serie_historica = [{"anio": int(r["anio"]), "consumo_hm3": float(r["consumo_hm3"])} for r in serie]
    return serie_historica, base_anio


async def _features_base(base_anio: int) -> dict:
    """Features congeladas en el ultimo anio observado + consumo base por municipio.

    `iph_max` se mantiene solo por compatibilidad con bundles antiguos (rollback);
    el modelo activo (features 2026-09-12) usa unicamente `iph_media` como factor IPH.
    """
    iph = {
        r["nombre_isla"]: r
        for r in await _q(
            "SELECT nombre_isla, AVG(iph) AS iph_media, MAX(iph) AS iph_max "
            "FROM gold.presion_humana WHERE anio = $1 GROUP BY nombre_isla",
            base_anio,
        )
    }
    ocup = {
        str(r["cod_municipio_ine"]): float(r["ocupacion_media"])
        for r in await _q(
            "SELECT cod_municipio_ine, AVG(ocupacion_plazas_pct) AS ocupacion_media "
            "FROM gold.ocupacion_turistica WHERE anio = $1 GROUP BY cod_municipio_ine",
            base_anio,
        )
    }
    lluvia = {
        str(r["cod_municipio"]): float(r["lluvia_anual_mm"])
        for r in await _q(
            """
            SELECT m.cod_municipio, AVG(ll.lluvia_anual_mm) AS lluvia_anual_mm
            FROM public.municipio_masa_subterranea m
            JOIN (
                SELECT cod_masa, SUM(precipitacion_mm) AS lluvia_anual_mm
                FROM gold.lluvia_masa_subterranea WHERE anio = $1 GROUP BY cod_masa
            ) ll ON ll.cod_masa = m.cod_masa
            GROUP BY m.cod_municipio
            """,
            base_anio,
        )
    }
    lluvia_media = sum(lluvia.values()) / len(lluvia) if lluvia else 0.0

    consumo_base = {
        str(r["cod_municipio"]): float(r["consumo_hm3"])
        for r in await _q(
            "SELECT cod_municipio, consumo_hm3 FROM gold.abastecimiento_urbano_baleares WHERE anio = $1",
            base_anio,
        )
    }

    provincias = await _q("SELECT cod_provincia, nombre_provincia FROM public.provincia")
    prov_map = {str(p["cod_provincia"]): p["nombre_provincia"] for p in provincias}

    def base_row(m: dict) -> dict:
        cod = str(m["cod_municipio"])
        prov = prov_map.get(str(m["cod_provincia"]), "")
        isla_nuts = NUTS_ISLA.get(prov, prov)
        iph_r = iph.get(isla_nuts, {})
        return {
            "anio": float(base_anio),
            "lag1": consumo_base.get(cod, 0.0),
            "iph_media": float(iph_r.get("iph_media", 0.0)),
            "iph_max": float(iph_r.get("iph_max", 0.0)),
            "ocupacion_media": ocup.get(cod, 0.0),
            "lluvia_anual_mm": lluvia.get(cod, lluvia_media),
        }

    return {
        "consumo_base": consumo_base,
        "prov_map": prov_map,
        "base_row": base_row,
    }


def _proyectar(
    municipios: list[dict], base_anio: int, hasta: int, escs: list[dict], feats: dict
) -> dict[str, dict[str, list[dict]]]:
    """Prediccion recursiva por municipio y escenario: {esc_id: {cod_municipio: [puntos]}}."""
    out: dict[str, dict[str, list[dict]]] = {}
    for e in escs:
        pct = {"iph": e["iph_pct"], "censo": e["censo_pct"], "lluvia": e["lluvia_pct"]}
        proy_por_mun: dict[str, list[dict]] = {}
        for m in municipios:
            cod = str(m["cod_municipio"])
            try:
                proy_por_mun[cod] = predecir_recursivo(cod, feats["base_row"](m), hasta, pct)
            except ModelosError:
                continue
        out[e["id"]] = proy_por_mun
    return out


@router.get("/version")
async def version():
    """Metadatos de la version del modelo servida (registry ml.model_versions)."""
    if not tiene_modelos():
        raise HTTPException(503, "modelos no disponibles")
    return version_info()


@router.get("/consumo")
async def consumo(
    isla: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
    hasta: int = Query(default=2030),
    escenarios: str = Query(
        default='[{"id":"tendencial","nombre":"Tendencial","iph_pct":0,"censo_pct":0,"lluvia_pct":0}]'
    ),
):
    if not tiene_modelos():
        raise HTTPException(503, "modelos no disponibles: ejecuta el notebook 11 (models/municipio/*.joblib)")

    escs = _parse_escenarios(escenarios)
    elasts = elasticidades()

    municipios, ambito = await _resolver_ambito(isla, municipio)
    serie_historica, base_anio = await _serie_historica(isla, municipio)

    if not base_anio + 1 <= hasta <= base_anio + MAX_HORIZONTE:
        raise HTTPException(400, f"hasta debe estar entre {base_anio + 1} y {base_anio + MAX_HORIZONTE}")

    feats = await _features_base(base_anio)
    consumo_base = feats["consumo_base"]
    prov_map = feats["prov_map"]
    proy_por_esc = _proyectar(municipios, base_anio, hasta, escs, feats)

    n_anios = hasta - base_anio
    escenarios_out = []
    municipios_out: dict[str, list[dict]] = {}
    for i, e in enumerate(escs):
        proy_por_mun = proy_por_esc.get(e["id"], {})
        if not proy_por_mun:
            continue
        final_por_mun = {cod: proy[-1]["consumo_hm3"] for cod, proy in proy_por_mun.items() if proy}

        proyeccion = []
        for t in range(n_anios):
            anio = base_anio + 1 + t
            proyeccion.append(
                {
                    "anio": anio,
                    "consumo_hm3": round(sum(p[t]["consumo_hm3"] for p in proy_por_mun.values()), 3),
                    "lo": round(sum(p[t]["lo"] for p in proy_por_mun.values()), 3),
                    "hi": round(sum(p[t]["hi"] for p in proy_por_mun.values()), 3),
                }
            )

        final_total = sum(final_por_mun.values())
        base_total = sum(consumo_base.get(str(m["cod_municipio"]), 0.0) for m in municipios)
        kpis = {
            "consumo_final_hm3": round(final_total, 3),
            "delta_vs_base_pct": round(((final_total - base_total) / base_total) * 100, 1) if base_total else 0.0,
            "variacion_media_anual_pct": (
                round(((final_total / base_total) ** (1 / n_anios) - 1) * 100, 1) if base_total and n_anios else 0.0
            ),
            "sensibilidad": elasts,
        }
        escenarios_out.append(
            {
                "id": e["id"],
                "nombre": e["nombre"],
                "color": COLORES[i % len(COLORES)],
                "proyeccion": proyeccion,
                "kpis": kpis,
            }
        )

        municipios_out[e["id"]] = []
        for m in municipios:
            cod = str(m["cod_municipio"])
            base_m = consumo_base.get(cod, 0.0)
            final_m = final_por_mun.get(cod, base_m)
            municipios_out[e["id"]].append(
                {
                    "cod_municipio": cod,
                    "nombre_municipio": m["nombre_municipio"],
                    "isla": prov_map.get(str(m["cod_provincia"]), ""),
                    "base_hm3": round(base_m, 3),
                    "proy_hm3": round(final_m, 3),
                    "delta_pct": round(((final_m - base_m) / base_m) * 100, 1) if base_m else 0.0,
                }
            )

    if not escenarios_out:
        raise HTTPException(503, "sin modelos para los municipios del ambito")

    return {
        "ambito": ambito,
        "municipio": municipio,
        "base_anio": base_anio,
        "hasta": hasta,
        "serie_historica": serie_historica,
        "escenarios": escenarios_out,
        "municipios": municipios_out,
    }


@router.get("/balance")
async def balance(
    isla: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
    hasta: int = Query(default=2030),
    escenarios: str = Query(
        default='[{"id":"tendencial","nombre":"Tendencial","iph_pct":0,"censo_pct":0,"lluvia_pct":0}]'
    ),
):
    """Cruce de la simulacion de consumo con el balance hidrico (modelo DMA del gold)."""
    if not tiene_modelos():
        raise HTTPException(503, "modelos no disponibles: ejecuta el notebook 11 (models/municipio/*.joblib)")

    escs = _parse_escenarios(escenarios)

    municipios, ambito = await _resolver_ambito(isla, municipio)
    serie_historica, base_anio = await _serie_historica(isla, municipio)

    if not base_anio + 1 <= hasta <= base_anio + MAX_HORIZONTE:
        raise HTTPException(400, f"hasta debe estar entre {base_anio + 1} y {base_anio + MAX_HORIZONTE}")

    feats = await _features_base(base_anio)
    proy_por_esc = _proyectar(municipios, base_anio, hasta, escs, feats)

    # ── Masas del ambito con su ultima fila de balance (anio <= base)
    if municipio:
        masas = await _q(
            f"""
            WITH last_anio AS (
                SELECT cod_masa, MAX(anio) AS anio FROM gold.balance_hidrico_baleares
                WHERE anio <= $1 GROUP BY cod_masa
            )
            SELECT m.cod_masa, m.nombre_masa, p.nombre_provincia AS isla, b.*
            FROM public.municipio_masa_subterranea mms
            JOIN public.masa_subterranea m ON m.cod_masa = mms.cod_masa
            {MASA_ISLA_JOIN}
            JOIN last_anio l ON l.cod_masa = m.cod_masa
            JOIN gold.balance_hidrico_baleares b ON b.cod_masa = l.cod_masa AND b.anio = l.anio
            WHERE mms.cod_municipio = $2
            """,
            base_anio,
            municipio,
        )
    elif isla and isla != "Baleares":
        masas = await _q(
            f"""
            WITH last_anio AS (
                SELECT cod_masa, MAX(anio) AS anio FROM gold.balance_hidrico_baleares
                WHERE anio <= $1 GROUP BY cod_masa
            )
            SELECT m.cod_masa, m.nombre_masa, p.nombre_provincia AS isla, b.*
            FROM public.masa_subterranea m
            {MASA_ISLA_JOIN}
            JOIN last_anio l ON l.cod_masa = m.cod_masa
            JOIN gold.balance_hidrico_baleares b ON b.cod_masa = l.cod_masa AND b.anio = l.anio
            WHERE p.nombre_provincia = $2
            """,
            base_anio,
            isla,
        )
    else:
        masas = await _q(
            """
            WITH last_anio AS (
                SELECT cod_masa, MAX(anio) AS anio FROM gold.balance_hidrico_baleares
                WHERE anio <= $1 GROUP BY cod_masa
            )
            SELECT m.cod_masa, m.nombre_masa, p.nombre_provincia AS isla, b.*
            FROM public.masa_subterranea m
            JOIN public.unidad_demanda ud ON ud.id_unidad_demanda = m.id_unidad_demanda
            JOIN public.provincia p ON p.cod_provincia = ud.cod_provincia
            JOIN last_anio l ON l.cod_masa = m.cod_masa
            JOIN gold.balance_hidrico_baleares b ON b.cod_masa = l.cod_masa AND b.anio = l.anio
            """,
            base_anio,
        )

    # ── Pesos municipio→masa (misma normalizacion que el DAG del balance)
    pesos_rows = await _q(
        """
        SELECT cod_municipio, cod_masa,
               abastecimiento_agua_media_ponderada_anual_hm3
               / NULLIF(SUM(abastecimiento_agua_media_ponderada_anual_hm3)
                        OVER (PARTITION BY cod_municipio), 0) AS peso
        FROM public.municipio_masa_subterranea
        WHERE abastecimiento_agua_media_ponderada_anual_hm3 > 0
        """
    )
    pesos: dict[str, dict[str, float]] = {}
    for r in pesos_rows:
        pesos.setdefault(str(r["cod_municipio"]), {})[r["cod_masa"]] = float(r["peso"])

    notas = []
    if isla == "Formentera" or (isla == "Baleares" and not municipio):
        notas.append(
            "Formentera no tiene relacion municipio→masa (abastecimiento sin masas subterraneas mapeadas): "
            "su consumo no se distribuye al balance."
        )
    if municipio and not masas:
        notas.append("Este municipio no tiene masas subterraneas asociadas: no hay cruce con el balance.")

    escenarios_out = []
    for i, e in enumerate(escs):
        esc = proyectar_balance(
            masas=masas,
            pesos=pesos,
            proy_por_mun=proy_por_esc.get(e["id"], {}),
            consumo_base=feats["consumo_base"],
            base_anio=base_anio,
            hasta=hasta,
            lluvia_pct=e["lluvia_pct"],
        )
        esc["id"] = e["id"]
        esc["nombre"] = e["nombre"]
        esc["color"] = COLORES[i % len(COLORES)]
        escenarios_out.append(esc)

    return {
        "ambito": ambito,
        "municipio": municipio,
        "base_anio": base_anio,
        "hasta": hasta,
        "n_masas": len(masas),
        "nota": " ".join(notas) if notas else None,
        "escenarios": escenarios_out,
    }
