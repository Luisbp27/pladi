"""Extrae abastecimiento urbano Mallorca -> MinIO bronze/dgrh/."""
import os
import tempfile

from deltalake import write_deltalake

from include.config import bronze_path, get_s3_client
from include.parsers.dgrh import parse_raw


def extract(**context) -> str:
    client = get_s3_client()
    prefix = bronze_path("dgrh") + "abastecimiento_urbano_mallorca/"

    filepath = "/opt/airflow/data/abastecimiento_urbano/Resum_Mallorca_2024.xlsx"
    df = parse_raw(filepath, "mallorca")

    with tempfile.TemporaryDirectory() as tmpdir:
        write_deltalake(tmpdir, df)
        for root, dirs, files in os.walk(tmpdir):
            for fname in files:
                local = os.path.join(root, fname)
                key = prefix + os.path.relpath(local, tmpdir)
                client.upload_file(local, "pladi", key)

    return prefix
