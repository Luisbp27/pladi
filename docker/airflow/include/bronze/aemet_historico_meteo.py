"""Extrae historico meteorologico AEMET -> MinIO bronze/aemet/."""
from include.config import bronze_path, get_s3_client


def extract(**context) -> str:
    client = get_s3_client()
    path = bronze_path("aemet")
    # TODO: implementar extraccion desde API AEMET OpenData
    return path
