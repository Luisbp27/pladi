import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchPresion } from '../../lib/api';
import { meses, useT } from '../../lib/i18n';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, RangoTemporal, Spinner, useIsDark, type Rango } from './ui';

const nf = new Intl.NumberFormat('es-ES');

// Serie NUTS del IPH → nombre de provincia(es) del censo
const NUTS_A_PROVINCIAS: Record<string, string[]> = {
  Mallorca: ['Mallorca'],
  Menorca: ['Menorca'],
  'Eivissa i Formentera': ['Eivissa', 'Formentera'],
};

const LINE_COLORS: Record<string, string> = {
  Mallorca: '#3b82f6',
  Menorca: '#22c55e',
  'Eivissa i Formentera': '#f59e0b',
};

export default function DashboardPresion() {
  const t = useT();
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [rango, setRango] = useState<Rango | null>(null);
  const [serie, setSerie] = useState<Array<Record<string, string | number>>>([]);
  const [ratio, setRatio] = useState<{ iph: number; pob: number; isla: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    fetchPresion(islaParam)
      .then((r) => {
        if (!alive) return;
        const ref = r.referencia;
        const m = meses();

        // Población anual por serie NUTS (suma de provincias censales)
        const porAnio = new Map<number, Record<string, number>>();
        for (const p of r.poblacion) {
          const entry = porAnio.get(p.anio) ?? {};
          for (const [nuts, provs] of Object.entries(NUTS_A_PROVINCIAS)) {
            if (provs.includes(p.nombre_provincia)) {
              entry[nuts] = (entry[nuts] ?? 0) + p.poblacion;
            }
          }
          porAnio.set(p.anio, entry);
        }

        if (r.isla === 'Baleares') {
          const byMes = new Map<string, Record<string, string | number>>();
          for (const x of r.serie) {
            const key = `${x.anio}-${x.mes}`;
            const entry = byMes.get(key) ?? {
              label: `${m[x.mes - 1]} ${String(x.anio).slice(2)}`,
              anio: x.anio,
              mes: x.mes,
            };
            entry[x.nombre_isla ?? ''] = x.iph;
            byMes.set(key, entry);
          }
          const rows = [...byMes.values()].sort((a, b) =>
            String(a.label).localeCompare(String(b.label))
          );
          // Merge población censal (constante dentro del año → escalón)
          for (const row of rows) {
            const p = porAnio.get(Number(row.anio));
            if (p) {
              for (const nuts of Object.keys(NUTS_A_PROVINCIAS)) {
                if (p[nuts] !== undefined) row[`pob_${nuts}`] = Number(p[nuts]);
              }
            }
          }
          setSerie(rows);
        } else {
          const rows: Array<Record<string, string | number>> = r.serie.map((x) => ({
            label: `${m[x.mes - 1]} ${String(x.anio).slice(2)}`,
            anio: x.anio,
            mes: x.mes,
            iph: x.iph,
            media: ref.find((m) => m.mes === x.mes)?.media_iph ?? 0,
          }));
          const nuts = r.isla === 'Eivissa' || r.isla === 'Formentera' ? 'Eivissa i Formentera' : r.isla;
          for (const row of rows) {
            const p = porAnio.get(Number(row.anio));
            if (p && p[nuts] !== undefined) row['pob'] = Number(p[nuts]);
          }
          setSerie(rows);
        }

        // Ratio IPH pico del año más reciente con IPH vs población de ese año (o más cercana)
        const serieIslas = r.isla === 'Baleares' ? r.serie : r.serie.map((x) => ({ ...x, nombre_isla: r.isla }));
        const ultimoAnio = serieIslas.length > 0 ? Math.max(...serieIslas.map((x) => x.anio)) : null;
        if (ultimoAnio) {
          const delAnio = serieIslas.filter((x) => x.anio === ultimoAnio);
          const pico = delAnio.reduce<typeof delAnio[0] | null>(
            (acc, x) => (acc === null || x.iph > acc.iph ? x : acc),
            null
          );
          if (pico && pico.nombre_isla) {
            const pobRows = r.poblacion.filter((p) => p.anio === ultimoAnio);
            const provs = NUTS_A_PROVINCIAS[pico.nombre_isla] ?? [pico.nombre_isla];
            const pob = pobRows.filter((p) => provs.includes(p.nombre_provincia)).reduce((s, p) => s + p.poblacion, 0);
            if (pob > 0) setRatio({ iph: pico.iph, pob, isla: pico.nombre_isla });
          }
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

      {ratio && (
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-1.5 max-w-sm">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {t('dash.presion.ratio')}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums" style={{ color: LINE_COLORS[ratio.isla] ?? '#3b82f6' }}>
              ×{(ratio.iph / ratio.pob).toFixed(1)}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{ratio.isla}</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums">
            {t('dash.presion.ratio_sub', { iph: nf.format(ratio.iph), pob: nf.format(ratio.pob) })}
          </span>
        </div>
      )}

      <Card
        title={t('dash.presion.titulo')}
        subtitle={isla === 'Baleares' ? t('dash.presion.sub_baleares') : t('dash.presion.sub_isla')}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{t('ui.rango')}</span>
          <RangoTemporal min={minAnio} max={maxAnio} value={rangoEf} onChange={setRango} />
        </div>
        {serie.length === 0 ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={serieFiltrada}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval={5} />
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
                  <Line type="monotone" dataKey="Mallorca" name="Mallorca" stroke={LINE_COLORS.Mallorca} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Menorca" name="Menorca" stroke={LINE_COLORS.Menorca} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Eivissa i Formentera" name="Eivissa i Formentera" stroke={LINE_COLORS['Eivissa i Formentera']} dot={false} connectNulls />
                  <Line type="monotone" dataKey="pob_Mallorca" name={t('dash.presion.series.pob', { isla: 'Mallorca' })} stroke={LINE_COLORS.Mallorca} strokeOpacity={0.4} strokeDasharray="5 5" strokeWidth={1} dot={false} connectNulls />
                  <Line type="monotone" dataKey="pob_Menorca" name={t('dash.presion.series.pob', { isla: 'Menorca' })} stroke={LINE_COLORS.Menorca} strokeOpacity={0.4} strokeDasharray="5 5" strokeWidth={1} dot={false} connectNulls />
                  <Line type="monotone" dataKey="pob_Eivissa i Formentera" name={t('dash.presion.series.pob', { isla: 'Eivissa i Formentera' })} stroke={LINE_COLORS['Eivissa i Formentera']} strokeOpacity={0.4} strokeDasharray="5 5" strokeWidth={1} dot={false} connectNulls />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="iph" name={t('dash.presion.series.iph')} stroke={LINE_COLORS[isla] ?? '#f59e0b'} strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="media" name={t('dash.presion.series.media')} stroke={dark ? '#f4f4f5' : '#52525b'} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="pob" name={t('dash.presion.series.pob_censal')} stroke={LINE_COLORS[isla] ?? '#f59e0b'} strokeOpacity={0.4} strokeDasharray="5 5" strokeWidth={1} dot={false} connectNulls />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
