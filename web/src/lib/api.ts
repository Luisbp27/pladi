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
  mes_cerrado: string;
  ah_actual: number;
  lluvia_ah_mm: number | null;
  lluvia_ah_media_mm: number | null;
  desviacion_pct: number | null;
  masas_en_deficit: number | null;
  masas_total: number | null;
  iph_pico: { nombre_isla: string; anio: number; mes: number; iph: number } | null;
  ocupacion_media_pct: number | null;
  poblacion: number | null;
  poblacion_anio: number | null;
  consumo_hm3: number | null;
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

export const fetchResumen = (isla?: string) =>
  getJson<ResumenKpis>(`resumen${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`);

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

export const fetchAbastecimiento = (isla?: string) =>
  getJson<{
    isla: string;
    serie: Record<string, number | string>[];
    top_municipios: { cod_municipio: string; nombre_municipio: string; consumo_hm3: number }[];
  }>(`abastecimiento${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`);

export const fetchPresion = (isla?: string) =>
  getJson<{
    isla: string;
    serie: { nombre_isla?: string; anio: number; mes: number; iph: number }[];
    referencia: { mes: number; media_iph: number }[];
  }>(`presion${isla ? `?isla=${encodeURIComponent(isla)}` : ''}`);

export const fetchOcupacion = (opts: { isla?: string; tipo?: string } = {}) => {
  const q = new URLSearchParams();
  if (opts.isla) q.set('isla', opts.isla);
  if (opts.tipo) q.set('tipo', opts.tipo);
  const s = q.toString();
  return getJson<{
    isla: string;
    serie: { isla: string; tipo: string; anio: number; mes: number; ocupacion_pct: number }[];
  }>(`ocupacion${s ? `?${s}` : ''}`);
};

export const fetchEntidad = (tipo: string, cod: string) =>
  getJson<EntidadKpis>(`entidad/${tipo}/${encodeURIComponent(cod)}`);

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const ISLAS = ['Mallorca', 'Menorca', 'Eivissa', 'Formentera'];
