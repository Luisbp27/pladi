import { atom, map } from 'nanostores';
import { fetchLayer, CAPA_INFO_MAP } from './api';

export const activeLayers = map<Record<string, boolean>>({
  masas: false,
  pozos: false,
  municipios: false,
  unidades_demanda: false,
});

export const layerLoading = map<Record<string, boolean>>({
  masas: false,
  pozos: false,
  municipios: false,
  unidades_demanda: false,
});

export const geojsonData = map<Record<string, GeoJSON.FeatureCollection | null>>({
  masas: null,
  pozos: null,
  municipios: null,
  unidades_demanda: null,
});

export const theme = atom<'dark' | 'light'>('light');

export const panelCollapsed = atom<boolean>(false);

export const drawerOpen = atom<boolean>(false);

// ── Dashboards ──────────────────────────────────────────────────────────────
export const dashIsla = atom<string>('Baleares');
export const dashVista = atom<string>('general');

// ── Drawer analitico (clic en mapa) ─────────────────────────────────────────
export const entidadTipo = atom<string>('');
export const entidadCod = atom<string>('');
export const entidadNombre = atom<string>('');
export const entidadKpis = atom<Record<string, unknown> | null>(null);
export const entidadLoading = atom<boolean>(false);

export async function loadLayer(layerId: string): Promise<void> {
  layerLoading.setKey(layerId, true);
  try {
    const info = CAPA_INFO_MAP[layerId];
    console.log(`[pladi] loadLayer: fetching ${layerId} → ${info?.endpoint || 'NOT FOUND'}`);
    const data = await fetchLayer(info.endpoint);
    console.log(`[pladi] loadLayer: ${layerId} OK — ${data.features?.length || 0} features`);
    geojsonData.setKey(layerId, data);
  } catch (err) {
    console.error(`[pladi] loadLayer ERROR ${layerId}:`, err);
    geojsonData.setKey(layerId, null);
  } finally {
    layerLoading.setKey(layerId, false);
  }
}

export async function toggleLayer(layerId: string): Promise<void> {
  const isActive = activeLayers.get()[layerId];
  const activating = !isActive;

  activeLayers.setKey(layerId, activating);

  if (activating) {
    await loadLayer(layerId);
  } else {
    geojsonData.setKey(layerId, null);
  }
}

export function loadDefaultLayers(): void {
  setTimeout(() => {
    const layers = activeLayers.get();
    for (const [id, active] of Object.entries(layers)) {
      if (active) {
        loadLayer(id);
      }
    }
  }, 300);
}
