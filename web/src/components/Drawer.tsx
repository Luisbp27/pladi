import { useEffect, type ReactNode } from 'react';
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
import { fetchEntidad, MESES, ESTADO_COLORS, ESTADO_LABELS } from '../lib/api';
import { useIsDark } from './dashboards/ui';

const TIPO_META: Record<string, { label: string; color: string; icon: string }> = {
  masa: {
    label: 'Masa subterránea',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    icon: 'M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17h-8v-2.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z',
  },
  municipio: {
    label: 'Municipio',
    color: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01',
  },
  pozo: {
    label: 'Pozo',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    icon: 'M12 2a7 7 0 0 0-4 12.7c.5 1.7 2 3.3 4 6.3 2-3 3.5-4.6 4-6.3A7 7 0 0 0 12 2z',
  },
  ud: {
    label: 'Unidad de demanda',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    icon: 'M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14H4zm4 0h8M12 7v2m-3 0h6',
  },
};

const nf = new Intl.NumberFormat('es-ES');

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/50 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2.5">
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function InfoRow({ icon, k, v }: { icon: string; k: string; v: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 dark:stroke-zinc-500">
        <path d={icon} />
      </svg>
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">{k}</span>
      <span className="ml-auto text-[11px] text-zinc-800 dark:text-zinc-200 text-right font-medium">{v}</span>
    </div>
  );
}

function KpiBlock({
  label,
  value,
  sub,
  delta,
  accent,
  deltaTone = 'auto',
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  accent: string;
  deltaTone?: 'auto' | 'zinc';
}) {
  return (
    <div className="flex-1 min-w-[45%] rounded-xl bg-white/70 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-700/40 p-3.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 truncate">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className={`text-xl font-bold tabular-nums ${accent}`}>{value}</span>
        {delta !== null && delta !== undefined && (
          <span
            className={`text-[10px] font-semibold tabular-nums ${
              deltaTone === 'zinc'
                ? 'text-zinc-400 dark:text-zinc-500'
                : delta >= 0
                  ? 'text-emerald-500'
                  : 'text-rose-500'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <span className="block text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{sub}</span>}
    </div>
  );
}

const ICONS = {
  rain: 'M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17h-8v-2.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z',
  gota: 'M12 2.7s6.5 7.2 6.5 11.3a6.5 6.5 0 1 1-13 0C5.5 9.9 12 2.7 12 2.7z',
  grifo: 'M4 6h16M5 6v3a7 7 0 0 0 14 0V6M12 13v4m-2.5 0a2.5 2.5 0 0 0 5 0c0-1.8-1.6-2.6-2.5-4-.9 1.4-2.5 2.2-2.5 4z',
  month: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  source: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z',
  stations: 'M12 2a5 5 0 0 1 5 5c0 3-5 9-5 9s-5-6-5-9a5 5 0 0 1 5-5zM12 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  munis: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01',
  people: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  water: 'M12 2l6 6h-4v6h4l-6 6-6-6h4V8H6l6-6z',
  well: 'M12 2a7 7 0 0 0-4 12.7c.5 1.7 2 3.3 4 6.3 2-3 3.5-4.6 4-6.3A7 7 0 0 0 12 2z',
  area: 'M3 3h18v18H3zM7 17L11 13l3 3 5-5',
  island: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
};

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
    if (t === 'masa') {
      window.location.href = `/dashboards?vista=balance&nivel=masa&masa=${encodeURIComponent(c)}&nombre=${encodeURIComponent(n)}`;
    } else if (t === 'municipio') {
      window.location.href = `/dashboards?vista=abastecimiento&municipio=${encodeURIComponent(c)}&nombre=${encodeURIComponent(n)}`;
    }
  };

  const verMasa = (codMasa: string, nombreMasa: string) => {
    entidadTipo.set('masa');
    entidadCod.set(codMasa);
    entidadNombre.set(nombreMasa);
  };

  const meta = TIPO_META[tipo];

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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              {meta && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${meta.color}`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={meta.icon} />
                  </svg>
                  {meta.label}
                </span>
              )}
              <button
                onClick={() => drawerOpen.set(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">{nombre || '—'}</h2>
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
                    label="Infiltración AH"
                    value={kpis.infiltracion_ah_hm3 != null ? `${nf.format(Number(kpis.infiltracion_ah_hm3))} hm³` : '—'}
                    sub={kpis.infiltracion_ah_media_hm3 != null ? `media ${nf.format(Number(kpis.infiltracion_ah_media_hm3))} hm³` : undefined}
                    delta={kpis.desviacion_pct as number | null}
                    accent="text-blue-500"
                  />
                  <KpiBlock
                    label="Último mes"
                    value={kpis.infiltracion_ultimo_mes_hm3 != null ? `${nf.format(Number(kpis.infiltracion_ultimo_mes_hm3))} hm³` : '—'}
                    sub={kpis.infiltracion_media_ultimo_mes_hm3 != null ? `media ${nf.format(Number(kpis.infiltracion_media_ultimo_mes_hm3))} hm³` : undefined}
                    accent="text-sky-500"
                  />
                </div>
                <InfoCard title="Agua infiltrada · 24 meses">
                  <Sparkline data={(kpis.sparkline_infiltracion as Record<string, unknown>[]) ?? []} dataKey="agua_infiltrada_hm3" unit="hm³" />
                </InfoCard>
                {(() => {
                  const bal = kpis.balance as Record<string, unknown> | null;
                  if (!bal) return null;
                  const estado = bal.estado_cuantitativo as string | null;
                  const color = estado ? ESTADO_COLORS[estado] ?? '#71717a' : '#71717a';
                  return (
                    <InfoCard title={`Balance hídrico · ${bal.anio ?? '—'}`}>
                      <div className="flex items-center gap-2 py-1.5">
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Estado DMA</span>
                        <span
                          className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{ color, backgroundColor: `${color}18`, borderColor: `${color}40` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                          {estado ? ESTADO_LABELS[estado] : '—'}
                        </span>
                      </div>
                      <InfoRow
                        icon={ICONS.water}
                        k="Disponibilidad"
                        v={bal.disponibilidad_hm3 != null ? `${nf.format(Number(bal.disponibilidad_hm3))} hm³` : '—'}
                      />
                      <InfoRow
                        icon={ICONS.grifo}
                        k="Explotación"
                        v={bal.explotacion_porcentaje != null ? nf.format(Number(bal.explotacion_porcentaje)) : '—'}
                      />
                      <InfoRow
                        icon={ICONS.grifo}
                        k="Extracción"
                        v={bal.extraccion_hm3 != null ? `${nf.format(Number(bal.extraccion_hm3))} hm³` : '—'}
                      />
                    </InfoCard>
                  );
                })()}
                <InfoCard title="Abastecimiento">
                  <InfoRow icon={ICONS.munis} k="Municipios" v={String(kpis.n_municipios ?? 0)} />
                  <InfoRow
                    icon={ICONS.grifo}
                    k="Demanda media anual"
                    v={kpis.demanda_hm3 != null ? `${nf.format(Number(kpis.demanda_hm3))} hm³` : '—'}
                  />
                </InfoCard>
              </div>
            )}

            {!loading && kpis && kpis.tipo === 'municipio' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <KpiBlock
                    label={`Población ${kpis.poblacion_anio ?? ''}`}
                    value={kpis.poblacion != null ? nf.format(Number(kpis.poblacion)) : '—'}
                    delta={kpis.poblacion_var_pct as number | null}
                    deltaTone="zinc"
                    accent="text-violet-500"
                  />
                  <KpiBlock
                    label="Consumo urbano 2024"
                    value={kpis.consumo_serie ? `${nf.format(Number((kpis.consumo_serie as Array<{ consumo_hm3: number }>).at(-1)?.consumo_hm3 ?? 0))} hm³` : '—'}
                    accent="text-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <KpiBlock
                    label="Ocupación último mes"
                    value={kpis.ocupacion_ultimo_mes_pct != null ? `${nf.format(Number(kpis.ocupacion_ultimo_mes_pct))}%` : '—'}
                    sub={kpis.ocupacion_mes_cerrado ? `mes ${kpis.ocupacion_mes_cerrado}` : undefined}
                    accent="text-amber-500"
                  />
                  <KpiBlock
                    label="Lluvia AH en sus masas"
                    value={kpis.lluvia_ah_media_mm != null ? `${nf.format(Number(kpis.lluvia_ah_media_mm))} mm` : '—'}
                    accent="text-sky-500"
                  />
                </div>
                <InfoCard title="Ocupación turística · 12 meses">
                  <Sparkline data={(kpis.sparkline_ocupacion as Record<string, unknown>[]) ?? []} dataKey="ocupacion_pct" color="#f59e0b" unit="%" />
                </InfoCard>
                <InfoCard title="Recursos hídricos">
                  <InfoRow icon={ICONS.water} k="Masas que lo abastecen" v={String(kpis.n_masas ?? 0)} />
                  <InfoRow icon={ICONS.well} k="Pozos en su término" v={String(kpis.n_pozos ?? 0)} />
                </InfoCard>
              </div>
            )}

            {!loading && kpis && kpis.tipo === 'pozo' && (
              <div className="flex flex-col gap-3">
                {(() => {
                  const f = kpis.ficha as Record<string, unknown>;
                  return (
                    <InfoCard title="Ficha del pozo">
                      <InfoRow icon={ICONS.well} k="Código" v={String(f.cod_pozo ?? '—')} />
                      <InfoRow
                        icon={ICONS.area}
                        k="Cota terreno"
                        v={f.cota_terreno_m != null ? `${nf.format(Number(f.cota_terreno_m))} m` : '—'}
                      />
                      <InfoRow
                        icon={ICONS.grifo}
                        k="Uso principal"
                        v={String(f.uso_principal || '—')}
                      />
                      <InfoRow icon={ICONS.calendar} k="Red piezométrica" v={f.red_piezometrica ? 'Sí' : 'No'} />
                      <InfoRow icon={ICONS.calendar} k="Red cualitativa" v={f.red_cualitativa ? 'Sí' : 'No'} />
                      {Boolean(f.cod_masa) && (
                        <button
                          onClick={() => verMasa(String(f.cod_masa), String(f.nombre_masa ?? f.cod_masa))}
                          className="mt-3 w-full py-2 px-3 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-950/40 hover:bg-blue-200/60 dark:hover:bg-blue-900/40 border border-blue-300/40 dark:border-blue-800/40 rounded-lg transition-colors cursor-pointer"
                        >
                          Ver masa {String(f.nombre_masa ?? '')} →
                        </button>
                      )}
                    </InfoCard>
                  );
                })()}
              </div>
            )}

            {!loading && kpis && kpis.tipo === 'ud' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <KpiBlock
                    label="Infiltración AH en sus masas"
                    value={kpis.infiltracion_ah_media_hm3 != null ? `${nf.format(Number(kpis.infiltracion_ah_media_hm3))} hm³` : '—'}
                    delta={kpis.desviacion_pct as number | null}
                    accent="text-sky-500"
                  />
                  <KpiBlock
                    label="Consumo 2024"
                    value={kpis.consumo_2024_hm3 != null ? `${nf.format(Number(kpis.consumo_2024_hm3))} hm³` : '—'}
                    accent="text-blue-500"
                  />
                </div>
                {(() => {
                  const bal = kpis.balance as Record<string, unknown> | null;
                  if (!bal) return null;
                  return (
                    <InfoCard title={`Balance hídrico · ${bal.anio ?? '—'}`}>
                      <InfoRow
                        icon={ICONS.water}
                        k="Disponibilidad"
                        v={bal.disponibilidad_hm3 != null ? `${nf.format(Number(bal.disponibilidad_hm3))} hm³` : '—'}
                      />
                      <InfoRow
                        icon={ICONS.grifo}
                        k="Explotación"
                        v={bal.explotacion_porcentaje != null ? nf.format(Number(bal.explotacion_porcentaje)) : '—'}
                      />
                      <div className="flex items-center gap-2 py-1.5 flex-wrap">
                        {[
                          { n: bal.n_buen_estado, color: ESTADO_COLORS.buen_estado, label: 'buenas' },
                          { n: bal.n_en_riesgo, color: ESTADO_COLORS.en_riesgo, label: 'riesgo' },
                          { n: bal.n_mal_estado, color: ESTADO_COLORS.mal_estado, label: 'malas' },
                        ].map((i) => (
                          <span
                            key={i.label}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                            style={{ color: i.color, backgroundColor: `${i.color}18`, borderColor: `${i.color}40` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: i.color }} />
                            {Number(i.n ?? 0)} {i.label}
                          </span>
                        ))}
                      </div>
                    </InfoCard>
                  );
                })()}
                <InfoCard title="Territorio">
                  <InfoRow icon={ICONS.island} k="Isla" v={String(kpis.isla ?? '—')} />
                  <InfoRow
                    icon={ICONS.area}
                    k="Área"
                    v={kpis.area_km2 != null ? `${nf.format(Number(kpis.area_km2))} km²` : '—'}
                  />
                  <InfoRow icon={ICONS.munis} k="Municipios" v={String(kpis.n_municipios ?? '—')} />
                  <InfoRow
                    icon={ICONS.people}
                    k="Población"
                    v={kpis.poblacion != null ? nf.format(Number(kpis.poblacion)) : '—'}
                  />
                </InfoCard>
                <InfoCard title={`Masas subterráneas (${kpis.n_masas ?? 0})`}>
                  {((kpis.masas as Array<{ cod_masa: string; nombre_masa: string }>) ?? []).map((m) => (
                    <button
                      key={m.cod_masa}
                      onClick={() => verMasa(m.cod_masa, m.nombre_masa)}
                      className="flex items-center gap-2.5 py-1.5 w-full text-left group cursor-pointer"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 dark:stroke-zinc-500">
                        <path d={ICONS.water} />
                      </svg>
                      <span className="text-[11px] text-zinc-800 dark:text-zinc-200 group-hover:text-blue-500 transition-colors">
                        {m.nombre_masa}
                      </span>
                      <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-600">{m.cod_masa}</span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 dark:text-zinc-700 group-hover:text-blue-500">
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </button>
                  ))}
                </InfoCard>
              </div>
            )}
          </div>

          {/* CTA */}
          {!loading && kpis && (kpis.tipo === 'masa' || kpis.tipo === 'municipio') && (
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
