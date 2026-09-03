import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Bar, BarChart,
} from 'recharts';
import { fetchInfiltrada, fetchAbastecimiento, fetchResumen, fetchMunicipios, type ResumenKpis } from '../../lib/api';
import { meses, useT } from '../../lib/i18n';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, KpiCard, SearchSelect, Spinner, useIsDark, type SelectOption } from './ui';

const nf = new Intl.NumberFormat('es-ES');

function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—';
  return nf.format(Number(v.toFixed(digits)));
}

export default function DashboardGeneral({ municipioInicial }: { municipioInicial?: string }) {
  const t = useT();
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;
  const dark = useIsDark();

  const [municipio, setMunicipio] = useState<string>(municipioInicial ?? '');
  const [municipios, setMunicipios] = useState<SelectOption[]>([]);
  const [kpis, setKpis] = useState<ResumenKpis | null>(null);
  const [infiltrada, setInfiltrada] = useState<{ label: string; hm3: number; media: number }[]>([]);
  const [abast, setAbast] = useState<Record<string, number | string>[]>([]);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (municipioInicial) setMunicipio(municipioInicial);
  }, [municipioInicial]);

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
    setKpis(null);
    Promise.all([
      fetchResumen({ isla: islaParam, municipio: municipio || undefined }),
      fetchInfiltrada({ isla: islaParam }),
      fetchAbastecimiento({ isla: islaParam }),
    ])
      .then(([k, l, a]) => {
        if (!alive) return;
        setKpis(k);
        const m = meses();
        const last24 = l.serie.slice(-24).map((r) => ({
          label: `${m[r.mes - 1]} ${String(r.anio).slice(2)}`,
          hm3: r.agua_infiltrada_hm3,
          media: l.referencia.find((ref) => ref.mes === r.mes)?.media_hm3 ?? 0,
        }));
        setInfiltrada(last24);
        setAbast(a.serie.slice(-10));
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [islaParam, municipio]);

  const grid = dark ? '#3f3f46' : '#e4e4e7';
  const tick = { fill: dark ? '#71717a' : '#a1a1aa', fontSize: 10 };
  const esMunicipio = kpis?.modo === 'municipio';

  return (
    <div className="flex flex-col gap-4">
      {err && <ErrorBox msg={err} />}

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{t('ui.filtrar_municipio')}</span>
        <SearchSelect
          placeholder={t('ui.todos')}
          value={municipio}
          options={municipios}
          onChange={setMunicipio}
        />
      </div>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {!esMunicipio ? (
          <>
            <KpiCard
              label={t('dash.general.infiltracion_total')}
              value={kpis ? fmt(kpis.infiltracion_ah_hm3, 1) : '—'}
              unit="hm³"
              delta={kpis?.desviacion_pct ?? null}
              sub={kpis ? t('dash.general.media_hm3', { x: fmt(kpis.infiltracion_ah_media_hm3, 1) }) : undefined}
            />
            <KpiCard
              label={t('dash.general.iph_pico')}
              value={kpis?.iph_pico ? nf.format(kpis.iph_pico.iph) : '—'}
              sub={
                kpis?.iph_pico
                  ? kpis.iph_pico.mes !== null
                    ? `${kpis.iph_pico.nombre_isla} · ${meses()[(kpis.iph_pico.mes ?? 1) - 1]} ${kpis.iph_pico.anio}`
                    : `${kpis.iph_pico.nombre_isla} · ${kpis.iph_pico.anio}`
                  : undefined
              }
            />
            <KpiCard
              label={t('dash.general.ocupacion')}
              value={kpis?.ocupacion_media_pct ? fmt(kpis.ocupacion_media_pct, 1) : '—'}
              unit="%"
              sub={kpis?.ocupacion_mes_cerrado ? t('dash.general.mes_consolidado', { m: kpis.ocupacion_mes_cerrado }) : undefined}
            />
            <KpiCard
              label={t('dash.general.poblacion')}
              value={kpis?.poblacion ? nf.format(kpis.poblacion) : '—'}
              sub={kpis?.poblacion_anio ? t('dash.general.censo', { a: kpis.poblacion_anio }) : undefined}
            />
            <KpiCard
              label={t('dash.general.consumo_urbano')}
              value={kpis?.consumo_hm3 ? fmt(kpis.consumo_hm3, 1) : '—'}
              unit="hm³"
              sub={t('dash.general.anio_2024')}
            />
            <KpiCard
              label={t('dash.general.masas_deficit')}
              value={kpis?.masas_en_deficit !== null && kpis?.masas_en_deficit !== undefined ? String(kpis.masas_en_deficit) : '—'}
              sub={kpis?.masas_total ? t('dash.general.de_masas', { n: kpis.masas_total }) : undefined}
            />
          </>
        ) : (
          <>
            <KpiCard
              label={t('dash.general.poblacion_anio', { a: kpis?.poblacion_anio ?? '' })}
              value={kpis?.poblacion ? nf.format(kpis.poblacion) : '—'}
              chip={
                kpis?.poblacion_var_pct !== null && kpis?.poblacion_var_pct !== undefined
                  ? `${kpis.poblacion_var_pct >= 0 ? '+' : ''}${kpis.poblacion_var_pct}%`
                  : undefined
              }
              chipTone="zinc"
              sub={kpis?.municipio}
            />
            <KpiCard
              label={t('dash.general.consumo_urbano')}
              value={kpis?.consumo_hm3 ? fmt(kpis.consumo_hm3, 1) : '—'}
              unit="hm³"
              sub={t('dash.general.anio_2024')}
            />
            <KpiCard
              label={t('dash.general.ocupacion')}
              value={kpis?.ocupacion_media_pct ? fmt(kpis.ocupacion_media_pct, 1) : '—'}
              unit="%"
              sub={kpis?.ocupacion_mes_cerrado ? t('dash.general.mes_consolidado', { m: kpis.ocupacion_mes_cerrado }) : undefined}
            />
            <KpiCard
              label={t('dash.general.infiltracion_masas')}
              value={kpis?.infiltracion_ah_media_hm3 ? fmt(kpis.infiltracion_ah_media_hm3, 2) : '—'}
              unit="hm³"
              sub={t('dash.general.n_masas', { n: kpis?.n_masas ?? 0 })}
            />
            <KpiCard
              label={t('dash.general.pozos_termino')}
              value={kpis?.n_pozos !== null && kpis?.n_pozos !== undefined ? nf.format(kpis.n_pozos) : '—'}
            />
            <KpiCard
              label={t('dash.general.iph_isla', { isla: kpis?.iph_pico?.nombre_isla ?? '' })}
              value={kpis?.iph_pico ? nf.format(kpis.iph_pico.iph) : '—'}
              sub={t('dash.general.nivel_isla')}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={t('dash.general.agua_inf_24')} subtitle={t('dash.general.agua_inf_sub')}>
          {infiltrada.length === 0 ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={infiltrada}>
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
                <Bar dataKey="hm3" name={t('dash.general.series.agua')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="media"
                  name={t('dash.general.series.media')}
                  stroke={dark ? '#f4f4f5' : '#52525b'}
                  strokeWidth={1.5}
                  dot={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title={t('dash.general.consumo_origen')} subtitle={t('dash.general.ultimos_10')}>
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
                <Area type="monotone" dataKey="subterranea_hm3" name={t('dash.general.series.subterranea')} stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="desalinizada_hm3" name={t('dash.general.series.desalinizada')} stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                <Area type="monotone" dataKey="superficial_hm3" name={t('dash.general.series.superficial')} stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="potabilizada_hm3" name={t('dash.general.series.potabilizada')} stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} />
                <Area type="monotone" dataKey="indiferenciada_hm3" name={t('dash.general.series.indiferenciada')} stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
