"""DAG one-time: crea el bucket de MinIO y su estructura de prefijos (bronze/silver/gold)."""
from __future__ import annotations

from datetime import datetime

from airflow.decorators import dag, task
from airflow.providers.amazon.aws.hooks.s3 import S3Hook
from botocore.exceptions import ClientError

from include.config import BUCKET

SOURCES = ["dgrh", "aemet", "ibestat"]
LAYERS = ["bronze", "silver", "gold"]


@dag(
    dag_id="setup_buckets",
    schedule="@once",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["setup", "minio"],
    description="Crea la estructura de prefijos en MinIO (bronze/silver/gold)",
)
def setup_buckets():
    @task
    def create_structure():
        hook = S3Hook(aws_conn_id="minio_default")
        client = hook.get_conn()
        try:
            client.create_bucket(Bucket=BUCKET)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                raise
        for layer in LAYERS:
            for source in SOURCES:
                key = f"{layer}/{source}/.keep"
                client.put_object(Bucket=BUCKET, Key=key, Body=b"")
        return {"bucket": BUCKET, "layers": LAYERS, "sources": SOURCES}

    create_structure()


setup_buckets()
