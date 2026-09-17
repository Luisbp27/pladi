-- ============================================================
-- pladi — GOLD IBESTAT
-- Tablas agregadas a partir de datos IBESTAT
-- ============================================================

-- ============================================================
-- 1. gold.censo_municipal_baleares
-- Poblacion anual por municipio. Fuente: IBESTAT padron municipal
-- (dataset 000001A_000001, 1998-2025; la tabla conserva el nombre
-- "censo" aunque la fuente es el padron desde 2026-09-12).
-- ============================================================
CREATE TABLE IF NOT EXISTS gold.censo_municipal_baleares (
    cod_provincia_ine    VARCHAR(3)   NOT NULL,
    nombre_provincia     TEXT         NOT NULL,
    cod_municipio_ine    VARCHAR(5)   NOT NULL,
    nombre_municipio     TEXT         NOT NULL,
    anio                 INTEGER      NOT NULL,
    poblacion            BIGINT       NOT NULL,
    created_at           TIMESTAMPTZ  DEFAULT now(),
    updated_at           TIMESTAMPTZ  DEFAULT now(),
    CONSTRAINT pk_censo_municipal_baleares PRIMARY KEY (cod_municipio_ine, anio),
    CONSTRAINT fk_censo_baleares_municipio FOREIGN KEY (cod_municipio_ine)
        REFERENCES public.municipio (cod_municipio) ON DELETE RESTRICT,
    CONSTRAINT fk_censo_baleares_provincia FOREIGN KEY (cod_provincia_ine)
        REFERENCES public.provincia (cod_provincia) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_censo_baleares_anio ON gold.censo_municipal_baleares (anio);
CREATE INDEX IF NOT EXISTS idx_censo_baleares_provincia ON gold.censo_municipal_baleares (cod_provincia_ine);


-- ============================================================
-- 2. gold.presion_humana
-- Indicador de Presion Humana (IPH) mensual por isla
-- ============================================================
CREATE TABLE IF NOT EXISTS gold.presion_humana (
    cod_provincia_ine    VARCHAR(3)   NOT NULL,
    nombre_provincia     TEXT         NOT NULL,
    nombre_isla          TEXT         NOT NULL,
    anio                 INTEGER      NOT NULL,
    mes                  INTEGER      NOT NULL,
    iph                  BIGINT       NOT NULL,
    created_at           TIMESTAMPTZ  DEFAULT now(),
    updated_at           TIMESTAMPTZ  DEFAULT now(),
    CONSTRAINT pk_presion_humana PRIMARY KEY (nombre_isla, anio, mes),
    CONSTRAINT ck_iph_mes CHECK (mes BETWEEN 1 AND 12)
);

CREATE INDEX IF NOT EXISTS idx_iph_isla      ON gold.presion_humana (nombre_isla);
CREATE INDEX IF NOT EXISTS idx_iph_anio_mes  ON gold.presion_humana (anio, mes);


-- ============================================================
-- 3. gold.ocupacion_turistica
-- Ocupacion turistica mensual por municipio y tipo de alojamiento
-- Unifica hotelera + apartamentos turisticos
-- ============================================================
CREATE TABLE IF NOT EXISTS gold.ocupacion_turistica (
    cod_provincia_ine    VARCHAR(3)   NOT NULL,
    nombre_provincia     TEXT         NOT NULL,
    cod_municipio_ine    VARCHAR(5)   NOT NULL,
    nombre_municipio     TEXT         NOT NULL,
    anio                 INTEGER      NOT NULL,
    mes                  INTEGER      NOT NULL,
    tipo_alojamiento     TEXT         NOT NULL,
    ocupacion_plazas_pct DOUBLE PRECISION,
    created_at           TIMESTAMPTZ  DEFAULT now(),
    updated_at           TIMESTAMPTZ  DEFAULT now(),
    CONSTRAINT pk_ocupacion_turistica PRIMARY KEY (cod_municipio_ine, anio, mes, tipo_alojamiento),
    CONSTRAINT ck_ocupacion_mes CHECK (mes BETWEEN 1 AND 12),
    CONSTRAINT ck_tipo_alojamiento CHECK (tipo_alojamiento IN ('hotelera', 'apartamentos')),
    CONSTRAINT fk_ocupacion_municipio FOREIGN KEY (cod_municipio_ine)
        REFERENCES public.municipio (cod_municipio) ON DELETE RESTRICT,
    CONSTRAINT fk_ocupacion_provincia FOREIGN KEY (cod_provincia_ine)
        REFERENCES public.provincia (cod_provincia) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ocupacion_tipo   ON gold.ocupacion_turistica (tipo_alojamiento);
CREATE INDEX IF NOT EXISTS idx_ocupacion_anio   ON gold.ocupacion_turistica (anio, mes);
