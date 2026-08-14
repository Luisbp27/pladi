import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  drawerOpen,
  entidadTipo,
  entidadCod,
  entidadNombre,
  entidadKpis,
  entidadLoading,
} from '../lib/store';
import { fetchEntidad, MESES } from '../lib/api';
import { useIsDark } from './dashboards/ui';

const TIPO_LABEL: Record<string, string> = {
  masa: 'Masa subterránea',
  municipio: 'Municipio',
  pozo: 'Pozo',
  ud: 'Unidad de demanda',
};

const nf = new Intl.NumberFormat('es-ES');

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between w-full py-2 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0">
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap min-w-[110px]">{k}</span>
      <span className="text-[11px] text-zinc-800 dark:text-zinc-200 text-right font-medium">{v}</span>
    </div>
  );
}

function KpiBlock({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="flex-1 min-w-[45%] rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/40 p-3">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</span>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</span>
        {delta !== null && delta !== undefined && (
          <span className={`text-[10px] font-semibold tabular-nums ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <span className="block text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{sub}</span>}
    </div>
  );
}

function Sparkline({
  data,
  dataKey,
  color = '#3b82f6',
  unit = '',
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
  unit?: string;
}) {
  const dark = useIsDark();
  const rows = data.map((d) => ({
    ...d,
    label: `${MESES[(d.mes as number) - 1]}-${String(d.anio).slice(2)}`,
  }));
  return (
    <div className="h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <defs>
            <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: dark ? '#18181b' : '#fff',
              border: '1px solid #3f3f46',
              borderRadius: 10,
              fontSize: 11,
            }}
            formatter={(v) => [`${nf.format(Number(v))} ${unit}`, '']}
            labelFormatter={(l) => String(l)}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${dataKey})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Drawer() {
  const $drawerOpen = useStore(drawerOpen);
  const tipo = useStore(entidadTipo);
  const cod = useStore(entidadCod);
  const nombre = useStore(entidadNombre);
  const kpis = useStore(entidadKpis);
  const loading = useStore(entidadLoading);

  useEffect(() => {
    if (!$drawerOpen || !tipo || !cod) return;
    let alive = true;
    entidadLoading.set(true);
    entidadKpis.set(null);
    fetchEntidad(tipo, cod)
      .then((d) => {
        if (alive) entidadKpis.set(d);
      })
      .catch(() => {
        if (alive) entidadKpis.set(null);
      })
      .finally(() => {
        if (alive) entidadLoading.set(false);
      });
    return () => {
      alive = false;
    };
  }, [$drawerOpen, tipo, cod]);

  const irADetalle = (t: string, c: string, n: string) => {
    window.location.href = `/dashboards?tipo=${encodeURIComponent(t)}&cod=${encodeURIComponent(c)}&nombre=${encodeURIComponent(n)}`;
  };

  const verMasa = (codMasa: string, nombreMasa: string) => {
    entidadTipo.set('masa');
    entidadCod.set(codMasa);
    entidadNombre.set(nombreMasa);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-zinc-900/20 dark:bg-black/30 transition-opacity duration-300 ${
          $drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => drawerOpen.set(false)}
      />

      <div
        className={`fixed top-11 right-0 z-40 h-[calc(100vh-44px-36px)] w-[380px] max-w-[92vw] bg-white dark:bg-[#0f0f13] border-l border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          $drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-3 p-4 h-full">
          {/* Header */}
          <div className="flex flex-col gap-0">
            <div className="flex items-center gap-1 mb-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                {TIPO_LABEL[tipo] || 'Detalle'}
              </span>
            </div>
            <div className="flex items-center justify-between w-full">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">{nombre || '—'}</h2>
              <button
                onClick={() => drawerOpen.set(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-400 dark:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Cerrar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <hr className="border-zinc-300/40 dark:border-zinc-700/40" />

          {/* Contenido */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}

            {!loading && !kpis && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-4">Sin datos disponibles</p>
            )}

            {!loading && kpis && kpis.tipo === 'masa' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <KpiBlock
                    label="Lluvia AH"
                    value={kpis.lluvia_ah_mm != null ? `${nf.format(Number(kpis.lluvia_ah_mm))} mm` : '—'}
                    sub={kpis.lluvia_ah_media_mm != null ? `media ${nf.format(Number(kpis.lluvia_ah_media_mm))} mm` : undefined}
                    delta={kpis.desviacion_pct as number | null}
                  />
                  <KpiBlock
                    label="Último mes"
                    value={kpis.lluvia_ultimo_mes_mm != null ? `${nf.format(Number(kpis.lluvia_ultimo_mes_mm))} mm` : '—'}
                    sub={kpis.lluvia_media_ultimo_mes_mm != null ? `media ${nf.format(Number(kpis.lluvia_media_ultimo_mes_mm))} mm` : undefined}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-1">
                    Lluvia mensual — 24 meses
                  </p>
                  <Sparkline data={(kpis.sparkline_lluvia as Record<string, unknown>[]) ?? []} dataKey="precipitacion_mm" unit="mm" />
                </div>
                <Row k="Fuente del dato" v={((kpis.fuentes as string[]) ?? []).join(', ') || '—'} />
                <Row k="Estaciones AEMET" v={String(kpis.n_estaciones ?? 0)} />
                <Row k="Municipios abastecidos" v={String(kpis.n_municipios ?? 0)} />
                <Row k="Demanda media anual" v={kpis.demanda_hm3 != null ? `${nf.format(Number(kpis.demanda_hm3))} hm³` : '—'} />
              </div>
            )}

            {!loading && kpis && kpis.tipo === 'municipio' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <KpiBlock
                    label={`Población ${kpis.poblacion_anio ?? ''}`}
                    value={kpis.poblacion != null ? nf.format(Number(kpis.poblacion)) : '—'}
                    delta={kpis.poblacion_var_pct as number | null}
                  />
                  <KpiBlock
                    label="Consumo urbano 2024"
                    value={kpis.consumo_serie ? `${nf.format(Number((kpis.consumo_serie as Array<{ consumo_hm3: number }>).at(-1)?.consumo_hm3 ?? 0))} hm³` : '—'}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <KpiBlock
                    label="Ocupación último mes"
                    value={kpis.ocupacion_ultimo_mes_pct != null ? `${nf.format(Number(kpis.ocupacion_ultimo_mes_pct))}%` : '—'}
                  />
                  <KpiBlock
                    label="Lluvia AH en sus masas"
                    value={kpis.lluvia_ah_media_mm != null ? `${nf.format(Number(kpis.lluvia_ah_media_mm))} mm` : '—'}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-1">
                    Ocupación turística — 12 meses
                  </p>
                  <Sparkline data={(kpis.sparkline_ocupacion as Record<string, unknown>[]) ?? []} dataKey="ocupacion_pct" color="#f59e0b" unit="%" />
                </div>
                <Row k="Masas que lo abastecen" v={String(kpis.n_masas ?? 0)} />
                <Row k="Pozos en su término" v={String(kpis.n_pozos ?? 0)} />
              </div>
            )}

            {!loading && kpis && kpis.tipo === 'pozo' && (
              <div className="flex flex-col">
                {(() => {
                  const f = kpis.ficha as Record<string, unknown>;
                  return (
                    <>
                      <Row k="Código" v={String(f.cod_pozo ?? '—')} />
                      <Row k="Cota terreno" v={f.cota_terreno_m != null ? `${nf.format(Number(f.cota_terreno_m))} m` : '—'} />
                      <Row k="Uso principal" v={String(f.uso_principal || '—')} />
                      <Row k="Red piezométrica" v={f.red_piezometrica ? 'Sí' : 'No'} />
                      <Row k="Red cualitativa" v={f.red_cualitativa ? 'Sí' : 'No'} />
                      {f.cod_masa && (
                        <button
                          onClick={() => verMasa(String(f.cod_masa), String(f.nombre_masa ?? f.cod_masa))}
                          className="mt-3 w-full py-2 px-3 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-950/40 hover:bg-blue-200/60 dark:hover:bg-blue-900/40 border border-blue-300/40 dark:border-blue-800/40 rounded-lg transition-colors cursor-pointer"
                        >
                          Ver masa {String(f.nombre_masa ?? '')} →
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {!loading && kpis && kpis.tipo === 'ud' && (
              <div className="flex flex-col">
                <Row k="Isla" v={String(kpis.isla ?? '—')} />
                <Row k="Área" v={kpis.area_km2 != null ? `${nf.format(Number(kpis.area_km2))} km²` : '—'} />
                <Row k="Municipios" v={String(kpis.n_municipios ?? '—')} />
                <Row k="Población" v={kpis.poblacion != null ? nf.format(Number(kpis.poblacion)) : '—'} />
                <Row k="Consumo 2024" v={kpis.consumo_2024_hm3 != null ? `${nf.format(Number(kpis.consumo_2024_hm3))} hm³` : '—'} />
                <Row k="Masas subterráneas" v={String(kpis.n_masas ?? '—')} />
                <Row
                  k="Lluvia AH media"
                  v={kpis.lluvia_ah_media_mm != null ? `${nf.format(Number(kpis.lluvia_ah_media_mm))} mm` : '—'}
                />
              </div>
            )}
          </div>

          {/* CTA */}
          {!loading && kpis && (kpis.tipo === 'masa' || kpis.tipo === 'municipio' || kpis.tipo === 'ud') && (
            <button
              onClick={() => irADetalle(tipo, cod, nombre)}
              className="w-full py-2.5 px-3 text-[12px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors cursor-pointer"
            >
              Más detalle →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
