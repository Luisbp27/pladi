"""Limpia historico meteorologico -> MinIO silver/aemet/."""
import polars as pl

from include.config import get_s3_client, silver_path


def clean(source_path: str, **context) -> str:
    client = get_s3_client()
    path = silver_path("aemet")
    # TODO: leer bronze, limpiar con Polars, escribir silver
    return path
