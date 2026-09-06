-- ============================================================
-- pladi — Carga de datos (9 tablas en orden de dependencia FK)
-- Ejecutar: docker compose exec -T postgis psql -U pladi -d pladi -f /tmp/load.sql
-- ============================================================

-- WKB hex → ST_SetSRID('hex'::geometry, 4326) funciona con EWKB
-- Para pozos: ST_Transform(ST_SetSRID(ST_MakePoint(X, Y), 25831), 4326)

-- ============================================================
-- 1. provincia
-- ============================================================
\copy provincia (cod_provincia, nombre_provincia, cod_zona_geografica) FROM '/tmp/pladi_data/provincia.csv' CSV HEADER

-- ============================================================
-- 2. municipio
-- ============================================================
CREATE TEMP TABLE _tmp_mun (
    cod_municipio    TEXT,
    cod_provincia    TEXT,
    nombre_municipio TEXT,
    area_km2         DOUBLE PRECISION,
    geometry_hex     TEXT
);
\copy _tmp_mun FROM '/tmp/pladi_data/municipio.csv' CSV HEADER
INSERT INTO municipio (cod_municipio, cod_provincia, nombre_municipio, area_km2, geometry)
SELECT cod_municipio, cod_provincia, nombre_municipio, NULLIF(area_km2, 0)::DOUBLE PRECISION, geometry_hex::geometry
FROM _tmp_mun;
DROP TABLE _tmp_mun;

-- ============================================================
-- 3. unidad_demanda
-- ============================================================
CREATE TEMP TABLE _tmp_ud (
    id_unidad_demanda TEXT,
    nombre            TEXT,
    cod_provincia     TEXT,
    area_km2          DOUBLE PRECISION,
    geometry_hex      TEXT
);
\copy _tmp_ud FROM '/tmp/pladi_data/unidad_demanda.csv' CSV HEADER
INSERT INTO unidad_demanda (id_unidad_demanda, nombre, cod_provincia, area_km2, geometry)
SELECT id_unidad_demanda::INT, nombre, cod_provincia, NULLIF(area_km2, 0)::DOUBLE PRECISION, geometry_hex::geometry
FROM _tmp_ud;
DROP TABLE _tmp_ud;

-- ============================================================
-- 4. masa_subterranea
-- ============================================================
CREATE TEMP TABLE _tmp_ms (
    cod_masa                  TEXT,
    id_unidad_demanda         TEXT,
    nombre_masa               TEXT,
    area_km2                  DOUBLE PRECISION,
    geometry_hex              TEXT,
    proporcion_area_masa_ud   DOUBLE PRECISION
);
\copy _tmp_ms FROM '/tmp/pladi_data/masa_subterranea.csv' CSV HEADER
INSERT INTO masa_subterranea (cod_masa, id_unidad_demanda, nombre_masa, area_km2, geometry, proporcion_area_masa_ud)
SELECT cod_masa, id_unidad_demanda::INT, nombre_masa, area_km2, geometry_hex::geometry, proporcion_area_masa_ud
FROM _tmp_ms;
DROP TABLE _tmp_ms;

-- ============================================================
-- 5. pozos
-- ============================================================
CREATE TEMP TABLE _tmp_poz (
    cod_pozo         TEXT,
    cod_provincia    TEXT,
    nombre           TEXT,
    cod_masa         TEXT,
    X                DOUBLE PRECISION,
    Y                DOUBLE PRECISION,
    cota_terreno_m   DOUBLE PRECISION,
    red_cualitativa  TEXT,
    red_piezometrica TEXT
);
\copy _tmp_poz FROM '/tmp/pladi_data/pozos.csv' CSV HEADER
INSERT INTO pozos (cod_pozo, nombre, cod_masa, cota_terreno_m, geometry, red_cualitativa, red_piezometrica)
SELECT cod_pozo, nombre, NULLIF(cod_masa, ''), cota_terreno_m,
       ST_Transform(ST_SetSRID(ST_MakePoint(X, Y), 25831), 4326),
       red_cualitativa::boolean, red_piezometrica::boolean
FROM _tmp_poz;
DROP TABLE _tmp_poz;

-- ============================================================
-- 6. balance_masas_subterraneas_porcentajes
-- ============================================================
CREATE TEMP TABLE _tmp_bal (
    cod_masa                       TEXT,
    infiltracion_lluvia            DOUBLE PRECISION,
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
    salida_zzhh                    DOUBLE PRECISION
);
\copy _tmp_bal FROM '/tmp/pladi_data/balance_hidrico.csv' CSV HEADER
INSERT INTO balance_masas_subterraneas_porcentajes (
    cod_masa, infiltracion_lluvia, transferencia_entre_masas, infiltracion_torrentes,
    retorno_riegos, perdida_redes_abastecimiento, perdida_redes_alcantarillado,
    intrusion_salina, abastecimiento_red, agrojardineria, industria, regadio,
    ganaderia, torrentes, manantiales, humedales, transferencia_a_masas,
    salida_mar, salida_zzhh
)
SELECT * FROM _tmp_bal;
DROP TABLE _tmp_bal;

-- ============================================================
-- 7. infiltracion_epoca_material
-- ============================================================
CREATE TEMP TABLE _tmp_inf (
    id                             TEXT,
    cod_masa                       TEXT,
    epoca                          TEXT,
    material                       TEXT,
    infiltracion_lluvia_porcentaje DOUBLE PRECISION,
    area_km2                       DOUBLE PRECISION
);
\copy _tmp_inf FROM '/tmp/pladi_data/masa_subterranea_infiltracion.csv' CSV HEADER
INSERT INTO infiltracion_epoca_material (cod_masa, epoca, material, infiltracion_lluvia_porcentaje, area_km2)
SELECT cod_masa, epoca, material, infiltracion_lluvia_porcentaje, area_km2
FROM _tmp_inf;
DROP TABLE _tmp_inf;

-- ============================================================
-- 8. masa_subterranea_estacion_aemet
-- ============================================================
\copy masa_subterranea_estacion_aemet (cod_masa, cod_estacion) FROM '/tmp/pladi_data/masa_subterranea_estacion_aemet.csv' CSV HEADER NULL ''

-- ============================================================
-- 9. municipio_masa_subterranea
-- ============================================================
\copy municipio_masa_subterranea (cod_municipio, cod_masa, abastecimiento_agua_media_ponderada_anual_hm3) FROM '/tmp/pladi_data/municipio_masa_subterranea.csv' CSV HEADER NULL ''

-- ============================================================
-- 10. recurso_potencial_hm3 (columna de balance_masas_subterraneas_porcentajes)
-- ============================================================
CREATE TEMP TABLE _tmp_rp (
    cod_masa               TEXT,
    recurso_potencial_hm3  DOUBLE PRECISION
);
\copy _tmp_rp FROM '/tmp/pladi_data/recurso_potencial.csv' CSV HEADER
UPDATE balance_masas_subterraneas_porcentajes b
SET recurso_potencial_hm3 = t.recurso_potencial_hm3
FROM _tmp_rp t
WHERE b.cod_masa = t.cod_masa;
DROP TABLE _tmp_rp;
