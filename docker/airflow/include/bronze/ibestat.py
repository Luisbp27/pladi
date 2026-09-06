"""Extrae datos de IBESTAT via HTTP y los sube a MinIO bronze/ibestat/."""
from __future__ import annotations

import io
import os
from datetime import datetime

import boto3
import requests
from botocore.config import Config
from requests.adapters import HTTPAdapter, Retry
from airflow.exceptions import AirflowFailException

from include.config import BUCKET, IBESTAT_URLS, bronze_path

MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ROOT_USER", "pladi")
MINIO_SECRET_KEY = os.environ.get("MINIO_ROOT_PASSWORD", "pladi2024")

CONNECT_TIMEOUT = 15
READ_TIMEOUT = 300


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _http_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=2,
        status_forcelist=[500, 502, 503, 504],
    )
    session.mount("https://", HTTPAdapter(max_retries=retries))
    session.mount("http://", HTTPAdapter(max_retries=retries))
    return session


def extract(dataset_id: str, **context) -> str:
    url = IBESTAT_URLS[dataset_id]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    session = _http_session()
    resp = session.get(url, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
    if resp.status_code != 200:
        raise AirflowFailException(
            f"IBESTAT download failed: {url} -> HTTP {resp.status_code}"
        )

    client = _get_s3_client()
    key = f"{bronze_path("ibestat")}{dataset_id}/{ts}.csv"
    client.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=io.BytesIO(resp.content),
        ContentType="text/csv",
    )

    return key
