import { useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ESTADO_COLORS,
  type EscenarioResultado,
  type SimulacionBalanceResp,
  type SimulacionResp,
} from '../../lib/api';
import { collator, estadoLabel, islaLabel, useT } from '../../lib/i18n';
import { KpiCard, useIsDark } from '../dashboards/ui';

export default function ResultadosSimulacion({
  data,
  balance,
  visible,
  activo,
  setActivo,
}: {
  data: SimulacionResp;
  balance: SimulacionBalanceResp | null;
  visible: Record<string, boolean>;
  activo: string;
  setActivo: (id: string) => void;
}) {
  const t = useT();
  const dark = useIsDark();

  const base_val = data.serie_historica.length
    ? data.serie_historica[data.serie_historica.length - 1].consumo_hm3
    : 0;
  const visibles = data.escenarios.filter((e) => visible[e.id] ?? true);
  const kpisEsc =
    data.escenarios.find((e) => e.id === activo) ??
    data.escenarios.find((e) => visible[e.id] ?? true) ??
    data.escenarios[0];

  const byAnio = new Map<number, Record<string, number>>();
  for (const h of data.serie_historica) byAnio.set(h.anio, { anio: h.anio, historico: h.consumo_hm3 });
  for (const esc of visibles) {
    byAnio.set(data.base_anio, {
      ...(byAnio.get(data.base_anio) ?? { anio: data.base_anio }),
      [esc.id]: base_val,
      [`${esc.id}_lo`]: base_val,
      [`${esc.id}_hi`]: base_val,
    });
    for (const pt of esc.proyeccion) {
      byAnio.set(pt.anio, {
        ...(byAnio.get(pt.anio) ?? { anio: pt.anio }),
        [esc.id]: pt.consumo_hm3,
        [`${esc.id}_lo`]: pt.lo,
        [`${esc.id}_hi`]: pt.hi,
      });
    }
  }
  const chartData = [...byAnio.values()].sort((a, b) => a.anio - b.anio);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'delta', dir: -1 });
  const muns = useMemo(() => {
    const rows = [...(data.municipios[activo] ?? [])];
    const cmp = collator();
    rows.sort((a, b) => {
      let r: number;
      if (sort.key === 'nombre') r = cmp.compare(a.nombre_municipio, b.nombre_municipio);
      else if (sort.key === 'isla') r = cmp.compare(a.isla, b.isla);
      else if (sort.key === 'base') r = a.base_hm3 - b.base_hm3;
      else if (sort.key === 'proy') r = a.proy_hm3 - b.proy_hm3;
      else r = a.delta_pct - b.delta_pct;
      return r * sort.dir;
    });
    return rows;
  }, [data.municipios, activo, sort]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-1.5">
          {t('simul.indicadores')}
        </p>
        <EscenarioPills data={data} activo={activo} setActivo={setActivo} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label={t('simul.consumo_proy', { h: data.hasta })}
          value={kpisEsc.kpis.consumo_final_hm3.toFixed(2)}
          unit="hm³"
          chip={`${kpisEsc.kpis.delta_vs_base_pct > 0 ? '+' : ''}${kpisEsc.kpis.delta_vs_base_pct}%`}
          chipTone={kpisEsc.kpis.delta_vs_base_pct > 0 ? 'rose' : 'emerald'}
          sub={t('simul.esc_sub', { n: kpisEsc.nombre })}
        />
        <KpiCard
          label={t('simul.consumo_base', { a: data.base_anio })}
          value={base_val.toFixed(2)}
          unit="hm³"
          sub={t('simul.ultimo_obs')}
        />
        <KpiCard
          label={t('simul.variacion')}
          value={`${kpisEsc.kpis.variacion_media_anual_pct > 0 ? '+' : ''}${kpisEsc.kpis.variacion_media_anual_pct.toFixed(1)}`}
          unit="%/año"
          sub={t('simul.hasta', { h: data.hasta })}
        />
        <KpiCard
          label={t('simul.sensibilidad')}
          value={`+${(kpisEsc.kpis.sensibilidad.iph * 10).toFixed(1).replace('.', ',')}`}
          unit="%"
          sub={t('simul.sens_sub')}
        />
      </div>

      <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
        <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {t('simul.proyeccion')}
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {t('simul.proy_sub', { ambito: data.ambito === 'Baleares' ? islaLabel('Baleares') : data.ambito })}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="anio" tick={tick} interval={1} />
            <YAxis tick={tick} width={40} unit=" hm³" />
            <Tooltip content={<SimulacionTooltip escenarios={data.escenarios} dark={dark} />} />
            <Line
              type="monotone"
              dataKey="historico"
              name={t('simul.historico')}
              stroke={dark ? '#f4f4f5' : '#52525b'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {visibles.map((esc) => (
              <g key={esc.id}>
                <Area
                  type="monotone"
                  dataKey={esc.id}
                  stroke="none"
                  fill={esc.color}
                  fillOpacity={0.08}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey={esc.id}
                  name={esc.nombre}
                  stroke={esc.color}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </g>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        {visibles.length > 0 && (
          <div className="flex gap-3 flex-wrap mt-2">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-zinc-500 inline-block" /> {t('simul.historico')}
            </span>
            {visibles.map((esc) => (
              <span key={esc.id} className="text-[10px] text-zinc-400 dark:text-zinc-600 flex items-center gap-1.5">
                <span className="w-3 h-0 border-t-2 border-dashed inline-block" style={{ borderColor: esc.color }} />
                {esc.nombre}
              </span>
            ))}
          </div>
        )}
      </div>

      <BalanceSection balance={balance} activo={activo} />

      <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{t('simul.detalle')}</h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {t('simul.detalle_sub', { a: data.base_anio, h: data.hasta })}
            </p>
          </div>
          <EscenarioPills data={data} activo={activo} setActivo={setActivo} />
        </div>
        {muns.length === 0 ? (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 py-4">
            {t('simul.sin_ambito')}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                  <SortableTh
                    col="nombre"
                    label={t('simul.th.municipio')}
                    sort={sort}
                    setSort={setSort}
                  />
                  {data.ambito === 'Baleares' && (
                    <SortableTh col="isla" label={t('simul.th.isla')} sort={sort} setSort={setSort} />
                  )}
                  <SortableTh
                    col="base"
                    label={t('simul.th.base', { a: data.base_anio })}
                    sort={sort}
                    setSort={setSort}
                    align="right"
                  />
                  <SortableTh
                    col="proy"
                    label={t('simul.th.proy', { h: data.hasta })}
                    sort={sort}
                    setSort={setSort}
                    align="right"
                  />
                  <SortableTh col="delta" label="Δ%" sort={sort} setSort={setSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {muns.map((m) => (
                  <tr key={m.cod_municipio} className="border-t border-zinc-200/50 dark:border-zinc-800/50">
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{m.nombre_municipio}</td>
                    {data.ambito === 'Baleares' && (
                      <td className="py-2 pr-3 text-zinc-500 dark:text-zinc-400">{m.isla}</td>
                    )}
                    <td className="py-2 pr-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {m.base_hm3.toFixed(3)} hm³
                    </td>
                    <td className="py-2 pr-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {m.proy_hm3.toFixed(3)} hm³
                    </td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${
                        m.delta_pct >= 0 ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {m.delta_pct > 0 ? '+' : ''}
                      {m.delta_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const SEVERIDAD: Record<string, number> = { buen_estado: 0, en_riesgo: 1, mal_estado: 2 };

function BalanceSection({ balance, activo }: { balance: SimulacionBalanceResp | null; activo: string }) {
  const t = useT();
  const dark = useIsDark();
  if (!balance) return null;

  const esc = balance.escenarios.find((e) => e.id === activo) ?? balance.escenarios[0];
  if (!esc) return null;

  if (balance.n_masas === 0) {
    return (
      <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-1">
          {t('simul.impacto')}
        </h3>
        <div className="rounded-xl border border-dashed border-zinc-300/60 dark:border-zinc-700/60 p-6 text-center">
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 max-w-md mx-auto">
            {balance.nota ?? t('simul.sin_masas')}
          </p>
        </div>
      </div>
    );
  }

  const serie = esc.serie;
  const base = serie[0];
  const fin = serie[serie.length - 1];
  const dMal = base ? fin.n_mal_estado - base.n_mal_estado : 0;
  const empeoran = esc.masas_cambio.filter(
    (m) => (SEVERIDAD[m.estado_proy] ?? 0) > (SEVERIDAD[m.estado_base] ?? 0)
  ).length;
  const mejoran = esc.masas_cambio.length - empeoran;
  const dExt =
    base && base.extraccion_total_hm3 > 0
      ? ((fin.extraccion_total_hm3 - base.extraccion_total_hm3) / base.extraccion_total_hm3) * 100
      : 0;
  const dDisp =
    base && base.disponibilidad_total_hm3 > 0
      ? ((fin.disponibilidad_total_hm3 - base.disponibilidad_total_hm3) / base.disponibilidad_total_hm3) * 100
      : 0;

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-0.5">
          {t('simul.impacto')}
        </h3>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          {t('simul.impacto_sub', {
            ambito: balance.ambito === 'Baleares' ? islaLabel('Baleares') : balance.ambito,
            n: esc.nombre,
          })}
        </p>
        {balance.nota && (
          <p className="text-[10px] text-amber-500 mt-1.5">{balance.nota}</p>
        )}
      </div>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label={t('simul.mal_estado', { h: balance.hasta })}
          value={String(fin.n_mal_estado)}
          chip={dMal > 0 ? `+${dMal}` : dMal < 0 ? `${dMal}` : '0'}
          chipTone={dMal > 0 ? 'rose' : 'emerald'}
          sub={t('simul.mal_estado_sub', { n: base.n_mal_estado, a: balance.base_anio, m: balance.n_masas })}
        />
        <KpiCard
          label={t('simul.cambio')}
          value={String(esc.masas_cambio.length)}
          chip={empeoran > 0 ? t('simul.empeoran', { n: empeoran }) : undefined}
          chipTone="rose"
          sub={esc.masas_cambio.length > 0 ? t('simul.mejoran', { n: mejoran }) : t('simul.sin_cambios')}
        />
        <KpiCard
          label={t('simul.extraccion_total', { h: balance.hasta })}
          value={fin.extraccion_total_hm3.toFixed(1)}
          unit="hm³"
          delta={Math.round(dExt * 10) / 10}
          positiveGood={false}
          sub={t('simul.vs_hm3', { n: base.extraccion_total_hm3.toFixed(1), a: balance.base_anio })}
        />
        <KpiCard
          label={t('simul.disp_total', { h: balance.hasta })}
          value={fin.disponibilidad_total_hm3.toFixed(1)}
          unit="hm³"
          delta={Math.round(dDisp * 10) / 10}
          positiveGood={true}
          sub={t('simul.vs_hm3', { n: base.disponibilidad_total_hm3.toFixed(1), a: balance.base_anio })}
        />
      </div>

      <div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
          {t('simul.estado_anual')}
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={serie} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="anio" tick={tick} />
            <YAxis tick={tick} width={28} />
            <Tooltip
              contentStyle={{
                background: dark ? '#18181b' : '#fff',
                border: `1px solid ${grid}`,
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="n_buen_estado" name={estadoLabel('buen_estado')} stackId="a" fill={ESTADO_COLORS.buen_estado} radius={[0, 0, 0, 0]} />
            <Bar dataKey="n_en_riesgo" name={estadoLabel('en_riesgo')} stackId="a" fill={ESTADO_COLORS.en_riesgo} />
            <Bar dataKey="n_mal_estado" name={estadoLabel('mal_estado')} stackId="a" fill={ESTADO_COLORS.mal_estado} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
          {t('simul.masas_cambio', { h: balance.hasta })}
        </p>
        {esc.masas_cambio.length === 0 ? (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
            {t('simul.ninguna')}
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                  <th className="py-2 pr-3 font-medium">{t('simul.th.masa')}</th>
                  <th className="py-2 pr-3 font-medium">{t('simul.th.estado')}</th>
                  <th className="py-2 pr-3 font-medium text-right">{t('simul.th.explotacion')}</th>
                  <th className="py-2 font-medium text-right">{t('simul.th.extraccion')}</th>
                </tr>
              </thead>
              <tbody>
                {esc.masas_cambio.map((m) => {
                  const empeora = (SEVERIDAD[m.estado_proy] ?? 0) > (SEVERIDAD[m.estado_base] ?? 0);
                  return (
                    <tr key={m.cod_masa} className="border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <td className="py-2 pr-3">
                        <span className="block text-zinc-700 dark:text-zinc-300">{m.nombre_masa}</span>
                        <span className="block text-[10px] text-zinc-400 dark:text-zinc-600">{m.isla}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1 text-[10px]">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: ESTADO_COLORS[m.estado_base] ?? '#71717a' }}
                          />
                          <span className="text-zinc-400 dark:text-zinc-500">
                            {estadoLabel(m.estado_base)}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-600">→</span>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: ESTADO_COLORS[m.estado_proy] ?? '#71717a' }}
                          />
                          <span className={empeora ? 'font-semibold text-rose-500' : 'font-semibold text-emerald-500'}>
                            {estadoLabel(m.estado_proy)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {m.explotacion_base !== null ? `${(m.explotacion_base * 100).toFixed(0)}%` : '—'}
                        {' → '}
                        {m.explotacion_proy !== null ? `${(m.explotacion_proy * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {m.extraccion_base_hm3.toFixed(2)} → {m.extraccion_proy_hm3.toFixed(2)} hm³
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EscenarioPills({
  data,
  activo,
  setActivo,
}: {
  data: SimulacionResp;
  activo: string;
  setActivo: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      {data.escenarios.map((e) => (
        <button
          key={e.id}
          onClick={() => setActivo(e.id)}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
            activo === e.id
              ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
          {e.nombre}
        </button>
      ))}
    </div>
  );
}

type SortKey = 'nombre' | 'isla' | 'base' | 'proy' | 'delta';

function SortableTh({
  col,
  label,
  sort,
  setSort,
  align,
}: {
  col: SortKey;
  label: string;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  align?: 'right';
}) {
  const activa = sort.key === col;
  return (
    <th className={`py-2 pr-3 font-medium ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() =>
          setSort(
            activa
              ? { key: col, dir: sort.dir === 1 ? -1 : 1 }
              : { key: col, dir: col === 'nombre' || col === 'isla' ? 1 : -1 }
          )
        }
        className={`inline-flex items-center gap-1 uppercase tracking-wide cursor-pointer select-none transition-colors ${
          activa
            ? 'text-zinc-700 dark:text-zinc-300'
            : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
        }`}
      >
        {label}
        <span className="text-[8px] leading-none">
          {activa ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function SimulacionTooltip({
  active,
  payload,
  label,
  escenarios,
  dark,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string; payload?: Record<string, number> }[];
  label?: number;
  escenarios: EscenarioResultado[];
  dark: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload as Record<string, number> | undefined;
  // El Area y la Line comparten dataKey → Recharts incluye ambas entradas en el payload
  const vistos = new Set<string>();
  const unicos = payload.filter((p) => {
    if (vistos.has(p.dataKey)) return false;
    vistos.add(p.dataKey);
    return true;
  });
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{
        background: dark ? '#18181b' : '#fff',
        borderColor: dark ? '#3f3f46' : '#e4e4e7',
      }}
    >
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{label}</p>
      {unicos.map((p) => {
        if (p.dataKey === 'historico') {
          return (
            <p key={p.dataKey} className="text-zinc-600 dark:text-zinc-400">
              {p.name}: {Number(p.value).toFixed(2)} hm³
            </p>
          );
        }
        const esc = escenarios.find((e) => e.id === p.dataKey);
        if (!esc || !fila) return null;
        const lo = fila[`${esc.id}_lo`];
        const hi = fila[`${esc.id}_hi`];
        return (
          <p key={p.dataKey} style={{ color: esc.color }}>
            {esc.nombre}: {Number(p.value).toFixed(2)} hm³
            {lo !== undefined && hi !== undefined && (
              <span className="text-zinc-400 dark:text-zinc-500">
                {' '}
                ({lo.toFixed(2)}–{hi.toFixed(2)})
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}
