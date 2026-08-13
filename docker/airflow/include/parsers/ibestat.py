"""Parser compartido para CSVs bilingues de IBESTAT.

Los CSVs de IBESTAT usan columnas bilingues con sufijos #ca / #es
y columnas _CODE con valores canonicos. Este modulo normaliza
los nombres y tipa valores comunes.
"""
from __future__ import annotations

import re

import polars as pl

COLUMN_RENAME = {
    "territorio_code": "cod_territorio",
    "time_period_code": "cod_tiempo",
    "sexo_code": "cod_sexo",
    "edad_code": "cod_edad",
    "medida_code": "cod_medida",
    "estado_observacion_code": "cod_estado_observacion",
}


def read_ibestat_csv(filepath: str) -> pl.DataFrame:
    df = pl.read_csv(filepath, separator=",", ignore_errors=True)

    rename = {}
    for col in df.columns:
        clean = _normalize_column(col)
        if clean:
            rename[col] = clean

    df = df.rename(rename)

    final_rename = {c: COLUMN_RENAME[c] for c in df.columns if c in COLUMN_RENAME}
    if final_rename:
        df = df.rename(final_rename)

    return df


def _normalize_column(name: str) -> str:
    name = name.strip()

    if name == "OBS_VALUE":
        return "obs_value"

    if "#" in name and not name.endswith("_CODE"):
        return None

    name = name.replace("#", "_")
    name = name.lower()
    name = re.sub(r"[^a-z0-9_]+", "_", name)
    name = name.strip("_")
    return name