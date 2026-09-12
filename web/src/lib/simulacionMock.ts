import {
  fetchAbastecimiento,
  fetchMunicipios,
  type MunicipioSim,
  type SimulacionBalanceResp,
  type SimulacionEscenario,
  type SimulacionParams,
  type SimulacionResp,
} from './api';

export const ESCENARIO_COLORS = ['#3b82f6', '#f59e0b', '#a855f7', '#22c55e', '#0ea5e9'];

// Elasticidades medidas en el DAG (modelos de produccion per capita, perturbacion ±10%)
// + coeficiente censo documentado (OLS) de models/elasticidades.json
const ELASTICIDADES = { iph: 0.275, ocupacion: 0.06, lluvia: -0.026, censo: 0.81 };
const MAPE = 0.0795;

const HISTORICO_SINTETICO = [
  { anio: 2015, consumo_hm3: 74.6 },
  { anio: 2016, consumo_hm3: 76.1 },
  { anio: 2017, consumo_hm3: 78.3 },
  { anio: 2018, consumo_hm3: 79.4 },
  { anio: 2019, consumo_hm3: 81.2 },
  { anio: 2020, consumo_hm3: 74.9 },
  { anio: 2021, consumo_hm3: 80.8 },
  { anio: 2022, consumo_hm3: 84.5 },
  { anio: 2023, consumo_hm3: 85.7 },
  { anio: 2024, consumo_hm3: 86.9 },
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h / 4294967295;
}

function growthEscenario(e: SimulacionEscenario): number {
  const tendencia = 0.012 + (hash(e.id + ':trend') - 0.5) * 0.008;
  return (
    tendencia +
    (e.iph_pct / 100) * ELASTICIDADES.iph +
    (e.censo_pct / 100) * ELASTICIDADES.censo +
    (e.lluvia_pct / 100) * ELASTICIDADES.lluvia
  );
}

export async function getSimulacionMock(p: SimulacionParams): Promise<SimulacionResp> {
  let historico: { anio: number; consumo_hm3: number }[] = [];
  let ambito = p.municipio ?? p.isla ?? 'Baleares';
  try {
    const real = await fetchAbastecimiento(
      p.municipio ? { municipio: p.municipio } : p.isla && p.isla !== 'Baleares' ? { isla: p.isla } : {}
    );
    historico = real.serie
      .map((r) => ({ anio: Number(r.anio), consumo_hm3: Number(r.consumo_hm3) }))
      .filter((r) => Number.isFinite(r.consumo_hm3));
    ambito = p.municipio ? real.isla : (p.isla ?? 'Baleares');
  } catch {
    historico = HISTORICO_SINTETICO;
  }

  const base_anio = historico.length ? historico[historico.length - 1].anio : 2024;
  const base_val = historico.length ? historico[historico.length - 1].consumo_hm3 : 0.5;
  const anios = Math.max(p.hasta - base_anio, 1);

  const escenarios = p.escenarios.map((e, i) => {
    const growth = growthEscenario(e);
    let consumo = base_val;
    const proyeccion = [];
    for (let a = base_anio + 1; a <= p.hasta; a++) {
      const ruido = (hash(`${e.id}:${a}`) - 0.5) * 0.02;
      consumo = Math.max(consumo * (1 + growth + ruido), 0.001);
      const banda = MAPE + 0.03 * (a - base_anio - 1);
      proyeccion.push({
        anio: a,
        consumo_hm3: +consumo.toFixed(3),
        lo: +(consumo * (1 - banda)).toFixed(3),
        hi: +(consumo * (1 + banda)).toFixed(3),
      });
    }
    const final = proyeccion.length ? proyeccion[proyeccion.length - 1].consumo_hm3 : base_val;
    return {
      id: e.id,
      nombre: e.nombre,
      color: ESCENARIO_COLORS[i % ESCENARIO_COLORS.length],
      proyeccion,
      kpis: {
        consumo_final_hm3: final,
        delta_vs_base_pct: +(((final - base_val) / base_val) * 100).toFixed(1),
        variacion_media_anual_pct: +(((final / base_val) ** (1 / anios) - 1) * 100).toFixed(1),
        sensibilidad: ELASTICIDADES,
      },
    };
  });

  let municipios: Record<string, MunicipioSim[]> = {};
  if (!p.municipio) {
    try {
      const { municipios: muns } = await fetchMunicipios(p.isla && p.isla !== 'Baleares' ? p.isla : undefined);
      for (const e of p.escenarios) {
        const growth = growthEscenario(e);
        municipios[e.id] = muns
          .map((m) => {
            const base = +(0.02 + hash(m.cod_municipio) * 0.9).toFixed(3);
            const proy = +(base * (1 + growth) ** anios).toFixed(3);
            return {
              cod_municipio: m.cod_municipio,
              nombre_municipio: m.nombre_municipio,
              isla: m.isla,
              base_hm3: base,
              proy_hm3: proy,
              delta_pct: +(((proy - base) / base) * 100).toFixed(1),
            };
          })
          .sort((a, b) => b.delta_pct - a.delta_pct);
      }
    } catch {
      municipios = {};
    }
  }

  return {
    ambito,
    municipio: p.municipio,
    base_anio,
    hasta: p.hasta,
    serie_historica: historico,
    escenarios,
    municipios,
  };
}

export async function getSimulacionBalanceMock(p: SimulacionParams): Promise<SimulacionBalanceResp> {
  const base = { bueno: 52, riesgo: 4, malo: 16, ext: 110, disp: 155 };
  const escenarios = p.escenarios.map((e, i) => {
    const growth = growthEscenario(e);
    const serie = [];
    for (let a = 2024; a <= p.hasta; a++) {
      const t = a - 2024;
      const malo = Math.max(0, base.malo + Math.round(t * growth * 40));
      const riesgo = Math.max(0, base.riesgo + Math.round(t * growth * 20));
      serie.push({
        anio: a,
        n_buen_estado: Math.max(0, 72 - malo - riesgo),
        n_en_riesgo: riesgo,
        n_mal_estado: malo,
        extraccion_total_hm3: +(base.ext * (1 + growth * t)).toFixed(2),
        disponibilidad_total_hm3: +(base.disp * (1 - growth * t * 0.3)).toFixed(2),
        explotacion_media_pct: null,
      });
    }
    return {
      id: e.id,
      nombre: e.nombre,
      color: ESCENARIO_COLORS[i % ESCENARIO_COLORS.length],
      serie,
      masas_cambio: [],
    };
  });
  return {
    ambito: p.municipio ?? p.isla ?? 'Baleares',
    municipio: p.municipio,
    base_anio: 2024,
    hasta: p.hasta,
    n_masas: 72,
    nota: 'Modo mock: valores de ejemplo, sin cruce real con el balance.',
    escenarios,
  };
}
