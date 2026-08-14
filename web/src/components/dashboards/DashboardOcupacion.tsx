import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchOcupacion, MESES } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, Spinner, useIsDark } from './ui';

export default function DashboardOcupacion() {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [tipo, setTipo] = useState<'ambos' | 'hotelera' | 'apartamentos'>('ambos');
  const [serie, setSerie] = useState<Array<Record<string, string | number | null>>>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    fetchOcupacion({ isla: islaParam, tipo: tipo === 'ambos' ? undefined : tipo })
      .then((r) => {
        if (!alive) return;
        const rows: Array<Record<string, string | number | null>> = [];
        const byKey = new Map<string, { hotelera?: number; apartamentos?: number }>();
        for (const x of r.serie) {
          const key = `${x.anio}-${x.mes}`;
          const entry = byKey.get(key) ?? {};
          if (x.tipo === 'hotelera') entry.hotelera = x.ocupacion_pct;
          if (x.tipo === 'apartamentos') entry.apartamentos = x.ocupacion_pct;
          byKey.set(key, entry);
        }
        for (const [key, v] of byKey) {
          const [anio, mes] = key.split('-').map(Number);
          rows.push({
            label: `${MESES[mes - 1]} ${String(anio).slice(2)}`,
            hotelera: v.hotelera ?? null,
            apartamentos: v.apartamentos ?? null,
          });
        }
        rows.sort((a, b) => {
          const la = String(a.label);
          const lb = String(b.label);
          return la.length === lb.length ? la.localeCompare(lb) : la.length - lb.length;
        });
        setSerie(rows.slice(-24));
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [islaParam, tipo]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <Card
        title="Ocupación turística mensual"
        subtitle="% de plazas ocupadas · últimos 24 meses"
        right={
          <div className="flex gap-1">
            {(['ambos', 'hotelera', 'apartamentos'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  tipo === t
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60'
                }`}
              >
                {t === 'ambos' ? 'Ambos' : t === 'hotelera' ? 'Hotelera' : 'Apartamentos'}
              </button>
            ))}
          </div>
        }
      >
        {serie.length === 0 ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval={2} />
              <YAxis tick={tick} width={34} unit="%" />
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
                <Bar dataKey="hotelera" name="Hotelera" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              )}
              {(tipo === 'ambos' || tipo === 'apartamentos') && (
                <Bar dataKey="apartamentos" name="Apartamentos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
