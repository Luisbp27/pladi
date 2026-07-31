import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  drawerOpen,
  featureProperties,
  selectedLayerLabel,
  geojsonData,
} from '../lib/store';
import { LAYER_OPTIONS } from '../lib/api';

const LAYER_LABELS: Record<string, string> = {
  masas: 'Masa subterránea',
  pozos: 'Pozo',
  municipios: 'Municipio',
  unidades_demanda: 'Unidad de demanda',
};

const CAPA_INFO: Record<string, { label: string }> = {
  masas: { label: 'Masas subterráneas' },
  pozos: { label: 'Pozos' },
  municipios: { label: 'Municipios' },
  unidades_demanda: { label: 'Unidades de demanda' },
};

export default function MapView() {
  const cssLoaded = useRef(false);
  const jsLoaded = useRef(false);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const prevGeo = useRef<Record<string, boolean>>({});

  const $geojsonData = useStore(geojsonData);

  const buildPopup = useCallback((props: Record<string, unknown>, layerId: string): string => {
    const label = LAYER_LABELS[layerId] || layerId;
    const name = (props.nombre || props.nombre_masa || props.nombre_municipio || '') as string;
    let rows = '';
    for (const k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      if (k.startsWith('created') || k.startsWith('updated')) continue;
      if (k === 'nombre' || k === 'nombre_masa' || k === 'nombre_municipio') continue;
      let v = props[k];
      if (v === null || v === undefined) v = '<span class="text-zinc-500">—</span>';
      else if (typeof v === 'number') v = v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
      else if (typeof v === 'boolean') v = v ? 'Sí' : 'No';
      rows += `<div class="flex justify-between gap-3 py-1 border-b border-zinc-800/50"><span class="text-[11px] text-zinc-500 whitespace-nowrap">${k.replace(/_/g, ' ')}</span><span class="text-[12px] text-zinc-200 text-right font-medium">${v}</span></div>`;
    }
    return `<div class="min-w-[240px] max-w-[340px] font-sans">`
      + `<div class="text-[13px] font-semibold text-blue-400 mb-2 pb-1.5 border-b border-blue-800/50">${name || label}</div>`
      + `<div class="text-[10px] text-zinc-500 mb-2">${label}</div>`
      + `<div class="max-h-[300px] overflow-y-auto mb-2">${rows}</div>`
      + `<button onclick="window.__pladiFeatureDetail('${layerId}', '${btoa(unescape(encodeURIComponent(JSON.stringify(props))))}')" class="w-full py-1.5 px-3 text-[11px] font-medium text-blue-400 bg-blue-950/40 hover:bg-blue-900/40 border border-blue-800/40 rounded-md transition-colors cursor-pointer">Ver detalle →</button>`
      + '</div>';
  }, []);

  const addLayer = useCallback((id: string, data: GeoJSON.FeatureCollection, options: Record<string, unknown>) => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;
    try {
      if (layersRef.current[id]) mapRef.current.removeLayer(layersRef.current[id]);

      if (data && data.type === 'FeatureCollection' && data.features.length > 0) {
        const geoJsonOptions: any = {
          ...options,
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties) {
              layer.bindPopup(buildPopup(feature.properties, id), {
                maxWidth: 380,
                className: 'pladi-popup',
              });
            }
          },
        };

        if (id === 'pozos') {
          geoJsonOptions.pointToLayer = (_feature: any, latlng: any) => {
            return L.circleMarker(latlng, {
              radius: (options.radius as number) || 6,
              fillColor: options.fillColor,
              color: options.color,
              weight: options.weight,
              fillOpacity: options.fillOpacity,
            });
          };
        }

        layersRef.current[id] = L.geoJSON(data, geoJsonOptions).addTo(mapRef.current);
      }
    } catch (e) {
      console.error('pladi layer error:', e);
    }
  }, [buildPopup]);

  const removeLayer = useCallback((id: string) => {
    if (layersRef.current[id] && mapRef.current) {
      mapRef.current.removeLayer(layersRef.current[id]);
      delete layersRef.current[id];
    }
  }, []);

  useEffect(() => {
    if (!cssLoaded.current) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      cssLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (jsLoaded.current) return;
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      jsLoaded.current = true;
      const L = (window as any).L;

      const darkTile = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/">CARTO</a>' }
      );

      const lightTile = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/">CARTO</a>' }
      );

      mapRef.current = L.map('pladi-map', {
        center: [39.6, 3.0],
        zoom: 8,
        zoomControl: true,
        layers: [darkTile],
      });

      L.control.layers(
        { Oscuro: darkTile, Claro: lightTile },
        undefined,
        { position: 'bottomright' }
      ).addTo(mapRef.current);

      // FeatureDetail bridge for popup buttons → React state
      (window as any).__pladiFeatureDetail = (layerId: string, propsB64: string) => {
        window.dispatchEvent(new CustomEvent('pladi:feature-detail', {
          detail: { layerId, propsB64 },
        }));
      };

      // Load default active layers
      import('../lib/store').then(({ loadDefaultLayers }) => {
        loadDefaultLayers();
      });
    };
    document.head.appendChild(script);
  }, []);

  // Sync geojsonData changes → map layers
  useEffect(() => {
    for (const [id, data] of Object.entries($geojsonData)) {
      if (data) {
        const options = { ...LAYER_OPTIONS[id] };
        addLayer(id, data, options);
        prevGeo.current[id] = true;
      } else if (prevGeo.current[id]) {
        removeLayer(id);
        prevGeo.current[id] = false;
      }
    }
  }, [$geojsonData, addLayer, removeLayer]);

  // Listen for map popup feature-detail events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { layerId: string; propsB64: string };
      const info = CAPA_INFO[detail.layerId] || { label: detail.layerId };

      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(detail.propsB64))));
        selectedLayerLabel.set(info.label);

        const props: Array<{ key: string; value: string }> = [];
        for (const [k, v] of Object.entries(decoded as Record<string, unknown>)) {
          if (k.startsWith('created') || k.startsWith('updated')) continue;
          let val = v;
          if (v === null) val = '—';
          else if (typeof v === 'number') val = v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
          else if (typeof v === 'boolean') val = v ? 'Sí' : 'No';
          else val = String(v);
          props.push({ key: k.replace(/_/g, ' '), value: val as string });
        }
        featureProperties.set(props);
        drawerOpen.set(true);
      } catch (err) {
        console.error('pladi: error decoding feature detail', err);
      }
    };

    window.addEventListener('pladi:feature-detail', handler);
    return () => window.removeEventListener('pladi:feature-detail', handler);
  }, []);

  return <div id="pladi-map" className="absolute inset-0 z-0" />;
}
