import os
import tempfile

import polars as pl
from deltalake import write_deltalake

from include.config import get_s3_client, silver_path
from include.parsers.dgrh import normalize
from include.silver.dgrh import enrich_geo


def clean(source_path: str, **context) -> str:
    prefix = silver_path("dgrh") + "abastecimiento_urbano_ibiza/"

    with tempfile.TemporaryDirectory() as input_dir, \
         tempfile.TemporaryDirectory() as output_dir:
        client = get_s3_client()
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket="pladi", Prefix=source_path):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                local_file = os.path.join(input_dir, os.path.relpath(key, source_path))
                os.makedirs(os.path.dirname(local_file), exist_ok=True)
                client.download_file("pladi", key, local_file)

        df = pl.read_delta(input_dir)
        df = normalize(df, "ibiza")

        from airflow.providers.postgres.hooks.postgres import PostgresHook

        pg_hook = PostgresHook(postgres_conn_id="postgis_pladi")
        df = enrich_geo(df, pg_hook)

        write_deltalake(output_dir, df)

        for root, dirs, files in os.walk(output_dir):
            for fname in files:
                local = os.path.join(root, fname)
                key = prefix + os.path.relpath(local, output_dir)
                client.upload_file(local, "pladi", key)

    return prefix
