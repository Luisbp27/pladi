import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchOcupacion, fetchMunicipios, fetchOcupacionRanking } from '../../lib/api';
import { meses, useT } from '../../lib/i18n';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, RangoTemporal, SearchSelect, Spinner, useIsDark, type Rango, type SelectOption } from './ui';

interface OcupRow {
  anio: number;
  mes: number;
  label: string;
  hotelera: number | null;
  apartamentos: number | null;
}

export default function DashboardOcupacion() {
  const t = useT();
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [tipo, setTipo] = useState<'ambos' | 'hotelera' | 'apartamentos'>('ambos');
  const [municipio, setMunicipio] = useState<string>('');
  const [rango, setRango] = useState<Rango | null>(null);
  const [comparativa, setComparativa] = useState<boolean>(false);
  const [municipios, setMunicipios] = useState<SelectOption[]>([]);
  const [rows, setRows] = useState<OcupRow[]>([]);
  const [ranking, setRanking] = useState<
    { nombre_municipio: string; isla: string; ocupacion_media_pct: number | null; meses_con_datos: number }[]
  >([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    fetchMunicipios(islaParam)
      .then((r) => {
        if (!alive) return;
        setMunicipios(r.municipios.map((m) => ({ cod: m.cod_municipio, nombre: m.nombre_municipio })));
      })
      .catch(() => alive && setMunicipios([]));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  useEffect(() => {
    let alive = true;
    setErr('');
    fetchOcupacion({
      isla: islaParam,
      municipio: municipio || undefined,
      tipo: tipo === 'ambos' ? undefined : tipo,
    })
      .then((r) => {
        if (!alive) return;
        const m = meses();
        const byKey = new Map<string, OcupRow>();
        for (const x of r.serie) {
          const key = `${x.anio}-${x.mes}`;
          const entry = byKey.get(key) ?? {
            anio: x.anio,
            mes: x.mes,
            label: `${m[x.mes - 1]} ${String(x.anio).slice(2)}`,
            hotelera: null,
            apartamentos: null,
          };
          if (x.tipo === 'hotelera') entry.hotelera = x.ocupacion_pct;
          if (x.tipo === 'apartamentos') entry.apartamentos = x.ocupacion_pct;
          byKey.set(key, entry);
        }
        const all = [...byKey.values()].sort((a, b) => (a.anio - b.anio) * 12 + (a.mes - b.mes));
        setRows(all);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [islaParam, tipo, municipio]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  const minAnio = rows.length > 0 ? rows[0].anio : 2008;
  const maxAnio = rows.length > 0 ? rows[rows.length - 1].anio : 2026;
  const rangoEf: Rango = rango ?? { desde: Math.max(minAnio, maxAnio - 4), hasta: maxAnio };
  const rowsFiltrados = rows.filter((r) => r.anio >= rangoEf.desde && r.anio <= rangoEf.hasta);

  // Ranking de municipios del año "hasta" del rango (respetando el toggle de tipo)
  useEffect(() => {
    let alive = true;
    fetchOcupacionRanking({
      isla: islaParam,
      anio: rangoEf.hasta,
      tipo: tipo === 'ambos' ? undefined : tipo,
    })
      .then((r) => alive && setRanking(r.municipios))
      .catch(() => alive && setRanking([]));
    return () => {
      alive = false;
    };
  }, [islaParam, tipo, rangoEf.hasta]);

  const topRanking = ranking.slice(0, 5);
  const bottomRanking = ranking.slice(-5).reverse();

  const valorDe = (r: OcupRow): number | null => {
    if (tipo === 'hotelera') return r.hotelera;
    if (tipo === 'apartamentos') return r.apartamentos;
    const vals = [r.hotelera, r.apartamentos].filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  // Comparativa interanual: eje X = mes, una línea por año (máx. 5 años recientes)
  const aniosComparativa = [...new Set(rowsFiltrados.map((r) => r.anio))]
    .sort((a, b) => a - b)
    .slice(-5);
  const ms = meses();
  const datosComparativa: Array<Record<string, string | number | null>> = ms.map((m, i) => {
    const row: Record<string, string | number | null> = { mes: m };
    for (const anio of aniosComparativa) {
      const r = rowsFiltrados.find((x) => x.anio === anio && x.mes === i + 1);
      row[String(anio)] = r ? valorDe(r) : null;
    }
    return row;
  });
  const colores = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#f43f5e'];

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{t('ui.filtrar_municipio')}</span>
        <SearchSelect
          placeholder={t('ui.todos')}
          value={municipio}
          options={municipios}
          onChange={setMunicipio}
        />
        <span className="text-[11px] text-zinc-400 dark:text-zinc-600 ml-1">{t('ui.rango')}</span>
        <RangoTemporal min={minAnio} max={maxAnio} value={rangoEf} onChange={setRango} />
      </div>

      <Card
        title={
          municipio
            ? t('dash.ocup.titulo_muni', { m: municipios.find((m) => m.cod === municipio)?.nombre ?? municipio })
            : t('dash.ocup.titulo')
        }
        subtitle={
          comparativa
            ? t('dash.ocup.sub_comp', { d: rangoEf.desde, h: rangoEf.hasta })
            : t('dash.ocup.sub', { d: rangoEf.desde, h: rangoEf.hasta })
        }
        right={
          <div className="flex gap-1 flex-wrap">
            {(['ambos', 'hotelera', 'apartamentos'] as const).map((tip) => (
              <button
                key={tip}
                onClick={() => setTipo(tip)}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  tipo === tip
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60'
                }`}
              >
                {tip === 'ambos' ? t('dash.ocup.ambos') : tip === 'hotelera' ? t('dash.ocup.hotelera') : t('dash.ocup.apartamentos')}
              </button>
            ))}
            <button
              onClick={() => setComparativa((v) => !v)}
              className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                comparativa
                  ? 'bg-violet-500/10 text-violet-500 border-violet-500/30'
                  : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60'
              }`}
            >
              {t('dash.ocup.comparativa')}
            </button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Spinner />
        ) : comparativa ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={datosComparativa}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="mes" tick={tick} />
              <YAxis tick={tick} width={34} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: dark ? '#18181b' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {aniosComparativa.map((anio, i) => (
                <Line
                  key={anio}
                  type="monotone"
                  dataKey={String(anio)}
                  name={String(anio)}
                  stroke={colores[i % colores.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rowsFiltrados}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval={3} />
              <YAxis tick={tick} width={34} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: dark ? '#18181b' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(tipo === 'ambos' || tipo === 'hotelera') && (
                <Bar dataKey="hotelera" name={t('dash.ocup.hotelera')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
              )}
              {(tipo === 'ambos' || tipo === 'apartamentos') && (
                <Bar dataKey="apartamentos" name={t('dash.ocup.apartamentos')} fill="#f59e0b" radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {!municipio && ranking.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title={t('dash.ocup.top')} subtitle={t('dash.ocup.ranking_sub', { a: rangoEf.hasta })}>
            <RankingTable rows={topRanking} />
          </Card>
          <Card title={t('dash.ocup.menor')} subtitle={t('dash.ocup.ranking_sub', { a: rangoEf.hasta })}>
            <RankingTable rows={bottomRanking} />
          </Card>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 -mt-2 xl:col-span-2">
            {t('dash.ocup.solo_munis')}
          </p>
        </div>
      )}
    </div>
  );
}

function RankingTable({
  rows,
}: {
  rows: { nombre_municipio: string; isla: string; ocupacion_media_pct: number | null; meses_con_datos: number }[];
}) {
  const t = useT();
  return (
    <div className="flex flex-col">
      {rows.map((m) => (
        <div
          key={m.nombre_municipio}
          className="flex items-center justify-between py-2 border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
        >
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{m.nombre_municipio}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
              {m.isla} · {t('dash.ocup.n_meses', { n: m.meses_con_datos })}
            </span>
          </div>
          <span className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
            {m.ocupacion_media_pct !== null ? `${m.ocupacion_media_pct}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
