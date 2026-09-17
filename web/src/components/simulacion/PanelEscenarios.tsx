import { ESCENARIO_COLORS } from '../../lib/simulacionMock';
import type { SelectOption } from '../dashboards/ui';
import { DropdownSelect, SearchSelect } from '../dashboards/ui';
import { MAX_ESCENARIOS, type SimulacionEscenario } from '../../lib/api';
import { useT } from '../../lib/i18n';
import type { ClaveI18n } from '../../lib/i18n/es';

const RANGO_MAX = 30;

const PRESETS_LLUVIA: { id: string; clave: ClaveI18n; v: number }[] = [
  { id: 'seco', clave: 'simul.preset.seco', v: -30 },
  { id: 'normal', clave: 'simul.preset.normal', v: 0 },
  { id: 'humedo', clave: 'simul.preset.humedo', v: 30 },
];

export default function PanelEscenarios({
  isla,
  municipio,
  municipios,
  onMunicipio,
  hasta,
  onHasta,
  escenarios,
  onUpdate,
  onAdd,
  onRemove,
  visible,
  onToggleVisible,
}: {
  isla: string;
  municipio: string;
  municipios: SelectOption[];
  onMunicipio: (cod: string) => void;
  hasta: number;
  onHasta: (anio: number) => void;
  escenarios: SimulacionEscenario[];
  onUpdate: (id: string, patch: Partial<SimulacionEscenario>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  visible: Record<string, boolean>;
  onToggleVisible: (id: string) => void;
}) {
  const t = useT();
  const puedeAnadir = escenarios.length < MAX_ESCENARIOS;

  return (
    <aside className="w-full lg:w-[340px] lg:shrink-0 flex flex-col gap-4">
      <section className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-0.5">{t('simul.ambito')}</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
            {t('simul.ambito_sub')}
          </p>
          <SearchSelect
            placeholder={isla === 'Baleares' ? t('ui.todo_baleares') : t('ui.toda_isla')}
            value={municipio}
            options={municipios}
            onChange={onMunicipio}
            className="w-full"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">{t('simul.horizonte')}</h3>
          <DropdownSelect
            value={hasta}
            options={Array.from({ length: 10 }, (_, i) => 2026 + i).map((a) => ({
              value: a,
              label: t('simul.proyectar', { a }),
            }))}
            onChange={(v) => onHasta(Number(v))}
            className="w-full"
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-0.5">{t('simul.escenarios')}</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {t('simul.escenarios_sub', { n: MAX_ESCENARIOS })}
          </p>
        </div>

        {escenarios.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300/60 dark:border-zinc-700/60 p-4 text-center">
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              {t('simul.sin_esc_panel')}
            </p>
          </div>
        )}

        {escenarios.map((e, i) => {
          const vis = visible[e.id] ?? true;
          const color = ESCENARIO_COLORS[i % ESCENARIO_COLORS.length];
          return (
            <div
              key={e.id}
              className={`rounded-xl border p-3 transition-opacity ${
                vis
                  ? 'border-zinc-300/40 dark:border-zinc-700/40'
                  : 'border-zinc-200/40 dark:border-zinc-800/60 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="flex-1 min-w-0 text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {e.nombre}
                </span>
                <button
                  onClick={() => onToggleVisible(e.id)}
                  className={`shrink-0 p-1.5 rounded-md border transition-colors cursor-pointer ${
                    vis
                      ? 'text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
                      : 'text-zinc-400 dark:text-zinc-600 border-transparent hover:text-zinc-500'
                  }`}
                  title={vis ? t('simul.ocultar') : t('simul.mostrar')}
                  aria-label={vis ? t('simul.ocultar_aria', { n: e.nombre }) : t('simul.mostrar_aria', { n: e.nombre })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {vis ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => onRemove(e.id)}
                  className="shrink-0 p-1.5 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-rose-500 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                  title={t('simul.borrar', { n: e.nombre })}
                  aria-label={t('simul.borrar', { n: e.nombre })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col gap-3 pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {t('simul.variacion_hint')}
                </p>
                <SliderInput
                  label={t('simul.slider.censo')}
                  hint={t('simul.slider.censo_hint')}
                  value={e.censo_pct}
                  onChange={(v) => onUpdate(e.id, { censo_pct: v })}
                />
                <SliderInput
                  label={t('simul.slider.iph')}
                  hint={t('simul.slider.iph_hint')}
                  value={e.iph_pct}
                  onChange={(v) => onUpdate(e.id, { iph_pct: v })}
                />
                <SliderInput
                  label={t('simul.slider.lluvia')}
                  hint={t('simul.slider.lluvia_hint')}
                  value={e.lluvia_pct}
                  onChange={(v) => onUpdate(e.id, { lluvia_pct: v })}
                  presets={PRESETS_LLUVIA}
                />
              </div>
            </div>
          );
        })}

        <button
          onClick={onAdd}
          disabled={!puedeAnadir}
          className={`w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
            puedeAnadir
              ? 'border-dashed border-blue-500/40 text-blue-500 hover:bg-blue-500/5'
              : 'opacity-40 pointer-events-none border border-zinc-300/60 dark:border-zinc-700/60 text-zinc-400'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {puedeAnadir ? t('simul.anadir') : t('simul.max', { n: MAX_ESCENARIOS })}
        </button>
      </section>
    </aside>
  );
}

function fmt(v: number): string {
  return `${v > 0 ? '+' : ''}${v}%`;
}

function SliderInput({
  label,
  hint,
  value,
  onChange,
  presets,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  presets?: { id: string; clave: ClaveI18n; v: number }[];
}) {
  const t = useT();
  const extrapolado = Math.abs(value) > 25;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            extrapolado ? 'text-amber-500' : 'text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {fmt(value)}
        </span>
      </div>
      {hint && <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mb-1">{hint}</p>}
      <input
        type="range"
        min={-RANGO_MAX}
        max={RANGO_MAX}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500 cursor-pointer"
      />
      {presets && (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onChange(p.v)}
              className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                value === p.v
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                  : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {t(p.clave)}
            </button>
          ))}
        </div>
      )}
      {extrapolado && (
        <p className="text-[10px] text-amber-500 mt-1">
          {t('simul.fuera_rango')}
        </p>
      )}
    </div>
  );
}
