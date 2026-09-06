"""Limpia historico diario AEMET -> MinIO silver/aemet/historico_meteo/.

Reescribe el delta completo (dedupe por indicativo+fecha, keep last) para
capturar las correcciones de las ventanas re-descargadas.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timedelta

import polars as pl

from include.config import BUCKET, get_s3_client, silver_path
from include.silver.ibestat import DELTA_STORAGE_OPTIONS

RENAME = {
    "fecha": "fecha",
    "indicativo": "indicativo",
    "nombre": "nombre",
    "provincia": "provincia",
    "altitud": "altitud",
    "tmed": "tmed_c",
    "prec": "prec_mm",
    "tmin": "tmin_c",
    "tmax": "tmax_c",
    "horatmin": "horatmin",
    "horatmax": "horatmax",
    "dir": "dir",
    "velmedia": "velmedia_kmh",
    "racha": "racha_kmh",
    "horaracha": "horaracha",
    "hrMedia": "hr_media_pct",
    "hrMax": "hr_max_pct",
    "horaHrMax": "hora_hr_max",
    "hrMin": "hr_min_pct",
    "horaHrMin": "hora_hr_min",
    "pintMax": "pint_max_mm",
    "sol": "sol_h",
}

NUMERIC = [
    "tmed_c", "prec_mm", "tmin_c", "tmax_c",
    "velmedia_kmh", "racha_kmh", "hr_media_pct", "hr_max_pct",
    "hr_min_pct", "pint_max_mm", "sol_h",
]


def _clean_str(col: pl.Expr) -> pl.Expr:
    return (
        pl.when(col.is_null())
        .then(None)
        .otherwise(col.cast(pl.Utf8).str.strip_chars())
    )


def clean(source_path: str, **context) -> str:
    client = get_s3_client()

    with tempfile.TemporaryDirectory() as tmpdir:
        paginator = client.get_paginator("list_objects_v2")
        files = []
        for page in paginator.paginate(Bucket=BUCKET, Prefix=source_path):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                local = os.path.join(tmpdir, os.path.basename(key))
                client.download_file(BUCKET, key, local)
                files.append(local)

        if not files:
            raise ValueError(f"No hay ficheros en bronze: {source_path}")

        frames = []
        for f in files:
            with open(f) as fh:
                raw = json.load(fh)
            if not isinstance(raw, list) or not raw:
                continue
            frames.append(pl.DataFrame(raw, infer_schema_length=None))

        if not frames:
            raise ValueError("Ningun fichero bronze valido para parsear")

        new = pl.concat(frames, how="diagonal_relaxed")

    rename = {k: v for k, v in RENAME.items() if k in new.columns}
    new = new.rename(rename)

    for col in NUMERIC:
        if col not in new.columns:
            new = new.with_columns(pl.lit(None, dtype=pl.Utf8).alias(col))
        new = new.with_columns(
            _clean_str(pl.col(col))
            .str.replace("Ip", "0")
            .str.replace(",", ".")
            .cast(pl.Float64, strict=False)
            .alias(col)
        )

    if "altitud" in new.columns:
        new = new.with_columns(
            _clean_str(pl.col("altitud")).cast(pl.Int64, strict=False)
        )

    new = new.with_columns(pl.col("fecha").str.to_date())

    end = datetime.now().replace(day=1) - timedelta(days=1)
    new = new.filter(pl.col("fecha") <= end.date())

    new = new.unique(subset=["indicativo", "fecha"], keep="last")

    out_path = f"s3://{BUCKET}/{silver_path("aemet")}historico_meteo/"
    existing = None
    try:
        existing = pl.read_delta(out_path, storage_options=DELTA_STORAGE_OPTIONS)
    except Exception:
        pass

    if existing is not None and existing.height > 0:
        merged = pl.concat([existing, new], how="diagonal_relaxed")
        merged = merged.unique(subset=["indicativo", "fecha"], keep="last")
    else:
        merged = new

    merged.write_delta(
        out_path,
        mode="overwrite",
        storage_options=DELTA_STORAGE_OPTIONS,
    )

    return out_path
