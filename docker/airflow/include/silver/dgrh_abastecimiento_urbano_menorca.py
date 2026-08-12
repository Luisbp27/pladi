"""Limpia abastecimiento urbano Menorca -> MinIO silver/dgrh/."""
import os
import tempfile

import polars as pl
from deltalake import write_deltalake

from include.config import silver_path, get_s3_client
from include.parsers.dgrh import normalize


def clean(source_path: str, **context) -> str:
    prefix = silver_path("dgrh") + "abastecimiento_urbano_menorca/"

    client = get_s3_client()

    with tempfile.TemporaryDirectory() as download_dir:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket="pladi", Prefix=source_path):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                local_file = os.path.join(
                    download_dir, os.path.relpath(key, source_path)
                )
                os.makedirs(os.path.dirname(local_file), exist_ok=True)
                client.download_file("pladi", key, local_file)

        df = pl.read_delta(download_dir)

    df = normalize(df, "menorca")

    with tempfile.TemporaryDirectory() as write_dir:
        write_deltalake(write_dir, df)
        for root, dirs, files in os.walk(write_dir):
            for fname in files:
                local = os.path.join(root, fname)
                key = prefix + os.path.relpath(local, write_dir)
                client.upload_file(local, "pladi", key)

    return prefix
