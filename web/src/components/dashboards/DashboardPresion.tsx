import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchPresion, MESES } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, Spinner, useIsDark } from './ui';

const nf = new Intl.NumberFormat('es-ES');

export default function DashboardPresion() {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

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
          setSerie(
            r.serie.map((x) => ({
              label: `${MESES[x.mes - 1]} ${String(x.anio).slice(2)}`,
              isla: x.nombre_isla ?? '',
              iph: x.iph,
            }))
          );
        } else {
          setSerie(
            r.serie.slice(-24).map((x) => ({
              label: `${MESES[x.mes - 1]} ${String(x.anio).slice(2)}`,
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

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <Card
        title="Índice de Presión Humana"
        subtitle={
          isla === 'Baleares'
            ? 'Series mensuales por isla'
            : 'Últimos 24 meses · línea: media del mes 2015-25'
        }
      >
        {serie.length === 0 ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={serie}>
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
                  <Line type="monotone" dataKey="iph" name="Mallorca" stroke="#3b82f6" dot={false}
                    data={serie.filter((s) => s.isla === 'Mallorca')} />
                  <Line type="monotone" dataKey="iph" name="Menorca" stroke="#22c55e" dot={false}
                    data={serie.filter((s) => s.isla === 'Menorca')} />
                  <Line type="monotone" dataKey="iph" name="Eivissa i Formentera" stroke="#f59e0b" dot={false}
                    data={serie.filter((s) => s.isla === 'Eivissa i Formentera')} />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="iph" name="IPH" stroke="#3b82f6" strokeWidth={2} dot={false} />
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
