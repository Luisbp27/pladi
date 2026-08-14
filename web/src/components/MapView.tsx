import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  drawerOpen,
  entidadTipo,
  entidadCod,
  entidadNombre,
  geojsonData,
  theme,
} from '../lib/store';
import { LAYER_OPTIONS } from '../lib/api';

// Capa de mapa → entidad analítica (tipo, campo codigo, campo nombre)
const ENTIDAD_POR_CAPA: Record<string, [string, string, string]> = {
  masas: ['masa', 'cod_masa', 'nombre_masa'],
  municipios: ['municipio', 'cod_municipio', 'nombre_municipio'],
  pozos: ['pozo', 'cod_pozo', 'nombre'],
  unidades_demanda: ['ud', 'id_unidad_demanda', 'nombre'],
};

export default function MapView() {
  const cssLoaded = useRef(false);
  const jsLoaded = useRef(false);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const prevGeo = useRef<Record<string, boolean>>({});

  const $geojsonData = useStore(geojsonData);
  const $theme = useStore(theme);
  const tileRef = useRef<{ dark: any; light: any }>({ dark: null, light: null });

  const onFeatureClick = useCallback((layerId: string, props: Record<string, unknown>) => {
    const mapping = ENTIDAD_POR_CAPA[layerId];
    if (!mapping) return;
    const [tipo, campoCod, campoNombre] = mapping;
    const cod = props[campoCod];
    if (cod === null || cod === undefined || cod === '') return;
    entidadTipo.set(tipo);
    entidadCod.set(String(cod));
    entidadNombre.set(String(props[campoNombre] ?? cod));
    drawerOpen.set(true);
  }, []);

  const addLayer = useCallback((id: string, data: GeoJSON.FeatureCollection, options: Record<string, unknown>) => {
    const L = (window as any).L;
    if (!mapRef.current || !L) {
      console.warn(`[pladi] addLayer ${id}: map or L not ready (map=${!!mapRef.current}, L=${!!L})`);
      return;
    }
    try {
      if (layersRef.current[id]) mapRef.current.removeLayer(layersRef.current[id]);

      if (data && data.type === 'FeatureCollection' && data.features.length > 0) {
        const geoJsonOptions: any = {
          ...options,
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties) {
              layer.on('click', () => onFeatureClick(id, feature.properties));
              layer.on('mouseover', () => layer.setStyle && layer.setStyle({ weight: 3, fillOpacity: 0.55 }));
              layer.on('mouseout', () =>
                layer.setStyle && layer.setStyle({ weight: (options.weight as number) || 1, fillOpacity: (options.fillOpacity as number) || 0.3 })
              );
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
  }, [onFeatureClick]);

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

      const lightTile = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/">CARTO</a>' }
      );

      const darkTile = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/">CARTO</a>' }
      );

      tileRef.current = { dark: darkTile, light: lightTile };

      const initialTheme = (() => {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem('pladi-theme') || 'light';
        }
        return 'light';
      })();

      if (initialTheme !== theme.get()) {
        theme.set(initialTheme as 'dark' | 'light');
      }

      mapRef.current = L.map('pladi-map', {
        center: [39.6, 3.0],
        zoom: 8,
        zoomControl: false,
        layers: [initialTheme === 'dark' ? darkTile : lightTile],
      });

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

  // Switch map tiles when theme changes
  useEffect(() => {
    if (!mapRef.current || !tileRef.current.dark || !tileRef.current.light) return;
    const { dark, light } = tileRef.current;
    if ($theme === 'dark' && mapRef.current.hasLayer(light)) {
      mapRef.current.removeLayer(light);
      dark.addTo(mapRef.current);
      dark.bringToBack();
    } else if ($theme === 'light' && mapRef.current.hasLayer(dark)) {
      mapRef.current.removeLayer(dark);
      light.addTo(mapRef.current);
      light.bringToBack();
    }
  }, [$theme]);

  return <div id="pladi-map" className="absolute inset-0 z-0" />;
}
