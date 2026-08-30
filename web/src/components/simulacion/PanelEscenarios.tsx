import { ESCENARIO_COLORS } from '../../lib/simulacionMock';
import type { SelectOption } from '../dashboards/ui';
import { SearchSelect } from '../dashboards/ui';
import type { SimulacionEscenario } from '../../lib/api';

const RANGO_MAX = 30;

const PRESETS_LLUVIA = [
  { id: 'seco', label: 'Año seco', v: -30 },
  { id: 'normal', label: 'Normal', v: 0 },
  { id: 'humedo', label: 'Año húmedo', v: 30 },
];

export default function PanelEscenarios({
  isla,
  municipio,
  municipios,
  onMunicipio,
  hasta,
  onHasta,
  escenarios,
  onEscenarios,
  visible,
  onToggleVisible,
  activo,
  onActivo,
}: {
  isla: string;
  municipio: string;
  municipios: SelectOption[];
  onMunicipio: (cod: string) => void;
  hasta: number;
  onHasta: (anio: number) => void;
  escenarios: SimulacionEscenario[];
  onEscenarios: (e: SimulacionEscenario[]) => void;
  visible: Record<string, boolean>;
  onToggleVisible: (id: string) => void;
  activo: string;
  onActivo: (id: string) => void;
}) {
  const base = escenarios.find((e) => e.id === 'base');
  const editables = escenarios.filter((e) => e.id !== 'base');
  const activoEsc = escenarios.find((e) => e.id === activo) ?? editables[0];

  const updateActivo = (patch: Partial<SimulacionEscenario>) =>
    onEscenarios(escenarios.map((e) => (e.id === activoEsc.id ? { ...e, ...patch } : e)));

  return (
    <aside className="w-full lg:w-[340px] lg:shrink-0 flex flex-col gap-4">
      <section className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-0.5">Ámbito</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
            Sin municipio se simula el conjunto de la isla
          </p>
          {isla === 'Baleares' ? (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 bg-zinc-500/10 border border-zinc-500/20 rounded-lg px-2.5 py-1.5">
              Selecciona una isla para poder filtrar por municipio
            </p>
          ) : (
            <SearchSelect
              placeholder="Toda la isla"
              value={municipio}
              options={municipios}
              onChange={onMunicipio}
              className="w-full"
            />
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Horizonte</h3>
          <select
            value={hasta}
            onChange={(e) => onHasta(Number(e.target.value))}
            className="w-full text-[12px] bg-white dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700/60 rounded-lg px-2.5 py-2 text-zinc-700 dark:text-zinc-200 outline-none"
          >
            {Array.from({ length: 10 }, (_, i) => 2026 + i).map((a) => (
              <option key={a} value={a}>
                Proyectar hasta {a}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-0.5">Inputs del modelo</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Variación % sobre el último año observado
          </p>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {escenarios.map((e, i) => (
            <button
              key={e.id}
              onClick={() => onActivo(e.id)}
              disabled={e.id === 'base'}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                e.id === 'base'
                  ? 'opacity-50 border-zinc-300/60 dark:border-zinc-700/60 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                  : activo === e.id
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30 cursor-pointer'
                    : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer'
              }`}
              title={e.id === 'base' ? 'El escenario Base no se edita' : undefined}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: ESCENARIO_COLORS[i % ESCENARIO_COLORS.length] }}
              />
              {e.nombre}
            </button>
          ))}
        </div>

        {activoEsc && activoEsc.id !== 'base' && (
          <>
            <SliderInput
              label="Presión humana (IPH)"
              hint="Eivissa y Formentera comparten serie (NUTS)"
              value={activoEsc.iph_pct}
              onChange={(v) => updateActivo({ iph_pct: v })}
            />
            <SliderInput
              label="Ocupación turística"
              hint="En municipios sin datos turísticos no tiene efecto (vale 0 en el modelo)"
              value={activoEsc.ocupacion_pct}
              onChange={(v) => updateActivo({ ocupacion_pct: v })}
            />
            <SliderInput
              label="Lluvia"
              value={activoEsc.lluvia_pct}
              onChange={(v) => updateActivo({ lluvia_pct: v })}
              presets={PRESETS_LLUVIA}
            />
            <input
              value={activoEsc.nombre}
              onChange={(e) => updateActivo({ nombre: e.target.value })}
              placeholder="Nombre del escenario"
              className="w-full text-[12px] bg-white dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700/60 rounded-lg px-2.5 py-2 text-zinc-700 dark:text-zinc-200 outline-none placeholder:text-zinc-400"
            />
          </>
        )}
      </section>

      <section className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Escenarios</h3>
        <div className="flex flex-col gap-1">
          {escenarios.map((e, i) => {
            const vis = visible[e.id] ?? true;
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: ESCENARIO_COLORS[i % ESCENARIO_COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                    {e.nombre}
                  </span>
                  <span className="block text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                    {e.id === 'base' ? 'Sin cambios' : `IPH ${fmt(e.iph_pct)} · Ocup ${fmt(e.ocupacion_pct)} · Lluvia ${fmt(e.lluvia_pct)}`}
                  </span>
                </div>
                <button
                  onClick={() => onToggleVisible(e.id)}
                  className={`text-[10px] px-1.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    vis
                      ? 'text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60'
                      : 'text-zinc-400 dark:text-zinc-600 border-transparent line-through'
                  }`}
                  title={vis ? 'Ocultar del gráfico' : 'Mostrar en el gráfico'}
                >
                  {vis ? '👁' : '—'}
                </button>
              </div>
            );
          })}
        </div>
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
  presets?: { id: string; label: string; v: number }[];
}) {
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
              {p.label}
            </button>
          ))}
        </div>
      )}
      {extrapolado && (
        <p className="text-[10px] text-amber-500 mt-1">
          ⚠ Fuera del rango observado en el entrenamiento — la extrapolación es menos fiable
        </p>
      )}
    </div>
  );
}
