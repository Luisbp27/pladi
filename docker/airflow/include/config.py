"""Configuracion compartida para ingestas pladi."""
from functools import lru_cache

from airflow.providers.amazon.aws.hooks.s3 import S3Hook

BUCKET = "pladi"

IBESTAT_URLS = {
    "censo_baleares": "https://ibestat.es/edatos/apis/statistical-resources/v1.0/datasets/IBESTAT/000305A_000010/~latest.csv",
    "indice_presion_humana": "https://ibestat.es/edatos/apis/statistical-resources/v1.0/datasets/IBESTAT/000011A_000002/~latest.csv",
    "ocupacion_hotelera": "https://ibestat.es/edatos/apis/statistical-resources/v1.0/datasets/IBESTAT/000061A_000006/~latest.csv",
    "ocupacion_apartamentos_turisticos": "https://ibestat.es/edatos/apis/statistical-resources/v1.0/datasets/IBESTAT/000060A_000006/~latest.csv",
}

IBESTAT_DATASETS = list(IBESTAT_URLS.keys())


@lru_cache()
def get_s3_client():
    hook = S3Hook(aws_conn_id="minio_default")
    return hook.get_conn()


def bronze_path(source: str) -> str:
    return f"bronze/{source}/"


def silver_path(source: str) -> str:
    return f"silver/{source}/"


def gold_path(source: str) -> str:
    return f"gold/{source}/"
