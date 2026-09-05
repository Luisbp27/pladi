#!/usr/bin/env bash
# Descarga el bundle de modelos ML (GitHub Release) a models/
# Uso: ./scripts/fetch_models.sh [tag]
set -euo pipefail

REPO="${PLADI_REPO:-Luisbp27/pladi}"
TAG="${1:-v0.1.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/models"
ZIP="models-pladi-${TAG}.zip"
URL="https://github.com/${REPO}/releases/download/${TAG}/${ZIP}"

echo "==> Descargando ${URL}"
if ! curl -fL --retry 3 -o "/tmp/${ZIP}" "$URL"; then
  echo "ERROR: no se pudo descargar el bundle de modelos." >&2
  echo "  - ¿Existe la release ${TAG}? Puedes crearla con:" >&2
  echo "      gh release create ${TAG} ${ZIP} --repo ${REPO}" >&2
  echo "  - Alternativa: reentrena los modelos (notebooks/11_modelo_municipio.ipynb" >&2
  echo "    o el DAG modelo_consumo_urbano en Airflow)." >&2
  exit 1
fi

mkdir -p "$DEST"
echo "==> Descomprimiendo en ${DEST}"
if ! unzip -o "/tmp/${ZIP}" -d "$DEST" >/dev/null; then
  echo "ERROR: el fichero descargado no es un zip válido." >&2
  exit 1
fi
rm -f "/tmp/${ZIP}"

N=$(find "$DEST" -name '*.joblib' | wc -l | tr -d ' ')
echo "==> Listo: ${N} modelos en ${DEST}"
echo "    Reinicia FastAPI para que cargue los modelos: docker compose restart fastapi"
