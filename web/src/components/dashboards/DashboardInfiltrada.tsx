import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchInfiltrada, fetchInfiltradaRanking, fetchMasas, MESES, type InfiltradaRanking } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, RangoTemporal, SearchSelect, Spinner, useIsDark, type Rango, type SelectOption } from './ui';

function ahLabel(anio: number, mes: number): string {
  const ah = mes >= 9 ? anio + 1 : anio;
  return `${MESES[mes - 1]} ${String(ah).slice(2)}`;
}

export default function DashboardInfiltrada({ masaInicial }: { masaInicial?: string }) {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [masa, setMasa] = useState<string>(masaInicial ?? '');
  const [ah, setAh] = useState<boolean>(false);
  const [rango, setRango] = useState<Rango | null>(null);
  const [masas, setMasas] = useState<SelectOption[]>([]);
  const [serie, setSerie] = useState<Record<string, number | string>[]>([]);
  const [ranking, setRanking] = useState<InfiltradaRanking[]>([]);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (masaInicial) setMasa(masaInicial);
  }, [masaInicial]);

  useEffect(() => {
    let alive = true;
    fetchMasas(islaParam)
      .then((r) => {
        if (!alive) return;
        setMasas(r.masas.map((m) => ({ cod: m.cod_masa, nombre: m.nombre_masa })));
      })
      .catch(() => alive && setMasas([]));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    Promise.all([
      fetchInfiltrada({ isla: islaParam, masa: masa || undefined }),
      fetchInfiltradaRanking(islaParam),
    ])
      .then(([l, r]) => {
        if (!alive) return;
        const ref = l.referencia;
        if (ah && l.serie.length > 0) {
          const last = l.serie[l.serie.length - 1];
          const ahActual = last.mes >= 9 ? last.anio + 1 : last.anio;
          const rows = l.serie
            .filter((x) => (x.mes >= 9 ? x.anio + 1 : x.anio) === ahActual)
            .map((x) => ({
              label: ahLabel(x.anio, x.mes),
              hm3: x.agua_infiltrada_hm3,
              media: ref.find((m) => m.mes === x.mes)?.media_hm3 ?? 0,
              anio: x.anio,
            }));
          setSerie(rows);
        } else {
          const rows = l.serie.map((x) => ({
            label: `${MESES[x.mes - 1]} ${String(x.anio).slice(2)}`,
            hm3: x.agua_infiltrada_hm3,
            media: ref.find((m) => m.mes === x.mes)?.media_hm3 ?? 0,
            anio: x.anio,
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

  const minAnio = 2015;
  const maxAnio = serie.length > 0 ? Number(serie[serie.length - 1].anio) : 2026;
  const rangoEf: Rango = ah
    ? { desde: maxAnio, hasta: maxAnio }
    : (rango ?? { desde: Math.max(minAnio, maxAnio - 9), hasta: maxAnio });
  const serieFiltrada = ah
    ? serie
    : serie.filter((x) => Number(x.anio) >= rangoEf.desde && Number(x.anio) <= rangoEf.hasta);

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <Card
        title={ah ? 'Agua infiltrada — año hidrológico en curso' : 'Agua infiltrada mensual'}
        subtitle={
          masa
            ? `Masa ${masa} · línea: media del mes 2015-25`
            : `${isla} · línea: media del mes 2015-25`
        }
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <SearchSelect
              placeholder="Toda la isla"
              value={masa}
              options={masas}
              onChange={setMasa}
            />
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
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">Rango:</span>
          <RangoTemporal
            min={minAnio}
            max={maxAnio}
            value={rangoEf}
            onChange={setRango}
            disabled={ah}
          />
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serieFiltrada}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval={2} />
              <YAxis tick={tick} width={40} unit=" hm³" />
              <Tooltip
                contentStyle={{
                  background: dark ? '#18181b' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="hm3" name="Agua infiltrada (hm³)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="media" name="Media (hm³)" stroke={dark ? '#f4f4f5' : '#52525b'} strokeWidth={1.5} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Masas con más infiltración" subtitle="Acumulado AH vs media histórica">
          <RankingTable rows={top} />
        </Card>
        <Card title="Masas con menos infiltración" subtitle="Acumulado AH vs media histórica">
          <RankingTable rows={bottom} />
        </Card>
      </div>
    </div>
  );
}

function RankingTable({ rows }: { rows: InfiltradaRanking[] }) {
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
              {m.ah_actual_hm3} hm³
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
