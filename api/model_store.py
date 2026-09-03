"""Resolucion y descarga de bundles de modelo (registry ml.model_versions + MinIO).

Flujo al arrancar la API:
  1. Pin MODEL_VERSION (env) -> esa version exacta del registry.
  2. Si no, version con estado='active' del registry (PostGIS).
  3. Si el registry no tiene filas: modo local (models_dir raiz, desarrollo).
  4. Descarga del bundle a models_dir/versions/v{id}/ + verificacion sha256 del manifest.
  5. Solo tras cargar OK se escribe el puntero current.json; si falla se conserva la anterior.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from minio import Minio

from config import settings

logger = logging.getLogger("pladi.model_store")

MANIFEST = "manifest.json"
PUNTERO = "current.json"


class BundleError(Exception):
    """Bundle de modelo no disponible o corrupto."""


def _client() -> Minio:
    url = urlparse(settings.minio_endpoint)
    return Minio(
        url.netloc or url.path,
        access_key=settings.minio_root_user,
        secret_key=settings.minio_root_password,
        secure=url.scheme == "https",
    )


def _prefix_from_uri(artifact_uri: str) -> tuple[str, str]:
    """s3://pladi/ml/simulacion/v{id}/ -> ('pladi', 'ml/simulacion/v{id}/')."""
    url = urlparse(artifact_uri)
    bucket, prefix = url.netloc, url.path.lstrip("/")
    if not bucket or not prefix:
        raise BundleError(f"artifact_uri invalida: {artifact_uri}")
    return bucket, prefix


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_and_verify(row: dict) -> Path:
    """Descarga el bundle de la version al directorio local y verifica el manifest."""
    version = row["id"]
    dest = Path(settings.models_dir) / "versions" / f"v{version}"
    if (dest / MANIFEST).exists() and not settings.model_version:
        return dest  # ya descargado y verificado; solo se re-verifica con pin

    bucket, prefix = _prefix_from_uri(row["artifact_uri"])
    client = _client()
    objetos = list(client.list_objects(bucket, prefix=prefix, recursive=True))
    if not objetos:
        raise BundleError(f"bundle vacio en {row['artifact_uri']}")

    dest.parent.mkdir(parents=True, exist_ok=True)
    staging = dest.parent / f".{dest.name}.staging"
    old = dest.parent / f".{dest.name}.old"
    if staging.exists():
        shutil.rmtree(staging)
    tmp = Path(tempfile.mkdtemp(prefix="pladi-model-", dir=str(dest.parent)))
    try:
        for obj in objetos:
            rel = obj.object_name[len(prefix):]
            if not rel:
                continue
            local = tmp / rel
            local.parent.mkdir(parents=True, exist_ok=True)
            client.fget_object(bucket, obj.object_name, str(local))

        manifest_path = tmp / MANIFEST
        if not manifest_path.exists():
            raise BundleError(f"manifest.json ausente en {row['artifact_uri']}")
        manifest = json.loads(manifest_path.read_text())
        if manifest.get("version") != version:
            raise BundleError(f"manifest version {manifest.get('version')} != {version}")
        for rel, sha in manifest.get("archivos", {}).items():
            if _sha256(tmp / rel) != sha:
                raise BundleError(f"checksum no coincide: {rel}")

        os.rename(tmp, staging)
        if old.exists():
            shutil.rmtree(old)
        if dest.exists():
            os.rename(dest, old)
        os.rename(staging, dest)
        if old.exists():
            shutil.rmtree(old)
    except BundleError:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        if staging.exists() and not dest.exists():
            shutil.rmtree(staging, ignore_errors=True)
        raise

    logger.info("bundle %s descargado y verificado en %s", version, dest)
    return dest


def leer_puntero() -> dict | None:
    """Lee current.json: la ultima version que cargo correctamente."""
    p = Path(settings.models_dir) / PUNTERO
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def escribir_puntero(info: dict) -> None:
    p = Path(settings.models_dir) / PUNTERO
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(info, ensure_ascii=False, indent=2))
    os.replace(tmp, p)
