-- ============================================================
-- pladi — ML REGISTRY + MONITOREO
-- Registry de versiones del modelo de consumo urbano (schema ml)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ml;

-- ============================================================
-- 1. ml.model_versions
--    Una fila por version de modelo publicada (bundle en MinIO).
--    Solo puede haber UNA fila con estado 'active' (indice parcial).
-- ============================================================
CREATE TABLE IF NOT EXISTS ml.model_versions (
    id                 TEXT             NOT NULL,   -- p.ej. "20260902T183000Z" (utc)
    artifact_uri       TEXT             NOT NULL,   -- s3://pladi/ml/simulacion/v{id}/
    estado             TEXT             NOT NULL DEFAULT 'shadow',
    mape_holdout_medio DOUBLE PRECISION,            -- MAPE medio holdout (2022-2024)
    mae_holdout_medio  DOUBLE PRECISION,
    mape_por_municipio JSONB,                       -- {cod_municipio: mape %}
    features           JSONB,                       -- lista de features del modelo
    params             JSONB,                       -- hiperparametros
    elasticidades      JSONB,                       -- {iph, ocupacion, lluvia}
    base_anio          INTEGER,                     -- ultimo anio de entrenamiento
    train_desde        INTEGER,
    test_start         INTEGER,
    n_modelos          INTEGER,
    checksum_sha256    TEXT,                        -- sha256 del manifest del bundle
    nota               TEXT,
    creado_en          TIMESTAMPTZ      NOT NULL DEFAULT now(),
    activado_en        TIMESTAMPTZ,
    CONSTRAINT pk_model_versions PRIMARY KEY (id),
    CONSTRAINT uq_model_versions_uri UNIQUE (artifact_uri),
    CONSTRAINT ck_model_versions_estado CHECK (estado IN ('active', 'shadow', 'archived'))
);

-- Una sola version activa en todo el registry
CREATE UNIQUE INDEX IF NOT EXISTS uq_model_versions_activa
    ON ml.model_versions ((estado)) WHERE estado = 'active';
CREATE INDEX IF NOT EXISTS idx_model_versions_estado ON ml.model_versions (estado);
CREATE INDEX IF NOT EXISTS idx_model_versions_creado ON ml.model_versions (creado_en DESC);

-- ============================================================
-- 2. ml.backtests
--    Resultados de los backtests walk-forward (drift monitoring).
--    Una fila por ventana evaluada (anio de test).
-- ============================================================
CREATE TABLE IF NOT EXISTS ml.backtests (
    id           BIGSERIAL       NOT NULL,
    version_id   TEXT,
    run_en       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    ventana      TEXT            NOT NULL,          -- anio evaluado, p.ej. "2025"
    n_municipios INTEGER,
    mape_medio   DOUBLE PRECISION,
    mae_medio    DOUBLE PRECISION,
    umbral_mape  DOUBLE PRECISION,                  -- umbral de degradacion usado
    degradado    BOOLEAN,                           -- mape_medio > umbral_mape
    detalle      JSONB,                             -- metricas por municipio
    CONSTRAINT pk_backtests PRIMARY KEY (id),
    CONSTRAINT fk_backtests_version FOREIGN KEY (version_id)
        REFERENCES ml.model_versions (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backtests_ventana ON ml.backtests (ventana);
CREATE INDEX IF NOT EXISTS idx_backtests_run ON ml.backtests (run_en DESC);
