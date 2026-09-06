import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { fetchResumen, fetchMunicipios, type ResumenKpis } from '../../lib/api';
import { meses, useT } from '../../lib/i18n';
import { dashIsla } from '../../lib/store';
import { Card, ErrorBox, KpiCard, SearchSelect, type SelectOption } from './ui';
import KpiMap from './KpiMap';

const nf = new Intl.NumberFormat('es-ES');

function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—';
  return nf.format(Number(v.toFixed(digits)));
}

// Acentos por temática (borde superior de cada KPI card)
const ACENTOS = {
  recursos: '#3b82f6',
  turismo: '#f59e0b',
  poblacion: '#a855f7',
} as const;

export default function DashboardGeneral({ municipioInicial }: { municipioInicial?: string }) {
  const t = useT();
  const isla = useStore(dashIsla);
  const islaParam = isla === 'Baleares' ? undefined : isla;

  const [municipio, setMunicipio] = useState<string>(municipioInicial ?? '');
  const [municipios, setMunicipios] = useState<SelectOption[]>([]);
  const [kpis, setKpis] = useState<ResumenKpis | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (municipioInicial) setMunicipio(municipioInicial);
  }, [municipioInicial]);

  // Al cambiar de isla el filtro de municipio deja de ser válido → se limpia
  const prevIsla = useRef(islaParam);
  useEffect(() => {
    if (prevIsla.current !== islaParam) {
      prevIsla.current = islaParam;
      setMunicipio('');
    }
  }, [islaParam]);

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
    fetchResumen({ isla: islaParam, municipio: municipio || undefined })
      .then((k) => {
        if (!alive) return;
        setKpis(k);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [islaParam, municipio]);

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
              accent={ACENTOS.recursos}
              label={t('dash.general.infiltracion_total')}
              value={kpis ? fmt(kpis.infiltracion_ah_hm3, 1) : '—'}
              unit="hm³"
              delta={kpis?.desviacion_pct ?? null}
              sub={kpis ? t('dash.general.media_hm3', { x: fmt(kpis.infiltracion_ah_media_hm3, 1) }) : undefined}
            />
            <KpiCard
              accent={ACENTOS.recursos}
              label={t('dash.general.masas_deficit')}
              value={kpis?.masas_en_deficit !== null && kpis?.masas_en_deficit !== undefined ? String(kpis.masas_en_deficit) : '—'}
              sub={kpis?.masas_total ? t('dash.general.de_masas', { n: kpis.masas_total }) : undefined}
            />
            <KpiCard
              accent={ACENTOS.recursos}
              label={t('dash.general.consumo_urbano')}
              value={kpis?.consumo_hm3 ? fmt(kpis.consumo_hm3, 1) : '—'}
              unit="hm³"
              sub={t('dash.general.anio_2024')}
            />
            <KpiCard
              accent={ACENTOS.turismo}
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
              accent={ACENTOS.turismo}
              label={t('dash.general.ocupacion')}
              value={kpis?.ocupacion_media_pct ? fmt(kpis.ocupacion_media_pct, 1) : '—'}
              unit="%"
              sub={kpis?.ocupacion_mes_cerrado ? t('dash.general.mes_consolidado', { m: kpis.ocupacion_mes_cerrado }) : undefined}
            />
            <KpiCard
              accent={ACENTOS.poblacion}
              label={t('dash.general.poblacion')}
              value={kpis?.poblacion ? nf.format(kpis.poblacion) : '—'}
              sub={kpis?.poblacion_anio ? t('dash.general.censo', { a: kpis.poblacion_anio }) : undefined}
            />
          </>
        ) : (
          <>
            <KpiCard
              accent={ACENTOS.recursos}
              label={t('dash.general.consumo_urbano')}
              value={kpis?.consumo_hm3 ? fmt(kpis.consumo_hm3, 1) : '—'}
              unit="hm³"
              sub={t('dash.general.anio_2024')}
            />
            <KpiCard
              accent={ACENTOS.recursos}
              label={t('dash.general.infiltracion_masas')}
              value={kpis?.infiltracion_ah_media_hm3 ? fmt(kpis.infiltracion_ah_media_hm3, 2) : '—'}
              unit="hm³"
              sub={t('dash.general.n_masas', { n: kpis?.n_masas ?? 0 })}
            />
            <KpiCard
              accent={ACENTOS.recursos}
              label={t('dash.general.pozos_termino')}
              value={kpis?.n_pozos !== null && kpis?.n_pozos !== undefined ? nf.format(kpis.n_pozos) : '—'}
            />
            <KpiCard
              accent={ACENTOS.turismo}
              label={t('dash.general.ocupacion')}
              value={kpis?.ocupacion_media_pct ? fmt(kpis.ocupacion_media_pct, 1) : '—'}
              unit="%"
              sub={kpis?.ocupacion_mes_cerrado ? t('dash.general.mes_consolidado', { m: kpis.ocupacion_mes_cerrado }) : undefined}
            />
            <KpiCard
              accent={ACENTOS.turismo}
              label={t('dash.general.iph_isla', { isla: kpis?.iph_pico?.nombre_isla ?? '' })}
              value={kpis?.iph_pico ? nf.format(kpis.iph_pico.iph) : '—'}
              sub={t('dash.general.nivel_isla')}
            />
            <KpiCard
              accent={ACENTOS.poblacion}
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
          </>
        )}
      </div>

      <Card title={t('dash.general.mapa_titulo')} subtitle={t('dash.general.mapa_sub')}>
        <KpiMap isla={isla} />
      </Card>
    </div>
  );
}
