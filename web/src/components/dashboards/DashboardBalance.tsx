import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ESTADO_COLORS, ESTADO_LABELS,
  fetchBalance, fetchBalanceRanking, fetchMasas, fetchUds,
  type BalanceFila, type BalanceRankingMasa, type BalanceRankingUd,
} from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, KpiCard, RangoTemporal, SearchSelect, Spinner, useIsDark, type Rango, type SelectOption } from './ui';

const nf = new Intl.NumberFormat('es-ES');

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—';
  return nf.format(Number(v.toFixed(digits)));
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h2>
        {subtitle && <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function EstadoChip({ estado }: { estado: string | null | undefined }) {
  if (!estado) return <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>;
  const color = ESTADO_COLORS[estado] ?? '#71717a';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ color, backgroundColor: `${color}18`, borderColor: `${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

function CountChips({ fila }: { fila: BalanceFila }) {
  const items = [
    { n: fila.n_buen_estado, color: ESTADO_COLORS.buen_estado, label: 'buenas' },
    { n: fila.n_en_riesgo, color: ESTADO_COLORS.en_riesgo, label: 'riesgo' },
    { n: fila.n_mal_estado, color: ESTADO_COLORS.mal_estado, label: 'malas' },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((i) => (
        <span
          key={i.label}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
          style={{ color: i.color, backgroundColor: `${i.color}18`, borderColor: `${i.color}40` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: i.color }} />
          {i.n ?? 0} {i.label}
        </span>
      ))}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Información sobre disponibilidad"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="cursor-help"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-zinc-100 text-[10px] leading-relaxed transition-opacity z-50 shadow-xl ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
}

const COMPONENTES_ENTRADAS = [
  { key: 'infiltracion_lluvia_hm3', label: 'Infiltración lluvia', color: '#3b82f6' },
  { key: 'infiltracion_torrentes_hm3', label: 'Infiltración torrentes', color: '#0ea5e9' },
  { key: 'retorno_riegos_hm3', label: 'Retorno riegos', color: '#22c55e' },
  { key: 'perdida_redes_abastecimiento_hm3', label: 'Pérdidas redes abastecimiento', color: '#a855f7' },
  { key: 'perdida_redes_alcantarillado_hm3', label: 'Pérdidas redes alcantarillado', color: '#8b5cf6' },
  { key: 'intrusion_salina_hm3', label: 'Intrusión salina', color: '#64748b' },
];

const COMPONENTES_SALIDAS = [
  { key: 'abastecimiento_urbano_hm3', label: 'Abastecimiento urbano', color: '#f43f5e' },
  { key: 'torrentes_hm3', label: 'Torrentes', color: '#0ea5e9' },
  { key: 'manantiales_hm3', label: 'Manantiales', color: '#06b6d4' },
  { key: 'humedales_hm3', label: 'Humedales', color: '#22c55e' },
  { key: 'salida_mar_hm3', label: 'Salida mar', color: '#64748b' },
  { key: 'salida_zzhh_hm3', label: 'Salida ZZHH', color: '#94a3b8' },
];

function GrupoDesglose({
  titulo,
  comps,
  fila,
}: {
  titulo: string;
  comps: typeof COMPONENTES_ENTRADAS;
  fila: BalanceFila;
}) {
  const dark = useIsDark();
  const grid = dark ? '#3f3f46' : '#e4e4e7';

  const v = (key: string): number => {
    const x = (fila as unknown as Record<string, unknown>)[key];
    return x === null || x === undefined ? 0 : Number(x);
  };
  const total = comps.reduce((s, c) => s + v(c.key), 0);

  const data = [{ name: titulo } as Record<string, string | number>];
  for (const c of comps) data[0][c.key] = v(c.key);

  return (
    <div className="rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/50 p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">{titulo}</p>
        <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
          {fmt(total)} hm³
        </span>
      </div>
      <ResponsiveContainer width="100%" height={46}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            contentStyle={{
              background: dark ? '#18181b' : '#fff',
              border: `1px solid ${grid}`,
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value) => [`${fmt(Number(value))} hm³`, '']}
          />
          {comps.map((c) => (
            <Bar key={c.key} dataKey={c.key} name={c.label} stackId="g" fill={c.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-col">
        {comps.map((c) => {
          const val = v(c.key);
          const pct = total > 0 ? (val / total) * 100 : 0;
          return (
            <div
              key={c.key}
              className="flex items-center gap-2 py-1.5 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
            >
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: c.color }} />
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 flex-1 truncate">{c.label}</span>
              <span className="hidden sm:inline text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums">{pct.toFixed(1)}%</span>
              <span className="text-[11px] text-zinc-800 dark:text-zinc-200 font-medium tabular-nums w-16 text-right">
                {fmt(val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardBalance({
  nivelInicial,
  masaInicial,
  udInicial,
}: {
  nivelInicial?: 'masa' | 'ud';
  masaInicial?: string;
  udInicial?: string;
}) {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [nivel, setNivel] = useState<'masa' | 'ud'>(nivelInicial ?? 'masa');
  const [masa, setMasa] = useState<string>(masaInicial ?? '');
  const [ud, setUd] = useState<string>(udInicial ?? '');
  const [rango, setRango] = useState<Rango | null>(null);
  const [masas, setMasas] = useState<SelectOption[]>([]);
  const [uds, setUds] = useState<SelectOption[]>([]);
  const [serie, setSerie] = useState<BalanceFila[]>([]);
  const [rankingMasa, setRankingMasa] = useState<BalanceRankingMasa[]>([]);
  const [rankingUd, setRankingUd] = useState<BalanceRankingUd[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (nivelInicial) setNivel(nivelInicial);
    if (masaInicial) setMasa(masaInicial);
    if (udInicial) setUd(udInicial);
  }, [nivelInicial, masaInicial, udInicial]);

  useEffect(() => {
    let alive = true;
    fetchMasas(islaParam)
      .then((r) => alive && setMasas(r.masas.map((m) => ({ cod: m.cod_masa, nombre: m.nombre_masa }))))
      .catch(() => alive && setMasas([]));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  useEffect(() => {
    let alive = true;
    fetchUds(islaParam)
      .then((r) => alive && setUds(r.uds.map((u) => ({ cod: String(u.id_unidad_demanda), nombre: u.nombre }))))
      .catch(() => alive && setUds([]));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  // Serie completa (para snapshot + evolución)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    const entidad = nivel === 'masa' ? masa || undefined : ud || undefined;
    fetchBalance({ nivel, isla: islaParam, entidad })
      .then((b) => {
        if (!alive) return;
        setSerie(b.serie);
        setLoading(false);
      })
      .catch((e) => {
        if (alive) {
          setErr(String(e));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [nivel, islaParam, masa, ud]);

  const minAnio = serie.length > 0 ? serie[0].anio : 2015;
  const maxAnio = serie.length > 0 ? serie[serie.length - 1].anio : 2024;
  const rangoEf: Rango = rango ?? { desde: minAnio, hasta: maxAnio };

  // Ranking del año "hasta" del rango
  useEffect(() => {
    let alive = true;
    fetchBalanceRanking(nivel, islaParam, rangoEf.hasta)
      .then((r) => {
        if (!alive) return;
        if (nivel === 'masa') setRankingMasa((r as { masas: BalanceRankingMasa[] }).masas);
        else setRankingUd((r as { uds: BalanceRankingUd[] }).uds);
      })
      .catch(() => {
        /* ranking opcional */
      });
    return () => {
      alive = false;
    };
  }, [nivel, islaParam, rangoEf.hasta]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  // Snapshot: último año disponible (independiente del rango)
  const snapshot = serie.length > 0 ? serie[serie.length - 1] : null;
  const esMasaDetalle = nivel === 'masa' && !!masa;

  const serieFiltrada = serie.filter((x) => x.anio >= rangoEf.desde && x.anio <= rangoEf.hasta);
  const top = rankingMasa.slice(0, 5);
  const bottom = rankingMasa.slice(-5).reverse();

  return (
    <div className="flex flex-col gap-5">
      {err && <ErrorBox msg={err} />}

      {/* Filtros de entidad (comunes a ambas secciones) */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-xl border border-zinc-300/60 dark:border-zinc-700/60 p-1">
          {(['masa', 'ud'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setNivel(n)}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                nivel === n
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {n === 'masa' ? 'Masa' : 'Unidad de demanda'}
            </button>
          ))}
        </div>

        {nivel === 'masa' ? (
          <SearchSelect placeholder="Toda la isla" value={masa} options={masas} onChange={setMasa} />
        ) : (
          <SearchSelect placeholder="Toda la isla" value={ud} options={uds} onChange={setUd} />
        )}
      </div>

      {/* ── Sección A: Situación actual (último año disponible) ─────────── */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Situación actual"
          subtitle={snapshot ? `Año ${snapshot.anio} — último disponible` : '—'}
        />

        {loading && !snapshot ? (
          <Spinner />
        ) : snapshot ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Disponibilidad
                  <InfoTooltip text="Disponibilidad = entradas aprovechables (sin intrusión salina) − descargas permanentes (salida mar + salida ZZHH). Por eso una masa con mucha infiltración puede tener poca disponibilidad." />
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                    {fmt(snapshot.disponibilidad_hm3)}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">hm³</span>
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Explotación
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{
                      color:
                        snapshot.explotacion_porcentaje === null || snapshot.explotacion_porcentaje === undefined
                          ? undefined
                          : snapshot.explotacion_porcentaje > 1
                            ? '#f43f5e'
                            : snapshot.explotacion_porcentaje >= 0.8
                              ? '#f59e0b'
                              : '#22c55e',
                    }}
                  >
                    {fmt(
                      snapshot.explotacion_porcentaje !== null && snapshot.explotacion_porcentaje !== undefined
                        ? snapshot.explotacion_porcentaje * 100
                        : null,
                      1
                    )}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">%</span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                  extracción / disponibilidad
                </span>
              </div>
              <KpiCard label="Diferencia vs RP" value={fmt(snapshot.diferencia_vs_rp_hm3)} unit="hm³" />
              <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Estado DMA
                </span>
                {esMasaDetalle ? (
                  <EstadoChip estado={snapshot.estado_cuantitativo} />
                ) : (
                  <CountChips fila={snapshot} />
                )}
              </div>
            </div>

            <Card title={`Desglose del balance · ${snapshot.anio}`} subtitle="Composición de entradas y salidas (hm³)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GrupoDesglose titulo="Entradas" comps={COMPONENTES_ENTRADAS} fila={snapshot} />
                <GrupoDesglose titulo="Salidas" comps={COMPONENTES_SALIDAS} fila={snapshot} />
              </div>
            </Card>
          </>
        ) : null}
      </section>

      {/* ── Sección B: Evolución temporal ──────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Evolución temporal"
          subtitle="El rango afecta a las gráficas y al ranking"
          right={
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-600">Rango:</span>
              <RangoTemporal min={minAnio} max={maxAnio} value={rangoEf} onChange={setRango} />
            </div>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Disponibilidad vs extracción" subtitle="Anual (hm³)">
            {loading ? (
              <Spinner />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={serieFiltrada}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="anio" tick={tick} />
                  <YAxis tick={tick} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: dark ? '#18181b' : '#fff',
                      border: `1px solid ${grid}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="disponibilidad_hm3" name="Disponibilidad" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="extraccion_hm3" name="Extracción" stroke="#f43f5e" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Índice de explotación" subtitle="Extracción / disponibilidad · umbrales DMA 0.8 y 1.0">
            {loading ? (
              <Spinner />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={serieFiltrada}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="anio" tick={tick} />
                  <YAxis tick={tick} width={34} />
                  <Tooltip
                    contentStyle={{
                      background: dark ? '#18181b' : '#fff',
                      border: `1px solid ${grid}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [fmt(Number(v), 2), 'explotación']}
                  />
                  <ReferenceLine y={0.8} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '0.8', fontSize: 10, fill: '#f59e0b', position: 'insideTopRight' }} />
                  <ReferenceLine y={1.0} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: '1.0', fontSize: 10, fill: '#f43f5e', position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="explotacion_porcentaje" name="Explotación" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {nivel === 'masa' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Masas más explotadas" subtitle={`Año ${rangoEf.hasta}`}>
              <RankingMasaTable rows={top} />
            </Card>
            <Card title="Masas con mejor estado" subtitle={`Año ${rangoEf.hasta}`}>
              <RankingMasaTable rows={bottom} />
            </Card>
          </div>
        ) : (
          <Card title="Unidades de demanda" subtitle={`Año ${rangoEf.hasta} · indicadores agregados de sus masas`}>
            <div className="flex flex-col">
              {rankingUd.map((u) => (
                <div
                  key={u.id_unidad_demanda}
                  className="flex flex-col sm:flex-row sm:items-center gap-1.5 py-2.5 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
                >
                  <div className="flex flex-col flex-1">
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{u.nombre}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{u.isla}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CountChips
                      fila={{
                        anio: rangoEf.hasta,
                        n_buen_estado: u.n_buen_estado,
                        n_en_riesgo: u.n_en_riesgo,
                        n_mal_estado: u.n_mal_estado,
                      } as BalanceFila}
                    />
                  </div>
                  <div className="text-right min-w-[110px]">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
                      expl. {fmt(u.explotacion_porcentaje, 2)}
                    </span>
                    <span className="block text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                      disp. {fmt(u.disponibilidad_hm3)} hm³
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function RankingMasaTable({ rows }: { rows: BalanceRankingMasa[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((m) => (
        <div
          key={m.cod_masa}
          className="flex items-center justify-between py-2 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
        >
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{m.nombre_masa}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{m.cod_masa} · {m.isla}</span>
          </div>
          <div className="flex items-center gap-2">
            <EstadoChip estado={m.estado_cuantitativo} />
            <span className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
              {fmt(m.explotacion_porcentaje, 2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
