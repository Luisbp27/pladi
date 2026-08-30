import { useEffect, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { EscenarioResultado, SimulacionResp } from '../../lib/api';
import { KpiCard, useIsDark } from '../dashboards/ui';

export default function ResultadosSimulacion({
  data,
  visible,
  activo,
}: {
  data: SimulacionResp;
  visible: Record<string, boolean>;
  activo: string;
}) {
  const dark = useIsDark();
  const [escTabla, setEscTabla] = useState<string>(activo);

  useEffect(() => {
    setEscTabla(activo);
  }, [activo]);

  const base_val = data.serie_historica.length
    ? data.serie_historica[data.serie_historica.length - 1].consumo_hm3
    : 0;
  const visibles = data.escenarios.filter((e) => visible[e.id] ?? true);
  const kpisEsc = data.escenarios.find((e) => e.id === activo) ?? data.escenarios[0];

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

  const muns = data.municipios[escTabla] ?? [];
  const top = muns.slice(0, 5);
  const bottom = muns.slice(-5).reverse();

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label={`Consumo proyectado ${data.hasta}`}
          value={kpisEsc.kpis.consumo_final_hm3.toFixed(2)}
          unit="hm³"
          chip={`${kpisEsc.kpis.delta_vs_base_pct > 0 ? '+' : ''}${kpisEsc.kpis.delta_vs_base_pct}%`}
          chipTone={kpisEsc.kpis.delta_vs_base_pct > 0 ? 'rose' : 'emerald'}
          sub={`escenario: ${kpisEsc.nombre}`}
        />
        <KpiCard
          label={`Consumo ${data.base_anio} (base)`}
          value={base_val.toFixed(2)}
          unit="hm³"
          sub="último año observado"
        />
        <KpiCard
          label="Variación media anual"
          value={`${kpisEsc.kpis.variacion_media_anual_pct > 0 ? '+' : ''}${kpisEsc.kpis.variacion_media_anual_pct.toFixed(1)}`}
          unit="%/año"
          sub={`hasta ${data.hasta}`}
        />
        <KpiCard
          label="Sensibilidad IPH"
          value="+2,0"
          unit="%"
          sub="consumo por cada +10% de IPH (elasticidad 0,2)"
        />
      </div>

      <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
        <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Proyección de consumo
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {data.ambito} · línea sólida = histórico, discontinua = proyección · banda ±MAPE (en tooltip)
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
              name="Histórico"
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
              <span className="w-3 h-0.5 bg-zinc-500 inline-block" /> Histórico
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-1">Mayor incremento</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-3">
            Municipios con mayor Δ% de consumo proyectado
          </p>
          <EscenarioPills data={data} escTabla={escTabla} setEscTabla={setEscTabla} />
          <MunicipioLista rows={top} />
        </div>
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-1">Menor incremento</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-3">
            Municipios con menor Δ% de consumo proyectado
          </p>
          <MunicipioLista rows={bottom} />
        </div>
      </div>

      <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Detalle por municipio</h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Consumo base {data.base_anio} vs proyectado {data.hasta}
            </p>
          </div>
          <EscenarioPills data={data} escTabla={escTabla} setEscTabla={setEscTabla} />
        </div>
        {muns.length === 0 ? (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 py-4">
            Selecciona una isla (sin municipio concreto) para ver el detalle municipal.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                  <th className="py-2 pr-3 font-medium">Municipio</th>
                  <th className="py-2 pr-3 font-medium text-right">Base ({data.base_anio})</th>
                  <th className="py-2 pr-3 font-medium text-right">Proy. ({data.hasta})</th>
                  <th className="py-2 font-medium text-right">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {muns.map((m) => (
                  <tr key={m.cod_municipio} className="border-t border-zinc-200/50 dark:border-zinc-800/50">
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{m.nombre_municipio}</td>
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

function EscenarioPills({
  data,
  escTabla,
  setEscTabla,
}: {
  data: SimulacionResp;
  escTabla: string;
  setEscTabla: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      {data.escenarios.map((e) => (
        <button
          key={e.id}
          onClick={() => setEscTabla(e.id)}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
            escTabla === e.id
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

function MunicipioLista({ rows }: { rows: { cod_municipio: string; nombre_municipio: string; isla: string; base_hm3: number; proy_hm3: number; delta_pct: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Sin datos</p>;
  }
  return (
    <div className="flex flex-col">
      {rows.map((m) => (
        <div
          key={m.cod_municipio}
          className="flex items-center justify-between py-2 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
        >
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {m.nombre_municipio}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{m.isla}</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
              {m.base_hm3.toFixed(2)} → {m.proy_hm3.toFixed(2)} hm³
            </span>
            <span
              className={`ml-2 text-[10px] font-semibold tabular-nums ${
                m.delta_pct >= 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {m.delta_pct > 0 ? '+' : ''}
              {m.delta_pct}%
            </span>
          </div>
        </div>
      ))}
    </div>
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
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{
        background: dark ? '#18181b' : '#fff',
        borderColor: dark ? '#3f3f46' : '#e4e4e7',
      }}
    >
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{label}</p>
      {payload.map((p) => {
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
