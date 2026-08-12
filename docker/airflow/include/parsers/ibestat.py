"""Parser compartido para CSVs bilingues de IBESTAT.

Los CSVs de IBESTAT usan columnas bilingues con sufijos #ca / #es
y columnas _CODE con valores canonicos. Este modulo normaliza
los nombres y tipa valores comunes.
"""
from __future__ import annotations

import re

import polars as pl


def read_ibestat_csv(filepath: str) -> pl.DataFrame:
    df = pl.read_csv(filepath, separator=",", ignore_errors=True)

    rename = {}
    for col in df.columns:
        clean = _normalize_column(col)
        if clean:
            rename[col] = clean

    return df.rename(rename)


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
