-- ============================================================
-- pladi — GOLD LLUVIA MASA SUBTERRANEA
-- Precipitacion mensual por masa (fusion AEMET + Open-Meteo)
-- ============================================================

CREATE TABLE IF NOT EXISTS gold.lluvia_masa_subterranea (
    cod_masa          TEXT             NOT NULL,
    anio              INTEGER          NOT NULL,
    mes               INTEGER          NOT NULL,
    precipitacion_mm  DOUBLE PRECISION,
    fuente            TEXT             NOT NULL,
    created_at        TIMESTAMPTZ      DEFAULT now(),
    updated_at        TIMESTAMPTZ      DEFAULT now(),
    CONSTRAINT pk_lluvia_masa PRIMARY KEY (cod_masa, anio, mes),
    CONSTRAINT fk_lluvia_masa FOREIGN KEY (cod_masa)
        REFERENCES public.masa_subterranea (cod_masa) ON DELETE RESTRICT,
    CONSTRAINT ck_lluvia_mes CHECK (mes BETWEEN 1 AND 12),
    CONSTRAINT ck_lluvia_fuente CHECK (fuente IN ('aemet', 'openmeteo'))
);

CREATE INDEX IF NOT EXISTS idx_lluvia_anio_mes ON gold.lluvia_masa_subterranea (anio, mes);
CREATE INDEX IF NOT EXISTS idx_lluvia_fuente  ON gold.lluvia_masa_subterranea (fuente);
