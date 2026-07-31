import { atom, map } from 'nanostores';
import { fetchLayer, CAPA_INFO_MAP } from './api';

export const activeLayers = map<Record<string, boolean>>({
  masas: true,
  pozos: true,
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

export const panelCollapsed = atom<boolean>(false);

export const drawerOpen = atom<boolean>(false);
export const selectedLayerLabel = atom<string>('');
export const selectedFeature = atom<Record<string, unknown>>({});
export const featureProperties = atom<Array<{ key: string; value: string }>>([]);

export async function loadLayer(layerId: string): Promise<void> {
  layerLoading.setKey(layerId, true);
  try {
    const info = CAPA_INFO_MAP[layerId];
    const data = await fetchLayer(info.endpoint);
    geojsonData.setKey(layerId, data);
  } catch (err) {
    console.error(`pladi: error loading layer ${layerId}`, err);
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
