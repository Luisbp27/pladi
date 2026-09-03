"""Publicacion del bundle entrenado a MinIO + registro en ml.model_versions.

Flujo:
  1. Guardrail: el MAPE medio del holdout debe ser <= MAPE de la version activa
     + tolerancia. Si no, se aborta ANTES de subir nada (el fallo del DAG es la alerta).
  2. Subida del bundle a s3://pladi/ml/simulacion/v{version}/ con manifest sha256.
  3. Registry: la version anterior activa pasa a 'archived' y la nueva se activa.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import get_s3_client
from include.ml.registry import ensure_schema

BUCKET = "pladi"
PREFIX = "ml/simulacion/"
MANIFEST = "manifest.json"
TOLERANCIA_PP = 2.0


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _activa(cur):
    cur.execute(
        "SELECT id, mape_holdout_medio FROM ml.model_versions WHERE estado = 'active' LIMIT 1"
    )
    return cur.fetchone()


def publicar(out_dir: Path, resumen: dict) -> dict:
    """Sube el bundle y registra la version como activa (con guardrail)."""
    version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    prefix = f"{PREFIX}v{version}/"
    artifact_uri = f"s3://{BUCKET}/{prefix}"

    hook = PostgresHook(postgres_conn_id="postgis_pladi")
    conn = hook.get_conn()
    try:
        with conn.cursor() as cur:
            ensure_schema(cur)
            activa = _activa(cur)
            mape = float(resumen["mape_medio"])
            if activa and activa[1] is not None and mape > activa[1] + TOLERANCIA_PP:
                raise ValueError(
                    f"guardrail: MAPE {mape} supera el de la version activa {activa[1]} "
                    f"+ {TOLERANCIA_PP}pp — no se publica (version {activa[0]} se mantiene)"
                )

            # 1. Subida del bundle (despues del guardrail)
            client = get_s3_client()
            archivos: dict[str, str] = {}
            for p in sorted(out_dir.rglob("*")):
                if not p.is_file():
                    continue
                rel = str(p.relative_to(out_dir))
                archivos[rel] = _sha256(p)
                client.upload_file(str(p), BUCKET, prefix + rel)
            manifest = {
                "version": version,
                "creado_en": datetime.now(timezone.utc).isoformat(),
                "artifact_uri": artifact_uri,
                "archivos": archivos,
            }
            client.put_object(
                Bucket=BUCKET, Key=prefix + MANIFEST, Body=json.dumps(manifest, indent=2)
            )

            # 2. Registry: archivar anterior y activar la nueva
            meta = resumen["metadata"]
            checksum = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
            cur.execute("UPDATE ml.model_versions SET estado = 'archived' WHERE estado = 'active'")
            cur.execute(
                """
                INSERT INTO ml.model_versions (
                    id, artifact_uri, estado, mape_holdout_medio, mae_holdout_medio,
                    mape_por_municipio, features, params, elasticidades,
                    base_anio, train_desde, test_start, n_modelos, checksum_sha256,
                    nota, activado_en
                ) VALUES (
                    %(id)s, %(uri)s, 'active', %(mape)s, %(mae)s,
                    %(mape_mun)s, %(features)s, %(params)s, %(elast)s,
                    %(base_anio)s, %(train_desde)s, %(test_start)s, %(n)s, %(sha)s,
                    %(nota)s, now()
                )
                """,
                {
                    "id": version,
                    "uri": artifact_uri,
                    "mape": mape,
                    "mae": float(resumen["mae_medio"]),
                    "mape_mun": json.dumps(meta.get("mape_por_municipio", {})),
                    "features": json.dumps(meta.get("features", [])),
                    "params": json.dumps(meta.get("params", {})),
                    "elast": json.dumps(resumen["elasticidades"]),
                    "base_anio": meta.get("base_anio"),
                    "train_desde": meta.get("train_desde"),
                    "test_start": meta.get("test_start"),
                    "n": resumen["n_modelos"],
                    "sha": checksum,
                    "nota": meta.get("nota"),
                },
            )
        conn.commit()
    finally:
        conn.close()

    return {
        "version": version,
        "artifact_uri": artifact_uri,
        "mape_holdout_medio": float(resumen["mape_medio"]),
        "n_modelos": resumen["n_modelos"],
        "guardrail_ok": True,
    }
