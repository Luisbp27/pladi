"""DDL y helpers del registry ml.* (misma estructura que sql/ml_registry.sql).

El DDL vive tambien en sql/ml_registry.sql para el init de PostGIS; aqui se
replica para que los DAGs de ml sean auto-contenidos (CREATE IF NOT EXISTS).
"""
from __future__ import annotations

DDL = """
CREATE SCHEMA IF NOT EXISTS ml;

CREATE TABLE IF NOT EXISTS ml.model_versions (
    id                 TEXT             NOT NULL,
    artifact_uri       TEXT             NOT NULL,
    estado             TEXT             NOT NULL DEFAULT 'shadow',
    mape_holdout_medio DOUBLE PRECISION,
    mae_holdout_medio  DOUBLE PRECISION,
    mape_por_municipio JSONB,
    features           JSONB,
    params             JSONB,
    elasticidades      JSONB,
    base_anio          INTEGER,
    train_desde        INTEGER,
    test_start         INTEGER,
    n_modelos          INTEGER,
    checksum_sha256    TEXT,
    nota               TEXT,
    creado_en          TIMESTAMPTZ      NOT NULL DEFAULT now(),
    activado_en        TIMESTAMPTZ,
    CONSTRAINT pk_model_versions PRIMARY KEY (id),
    CONSTRAINT uq_model_versions_uri UNIQUE (artifact_uri),
    CONSTRAINT ck_model_versions_estado CHECK (estado IN ('active', 'shadow', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_versions_activa
    ON ml.model_versions ((estado)) WHERE estado = 'active';
CREATE INDEX IF NOT EXISTS idx_model_versions_estado ON ml.model_versions (estado);
CREATE INDEX IF NOT EXISTS idx_model_versions_creado ON ml.model_versions (creado_en DESC);

CREATE TABLE IF NOT EXISTS ml.backtests (
    id           BIGSERIAL       NOT NULL,
    version_id   TEXT,
    run_en       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    ventana      TEXT            NOT NULL,
    n_municipios INTEGER,
    mape_medio   DOUBLE PRECISION,
    mae_medio    DOUBLE PRECISION,
    umbral_mape  DOUBLE PRECISION,
    degradado    BOOLEAN,
    detalle      JSONB,
    CONSTRAINT pk_backtests PRIMARY KEY (id),
    CONSTRAINT fk_backtests_version FOREIGN KEY (version_id)
        REFERENCES ml.model_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backtests_ventana ON ml.backtests (ventana);
CREATE INDEX IF NOT EXISTS idx_backtests_run ON ml.backtests (run_en DESC);
"""


def ensure_schema(cur) -> None:
    cur.execute(DDL)
