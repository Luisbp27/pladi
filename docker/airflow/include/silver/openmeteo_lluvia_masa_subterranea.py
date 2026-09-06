"""Limpia precipitacion Open-Meteo por masa -> MinIO silver/openmeteo/.

Filas diarias (cod_masa, fecha, precipitacion_mm). Reescribe el delta
completo con dedupe (cod_masa, fecha) keep-last.
"""
from __future__ import annotations

import json
import os
import tempfile

import polars as pl

from include.config import BUCKET, get_s3_client, silver_path
from include.silver.ibestat import DELTA_STORAGE_OPTIONS


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

        rows = []
        for f in files:
            cod_masa = os.path.basename(f).split("_")[0]
            with open(f) as fh:
                data = json.load(fh)
            for fecha, prec in zip(
                data["daily"]["time"], data["daily"]["precipitation_sum"]
            ):
                if prec is None:
                    continue
                rows.append(
                    {"cod_masa": cod_masa, "fecha": fecha, "precipitacion_mm": float(prec)}
                )

    new = pl.DataFrame(rows).with_columns(pl.col("fecha").str.to_date())
    new = new.unique(subset=["cod_masa", "fecha"], keep="last")

    out_path = f"s3://{BUCKET}/{silver_path("openmeteo")}lluvia_masa_subterranea/"
    existing = None
    try:
        existing = pl.read_delta(out_path, storage_options=DELTA_STORAGE_OPTIONS)
    except Exception:
        pass

    if existing is not None and existing.height > 0:
        merged = pl.concat([existing, new], how="diagonal_relaxed")
        merged = merged.unique(subset=["cod_masa", "fecha"], keep="last")
    else:
        merged = new

    merged.write_delta(
        out_path,
        mode="overwrite",
        storage_options=DELTA_STORAGE_OPTIONS,
    )

    return out_path
