"""Endpoint de simulacion de consumo urbano (modelos joblib entrenados en notebook 11)."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from database import get_pool
from simulacion_service import ModelosError, elasticidades, predecir_recursivo, tiene_modelos

router = APIRouter(
    prefix="/api/v1/simulacion",
    tags=["simulacion"],
)

ISLAS = {"Mallorca", "Menorca", "Eivissa", "Formentera"}
NUTS_ISLA = {"Eivissa": "Eivissa i Formentera", "Formentera": "Eivissa i Formentera"}
COLORES = ["#3b82f6", "#f59e0b", "#a855f7"]
MAX_HORIZONTE = 10
MAX_ESCENARIOS = 5


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
        for k in ("iph_pct", "ocupacion_pct", "lluvia_pct"):
            v = float(e.get(k, 0.0))
            if not -0.5 <= v <= 0.5:
                raise HTTPException(400, f"{k} fuera de rango [-50%, +50%]")
            e[k] = v
        e["nombre"] = str(e.get("nombre") or e["id"])
    return escenarios


@router.get("/consumo")
async def consumo(
    isla: str | None = Query(default=None),
    municipio: str | None = Query(default=None),
    hasta: int = Query(default=2030),
    escenarios: str = Query(
        default='[{"id":"tendencial","nombre":"Tendencial","iph_pct":0,"ocupacion_pct":0,"lluvia_pct":0}]'
    ),
):
    if not tiene_modelos():
        raise HTTPException(503, "modelos no disponibles: ejecuta el notebook 11 (models/municipio/*.joblib)")

    escs = _parse_escenarios(escenarios)
    elasts = elasticidades()

    # ── Ambito y municipios
    if municipio:
        m = await _qrow(
            "SELECT cod_municipio, nombre_municipio, cod_provincia FROM public.municipio WHERE cod_municipio = $1",
            municipio,
        )
        if m is None:
            raise HTTPException(404, f"municipio no encontrado: {municipio}")
        municipios = [m]
        ambito = m["nombre_municipio"]
    elif isla:
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
        ambito = isla
    else:
        raise HTTPException(400, "indica isla o municipio")

    # ── Historico de consumo
    if municipio:
        serie = await _q(
            "SELECT anio, ROUND(consumo_hm3::numeric, 3) AS consumo_hm3 "
            "FROM gold.abastecimiento_urbano_baleares WHERE cod_municipio = $1 ORDER BY anio",
            municipio,
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

    if not base_anio + 1 <= hasta <= base_anio + MAX_HORIZONTE:
        raise HTTPException(400, f"hasta debe estar entre {base_anio + 1} y {base_anio + MAX_HORIZONTE}")

    # ── Features base (ultimo anio completo)
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

    # ── Predicciones por escenario
    n_anios = hasta - base_anio
    escenarios_out = []
    municipios_out: dict[str, list[dict]] = {}
    for i, e in enumerate(escs):
        pct = {"iph": e["iph_pct"], "ocupacion": e["ocupacion_pct"], "lluvia": e["lluvia_pct"]}
        proy_por_mun: dict[str, list[dict]] = {}
        final_por_mun: dict[str, float] = {}
        for m in municipios:
            cod = str(m["cod_municipio"])
            try:
                proy = predecir_recursivo(cod, base_row(m), hasta, pct)
            except ModelosError:
                continue
            proy_por_mun[cod] = proy
            final_por_mun[cod] = proy[-1]["consumo_hm3"] if proy else consumo_base.get(cod, 0.0)

        if not proy_por_mun:
            continue

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
