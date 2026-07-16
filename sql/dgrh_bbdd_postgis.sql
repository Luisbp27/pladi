-- ============================================================
-- DDL PostgreSQL – Tablas Dimensiones DGRH
-- NOTA: Script para PostgreSQL. No ejecutar en Databricks SQL.
-- Requiere PostGIS para columnas geometry:
--   CREATE EXTENSION IF NOT EXISTS postgis;
-- ============================================================


-- ============================================================
-- dim_dgrh_balance_masas_subterraneas_porcentajes
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_balance_masas_subterraneas_porcentajes (
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
COMMENT ON TABLE  dim_dgrh_balance_masas_subterraneas_porcentajes IS 'Porcentajes del balance hídrico por masa subterránea. Entradas: infiltración lluvia, torrentes, retorno riegos, etc. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.cod_masa IS 'FK a dim_dgrh_masa_subterranea.cod_masa.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.infiltracion_lluvia IS 'Principal entrada de agua en la mayoría de masas. Valores típicos: 30-70% del total de entradas.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.transferencia_entre_masas IS 'Agua que entra lateralmente desde masas vecinas.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.infiltracion_torrentes IS 'Agua de escorrentía superficial que se infiltra.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.retorno_riegos IS 'Agua de riego que vuelve al acuífero.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.perdida_redes_abastecimiento IS 'Fugas de las tuberías urbanas que recargan el acuífero.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.perdida_redes_alcantarillado IS 'Fugas del alcantarillado que recargan el acuífero.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.intrusion_salina IS 'Entrada de agua marina. Si es alto, la masa está sobreexplotada o es costera.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.abastecimiento_red IS 'Principal demanda humana en la mayoría de masas.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.agrojardineria IS 'Extracción para riego de jardines y zonas verdes.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.industria IS 'Extracción para uso industrial.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.regadio IS 'Extracción para riego agrícola.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.ganaderia IS 'Extracción para uso ganadero.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.torrentes IS 'Descarga natural del acuífero hacia torrentes.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.manantiales IS 'Descarga natural por manantiales.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.humedales IS 'Descarga natural hacia zonas húmedas.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.transferencia_a_masas IS 'Agua que sale lateralmente hacia masas vecinas.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.salida_mar IS 'Descarga natural al mar. Si baja mucho = riesgo de intrusión salina.';
COMMENT ON COLUMN dim_dgrh_balance_masas_subterraneas_porcentajes.salida_zzhh IS 'Similar a humedales. Salida hacia zonas húmedas catalogadas (ZZHH).';

-- ============================================================
-- dim_dgrh_depuradoras_desalinizadoras
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_depuradoras_desalinizadoras (
    id_edar                   INTEGER,
    nombre_edar               TEXT,
    punto_vertido             TEXT,
    volumen_anual_maximo_m3   INTEGER,
    zona_abaqua               TEXT,
    latitud_vertido           DOUBLE PRECISION,
    latitud_edar              DOUBLE PRECISION,
    longitud_vertido          DOUBLE PRECISION,
    longitud_edar             DOUBLE PRECISION,
    geometry_pg               GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_depuradoras_desalinizadoras IS 'Catálogo de depuradoras (EDAR) y desalinizadoras de Baleares. Incluye ubicación de la planta y del punto de vertido. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.id_edar IS 'Clave primaria.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.nombre_edar IS 'Nombre oficial de la instalación.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.punto_vertido IS 'Nombre o referencia del punto donde se vierte el agua tratada.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.volumen_anual_maximo_m3 IS 'Capacidad máxima autorizada. Útil para comparar con producción real.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.zona_abaqua IS 'Zona operativa de ABAQUA (ente público que gestiona agua en Baleares).';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.latitud_vertido IS 'Ubicación del vertido, no de la planta.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.latitud_edar IS 'Ubicación de la planta.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.longitud_vertido IS 'Ubicación del vertido, no de la planta.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.longitud_edar IS 'Ubicación de la planta.';
COMMENT ON COLUMN dim_dgrh_depuradoras_desalinizadoras.geometry_pg IS 'Geometría en formato WKT para uso con PostGIS.';

-- ============================================================
-- dim_dgrh_escenario_sequia
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_escenario_sequia (
    id_escenario           INTEGER,
    escenario_descripcion  TEXT
);
COMMENT ON TABLE  dim_dgrh_escenario_sequia IS 'Define los escenarios de sequía (normalidad, prealerta, alerta, emergencia). Se relaciona con dgrh_indice_sequia.id_escenario. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_escenario_sequia.id_escenario IS 'Clave primaria. FK desde silver.dgrh_indice_sequia.';
COMMENT ON COLUMN dim_dgrh_escenario_sequia.escenario_descripcion IS 'Niveles típicos: normalidad, prealerta, alerta, emergencia. Cada nivel activa restricciones distintas de consumo.';

-- ============================================================
-- dim_dgrh_infiltracion_epoca_material
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_infiltracion_epoca_material (
    id_infiltracion_epoca_material  BIGINT,
    cod_masa                        TEXT,
    epoca                           TEXT,
    material                        TEXT,
    infiltracion_lluvia_porcentaje  DOUBLE PRECISION,
    area_m2                         INTEGER
);
COMMENT ON TABLE  dim_dgrh_infiltracion_epoca_material IS 'Coeficientes de infiltración por masa, época y material geológico. Se usan para calcular cuánta lluvia se convierte en recarga del acuífero. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_infiltracion_epoca_material.id_infiltracion_epoca_material IS 'Clave primaria surrogate.';
COMMENT ON COLUMN dim_dgrh_infiltracion_epoca_material.cod_masa IS 'FK a dim_dgrh_masa_subterranea.';
COMMENT ON COLUMN dim_dgrh_infiltracion_epoca_material.epoca IS 'Húmeda o seca. La infiltración varía mucho según la saturación del suelo.';
COMMENT ON COLUMN dim_dgrh_infiltracion_epoca_material.material IS 'Tipo de suelo/roca. Calizas infiltran mucho, arcillas casi nada.';
COMMENT ON COLUMN dim_dgrh_infiltracion_epoca_material.infiltracion_lluvia_porcentaje IS 'Qué % de la lluvia se infiltra en esta combinación. Ej: caliza en época húmeda puede ser >40%, arcilla <5%.';
COMMENT ON COLUMN dim_dgrh_infiltracion_epoca_material.area_m2 IS 'Superficie con esta combinación dentro de la masa.';

-- ============================================================
-- dim_dgrh_masa_subterranea
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_masa_subterranea (
    cod_masa                 TEXT             NOT NULL,
    id_unidad_demanda        BIGINT           NOT NULL,
    nombre_masa              TEXT,
    latitud_decimal          DOUBLE PRECISION,
    longitud_decimal         DOUBLE PRECISION,
    area_m2                  INTEGER,
    geometry_pg              GEOMETRY,
    geometry_native          GEOMETRY(GEOMETRY, 4326),
    proporcion_area_masa_ud  DOUBLE PRECISION
);
COMMENT ON TABLE  dim_dgrh_masa_subterranea IS 'Catálogo maestro de masas de agua subterránea (acuíferos) de Baleares. Tabla central del dominio hídrico. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.cod_masa IS 'Clave primaria. Código oficial DGRH. Usada como FK en la mayoría de tablas del dominio hídrico.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.id_unidad_demanda IS 'FK a dim_dgrh_unidad_demanda. Una unidad de demanda agrupa varias masas.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.nombre_masa IS 'Nombre oficial del acuífero.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.latitud_decimal IS 'Centroide, no límite exacto. Para el perímetro usar geometry.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.longitud_decimal IS 'Centroide, no límite exacto. Para el perímetro usar geometry.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.area_m2 IS 'Superficie del acuífero. Masas grandes >100km², pequeñas <10km².';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.geometry_pg IS 'Perímetro en formato WKT para PostGIS.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.geometry_native IS 'Mismo perímetro en formato nativo GEOMETRY (SRID 4326). Usar para funciones ST_*.';
COMMENT ON COLUMN dim_dgrh_masa_subterranea.proporcion_area_masa_ud IS 'Proporción del área de la masa sobre la suma de áreas de todas las masas de su id_unidad_demanda. Rango [0, 1].';

-- ============================================================
-- dim_dgrh_masa_subterranea_estacion_aemet
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_masa_subterranea_estacion_aemet (
    cod_masa      TEXT,
    cod_estacion  TEXT
);
COMMENT ON TABLE dim_dgrh_masa_subterranea_estacion_aemet IS 'Relación entre masas subterráneas y estaciones AEMET.';

-- ============================================================
-- dim_dgrh_masa_superficial_costas
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_masa_superficial_costas (
    cod_masa          TEXT,
    cod_masa_europa   TEXT,
    cod_masa_iph      TEXT,
    categoria         TEXT,
    nombre            TEXT,
    area_m2           DOUBLE PRECISION,
    perimetro_km      DOUBLE PRECISION,
    latitud_decimal   DOUBLE PRECISION,
    longitud_decimal  DOUBLE PRECISION,
    geometry_pg       GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_masa_superficial_costas IS 'Masas de agua superficial costeras de Baleares. Usadas para evaluar calidad del agua de baño y estado ecológico. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.cod_masa IS 'Clave primaria. Código DGRH.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.cod_masa_europa IS 'Código europeo (Directiva Marco del Agua). Para reportes a la UE.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.cod_masa_iph IS 'Código según Instrucción de Planificación Hidrológica (normativa estatal).';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.categoria IS 'Siempre "costera" en esta tabla.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.nombre IS 'Nombre oficial.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.area_m2 IS 'Superficie de la masa costera.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.perimetro_km IS 'Línea de costa de la masa.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.latitud_decimal IS 'Centroide.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.longitud_decimal IS 'Centroide.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_costas.geometry_pg IS 'Perímetro en WKT.';

-- ============================================================
-- dim_dgrh_masa_superficial_lagos
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_masa_superficial_lagos (
    cod_masa          TEXT,
    cod_masa_europa   TEXT,
    cod_masa_iph      TEXT,
    categoria         TEXT,
    nombre            TEXT,
    area_m2           DOUBLE PRECISION,
    perimetro_km      DOUBLE PRECISION,
    latitud_decimal   DOUBLE PRECISION,
    longitud_decimal  DOUBLE PRECISION,
    geometry_pg       GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_masa_superficial_lagos IS 'Masas de agua superficial tipo lago de Baleares. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.cod_masa IS 'Clave primaria.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.cod_masa_europa IS 'Código europeo (Directiva Marco del Agua).';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.cod_masa_iph IS 'Código normativa estatal.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.categoria IS 'Siempre "lago" en esta tabla.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.nombre IS 'Nombre oficial.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.area_m2 IS 'Superficie del lago.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.perimetro_km IS 'Perímetro del lago.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.latitud_decimal IS 'Centroide.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.longitud_decimal IS 'Centroide.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_lagos.geometry_pg IS 'Perímetro en WKT.';

-- ============================================================
-- dim_dgrh_masa_superficial_rios
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_masa_superficial_rios (
    cod_masa          TEXT,
    cod_masa_europa   TEXT,
    cod_masa_iph      TEXT,
    categoria         TEXT,
    nombre            TEXT,
    latitud_decimal   DOUBLE PRECISION,
    longitud_decimal  DOUBLE PRECISION,
    geometry_pg       GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_masa_superficial_rios IS 'Masas de agua superficial tipo río (torrentes) de Baleares. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.cod_masa IS 'Clave primaria.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.cod_masa_europa IS 'Código europeo (Directiva Marco del Agua).';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.cod_masa_iph IS 'Código normativa estatal.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.categoria IS 'Siempre "río" aunque sean torrentes.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.nombre IS 'Nombre oficial del tramo.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.latitud_decimal IS 'Centroide del tramo.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.longitud_decimal IS 'Centroide del tramo.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_rios.geometry_pg IS 'Geometría lineal del tramo en WKT.';

-- ============================================================
-- dim_dgrh_masa_superficial_transicion
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_masa_superficial_transicion (
    cod_masa          TEXT,
    cod_masa_europa   TEXT,
    cod_masa_iph      TEXT,
    categoria         TEXT,
    tipo              TEXT,
    nombre            TEXT,
    area_m2           DOUBLE PRECISION,
    perimetro_km      DOUBLE PRECISION,
    latitud_decimal   DOUBLE PRECISION,
    longitud_decimal  DOUBLE PRECISION,
    geometry_pg       GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_masa_superficial_transicion IS 'Masas de agua de transición (albuferas, estuarios, lagunas costeras). Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.cod_masa IS 'Clave primaria.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.cod_masa_europa IS 'Código europeo (Directiva Marco del Agua).';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.cod_masa_iph IS 'Código normativa estatal.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.categoria IS 'Siempre "transición" en esta tabla.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.tipo IS 'Subtipo: estuario, albufera, laguna costera, etc.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.nombre IS 'Nombre oficial.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.area_m2 IS 'Superficie de la masa.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.perimetro_km IS 'Perímetro de la masa.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.latitud_decimal IS 'Centroide.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.longitud_decimal IS 'Centroide.';
COMMENT ON COLUMN dim_dgrh_masa_superficial_transicion.geometry_pg IS 'Perímetro en WKT.';

-- ============================================================
-- dim_dgrh_municipio_masa_subterranea
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_municipio_masa_subterranea (
    cod_municipio_ine                             TEXT,
    cod_masa                                      TEXT,
    abastecimiento_agua_media_ponderada_anual_hm3 DOUBLE PRECISION
);
COMMENT ON TABLE  dim_dgrh_municipio_masa_subterranea IS 'Relación municipio ↔ masa subterránea. Un municipio puede abastecerse de varias masas. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_municipio_masa_subterranea.cod_municipio_ine IS 'FK a dim_municipio.';
COMMENT ON COLUMN dim_dgrh_municipio_masa_subterranea.cod_masa IS 'FK a dim_dgrh_masa_subterranea.';

-- ============================================================
-- dim_dgrh_pozos
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_pozos (
    cod_pozo                                 TEXT,
    cod_pozo_antiguo                         TEXT,
    nombre                                   TEXT,
    cod_masa                                 TEXT,
    tipo                                     TEXT,
    uso_principal                            TEXT,
    cota_terreno_m                           DOUBLE PRECISION,
    longitud                                 DOUBLE PRECISION,
    latitud                                  DOUBLE PRECISION,
    red_cualitativa                          INTEGER,
    frecuencia_muestreo_cualitativa_iso8601  TEXT,
    red_piezometrica                         INTEGER,
    frecuencia_medicion_piezometrica_iso8601 TEXT,
    geometry_pg                              GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_pozos IS 'Catálogo de pozos de control y extracción de Baleares. Incluye pozos de monitoreo (piezometría y calidad) y de extracción. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_pozos.cod_pozo IS 'Clave primaria. Código actual.';
COMMENT ON COLUMN dim_dgrh_pozos.cod_pozo_antiguo IS 'Código anterior. Útil para cruzar con datos históricos.';
COMMENT ON COLUMN dim_dgrh_pozos.nombre IS 'Topónimo o nombre descriptivo.';
COMMENT ON COLUMN dim_dgrh_pozos.cod_masa IS 'FK a dim_dgrh_masa_subterranea. En qué acuífero está.';
COMMENT ON COLUMN dim_dgrh_pozos.tipo IS 'Sondeo, pozo excavado, galería, etc.';
COMMENT ON COLUMN dim_dgrh_pozos.uso_principal IS 'Abastecimiento, riego, control, etc.';
COMMENT ON COLUMN dim_dgrh_pozos.cota_terreno_m IS 'Metros sobre nivel del mar en la boca del pozo.';
COMMENT ON COLUMN dim_dgrh_pozos.longitud IS 'WGS84 decimal.';
COMMENT ON COLUMN dim_dgrh_pozos.latitud IS 'WGS84 decimal.';
COMMENT ON COLUMN dim_dgrh_pozos.red_cualitativa IS '1 = pertenece a la red de calidad del agua. Se le toman muestras químicas periódicamente.';
COMMENT ON COLUMN dim_dgrh_pozos.frecuencia_muestreo_cualitativa_iso8601 IS 'Formato ISO 8601 duración. Ej: P6M = cada 6 meses, P1Y = anual.';
COMMENT ON COLUMN dim_dgrh_pozos.red_piezometrica IS '1 = pertenece a la red piezométrica. Se mide el nivel del agua periódicamente.';
COMMENT ON COLUMN dim_dgrh_pozos.frecuencia_medicion_piezometrica_iso8601 IS 'Formato ISO 8601 duración. Ej: P1M = mensual.';
COMMENT ON COLUMN dim_dgrh_pozos.geometry_pg IS 'Punto en WKT.';

-- ============================================================
-- dim_dgrh_unidad_demanda
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_dgrh_unidad_demanda (
    id_unidad_demanda  BIGINT           NOT NULL,
    nombre             TEXT,
    cod_provincia_ine  TEXT,
    superficie_km2     DOUBLE PRECISION,
    geometry_pg        GEOMETRY
);
COMMENT ON TABLE  dim_dgrh_unidad_demanda IS 'Unidades de demanda hídrica de Baleares. Agrupan varias masas subterráneas por zona de gestión. Fuente: DGRH.';
COMMENT ON COLUMN dim_dgrh_unidad_demanda.id_unidad_demanda IS 'Clave primaria. FK desde dim_dgrh_masa_subterranea.';
COMMENT ON COLUMN dim_dgrh_unidad_demanda.nombre IS 'Nombre de la unidad (generalmente referencia geográfica).';
COMMENT ON COLUMN dim_dgrh_unidad_demanda.cod_provincia_ine IS 'Provincia donde se ubica.';
COMMENT ON COLUMN dim_dgrh_unidad_demanda.superficie_km2 IS 'Superficie total de la unidad de demanda.';
COMMENT ON COLUMN dim_dgrh_unidad_demanda.geometry_pg IS 'Perímetro en WKT.';

-- ============================================================
-- dim_municipio
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_municipio (
    cod_municipio_ine   TEXT,
    cod_municipio       VARCHAR(30),
    nombre_municipio    VARCHAR(255),
    latitud_municipio   DOUBLE PRECISION,
    longitud_municipio  DOUBLE PRECISION,
    poblacion_ine_2025  BIGINT,
    superficie_km2      DOUBLE PRECISION,
    geometry_pg         GEOMETRY
);
COMMENT ON TABLE  dim_municipio IS 'Tabla maestra de municipios de Baleares. Base para cruzar datos de cualquier dominio. Fuente: INE + elaboración propia.';
COMMENT ON COLUMN dim_municipio.cod_municipio_ine IS 'Clave primaria. 5 dígitos: 2 de provincia + 3 de municipio. Usada como FK en la mayoría de tablas con datos municipales.';
COMMENT ON COLUMN dim_municipio.cod_municipio IS 'Solo los 3 dígitos de municipio (sin provincia). Menos usado.';
COMMENT ON COLUMN dim_municipio.nombre_municipio IS 'Nombre oficial.';
COMMENT ON COLUMN dim_municipio.latitud_municipio IS 'Centroide del municipio.';
COMMENT ON COLUMN dim_municipio.longitud_municipio IS 'Centroide del municipio.';
COMMENT ON COLUMN dim_municipio.poblacion_ine_2025 IS 'Cifra oficial INE 2025. Útil para calcular consumo per cápita.';
COMMENT ON COLUMN dim_municipio.superficie_km2 IS 'Superficie del término municipal.';
COMMENT ON COLUMN dim_municipio.geometry_pg IS 'Perímetro municipal en WKT.';

-- ============================================================
-- dim_provincia
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_provincia (
    cod_provincia_ine    TEXT,
    nombre_provincia     TEXT,
    cod_zona_geografica  TEXT
);
COMMENT ON TABLE  dim_provincia IS 'Provincias de Baleares y su zona geográfica IBESTAT. Fuente: INE + elaboración propia.';
COMMENT ON COLUMN dim_provincia.cod_provincia_ine IS 'Código INE de provincia.';
COMMENT ON COLUMN dim_provincia.nombre_provincia IS 'Nombre oficial.';
COMMENT ON COLUMN dim_provincia.cod_zona_geografica IS 'Código IBESTAT para cruzar con datos turísticos.';