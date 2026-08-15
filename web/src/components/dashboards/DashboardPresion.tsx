import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchPresion, MESES } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, RangoTemporal, Spinner, useIsDark, type Rango } from './ui';

const nf = new Intl.NumberFormat('es-ES');

export default function DashboardPresion() {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [rango, setRango] = useState<Rango | null>(null);
  const [serie, setSerie] = useState<Array<Record<string, string | number>>>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    fetchPresion(islaParam)
      .then((r) => {
        if (!alive) return;
        const ref = r.referencia;
        if (r.isla === 'Baleares') {
          const byMes = new Map<string, Record<string, string | number>>();
          for (const x of r.serie) {
            const key = `${x.anio}-${x.mes}`;
            const entry = byMes.get(key) ?? {
              label: `${MESES[x.mes - 1]} ${String(x.anio).slice(2)}`,
              anio: x.anio,
            };
            entry[x.nombre_isla ?? ''] = x.iph;
            byMes.set(key, entry);
          }
          setSerie(
            [...byMes.values()].sort((a, b) =>
              String(a.label).localeCompare(String(b.label))
            )
          );
        } else {
          setSerie(
            r.serie.map((x) => ({
              label: `${MESES[x.mes - 1]} ${String(x.anio).slice(2)}`,
              anio: x.anio,
              iph: x.iph,
              media: ref.find((m) => m.mes === x.mes)?.media_iph ?? 0,
            }))
          );
        }
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  const anios = serie.map((s) => Number(s.anio));
  const minAnio = anios.length > 0 ? Math.min(...anios) : 2015;
  const maxAnio = anios.length > 0 ? Math.max(...anios) : 2026;
  const rangoEf: Rango = rango ?? { desde: Math.max(minAnio, maxAnio - 4), hasta: maxAnio };
  const serieFiltrada = serie.filter(
    (s) => Number(s.anio) >= rangoEf.desde && Number(s.anio) <= rangoEf.hasta
  );

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <Card
        title="Índice de Presión Humana"
        subtitle={
          isla === 'Baleares'
            ? 'Series mensuales por isla'
            : 'Línea: media del mes 2015-25'
        }
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">Rango:</span>
          <RangoTemporal min={minAnio} max={maxAnio} value={rangoEf} onChange={setRango} />
        </div>
        {serie.length === 0 ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={serieFiltrada}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval={3} />
              <YAxis tick={tick} width={44} tickFormatter={(v: number) => nf.format(v)} />
              <Tooltip
                contentStyle={{
                  background: dark ? '#18181b' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v) => nf.format(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {isla === 'Baleares' ? (
                <>
                  <Line type="monotone" dataKey="Mallorca" name="Mallorca" stroke="#3b82f6" dot={false} connectNulls />
                  <Line type="monotone" dataKey="Menorca" name="Menorca" stroke="#22c55e" dot={false} connectNulls />
                  <Line type="monotone" dataKey="Eivissa i Formentera" name="Eivissa i Formentera" stroke="#f59e0b" dot={false} connectNulls />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="iph" name="IPH" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="media" name="Media" stroke={dark ? '#f4f4f5' : '#52525b'} strokeWidth={1.5} dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
