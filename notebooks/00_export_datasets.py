#!/usr/bin/env python3
"""
pladi — Exportación de datasets para notebooks (FASE VII)

Exporta las tablas gold.* y las dimensiones necesarias desde PostGIS
a notebooks/data/*.csv (CSV con cabecera, columnas sin created_at/updated_at/geometry).

Uso (en el host del VPS, no dentro de Jupyter):
    python3 notebooks/00_export_datasets.py

Requiere el contenedor `pladi-postgis` levantado y credenciales en docker/.env.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "notebooks" / "data"
ENV_FILE = ROOT / "docker" / ".env"

EXPORTS = {
    # ── Gold ─────────────────────────────────────────────
    "abastecimiento_urbano_baleares.csv": "gold.abastecimiento_urbano_baleares",
    "presion_humana.csv": "gold.presion_humana",
    "ocupacion_turistica.csv": "gold.ocupacion_turistica",
    "lluvia_masa_subterranea.csv": "gold.lluvia_masa_subterranea",
    "agua_infiltrada_masa_subterranea.csv": "gold.agua_infiltrada_masa_subterranea",
    "balance_hidrico_baleares.csv": "gold.balance_hidrico_baleares",
    "censo_municipal_baleares.csv": "gold.censo_municipal_baleares",
    # ── Dimensiones (para joins y features) ──────────────
    "masa_subterranea.csv": "public.masa_subterranea",
    "municipio_masa_subterranea.csv": "public.municipio_masa_subterranea",
    "municipio.csv": "public.municipio",
    "provincia.csv": "public.provincia",
}

EXCLUDE_COLS = {"created_at", "updated_at", "geometry"}


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def columns_of(psql_base: list[str], table: str) -> list[str]:
    sql = (
        "SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='{table.split('.')[0]}' AND table_name='{table.split('.')[1]}' "
        "ORDER BY ordinal_position"
    )
    out = subprocess.run(
        psql_base + ["-t", "-A", "-c", sql], capture_output=True, text=True, check=True
    )
    return [c for c in out.stdout.splitlines() if c and c not in EXCLUDE_COLS]


def export(psql_base: list[str], table: str, out_path: Path) -> int:
    cols = columns_of(psql_base, table)
    sql = f"COPY (SELECT {', '.join(cols)} FROM {table}) TO STDOUT CSV HEADER"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        subprocess.run(psql_base + ["-c", sql], stdout=f, check=True)
    n_rows = sum(1 for _ in out_path.open()) - 1
    print(f"  {table:45s} -> {out_path.name:45s} ({n_rows} filas)")
    return n_rows


def main() -> int:
    env = load_env()
    user = env.get("POSTGRES_USER", "pladi")
    db = env.get("POSTGRES_DB", "pladi")
    psql_base = ["docker", "exec", "-i", "pladi-postgis", "psql", "-U", user, "-d", db, "-q"]

    print(f"Exportando {len(EXPORTS)} tablas a {DATA_DIR}/ ...")
    total = 0
    for filename, table in EXPORTS.items():
        total += export(psql_base, table, DATA_DIR / filename)
    print(f"Total: {total} filas exportadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
