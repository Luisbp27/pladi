-- ============================================================
-- pladi — DDL PostgreSQL / PostGIS (SRID 4326)
-- Tablas maestras de dimensiones
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- 1. provincia
-- ============================================================
CREATE TABLE IF NOT EXISTS provincia (
    cod_provincia        VARCHAR(3) NOT NULL,
    nombre_provincia     TEXT       NOT NULL,
    cod_zona_geografica  TEXT,
    CONSTRAINT pk_provincia PRIMARY KEY (cod_provincia)
);


-- ============================================================
-- 2. municipio
-- ============================================================
CREATE TABLE IF NOT EXISTS municipio (
    cod_municipio    VARCHAR(5)   NOT NULL,
    cod_provincia    VARCHAR(3)   NOT NULL,
    nombre_municipio VARCHAR(255) NOT NULL,
    area_km2         DOUBLE PRECISION CHECK (area_km2 > 0),
    geometry         GEOMETRY(MULTIPOLYGON, 4326),
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_municipio PRIMARY KEY (cod_municipio),
    CONSTRAINT fk_municipio_provincia FOREIGN KEY (cod_provincia)
        REFERENCES provincia (cod_provincia) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_municipio_geom       ON municipio USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_municipio_provincia  ON municipio (cod_provincia);


-- ============================================================
-- 3. unidad_demanda
-- ============================================================
CREATE TABLE IF NOT EXISTS unidad_demanda (
    id_unidad_demanda  INT              NOT NULL,
    nombre             TEXT             NOT NULL,
    cod_provincia      VARCHAR(3)       NOT NULL,
    area_km2           DOUBLE PRECISION CHECK (area_km2 > 0),
    geometry           GEOMETRY(MULTIPOLYGON, 4326),
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_unidad_demanda PRIMARY KEY (id_unidad_demanda),
    CONSTRAINT fk_unidad_demanda_provincia FOREIGN KEY (cod_provincia)
        REFERENCES provincia (cod_provincia) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_ud_geom       ON unidad_demanda USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_ud_provincia  ON unidad_demanda (cod_provincia);


-- ============================================================
-- 4. masa_subterranea
-- ============================================================
CREATE TABLE IF NOT EXISTS masa_subterranea (
    cod_masa                  TEXT    NOT NULL,
    id_unidad_demanda         INT     NOT NULL,
    nombre_masa               TEXT    NOT NULL,
    area_km2                  DOUBLE PRECISION CHECK (area_km2 > 0),
    geometry                  GEOMETRY(MULTIPOLYGON, 4326),
    proporcion_area_masa_ud   DOUBLE PRECISION CHECK (proporcion_area_masa_ud >= 0 AND proporcion_area_masa_ud <= 1),
    created_at                TIMESTAMPTZ DEFAULT now(),
    updated_at                TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_masa_subterranea PRIMARY KEY (cod_masa),
    CONSTRAINT fk_masa_subterranea_ud FOREIGN KEY (id_unidad_demanda)
        REFERENCES unidad_demanda (id_unidad_demanda) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_masa_sub_geom ON masa_subterranea USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_masa_sub_ud   ON masa_subterranea (id_unidad_demanda);


-- ============================================================
-- 5. pozos
-- ============================================================
CREATE TABLE IF NOT EXISTS pozos (
    cod_pozo                                 TEXT    NOT NULL,
    cod_pozo_antiguo                         TEXT,
    nombre                                   TEXT,
    cod_masa                                 TEXT,
    cod_municipio                            VARCHAR(5),
    tipo                                     TEXT,
    uso_principal                            TEXT,
    cota_terreno_m                           DOUBLE PRECISION,
    geometry                                 GEOMETRY(POINT, 4326),
    red_cualitativa                          BOOLEAN,
    frecuencia_muestreo_cualitativa_iso8601  TEXT,
    red_piezometrica                         BOOLEAN,
    frecuencia_medicion_piezometrica_iso8601 TEXT,
    created_at                               TIMESTAMPTZ DEFAULT now(),
    updated_at                               TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_pozos PRIMARY KEY (cod_pozo),
    CONSTRAINT fk_pozos_masa FOREIGN KEY (cod_masa)
        REFERENCES masa_subterranea (cod_masa) ON DELETE RESTRICT,
    CONSTRAINT fk_pozos_municipio FOREIGN KEY (cod_municipio)
        REFERENCES municipio (cod_municipio) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pozos_geom      ON pozos USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_pozos_masa      ON pozos (cod_masa);
CREATE INDEX IF NOT EXISTS idx_pozos_municipio ON pozos (cod_municipio);


-- ============================================================
-- 6. balance_masas_subterraneas_porcentajes
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_masas_subterraneas_porcentajes (
    cod_masa                       TEXT             NOT NULL,
    infiltracion_lluvia            DOUBLE PRECISION CHECK (infiltracion_lluvia >= 0),
    transferencia_entre_masas      DOUBLE PRECISION,
    infiltracion_torrentes         DOUBLE PRECISION,
    retorno_riegos                 DOUBLE PRECISION,
    perdida_redes_abastecimiento   DOUBLE PRECISION,
    perdida_redes_alcantarillado   DOUBLE PRECISION,
    intrusion_salina               DOUBLE PRECISION,
    abastecimiento_red             DOUBLE PRECISION,
    agrojardineria                 DOUBLE PRECISION,
    industria                      DOUBLE PRECISION,
    regadio                        DOUBLE PRECISION,
    ganaderia                      DOUBLE PRECISION,
    torrentes                      DOUBLE PRECISION,
    manantiales                    DOUBLE PRECISION,
    humedales                      DOUBLE PRECISION,
    transferencia_a_masas          DOUBLE PRECISION,
    salida_mar                     DOUBLE PRECISION,
    salida_zzhh                    DOUBLE PRECISION,
    recurso_potencial_hm3          DOUBLE PRECISION CHECK (recurso_potencial_hm3 >= 0),
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_balance_masas_sub PRIMARY KEY (cod_masa),
    CONSTRAINT fk_balance_masas_sub_masa FOREIGN KEY (cod_masa)
        REFERENCES masa_subterranea (cod_masa) ON DELETE RESTRICT
);


-- ============================================================
-- 7. infiltracion_epoca_material
-- ============================================================
CREATE TABLE IF NOT EXISTS infiltracion_epoca_material (
    id_infiltracion_epoca_material  BIGINT           GENERATED ALWAYS AS IDENTITY,
    cod_masa                        TEXT             NOT NULL,
    epoca                           TEXT             NOT NULL,
    material                        TEXT             NOT NULL,
    infiltracion_lluvia_porcentaje  DOUBLE PRECISION CHECK (infiltracion_lluvia_porcentaje >= 0),
    area_km2                         DOUBLE PRECISION CHECK (area_km2 > 0),
    created_at                      TIMESTAMPTZ DEFAULT now(),
    updated_at                      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_infiltracion_epoca_material PRIMARY KEY (id_infiltracion_epoca_material),
    CONSTRAINT fk_infiltracion_masa FOREIGN KEY (cod_masa)
        REFERENCES masa_subterranea (cod_masa) ON DELETE RESTRICT,
    CONSTRAINT uq_infiltracion_masa_epoca_material
        UNIQUE (cod_masa, epoca, material)
);
CREATE INDEX IF NOT EXISTS idx_infiltracion_masa ON infiltracion_epoca_material (cod_masa);


-- ============================================================
-- 8. masa_subterranea_estacion_aemet
-- ============================================================
CREATE TABLE IF NOT EXISTS masa_subterranea_estacion_aemet (
    cod_masa     TEXT NOT NULL,
    cod_estacion TEXT NOT NULL,
    CONSTRAINT pk_masa_estacion PRIMARY KEY (cod_masa, cod_estacion),
    CONSTRAINT fk_masa_estacion_masa FOREIGN KEY (cod_masa)
        REFERENCES masa_subterranea (cod_masa) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_estacion_masa ON masa_subterranea_estacion_aemet (cod_masa);


-- ============================================================
-- 9. municipio_masa_subterranea
-- ============================================================
CREATE TABLE IF NOT EXISTS municipio_masa_subterranea (
    cod_municipio                                VARCHAR(5) NOT NULL,
    cod_masa                                     TEXT       NOT NULL,
    abastecimiento_agua_media_ponderada_anual_hm3 DOUBLE PRECISION,
    CONSTRAINT pk_municipio_masa PRIMARY KEY (cod_municipio, cod_masa),
    CONSTRAINT fk_mun_masa_municipio FOREIGN KEY (cod_municipio)
        REFERENCES municipio (cod_municipio) ON DELETE RESTRICT,
    CONSTRAINT fk_mun_masa_masa FOREIGN KEY (cod_masa)
        REFERENCES masa_subterranea (cod_masa) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_mun_masa_mun  ON municipio_masa_subterranea (cod_municipio);
CREATE INDEX IF NOT EXISTS idx_mun_masa_masa ON municipio_masa_subterranea (cod_masa);


-- ============================================================
-- GOLD — Tablas de hechos / agregadas
-- ============================================================

CREATE SCHEMA IF NOT EXISTS gold;

-- ============================================================
-- 10. gold.abastecimiento_urbano_baleares
-- ============================================================
CREATE TABLE gold.abastecimiento_urbano_baleares (
    cod_municipio          VARCHAR(5)   NOT NULL,
    nombre_municipio       TEXT         NOT NULL,
    cod_provincia          VARCHAR(3)   NOT NULL,
    nombre_provincia       TEXT         NOT NULL,
    anio                   INTEGER      NOT NULL,

    subterranea_hm3        DOUBLE PRECISION,
    desalinizada_hm3       DOUBLE PRECISION,
    indiferenciada_hm3     DOUBLE PRECISION,
    superficial_hm3        DOUBLE PRECISION,
    potabilizada_hm3       DOUBLE PRECISION,
    rechazo_hm3            DOUBLE PRECISION,
    otros_destinos_hm3     DOUBLE PRECISION,
    total_suministrado_hm3 DOUBLE PRECISION,
    consumo_hm3            DOUBLE PRECISION,

    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT pk_abastecimiento_urbano PRIMARY KEY (cod_municipio, anio),
    CONSTRAINT fk_abast_municipio FOREIGN KEY (cod_municipio)
        REFERENCES public.municipio (cod_municipio) ON DELETE RESTRICT,
    CONSTRAINT fk_abast_provincia FOREIGN KEY (cod_provincia)
        REFERENCES public.provincia (cod_provincia) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_abast_anio             ON gold.abastecimiento_urbano_baleares (anio);
CREATE INDEX IF NOT EXISTS idx_abast_cod_provincia    ON gold.abastecimiento_urbano_baleares (cod_provincia);
CREATE INDEX IF NOT EXISTS idx_abast_nombre_provincia ON gold.abastecimiento_urbano_baleares (nombre_provincia);
