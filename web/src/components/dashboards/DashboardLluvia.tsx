import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchLluvia, fetchLluviaRanking, MESES, type RankingMasa } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, Spinner, useIsDark } from './ui';

function ahLabel(anio: number, mes: number): string {
  const ah = mes >= 9 ? anio + 1 : anio;
  return `${MESES[mes - 1]} ${String(ah).slice(2)}`;
}

export default function DashboardLluvia({ masaInicial }: { masaInicial?: string }) {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [masa, setMasa] = useState<string>(masaInicial ?? '');
  const [ah, setAh] = useState<boolean>(false);
  const [masas, setMasas] = useState<RankingMasa[]>([]);
  const [serie, setSerie] = useState<Record<string, number | string>[]>([]);
  const [ranking, setRanking] = useState<RankingMasa[]>([]);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (masaInicial) setMasa(masaInicial);
  }, [masaInicial]);

  useEffect(() => {
    fetchLluviaRanking(islaParam)
      .then((r) => setMasas(r.masas))
      .catch(() => setMasas([]));
  }, [islaParam]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    Promise.all([fetchLluvia({ isla: islaParam, masa: masa || undefined }), fetchLluviaRanking(islaParam)])
      .then(([l, r]) => {
        if (!alive) return;
        const ref = l.referencia;
        if (ah) {
          const rows = l.serie
            .filter((x) => {
              const a = x.mes >= 9 ? x.anio + 1 : x.anio;
              return a === new Date().getFullYear() || a === new Date().getFullYear() + 1;
            })
            .slice(-12)
            .map((x) => {
              const ahRef = ref.find((m) => m.mes === x.mes)?.media_mm ?? 0;
              return { label: ahLabel(x.anio, x.mes), mm: x.precipitacion_mm, media: ahRef };
            });
          setSerie(rows);
        } else {
          const rows = l.serie.slice(-24).map((x) => ({
            label: `${MESES[x.mes - 1]} ${String(x.anio).slice(2)}`,
            mm: x.precipitacion_mm,
            media: ref.find((m) => m.mes === x.mes)?.media_mm ?? 0,
          }));
          setSerie(rows);
        }
        setRanking(r.masas);
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
  }, [islaParam, masa, ah]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };
  const top = ranking.slice(0, 5);
  const bottom = ranking.slice(-5).reverse();

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <Card
        title={ah ? 'Lluvia — año hidrológico en curso' : 'Lluvia mensual — últimos 24 meses'}
        subtitle={
          masa
            ? `Masa ${masa} · línea: media del mes 2015-25`
            : `${isla} · línea: media del mes 2015-25`
        }
        right={
          <div className="flex items-center gap-2">
            <select
              value={masa}
              onChange={(e) => setMasa(e.target.value)}
              className="text-[11px] bg-white dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700/60 rounded-lg px-2 py-1.5 text-zinc-700 dark:text-zinc-200 outline-none"
            >
              <option value="">Toda la isla</option>
              {masas.map((m) => (
                <option key={m.cod_masa} value={m.cod_masa}>
                  {m.nombre_masa} ({m.cod_masa})
                </option>
              ))}
            </select>
            <button
              onClick={() => setAh((v) => !v)}
              className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                ah
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                  : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60'
              }`}
            >
              Año hidrológico
            </button>
          </div>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval={2} />
              <YAxis tick={tick} width={34} />
              <Tooltip
                contentStyle={{
                  background: dark ? '#18181b' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="mm" name="Precipitación (mm)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="media" name="Media (mm)" stroke={dark ? '#f4f4f5' : '#52525b'} strokeWidth={1.5} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Masas con más superávit" subtitle="Acumulado AH vs media histórica">
          <RankingTable rows={top} />
        </Card>
        <Card title="Masas con más déficit" subtitle="Acumulado AH vs media histórica">
          <RankingTable rows={bottom} />
        </Card>
      </div>
    </div>
  );
}

function RankingTable({ rows }: { rows: RankingMasa[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((m) => (
        <div
          key={m.cod_masa}
          className="flex items-center justify-between py-2 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
        >
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{m.nombre_masa}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
              {m.cod_masa} · {m.isla}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
              {m.ah_actual_mm} mm
            </span>
            <span
              className={`ml-2 text-[10px] font-semibold tabular-nums ${
                m.desviacion_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {m.desviacion_pct >= 0 ? '+' : ''}
              {m.desviacion_pct}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
