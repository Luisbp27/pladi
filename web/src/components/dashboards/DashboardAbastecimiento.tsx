import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchAbastecimiento } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, Spinner, useIsDark } from './ui';

export default function DashboardAbastecimiento() {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [serie, setSerie] = useState<Record<string, number | string>[]>([]);
  const [top, setTop] = useState<{ nombre_municipio: string; consumo_hm3: number }[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    fetchAbastecimiento(islaParam)
      .then((r) => {
        if (!alive) return;
        setSerie(r.serie);
        setTop(r.top_municipios);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [islaParam]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };
  const max = Math.max(...top.map((t) => t.consumo_hm3), 1);

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <Card title="Evolución del abastecimiento (2000-2024)" subtitle="hm³ por origen de agua">
        {serie.length === 0 ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="anio" tick={tick} />
              <YAxis tick={tick} width={36} />
              <Tooltip
                contentStyle={{
                  background: dark ? '#18181b' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="subterranea_hm3" name="Subterránea" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.55} />
              <Area type="monotone" dataKey="desalinizada_hm3" name="Desalinizada" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.55} />
              <Area type="monotone" dataKey="superficial_hm3" name="Superficial" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.55} />
              <Area type="monotone" dataKey="potabilizada_hm3" name="Potabilizada" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.55} />
              <Area type="monotone" dataKey="indiferenciada_hm3" name="Indiferenciada" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.55} />
              <Area type="monotone" dataKey="consumo_hm3" name="Consumo" stackId="2" stroke="#f43f5e" fill="none" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Top municipios consumidores" subtitle="Consumo 2024 (hm³)">
        <div className="flex flex-col">
          {top.map((t) => (
            <div key={t.nombre_municipio} className="flex flex-col gap-1 py-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-700 dark:text-zinc-200">{t.nombre_municipio}</span>
                <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {t.consumo_hm3} hm³
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${(t.consumo_hm3 / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
