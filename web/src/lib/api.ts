const API_BASE = import.meta.env.PUBLIC_PLADI_API_URL || '/api/v1/mapa';

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
  const res = await fetch(`${API_BASE}/${endpoint}`);
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}: ${res.status}`);
  return res.json();
}
