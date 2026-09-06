"""Cruce de la simulacion de consumo con el balance hidrico (modelo DMA del gold).

Replica las formulas del DAG `balance_hidrico_baleares` (include/gold/balance_hidrico_baleares.py):
- extraccion(t) = extraccion_base + Σ_mun (consumo_proy(mun,t) - consumo_base(mun)) x peso(mun,masa)
  con los pesos normalizados de public.municipio_masa_subterranea (misma normalizacion que el DAG).
- El escenario de lluvia escala la infiltracion y las salidas climaticas (torrentes/manantiales):
  componente(t) = componente_base x (1 + lluvia_pct). El resto de componentes se mantienen.
- disponibilidad = max((suma_entradas - intrusion) - (salida_mar + salida_zzhh), 0)
- explotacion = extraccion / disponibilidad (None si disponibilidad 0)
- estado DMA: <0.8 bueno, 0.8-1.0 riesgo, >1.0 o disp=0 malo
"""
from __future__ import annotations


def _estado(explotacion: float | None, disponibilidad: float | None) -> str | None:
    if disponibilidad is None:
        return None
    if disponibilidad == 0:
        return "mal_estado"
    if explotacion is None:
        return None
    if explotacion < 0.8:
        return "buen_estado"
    if explotacion <= 1.0:
        return "en_riesgo"
    return "mal_estado"


def _explotacion(extraccion: float, disponibilidad: float | None) -> float | None:
    if disponibilidad is None or disponibilidad <= 0:
        return None
    return extraccion / disponibilidad


_SEVERIDAD = {"buen_estado": 0, "en_riesgo": 1, "mal_estado": 2}


def proyectar_balance(
    masas: list[dict],
    pesos: dict[str, dict[str, float]],
    proy_por_mun: dict[str, list[dict]],
    consumo_base: dict[str, float],
    base_anio: int,
    hasta: int,
    lluvia_pct: float,
) -> dict:
    """Devuelve {serie, masas_cambio} para un escenario (sin id/nombre/color)."""
    lluvia_f = 1.0 + lluvia_pct

    def fila_masa(b: dict, delta_extraccion: float, lf: float) -> dict:
        inf_lluvia = float(b["infiltracion_lluvia_hm3"] or 0.0) * lf
        extraccion = max(float(b["extraccion_hm3"] or 0.0) + delta_extraccion, 0.0)
        suma_entradas = (
            inf_lluvia
            + float(b["infiltracion_torrentes_hm3"] or 0.0) * lf
            + float(b["retorno_riegos_hm3"] or 0.0)
            + float(b["perdida_redes_abastecimiento_hm3"] or 0.0)
            + float(b["perdida_redes_alcantarillado_hm3"] or 0.0)
            + float(b["intrusion_salina_hm3"] or 0.0)
        )
        salidas_no_urbanas = (
            float(b["torrentes_hm3"] or 0.0) * lf
            + float(b["manantiales_hm3"] or 0.0) * lf
            + float(b["humedales_hm3"] or 0.0)
        )
        disponibilidad = max(
            (suma_entradas - float(b["intrusion_salina_hm3"] or 0.0))
            - (float(b["salida_mar_hm3"] or 0.0) + float(b["salida_zzhh_hm3"] or 0.0)),
            0.0,
        )
        explotacion = _explotacion(extraccion, disponibilidad)
        estado = _estado(explotacion, disponibilidad)
        return {
            "extraccion": extraccion,
            "disponibilidad": disponibilidad,
            "explotacion": explotacion,
            "estado": estado,
        }

    # Anio base = estado observado (sin escalar por el escenario)
    base_filas: dict[str, dict] = {}
    for b in masas:
        base_filas[b["cod_masa"]] = fila_masa(b, 0.0, 1.0)

    # ── Serie anual (incluye el anio base como referencia observada)
    serie = []
    totales_base = {
        "n_buen_estado": 0,
        "n_en_riesgo": 0,
        "n_mal_estado": 0,
        "extraccion_total_hm3": 0.0,
        "disponibilidad_total_hm3": 0.0,
        "expl_sum": 0.0,
        "expl_n": 0,
    }
    for f in base_filas.values():
        key = f"n_{f['estado']}" if f["estado"] else None
        if key:
            totales_base[key] += 1
        totales_base["extraccion_total_hm3"] += f["extraccion"]
        totales_base["disponibilidad_total_hm3"] += f["disponibilidad"]
        if f["explotacion"] is not None:
            totales_base["expl_sum"] += f["explotacion"]
            totales_base["expl_n"] += 1
    serie.append(_serie_punto(base_anio, totales_base))

    masas_cambio = []

    for t in range(base_anio + 1, hasta + 1):
        idx = t - base_anio - 1
        totales = {
            "n_buen_estado": 0,
            "n_en_riesgo": 0,
            "n_mal_estado": 0,
            "extraccion_total_hm3": 0.0,
            "disponibilidad_total_hm3": 0.0,
            "expl_sum": 0.0,
            "expl_n": 0,
        }
        for b in masas:
            cod_masa = b["cod_masa"]
            delta = 0.0
            for mun, proy in proy_por_mun.items():
                peso = pesos.get(mun, {}).get(cod_masa, 0.0)
                if peso == 0.0:
                    continue
                cons_proy = proy[idx]["consumo_hm3"] if idx < len(proy) else consumo_base.get(mun, 0.0)
                delta += (cons_proy - consumo_base.get(mun, 0.0)) * peso
            f = fila_masa(b, delta, lluvia_f)
            key = f"n_{f['estado']}" if f["estado"] else None
            if key:
                totales[key] += 1
            totales["extraccion_total_hm3"] += f["extraccion"]
            totales["disponibilidad_total_hm3"] += f["disponibilidad"]
            if f["explotacion"] is not None:
                totales["expl_sum"] += f["explotacion"]
                totales["expl_n"] += 1

            if t == hasta:
                base_f = base_filas[cod_masa]
                if base_f["estado"] != f["estado"]:
                    masas_cambio.append(
                        {
                            "cod_masa": cod_masa,
                            "nombre_masa": b["nombre_masa"],
                            "isla": b["isla"],
                            "extraccion_base_hm3": round(base_f["extraccion"], 3),
                            "extraccion_proy_hm3": round(f["extraccion"], 3),
                            "explotacion_base": round(base_f["explotacion"], 3) if base_f["explotacion"] is not None else None,
                            "explotacion_proy": round(f["explotacion"], 3) if f["explotacion"] is not None else None,
                            "estado_base": base_f["estado"],
                            "estado_proy": f["estado"],
                        }
                    )
        serie.append(_serie_punto(t, totales))

    # Empeoran primero, luego mejoran, por magnitud del cambio de explotacion
    masas_cambio.sort(
        key=lambda r: (
            -(_SEVERIDAD.get(r["estado_proy"] or "", 0) - _SEVERIDAD.get(r["estado_base"] or "", 0)),
            -(abs((r["explotacion_proy"] or 0.0) - (r["explotacion_base"] or 0.0))),
        )
    )

    return {"serie": serie, "masas_cambio": masas_cambio}


def _serie_punto(anio: int, t: dict) -> dict:
    return {
        "anio": anio,
        "n_buen_estado": t["n_buen_estado"],
        "n_en_riesgo": t["n_en_riesgo"],
        "n_mal_estado": t["n_mal_estado"],
        "extraccion_total_hm3": round(t["extraccion_total_hm3"], 3),
        "disponibilidad_total_hm3": round(t["disponibilidad_total_hm3"], 3),
        "explotacion_media_pct": (
            round(t["expl_sum"] / t["expl_n"], 3) if t["expl_n"] else None
        ),
    }
