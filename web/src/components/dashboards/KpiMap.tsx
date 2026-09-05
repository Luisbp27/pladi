import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  ESTADO_COLORS,
  fetchMapaKpis,
  fetchMasas,
  type MapaKpisResp,
} from '../../lib/api';
import { estadoLabel, islaLabel, useT } from '../../lib/i18n';
import { theme } from '../../lib/store';

type Modo = 'consumo' | 'ocupacion' | 'poblacion' | 'masas';

const RAMPAS: Record<'consumo' | 'ocupacion' | 'poblacion', string[]> = {
  consumo: ['#dbeafe', '#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8'],
  ocupacion: ['#fef3c7', '#fde68a', '#fbbf24', '#f59e0b', '#b45309'],
  poblacion: ['#ede9fe', '#c4b5fd', '#a78bfa', '#7c3aed', '#6d28d9'],
};

const SIN_DATO = '#71717a';

const MODOS_MUNI: Modo[] = ['consumo', 'ocupacion', 'poblacion'];

const nf = new Intl.NumberFormat('es-ES');

export default function KpiMap({ isla }: { isla: string }) {
  const t = useT();
  const $theme = useStore(theme);

  const [modo, setModo] = useState<Modo>('consumo');
  const [err, setErr] = useState('');
  const [kpis, setKpis] = useState<MapaKpisResp | null>(null);
  const [masasIsla, setMasasIsla] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapListo, setMapListo] = useState(false);
  const [geoListo, setGeoListo] = useState(false);

  const mapRef = useRef<any>(null);
  const tileRef = useRef<{ dark: any; light: any }>({ dark: null, light: null });
  const layerRef = useRef<any>(null);
  const cssLoaded = useRef(false);
  const jsLoaded = useRef(false);
  const muniGeo = useRef<GeoJSON.FeatureCollection | null>(null);
  const masasGeo = useRef<GeoJSON.FeatureCollection | null>(null);
  const modoRef = useRef<Modo>('consumo');
  modoRef.current = modo;

  const islaParam = isla === 'Baleares' ? undefined : isla;

  // ── Leaflet init (una vez) ──────────────────────────────────────────────
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
      const initialTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('pladi-theme') || 'light' : 'light';
      mapRef.current = L.map('pladi-kpi-map', {
        center: [39.57, 2.9],
        zoom: 8,
        zoomControl: false,
        layers: [initialTheme === 'dark' ? darkTile : lightTile],
      });
      setMapListo(true);
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    };
    document.head.appendChild(script);
  }, []);

  // Tiles por theme
  useEffect(() => {
    if (!mapRef.current || !tileRef.current.dark || !tileRef.current.light) return;
    const { dark: dk, light: lt } = tileRef.current;
    if ($theme === 'dark' && mapRef.current.hasLayer(lt)) {
      mapRef.current.removeLayer(lt);
      dk.addTo(mapRef.current);
      dk.bringToBack();
    } else if ($theme === 'light' && mapRef.current.hasLayer(dk)) {
      mapRef.current.removeLayer(dk);
      lt.addTo(mapRef.current);
      lt.bringToBack();
    }
  }, [$theme]);

  // ── Datos ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cargadas = 0;
    const hecha = () => {
      cargadas += 1;
      if (cargadas === 2) setGeoListo(true);
    };
    if (!muniGeo.current) {
      fetch(`${import.meta.env.PUBLIC_PLADI_API_URL || 'http://localhost:8000/api/v1'}/mapa/municipios`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`mapa/municipios: ${r.status}`))))
        .then((g: GeoJSON.FeatureCollection) => {
          muniGeo.current = g;
        })
        .catch(() => {
          /* el mapa quedará vacío si no hay geometrías */
        })
        .finally(hecha);
    } else {
      hecha();
    }
    if (!masasGeo.current) {
      fetch(`${import.meta.env.PUBLIC_PLADI_API_URL || 'http://localhost:8000/api/v1'}/mapa/masas`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`mapa/masas: ${r.status}`))))
        .then((g: GeoJSON.FeatureCollection) => {
          masasGeo.current = g;
        })
        .catch(() => {
          /* idem */
        })
        .finally(hecha);
    } else {
      hecha();
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setErr('');
    setLoading(true);
    Promise.all([fetchMapaKpis(islaParam), fetchMasas(islaParam)])
      .then(([k, m]) => {
        if (!alive) return;
        setKpis(k);
        setMasasIsla(m.masas.map((x) => x.cod_masa));
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  // ── Dibujo de la capa ───────────────────────────────────────────────────
  const dibujar = useCallback(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;
    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const features: GeoJSON.Feature[] = [];
    let colores: Record<string, string> = {};

    if (modoRef.current === 'masas') {
      const geo = masasGeo.current;
      if (!geo) return;
      for (const f of geo.features) {
        const cod = String((f.properties as any)?.cod_masa ?? '');
        if (masasIsla.length > 0 && !masasIsla.includes(cod)) continue;
        features.push(f);
        const est = (f.properties as any)?.estado_cuantitativo;
        colores[cod] = est ? ESTADO_COLORS[String(est)] ?? SIN_DATO : SIN_DATO;
      }
    } else {
      const geo = muniGeo.current;
      const rows = kpis?.municipios ?? [];
      if (!geo || rows.length === 0) return;
      const valores: { cod: string; v: number }[] = [];
      for (const r of rows) {
        const v =
          modoRef.current === 'consumo'
            ? r.consumo_hm3
            : modoRef.current === 'ocupacion'
              ? r.ocupacion_media_pct
              : r.poblacion;
        if (v !== null && v !== undefined) valores.push({ cod: r.cod_municipio, v: Number(v) });
      }
      const min = valores.length > 0 ? Math.min(...valores.map((x) => x.v)) : 0;
      const max = valores.length > 0 ? Math.max(...valores.map((x) => x.v)) : 1;
      const ramp = RAMPAS[modoRef.current as 'consumo' | 'ocupacion' | 'poblacion'];
      for (const { cod, v } of valores) {
        const bucket = max > min ? Math.min(4, Math.floor(((v - min) / (max - min)) * 5)) : 2;
        colores[cod] = ramp[bucket];
      }
      const cods = new Set(rows.map((r) => r.cod_municipio));
      for (const f of geo.features) {
        const cod = String((f.properties as any)?.cod_municipio ?? '');
        if (!cods.has(cod)) continue;
        features.push(f);
      }
    }

    if (features.length === 0) return;

    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    layerRef.current = L.geoJSON(fc, {
      style: (feature: any) => {
        const props = feature.properties ?? {};
        const cod =
          modoRef.current === 'masas' ? String(props.cod_masa ?? '') : String(props.cod_municipio ?? '');
        const color = colores[cod] ?? SIN_DATO;
        return {
          color,
          fillColor: color,
          weight: 1.2,
          fillOpacity: modoRef.current === 'masas' ? 0.45 : 0.6,
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const props = feature.properties ?? {};
        const nombre = String(props.nombre_masa ?? props.nombre_municipio ?? '');
        if (nombre) {
          layer.bindTooltip(nombre, {
            className: 'pladi-tooltip',
            direction: 'top',
            offset: [0, -6],
          });
        }
        layer.on('click', () => {
          if (modoRef.current === 'masas') {
            window.location.href = `/dashboards?vista=balance&nivel=masa&masa=${encodeURIComponent(String(props.cod_masa ?? ''))}`;
          } else {
            window.location.href = `/dashboards?vista=abastecimiento&municipio=${encodeURIComponent(String(props.cod_municipio ?? ''))}`;
          }
        });
      },
    }).addTo(mapRef.current);

    if (features.length > 0) {
      const bounds = L.geoJSON(fc as any).getBounds();
      mapRef.current.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [kpis, masasIsla]);

  useEffect(() => {
    if (loading || !mapListo || !geoListo) return;
    const timer = setTimeout(dibujar, 60);
    return () => clearTimeout(timer);
  }, [loading, mapListo, geoListo, modo, dibujar]);

  // ── Leyenda ─────────────────────────────────────────────────────────────
  const valores =
    kpis?.municipios
      .map((r) =>
        modo === 'consumo' ? r.consumo_hm3 : modo === 'ocupacion' ? r.ocupacion_media_pct : r.poblacion
      )
      .filter((v): v is number => v !== null && v !== undefined)
      .map(Number) ?? [];
  const min = valores.length > 0 ? Math.min(...valores) : 0;
  const max = valores.length > 0 ? Math.max(...valores) : 1;
  const fmtValor = (v: number): string =>
    modo === 'consumo' ? `${nf.format(v)} hm³` : modo === 'ocupacion' ? `${nf.format(v)}%` : nf.format(v);

  const refSub =
    modo === 'consumo'
      ? t('dash.general.mapa.consumo_ref', { a: kpis?.anio_consumo ?? '—' })
      : modo === 'ocupacion'
        ? t('dash.general.mapa.ocupacion_ref')
        : modo === 'poblacion'
          ? t('dash.general.mapa.poblacion_ref', { a: kpis?.anio_poblacion ?? '—' })
          : t('mapa.estado_dma');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {MODOS_MUNI.map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              modo === m
                ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {m === 'consumo'
              ? t('dash.general.mapa.consumo')
              : m === 'ocupacion'
                ? t('dash.general.mapa.ocupacion')
                : t('dash.general.mapa.poblacion')}
          </button>
        ))}
        <button
          onClick={() => setModo('masas')}
          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
            modo === 'masas'
              ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {t('dash.general.mapa.masas')}
        </button>
      </div>

      <p className="text-[10px] text-zinc-400 dark:text-zinc-600">{refSub}</p>

      <div className="relative">
        <div id="pladi-kpi-map" className="h-[380px] w-full rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60" />
        {err && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 dark:bg-zinc-950/70">
            <p className="text-xs text-rose-500">{err}</p>
          </div>
        )}
        {loading && !err && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 dark:bg-zinc-950/50">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Leyenda */}
      {!loading && !err && (
        <div className="flex items-center gap-3 flex-wrap">
          {modo === 'masas' ? (
            <>
              {[
                { estado: 'buen_estado', color: ESTADO_COLORS.buen_estado },
                { estado: 'en_riesgo', color: ESTADO_COLORS.en_riesgo },
                { estado: 'mal_estado', color: ESTADO_COLORS.mal_estado },
              ].map((l) => (
                <span key={l.estado} className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.color }} />
                  {estadoLabel(l.estado)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: SIN_DATO }} />
                {t('mapa.sin_dato')}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">{fmtValor(min)}</span>
              <span className="flex gap-0.5">
                {RAMPAS[modo].map((c) => (
                  <span key={c} className="w-4 h-2.5 rounded-[2px]" style={{ background: c }} />
                ))}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">{fmtValor(max)}</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 ml-1">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: SIN_DATO }} />
                {t('mapa.sin_dato')}
              </span>
            </>
          )}
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600 w-full sm:w-auto sm:ml-auto">
            {modo === 'masas' ? t('dash.general.mapa.click_masa') : t('dash.general.mapa.click_muni')}
          </span>
        </div>
      )}
      {isla !== 'Baleares' && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600">— {islaLabel(isla)}</p>
      )}
    </div>
  );
}
