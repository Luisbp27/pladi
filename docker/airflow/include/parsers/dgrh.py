"""Parser compartido para ficheros DGRH de abastecimiento urbano.

Cada fichero (uno por isla) tiene estructura similar pero con diferencias:
  - Formato: .ods (Ibiza, Menorca, Formentera) o .xlsx (Mallorca)
  - Columnas: Mallorca tiene "otros_destinos" extra; Formentera no tiene "indiferenciada"
  - Nombres compuestos: en Ibiza y Menorca los nombres de municipio largos
    aparecen partidos en dos filas consecutivas (SANT ANTONI + DE PORTMANY)

El parser se usa en dos fases:
  1. parse_raw()  -> bronze: lee el fichero y devuelve un DataFrame con valores crudos (string)
  2. normalize()  -> silver: recibe el DF crudo y devuelve el esquema tipado y normalizado
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import polars as pl

# ── Mapeo de columnas por isla (indices 0-based en el fichero) ──────────────

ISLAND_LAYOUTS = {
    "mallorca": {
        "municipio": 1,
        "anyo": 2,
        "subterranea": 3,
        "desalinizada": 4,
        "indiferenciada": 5,
        "superficial": 6,
        "potabilizada": 7,
        "rechazo": 8,
        "otros_destinos": 9,
        "total_suministrado": 10,
        "consumo": 11,
    },
    "menorca": {
        "municipio": 0,
        "anyo": 1,
        "subterranea": 2,
        "desalinizada": 3,
        "indiferenciada": 4,
        "superficial": 5,
        "potabilizada": 6,
        "rechazo": 7,
        "total_suministrado": 8,
        "consumo": 9,
    },
    "ibiza": {
        "municipio": 1,
        "anyo": 2,
        "subterranea": 3,
        "desalinizada": 4,
        "indiferenciada": 5,
        "superficial": 6,
        "potabilizada": 7,
        "rechazo": 8,
        "total_suministrado": 9,
        "consumo": 10,
    },
    "formentera": {
        "municipio": 1,
        "anyo": 2,
        "subterranea": 3,
        "desalinizada": 4,
        "superficial": 5,
        "potabilizada": 6,
        "rechazo": 7,
        "total_suministrado": 8,
        "consumo": 9,
    },
}

# Prefijos que indican que una celda es continuacion de un nombre compuesto
_CONTINUATION_RE = re.compile(r"^(DE|DES|DEL|D['’]|DE LA|DE SA|GRAN)\b", re.IGNORECASE)


_KNOWN_NONSTANDARD_CONTINUATIONS = frozenset({"LABRITJA", "EULÀRIA"})


def _is_continuation(text: str, prev: str = "") -> bool:
    """Detecta si el texto es la segunda parte de un nombre de municipio.

    Caso 1: el texto empieza con un prefijo conocido (DE, DES, DEL, …).
    Caso 2: palabra no estándar (ej. "LABRITJA", "EULÀRIA") si el nombre
            anterior termina en prefijo de continuación.
    Caso 3: el nombre anterior termina en prefijo conocido y el texto
            actual contiene un espacio (ej. "SA TALAIA" tras "SANT JOSEP DE").
    """
    text = text.strip()
    if _CONTINUATION_RE.match(text):
        return True
    if not prev:
        return False
    prev_ends_with_prefix = bool(re.search(
        r"\b(DE|DES|DEL|D['\'']|DE LA|DE SA|GRAN|SANTA)\s*$", prev, re.IGNORECASE,
    ))
    if not prev_ends_with_prefix:
        return False
    if text.upper() in _KNOWN_NONSTANDARD_CONTINUATIONS:
        return True
    if " " in text:
        return True
    return False


def parse_raw(filepath: str, isla: str) -> pl.DataFrame:
    """Lee un fichero DGRH (ODS/XLSX) y devuelve un DataFrame crudo.

    Args:
        filepath: Ruta al fichero en el sistema de archivos.
        isla: Clave de la isla ("mallorca", "menorca", "ibiza", "formentera").

    Returns:
        DataFrame con columnas: municipio, anyo, y valores en string.
    """
    layout = ISLAND_LAYOUTS[isla]
    df = pd.read_excel(filepath, header=None, dtype=str)

    # Detectar primera fila de datos (anyo entre 2000 y 2024)
    year_col = layout["anyo"]
    data_start = None
    for i in range(len(df)):
        val = str(df.iloc[i, year_col]).strip()
        try:
            n = int(val)
            if 2000 <= n <= 2024:
                data_start = i
                break
        except (ValueError, TypeError):
            continue

    if data_start is None:
        raise ValueError(f"No se encontraron filas de datos en {filepath}")

    df = df.iloc[data_start:].reset_index(drop=True)
    muni_col = layout["municipio"]

    # ── Resolver nombres compuestos partidos ──────────────────────────────
    resolved = []       # lista de nombres resueltos, mismo indice que df

    i = 0
    while i < len(df):
        raw_muni = str(df.iloc[i, muni_col]).strip()

        if raw_muni and raw_muni.lower() not in ("nan", ""):
            prev_name = resolved[-1] if resolved else ""
            if _is_continuation(raw_muni, prev=prev_name):
                # Es la segunda parte: concatenar con el nombre anterior
                prev = resolved[-1] if resolved else raw_muni
                full = f"{prev} {raw_muni}"
                # Retroceder y corregir TODAS las entradas consecutivas previas
                # con el nombre base (cadenas de 3+ partes: SANTA/EULÀRIA/DES RIU)
                k = len(resolved) - 1
                while k >= 0 and resolved[k] == prev:
                    resolved[k] = full
                    k -= 1
                resolved.append(full)
            else:
                resolved.append(raw_muni)
        else:
            # Celda vacia: forward-fill del municipio anterior
            resolved.append(resolved[-1] if resolved else "")

        i += 1

    # ── Segunda pasada: resolver compuestos de 3+ partes ──────────────────
    # Caso: SANTA + EULÀRIA + DES RIU → SANTA EULÀRIA DES RIU
    # La entrada previa solo aparece al inicio del split (no forward-filled).
    for j in range(2, len(resolved)):
        if resolved[j] == resolved[j - 1]:
            continue
        if _CONTINUATION_RE.match(resolved[j]):
            continue
        prev_entry = resolved[j - 1]
        curr_original = resolved[j]
        if " " not in curr_original or " " in prev_entry:
            continue
        if resolved[j - 2] == prev_entry or len(prev_entry) > 8:
            continue
        compound = f"{prev_entry} {curr_original}"
        k = j - 1
        while k >= 0 and resolved[k] == prev_entry:
            resolved[k] = compound
            k -= 1
        k = j
        while k < len(resolved) and resolved[k] == curr_original:
            resolved[k] = compound
            k += 1

    df["municipio_resuelto"] = resolved

    # ── Seleccionar y renombrar columnas segun layout ────────────────────
    raw_columns = [
        "municipio",
        "anyo",
        "subterranea",
        "desalinizada",
        "indiferenciada",
        "superficial",
        "potabilizada",
        "rechazo",
        "otros_destinos",
        "total_suministrado",
        "consumo",
    ]

    result = pl.DataFrame({
        "municipio": resolved,
        "anyo": df.iloc[:, layout["anyo"]].astype(str).str.strip().to_list(),
    })

    for col in raw_columns:
        if col in ("municipio", "anyo"):
            continue
        if col in layout:
            values = df.iloc[:, layout[col]].astype(str).str.strip().to_list()
            result = result.with_columns(pl.Series(col, values))
        else:
            result = result.with_columns(pl.lit(None).cast(pl.Utf8).alias(col))

    # Filtrar solo filas con anyo valido (descartar filas residuales)
    result = result.filter(
        pl.col("anyo").str.contains(r"^\d{4}$")
    )

    return result


def normalize(df: pl.DataFrame, isla: str) -> pl.DataFrame:
    """Normaliza un DataFrame crudo de DGRH a tipos correctos.

    Args:
        df: DataFrame crudo de parse_raw().
        isla: Clave de la isla.

    Returns:
        DataFrame normalizado con tipos correctos y sufijos _hm3 / pct_.
    """
    df = df.clone()

    # ── anyo -> i32 ──────────────────────────────────────────────────────
    df = df.with_columns(
        pl.col("anyo").str.strip_chars().cast(pl.Int32)
    )

    # ── Columnas hm3: reemplazar "-" -> null, "," -> ".", cast f64 ─────
    hm3_cols_raw = [
        "subterranea", "desalinizada", "indiferenciada",
        "superficial", "potabilizada", "rechazo",
        "total_suministrado", "consumo",
    ]
    hm3_cols_renamed = [
        "subterranea_hm3", "desalinizada_hm3", "indiferenciada_hm3",
        "superficial_hm3", "potabilizada_hm3", "rechazo_hm3",
        "total_suministrado_hm3", "consumo_hm3",
    ]

    for raw, renamed in zip(hm3_cols_raw, hm3_cols_renamed):
        if raw in df.columns:
            df = df.with_columns(
                pl.when(
                    pl.col(raw).is_in(["-", "", "nan", "None"])
                    | pl.col(raw).is_null()
                )
                .then(pl.lit(None, dtype=pl.Utf8))
                .otherwise(pl.col(raw))
                .alias(raw)
            )
            df = df.with_columns(
                pl.col(raw)
                .str.replace(",", ".")
                .cast(pl.Float64)
                .fill_null(0.0)
                .alias(renamed)
            )
            df = df.drop(raw)
        else:
            df = df.with_columns(pl.lit(0.0).cast(pl.Float64).alias(renamed))

    # ── otros_destinos_hm3 ──────────────────────────────────────────────
    if "otros_destinos" in df.columns:
        df = df.with_columns(
            pl.when(
                pl.col("otros_destinos").is_in(["-", "", "nan", "None"])
                | pl.col("otros_destinos").is_null()
            )
            .then(pl.lit(None, dtype=pl.Utf8))
            .otherwise(pl.col("otros_destinos"))
            .alias("otros_destinos")
        )
        df = df.with_columns(
            pl.col("otros_destinos")
            .str.replace(",", ".")
            .cast(pl.Float64)
            .fill_null(0.0)
            .alias("otros_destinos_hm3")
        )
        df = df.drop("otros_destinos")
    else:
        df = df.with_columns(pl.lit(0.0).cast(pl.Float64).alias("otros_destinos_hm3"))

    # ── isla ────────────────────────────────────────────────────────────
    isla_map = {
        "mallorca": "Mallorca",
        "menorca": "Menorca",
        "ibiza": "Ibiza",
        "formentera": "Formentera",
    }
    df = df.with_columns(pl.lit(isla_map[isla]).alias("isla"))

    # ── Reordenar columnas ──────────────────────────────────────────────
    final_order = [
        "isla", "municipio", "anyo",
        "subterranea_hm3", "desalinizada_hm3", "indiferenciada_hm3",
        "superficial_hm3", "potabilizada_hm3", "rechazo_hm3",
        "otros_destinos_hm3", "total_suministrado_hm3", "consumo_hm3",
    ]
    df = df.select([c for c in final_order if c in df.columns])

    return df
