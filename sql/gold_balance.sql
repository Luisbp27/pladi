-- ============================================================
-- pladi — GOLD BALANCE HIDRICO
-- Agua infiltrada (mensual) y balance hidrico simplificado (anual, DMA)
-- ============================================================

-- 1. gold.agua_infiltrada_masa_subterranea
--    agua_infiltrada_m3 = lluvia_mm x SUM(area_km2 x coef_infiltracion) x 1000
--    coef_infiltracion en tanto por uno (0.3 = 30%)
-- ============================================================
CREATE TABLE IF NOT EXISTS gold.agua_infiltrada_masa_subterranea (
    cod_masa           TEXT             NOT NULL,
    anio               INTEGER          NOT NULL,
    mes                INTEGER          NOT NULL,
    agua_infiltrada_m3 DOUBLE PRECISION,
    created_at         TIMESTAMPTZ      DEFAULT now(),
    updated_at         TIMESTAMPTZ      DEFAULT now(),
    CONSTRAINT pk_agua_infiltrada PRIMARY KEY (cod_masa, anio, mes),
    CONSTRAINT fk_agua_infiltrada_masa FOREIGN KEY (cod_masa)
        REFERENCES public.masa_subterranea (cod_masa) ON DELETE RESTRICT,
    CONSTRAINT ck_agua_infiltrada_mes CHECK (mes BETWEEN 1 AND 12)
);

CREATE INDEX IF NOT EXISTS idx_agua_infiltrada_anio_mes ON gold.agua_infiltrada_masa_subterranea (anio, mes);

-- ============================================================
-- 2. gold.balance_hidrico_baleares
--    Balance anual simplificado (modelo DMA) por masa subterranea
-- ============================================================
CREATE TABLE IF NOT EXISTS gold.balance_hidrico_baleares (
    cod_masa                          TEXT             NOT NULL,
    anio                              INTEGER          NOT NULL,

    infiltracion_lluvia_hm3           DOUBLE PRECISION,
    infiltracion_torrentes_hm3        DOUBLE PRECISION,
    retorno_riegos_hm3                DOUBLE PRECISION,
    perdida_redes_abastecimiento_hm3  DOUBLE PRECISION,
    perdida_redes_alcantarillado_hm3  DOUBLE PRECISION,
    intrusion_salina_hm3              DOUBLE PRECISION,
    suma_entradas_hm3                 DOUBLE PRECISION,
    diferencia_vs_rp_hm3              DOUBLE PRECISION,

    abastecimiento_urbano_hm3         DOUBLE PRECISION,
    torrentes_hm3                     DOUBLE PRECISION,
    manantiales_hm3                   DOUBLE PRECISION,
    humedales_hm3                     DOUBLE PRECISION,
    salida_mar_hm3                    DOUBLE PRECISION,
    salida_zzhh_hm3                   DOUBLE PRECISION,
    suma_salidas_hm3                  DOUBLE PRECISION,

    disponibilidad_hm3                DOUBLE PRECISION,
    extraccion_hm3                    DOUBLE PRECISION,
    explotacion_porcentaje            DOUBLE PRECISION,
    estado_cuantitativo               TEXT,

    created_at                        TIMESTAMPTZ      DEFAULT now(),
    updated_at                        TIMESTAMPTZ      DEFAULT now(),

    CONSTRAINT pk_balance_hidrico PRIMARY KEY (cod_masa, anio),
    CONSTRAINT fk_balance_hidrico_masa FOREIGN KEY (cod_masa)
        REFERENCES public.masa_subterranea (cod_masa) ON DELETE RESTRICT,
    CONSTRAINT ck_balance_estado CHECK (
        estado_cuantitativo IS NULL OR estado_cuantitativo IN ('buen_estado', 'en_riesgo', 'mal_estado')
    )
);

CREATE INDEX IF NOT EXISTS idx_balance_hidrico_anio ON gold.balance_hidrico_baleares (anio);
CREATE INDEX IF NOT EXISTS idx_balance_hidrico_estado ON gold.balance_hidrico_baleares (estado_cuantitativo);
