"""Limpia abastecimiento urbano Mallorca -> MinIO silver/dgrh/."""
import os
import tempfile

import polars as pl
from deltalake import write_deltalake

from include.config import get_s3_client, silver_path
from include.parsers.dgrh import normalize


def clean(source_path: str, **context) -> str:
    client = get_s3_client()
    prefix = silver_path("dgrh") + "abastecimiento_urbano_mallorca/"

    with tempfile.TemporaryDirectory() as tmpdir_dl:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket="pladi", Prefix=source_path):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                local_file = os.path.join(tmpdir_dl, os.path.relpath(key, source_path))
                os.makedirs(os.path.dirname(local_file), exist_ok=True)
                client.download_file("pladi", key, local_file)

        df = pl.read_delta(tmpdir_dl)

    df = normalize(df, "mallorca")

    with tempfile.TemporaryDirectory() as tmpdir_up:
        write_deltalake(tmpdir_up, df)
        for root, dirs, files in os.walk(tmpdir_up):
            for fname in files:
                local = os.path.join(root, fname)
                key = prefix + os.path.relpath(local, tmpdir_up)
                client.upload_file(local, "pladi", key)

    return prefix
