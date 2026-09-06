"""ML (one-time): seed del registry con los modelos actuales de /models como version 0.

- Sube ../../models (montado ro en /opt/airflow/models) a s3://pladi/ml/simulacion/v0/
  con manifest sha256.
- Inserta la fila en ml.model_versions con estado 'active'.
- @once: si la version 0 ya existe, no hace nada.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path

from airflow.decorators import dag, task
from airflow.providers.postgres.hooks.postgres import PostgresHook

from include.config import get_s3_client
from include.ml.registry import ensure_schema

SRC = Path("/opt/airflow/models")
BUCKET = "pladi"
PREFIX = "ml/simulacion/v0/"
URI = f"s3://{BUCKET}/{PREFIX}"


@dag(
    dag_id="modelo_seed",
    schedule="@once",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ml"],
    default_args={
        "owner": "pladi",
        "retries": 2,
        "retry_delay": timedelta(minutes=5),
    },
    description="ML (one-time): sube los modelos actuales como version 0 del registry",
)
def modelo_seed():
    @task
    def seed() -> str:
        if not (SRC / "metadata.json").exists():
            raise RuntimeError(
                f"no hay modelos en {SRC}: ejecuta el notebook 11 antes del seed "
                "(y verifica el montaje ../../models en los servicios de airflow)"
            )
        meta = json.loads((SRC / "metadata.json").read_text())

        client = get_s3_client()
        archivos: dict[str, str] = {}
        for p in sorted(SRC.rglob("*")):
            if not p.is_file():
                continue
            rel = str(p.relative_to(SRC))
            archivos[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
            client.upload_file(str(p), BUCKET, PREFIX + rel)
        manifest = {
            "version": "0",
            "creado_en": datetime.now().astimezone().isoformat(),
            "artifact_uri": URI,
            "archivos": archivos,
        }
        client.put_object(
            Bucket=BUCKET, Key=PREFIX + "manifest.json", Body=json.dumps(manifest, indent=2)
        )

        hook = PostgresHook(postgres_conn_id="postgis_pladi")
        conn = hook.get_conn()
        try:
            with conn.cursor() as cur:
                ensure_schema(cur)
                cur.execute("SELECT id FROM ml.model_versions WHERE id = '0'")
                if cur.fetchone():
                    return "seed ya ejecutado (version 0 existe): omitido"

                elasticidades = json.loads((SRC / "elasticidades.json").read_text())
                mape = meta.get("mape_por_municipio", {})
                mape_medio = (
                    round(sum(float(v) for v in mape.values()) / len(mape), 3) if mape else None
                )
                checksum = hashlib.sha256(
                    json.dumps(manifest, sort_keys=True).encode()
                ).hexdigest()
                cur.execute("UPDATE ml.model_versions SET estado = 'archived' WHERE estado = 'active'")
                cur.execute(
                    """
                    INSERT INTO ml.model_versions (
                        id, artifact_uri, estado, mape_holdout_medio, mape_por_municipio,
                        features, params, elasticidades, base_anio, train_desde,
                        test_start, n_modelos, checksum_sha256, nota, activado_en
                    ) VALUES (%s, %s, 'active', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    """,
                    (
                        "0",
                        URI,
                        mape_medio,
                        json.dumps(mape),
                        json.dumps(meta.get("features", [])),
                        json.dumps(meta.get("params", {})),
                        json.dumps(
                            {k: elasticidades.get(k) for k in ("iph", "ocupacion", "lluvia")}
                        ),
                        meta.get("base_anio"),
                        meta.get("train_desde"),
                        meta.get("test_start"),
                        meta.get("n_modelos"),
                        checksum,
                        meta.get("nota"),
                    ),
                )
            conn.commit()
        finally:
            conn.close()
        return f"seed OK: version 0 activa (n_modelos {meta.get('n_modelos')})"

    seed()


modelo_seed()
