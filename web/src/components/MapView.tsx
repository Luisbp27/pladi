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

const ZOOM_POZOS_INDIVIDUALES = 10;

const DMA_COLOR: Record<string, string> = {
  buen_estado: '#22c55e',
  en_riesgo: '#f59e0b',
  mal_estado: '#f43f5e',
};

const SIN_DATO_COLOR = { color: '#71717a', fillColor: '#71717a' };

function dmaStyleFor(layerId: string, props: Record<string, unknown>): { color: string; fillColor: string } | null {
  if (layerId === 'masas') {
    const e = props.estado_cuantitativo;
    if (!e) return SIN_DATO_COLOR;
    const c = DMA_COLOR[String(e)];
    return c ? { color: c, fillColor: c } : SIN_DATO_COLOR;
  }
  if (layerId === 'unidades_demanda') {
    const x = props.explotacion_porcentaje;
    if (x === null || x === undefined) return SIN_DATO_COLOR;
    const n = Number(x);
    const c = n > 1 ? '#f43f5e' : n >= 0.8 ? '#f59e0b' : '#22c55e';
    return { color: c, fillColor: c };
  }
  return null;
}

export default function MapView() {
  const cssLoaded = useRef(false);
  const jsLoaded = useRef(false);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const prevGeo = useRef<Record<string, boolean>>({});

  const $geojsonData = useStore(geojsonData);
  const $theme = useStore(theme);
  const tileRef = useRef<{ dark: any; light: any }>({ dark: null, light: null });
  const pozosClustered = useRef(false);

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

  const nombreDe = useCallback((layerId: string, props: Record<string, unknown>): string => {
    const mapping = ENTIDAD_POR_CAPA[layerId];
    if (!mapping) return '';
    return String(props[mapping[2]] ?? '');
  }, []);

  const addPozosClustered = useCallback((data: GeoJSON.FeatureCollection, options: Record<string, unknown>) => {
    const L = (window as any).L;
    if (!mapRef.current || !L?.markerClusterGroup) return false;
    if (layersRef.current['pozos']) mapRef.current.removeLayer(layersRef.current['pozos']);

    const cluster = L.markerClusterGroup({
      disableClusteringAtZoom: ZOOM_POZOS_INDIVIDUALES,
      showCoverageOnHover: false,
      maxClusterRadius: 55,
    });

    for (const feature of data.features) {
      const props = feature.properties ?? {};
      const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      const marker = L.circleMarker([lat, lon], {
        radius: (options.radius as number) || 6,
        fillColor: options.fillColor,
        color: options.color,
        weight: options.weight,
        fillOpacity: options.fillOpacity,
      });
      const nombre = nombreDe('pozos', props);
      if (nombre) marker.bindTooltip(nombre, { className: 'pladi-tooltip', direction: 'top', offset: [0, -6] });
      marker.on('click', () => onFeatureClick('pozos', props));
      cluster.addLayer(marker);
    }

    cluster.addTo(mapRef.current);
    layersRef.current['pozos'] = cluster;
    pozosClustered.current = true;
    return true;
  }, [nombreDe, onFeatureClick]);

  const addLayer = useCallback((id: string, data: GeoJSON.FeatureCollection, options: Record<string, unknown>) => {
    const L = (window as any).L;
    if (!mapRef.current || !L) {
      console.warn(`[pladi] addLayer ${id}: map or L not ready (map=${!!mapRef.current}, L=${!!L})`);
      return;
    }
    try {
      if (layersRef.current[id]) mapRef.current.removeLayer(layersRef.current[id]);

      if (id === 'pozos' && L.markerClusterGroup && addPozosClustered(data, options)) {
        return;
      }
      if (id === 'pozos') {
        (window as any).__pladiPozosGeo = data;
      }

      if (data && data.type === 'FeatureCollection' && data.features.length > 0) {
        const geoJsonOptions: any = {
          ...options,
          style: (feature: any) => {
            if (id === 'masas' || id === 'unidades_demanda') {
              const dma = dmaStyleFor(id, feature.properties ?? {});
              if (dma) return { ...dma, weight: 1.5, fillOpacity: 0.45 };
            }
            return undefined;
          },
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties) {
              const nombre = nombreDe(id, feature.properties);
              if (nombre) {
                layer.bindTooltip(nombre, {
                  className: 'pladi-tooltip',
                  direction: 'top',
                  offset: [0, -6],
                });
              }
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
  }, [onFeatureClick, nombreDe, addPozosClustered]);

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

      const cartoKey = import.meta.env.PUBLIC_CARTO_API_KEY ?? '';
      const keyParam = cartoKey ? `?key=${cartoKey}` : '';

      const lightTile = L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png${keyParam}`,
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/">CARTO</a>' }
      );

      const darkTile = L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${keyParam}`,
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
        center: [39.57, 2.9],
        zoom: 9,
        zoomControl: false,
        layers: [initialTheme === 'dark' ? darkTile : lightTile],
      });

      // MarkerCluster (clustering de pozos) — CDN tras Leaflet
      const mcCss = document.createElement('link');
      mcCss.rel = 'stylesheet';
      mcCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      document.head.appendChild(mcCss);
      const mcCssDefault = document.createElement('link');
      mcCssDefault.rel = 'stylesheet';
      mcCssDefault.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      document.head.appendChild(mcCssDefault);
      const mcJs = document.createElement('script');
      mcJs.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      mcJs.onload = () => {
        // Si los pozos ya se pintaron en plano antes de cargar el cluster, los actualizamos
        if (!pozosClustered.current && L.markerClusterGroup) {
          const geojson = (window as any).__pladiPozosGeo as GeoJSON.FeatureCollection | undefined;
          if (geojson) {
            addPozosClustered(geojson, { ...LAYER_OPTIONS['pozos'] });
          }
        }
      };
      document.head.appendChild(mcJs);

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
