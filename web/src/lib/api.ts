const API_BASE = import.meta.env.PUBLIC_PLADI_API_URL || 'http://localhost:8000/api/v1';

export interface CapaInfo {
  id: string;
  label: string;
  endpoint: string;
  color: string;
  icon: string;
  count: number;
  description: string;
}

export const CAPAS: CapaInfo[] = [
  {
    id: 'municipios',
    label: 'Municipios',
    endpoint: 'municipios',
    color: '#a855f7',
    icon: 'map-pin',
    count: 67,
    description: 'Límites municipales de las Illes Balears',
  },
  {
    id: 'pozos',
    label: 'Pozos',
    endpoint: 'pozos',
    color: '#22c55e',
    icon: 'scan-line',
    count: 1226,
    description: 'Red de control de calidad y piezometría',
  },
  {
    id: 'masas',
    label: 'Masas subterráneas',
    endpoint: 'masas',
    color: '#3b82f6',
    icon: 'layers',
    count: 87,
    description: 'Acuíferos y masas de agua subterránea',
  },
  {
    id: 'unidades_demanda',
    label: 'Unidades de demanda',
    endpoint: 'unidades-demanda',
    color: '#f59e0b',
    icon: 'pie-chart',
    count: 10,
    description: 'Zonas de gestión hídrica',
  },
];

export const CAPA_INFO_MAP: Record<string, CapaInfo> = Object.fromEntries(
  CAPAS.map((c) => [c.id, c])
);

export const LAYER_OPTIONS: Record<string, Record<string, unknown>> = {
  masas: {
    fillColor: '#3b82f6',
    color: '#3b82f6',
    weight: 1.5,
    fillOpacity: 0.35,
  },
  pozos: {
    fillColor: '#22c55e',
    color: '#22c55e',
    weight: 2,
    radius: 6,
    fillOpacity: 0.8,
  },
  municipios: {
    fillColor: '#a855f7',
    color: '#a855f7',
    weight: 1,
    fillOpacity: 0.15,
  },
  unidades_demanda: {
    fillColor: '#f59e0b',
    color: '#f59e0b',
    weight: 2,
    fillOpacity: 0.22,
  },
};

export async function fetchLayer(endpoint: string): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(`${API_BASE}/mapa/${endpoint}`);
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}: ${res.status}`);
  return res.json();
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface MesDato {
  anio: number;
  mes: number;
}

export interface ResumenKpis {
  modo?: 'isla' | 'municipio';
  municipio?: string;
  isla?: string;
  mes_cerrado: string;
  ah_actual: number;
  infiltracion_ah_hm3: number | null;
  infiltracion_ah_media_hm3: number | null;
  desviacion_pct: number | null;
  masas_en_deficit: number | null;
  masas_total: number | null;
  iph_pico: { nombre_isla: string; anio: number; mes: number; iph: number } | null;
  ocupacion_media_pct: number | null;
  ocupacion_mes_cerrado?: string;
  poblacion: number | null;
  poblacion_anio: number | null;
  poblacion_var_pct?: number | null;
  consumo_hm3: number | null;
  n_pozos?: number | null;
  n_masas?: number | null;
}

export interface LluviaResp {
  masa?: { cod_masa: string; nombre_masa: string; isla: string } | null;
  isla?: string;
  serie: (MesDato & { precipitacion_mm: number })[];
  referencia: { mes: number; media_mm: number }[];
}

export interface RankingMasa {
  cod_masa: string;
  nombre_masa: string;
  isla: string;
  ah_actual_mm: number;
  ah_media_mm: number;
  desviacion_pct: number;
}

export interface EntidadKpis {
  tipo: string;
  [key: string]: unknown;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/analytics/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

export const fetchResumen = (opts: { isla?: string; municipio?: string } = {}) => {
  const q = new URLSearchParams();
  if (opts.municipio) q.set('municipio', opts.municipio);
  else if (opts.isla) q.set('isla', opts.isla);
  const s = q.toString();
  return getJson<ResumenKpis>(`resumen${s ? `?${s}` : ''}`);
};

export const fetchMunicipios = (isla?: string) =>
  getJson<{ municipios: { cod_municipio: string; nombre_municipio: string; isla: string }[] }>(
    `municipios${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`
  );

export const fetchMasas = (isla?: string) =>
  getJson<{ masas: { cod_masa: string; nombre_masa: string; isla: string }[] }>(
    `masas${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`
  );

export const fetchLluvia = (opts: { isla?: string; masa?: string } = {}) => {
  const q = opts.masa
    ? `masa=${encodeURIComponent(opts.masa)}`
    : opts.isla
      ? `isla=${encodeURIComponent(opts.isla)}`
      : '';
  return getJson<LluviaResp>(`lluvia${q ? `?${q}` : ''}`);
};

export const fetchLluviaRanking = (isla?: string) =>
  getJson<{ ah_actual: number; masas: RankingMasa[] }>(
    `lluvia/ranking${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`
  );

export const fetchAbastecimiento = (opts: { isla?: string; municipio?: string } = {}) => {
  const q = new URLSearchParams();
  if (opts.municipio) q.set('municipio', opts.municipio);
  else if (opts.isla) q.set('isla', opts.isla);
  const s = q.toString();
  return getJson<{
    isla: string;
    municipio?: string;
    serie: Record<string, number | string>[];
    top_municipios: { cod_municipio: string; nombre_municipio: string; consumo_hm3: number }[];
  }>(`abastecimiento${s ? `?${s}` : ''}`);
};

export const fetchPresion = (isla?: string) =>
  getJson<{
    isla: string;
    serie: { nombre_isla?: string; anio: number; mes: number; iph: number }[];
    referencia: { mes: number; media_iph: number }[];
  }>(`presion${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`);

export const fetchOcupacion = (opts: { isla?: string; tipo?: string; municipio?: string } = {}) => {
  const q = new URLSearchParams();
  if (opts.municipio) q.set('municipio', opts.municipio);
  else if (opts.isla) q.set('isla', opts.isla);
  if (opts.tipo) q.set('tipo', opts.tipo);
  const s = q.toString();
  return getJson<{
    isla: string;
    municipio?: string;
    serie: { isla?: string; tipo: string; anio: number; mes: number; ocupacion_pct: number }[];
  }>(`ocupacion${s ? `?${s}` : ''}`);
};

export const fetchEntidad = (tipo: string, cod: string) =>
  getJson<EntidadKpis>(`entidad/${tipo}/${encodeURIComponent(cod)}`);

// ── Agua infiltrada ────────────────────────────────────────────────────────

export interface InfiltradaSerie {
  anio: number;
  mes: number;
  agua_infiltrada_hm3: number;
}

export interface InfiltradaResp {
  masa?: { cod_masa: string; nombre_masa: string; isla: string } | null;
  isla?: string;
  serie: InfiltradaSerie[];
  referencia: { mes: number; media_hm3: number }[];
}

export interface InfiltradaRanking {
  cod_masa: string;
  nombre_masa: string;
  isla: string;
  ah_actual_hm3: number;
  ah_media_hm3: number;
  desviacion_pct: number;
}

export const fetchInfiltrada = (opts: { isla?: string; masa?: string } = {}) => {
  const q = opts.masa
    ? `masa=${encodeURIComponent(opts.masa)}`
    : opts.isla
      ? `isla=${encodeURIComponent(opts.isla)}`
      : '';
  return getJson<InfiltradaResp>(`infiltrada${q ? `?${q}` : ''}`);
};

export const fetchInfiltradaRanking = (isla?: string) =>
  getJson<{ ah_actual: number; masas: InfiltradaRanking[] }>(
    `infiltrada/ranking${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`
  );

// ── Balance hídrico ────────────────────────────────────────────────────────

export interface BalanceFila {
  anio: number;
  infiltracion_lluvia_hm3: number | null;
  infiltracion_torrentes_hm3: number | null;
  retorno_riegos_hm3: number | null;
  perdida_redes_abastecimiento_hm3: number | null;
  perdida_redes_alcantarillado_hm3: number | null;
  intrusion_salina_hm3: number | null;
  suma_entradas_hm3: number | null;
  diferencia_vs_rp_hm3: number | null;
  abastecimiento_urbano_hm3: number | null;
  torrentes_hm3: number | null;
  manantiales_hm3: number | null;
  humedales_hm3: number | null;
  salida_mar_hm3: number | null;
  salida_zzhh_hm3: number | null;
  suma_salidas_hm3: number | null;
  disponibilidad_hm3: number | null;
  extraccion_hm3: number | null;
  explotacion_porcentaje: number | null;
  estado_cuantitativo?: string | null;
  n_buen_estado?: number;
  n_en_riesgo?: number;
  n_mal_estado?: number;
}

export interface BalanceResp {
  nivel: 'masa' | 'ud';
  masa?: { cod_masa: string; nombre_masa: string; isla: string } | null;
  ud?: { id_unidad_demanda: number; nombre: string; isla: string } | null;
  isla?: string;
  serie: BalanceFila[];
}

export interface BalanceRankingMasa {
  cod_masa: string;
  nombre_masa: string;
  isla: string;
  explotacion_porcentaje: number | null;
  disponibilidad_hm3: number | null;
  extraccion_hm3: number | null;
  estado_cuantitativo: string | null;
}

export interface BalanceRankingUd {
  id_unidad_demanda: number;
  nombre: string;
  isla: string;
  explotacion_porcentaje: number | null;
  disponibilidad_hm3: number | null;
  extraccion_hm3: number | null;
  n_buen_estado: number;
  n_en_riesgo: number;
  n_mal_estado: number;
}

export const fetchUds = (isla?: string) =>
  getJson<{ uds: { id_unidad_demanda: number; nombre: string; isla: string }[] }>(
    `uds${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`
  );

export const fetchBalance = (opts: { nivel: 'masa' | 'ud'; isla?: string; entidad?: string } = { nivel: 'masa' }) => {
  const q = new URLSearchParams();
  q.set('nivel', opts.nivel);
  if (opts.entidad) q.set('entidad', opts.entidad);
  else if (opts.isla) q.set('isla', opts.isla);
  return getJson<BalanceResp>(`balance?${q.toString()}`);
};

export const fetchBalanceRanking = (nivel: 'masa' | 'ud', isla?: string, anio?: number) => {
  const q = new URLSearchParams({ nivel });
  if (isla) q.set('isla', isla);
  if (anio) q.set('anio', String(anio));
  return nivel === 'masa'
    ? getJson<{ anio: number; nivel: string; masas: BalanceRankingMasa[] }>(`balance/ranking?${q.toString()}`)
    : getJson<{ anio: number; nivel: string; uds: BalanceRankingUd[] }>(`balance/ranking?${q.toString()}`);
};

export const ESTADO_COLORS: Record<string, string> = {
  buen_estado: '#22c55e',
  en_riesgo: '#f59e0b',
  mal_estado: '#f43f5e',
};

export const ESTADO_LABELS: Record<string, string> = {
  buen_estado: 'Buen estado',
  en_riesgo: 'En riesgo',
  mal_estado: 'Mal estado',
};

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const ISLAS = ['Mallorca', 'Menorca', 'Eivissa', 'Formentera'];
