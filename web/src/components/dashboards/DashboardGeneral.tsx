import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Bar, BarChart,
} from 'recharts';
import { fetchLluvia, fetchAbastecimiento, fetchResumen, MESES, type ResumenKpis } from '../../lib/api';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, KpiCard, Spinner, useIsDark } from './ui';

const nf = new Intl.NumberFormat('es-ES');

function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—';
  return nf.format(Number(v.toFixed(digits)));
}

export default function DashboardGeneral() {
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [kpis, setKpis] = useState<ResumenKpis | null>(null);
  const [lluvia, setLluvia] = useState<{ label: string; mm: number; media: number }[]>([]);
  const [abast, setAbast] = useState<Record<string, number | string>[]>([]);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setErr('');
    setKpis(null);
    Promise.all([fetchResumen(islaParam), fetchLluvia({ isla: islaParam }), fetchAbastecimiento(islaParam)])
      .then(([k, l, a]) => {
        if (!alive) return;
        setKpis(k);
        const last24 = l.serie.slice(-24).map((r) => ({
          label: `${MESES[r.mes - 1]} ${String(r.anio).slice(2)}`,
          mm: r.precipitacion_mm,
          media: l.referencia.find((ref) => ref.mes === r.mes)?.media_mm ?? 0,
        }));
        setLluvia(last24);
        setAbast(a.serie.slice(-10));
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Lluvia año hidrológico"
          value={kpis ? fmt(kpis.lluvia_ah_mm) : '—'}
          unit="mm"
          delta={kpis?.desviacion_pct ?? null}
          sub={kpis ? `media ${fmt(kpis.lluvia_ah_media_mm)} mm (2016-25)` : undefined}
        />
        <KpiCard
          label="IPH pico del año"
          value={kpis?.iph_pico ? nf.format(kpis.iph_pico.iph) : '—'}
          sub={kpis?.iph_pico ? `${kpis.iph_pico.nombre_isla} · ${MESES[(kpis.iph_pico.mes ?? 1) - 1]} ${kpis.iph_pico.anio}` : undefined}
        />
        <KpiCard
          label="Ocupación turística"
          value={kpis?.ocupacion_media_pct ? fmt(kpis.ocupacion_media_pct, 1) : '—'}
          unit="%"
          sub={kpis ? `mes cerrado ${kpis.mes_cerrado}` : undefined}
        />
        <KpiCard
          label="Población"
          value={kpis?.poblacion ? nf.format(kpis.poblacion) : '—'}
          sub={kpis?.poblacion_anio ? `censo ${kpis.poblacion_anio}` : undefined}
        />
        <KpiCard
          label="Consumo urbano"
          value={kpis?.consumo_hm3 ? fmt(kpis.consumo_hm3, 1) : '—'}
          unit="hm³"
          sub="año 2024"
        />
        <KpiCard
          label="Masas en déficit"
          value={kpis?.masas_en_deficit !== null && kpis?.masas_en_deficit !== undefined ? String(kpis.masas_en_deficit) : '—'}
          unit={kpis?.masas_total ? `/ ${kpis.masas_total}` : undefined}
          delta={kpis?.masas_en_deficit ? -1 : 0}
          positiveGood={false}
          sub="lluvia AH < -15% vs media"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Lluvia mensual — últimos 24 meses" subtitle="Barras: precipitación · línea: media del mes (2015-25)">
          {lluvia.length === 0 ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={lluvia}>
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
                <Bar dataKey="mm" name="Lluvia (mm)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="media"
                  name="Media (mm)"
                  stroke={dark ? '#f4f4f5' : '#52525b'}
                  strokeWidth={1.5}
                  dot={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Consumo urbano por origen" subtitle="Últimos 10 años (hm³)">
          {abast.length === 0 ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={abast}>
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
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="subterranea_hm3" name="Subterránea" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="desalinizada_hm3" name="Desalinizada" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                <Area type="monotone" dataKey="superficial_hm3" name="Superficial" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="potabilizada_hm3" name="Potabilizada" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} />
                <Area type="monotone" dataKey="indiferenciada_hm3" name="Indiferenciada" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
