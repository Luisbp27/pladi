import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@nanostores/react';
import { theme } from '../../lib/store';
import { useT } from '../../lib/i18n';

export const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9', '#f43f5e'];

export interface ChartLegendSwatch {
  color: string;
  dashed?: boolean;
  shape?: 'line' | 'bar';
}

export interface ChartLegendItem {
  label: string;
  swatches: ChartLegendSwatch[];
}

export function ChartLegend({ items, className = '' }: { items: ChartLegendItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 ${className}`}>
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400"
        >
          <span className="inline-flex items-center gap-1">
            {it.swatches.map((s, i) =>
              s.shape === 'bar' ? (
                <span key={i} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />
              ) : s.dashed ? (
                <span key={i} className="w-3.5 h-0 border-t-2 border-dashed" style={{ borderColor: s.color }} />
              ) : (
                <span key={i} className="w-3.5 h-0.5 rounded-full" style={{ background: s.color }} />
              )
            )}
          </span>
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function useIsDark() {
  return useStore(theme) === 'dark';
}

export function Card({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-5 ${className}`}
    >
      {(title || right) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  positiveGood = true,
  sub,
  chip,
  chipTone = 'zinc',
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  positiveGood?: boolean;
  sub?: string;
  chip?: string;
  chipTone?: 'rose' | 'emerald' | 'zinc';
  accent?: string;
}) {
  const deltaGood = delta !== null && delta !== undefined && (delta >= 0) === positiveGood;
  const deltaColor =
    delta === null || delta === undefined
      ? 'text-zinc-400 dark:text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
      : deltaGood
        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
        : 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  const chipColor =
    chipTone === 'rose'
      ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
      : chipTone === 'emerald'
        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
        : 'text-zinc-400 dark:text-zinc-500 bg-zinc-500/10 border-zinc-500/20';

  return (
    <div
      className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-1.5"
      style={accent ? { borderTop: `2px solid ${accent}` } : undefined}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-zinc-400 dark:text-zinc-500">{unit}</span>}
        {chip !== undefined && chip !== '' && (
          <span
            className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border tabular-nums ${chipColor}`}
          >
            {chip}
          </span>
        )}
        {chip === undefined && delta !== null && delta !== undefined && (
          <span
            className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border tabular-nums ${deltaColor}`}
          >
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{sub}</span>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="py-8 text-center text-xs text-rose-500 bg-rose-500/5 rounded-xl">
      {msg}
    </div>
  );
}

export interface SelectOption {
  cod: string;
  nombre: string;
}

export interface Rango {
  desde: number;
  hasta: number;
}

export function RangoTemporal({
  min,
  max,
  value,
  onChange,
  disabled = false,
}: {
  min: number;
  max: number;
  value: Rango;
  onChange: (r: Rango) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const anios = Array.from({ length: max - min + 1 }, (_, i) => max - i);
  const presets: { id: string; label: string; r: Rango }[] = [
    { id: 'todo', label: t('ui.todo'), r: { desde: min, hasta: max } },
    { id: '5', label: t('ui.ultimos_5'), r: { desde: Math.max(min, max - 4), hasta: max } },
    { id: '10', label: t('ui.ultimos_10'), r: { desde: Math.max(min, max - 9), hasta: max } },
  ];

  const isPreset = (r: Rango) =>
    presets.some((p) => p.r.desde === r.desde && p.r.hasta === r.hasta);

  return (
    <div
      className={`flex items-center gap-1.5 flex-wrap ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.r)}
          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
            isPreset(value) && value.desde === p.r.desde && value.hasta === p.r.hasta
              ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {p.label}
        </button>
      ))}
      <span className="text-[10px] text-zinc-400 dark:text-zinc-600 mx-1">{t('ui.o')}</span>
      <select
        value={value.desde}
        onChange={(e) => {
          const d = Number(e.target.value);
          onChange({ desde: d, hasta: Math.max(d, value.hasta) });
        }}
        className="text-[11px] bg-white dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700/60 rounded-lg px-2 py-1.5 text-zinc-700 dark:text-zinc-200 outline-none"
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-600">→</span>
      <select
        value={value.hasta}
        onChange={(e) => {
          const h = Number(e.target.value);
          onChange({ desde: Math.min(h, value.desde), hasta: h });
        }}
        className="text-[11px] bg-white dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700/60 rounded-lg px-2 py-1.5 text-zinc-700 dark:text-zinc-200 outline-none"
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SearchSelect({
  placeholder,
  value,
  options,
  onChange,
  className = '',
}: {
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (cod: string) => void;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.cod === value);
  const filtered = options.filter((o) =>
    o.nombre.toLowerCase().includes(query.trim().toLowerCase())
  );

  const toggle = () => {
    if (!open) {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
      setQuery('');
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const menuStyle: CSSProperties = (() => {
    if (!rect) return { top: 0, left: 0 };
    const margin = 8;
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const altura = Math.min(options.length * 36 + 56, 320);
    if (rect.top + altura > window.innerHeight) {
      return { bottom: window.innerHeight - rect.top + 4, left, width };
    }
    return { top: rect.top, left, width };
  })();

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer truncate max-w-[220px] ${
            value
              ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="truncate">{selected ? selected.nombre : placeholder}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {value && (
          <button
            onClick={() => onChange('')}
            className="text-[10px] text-zinc-400 hover:text-rose-500 px-1.5 py-1.5 rounded-lg cursor-pointer"
            aria-label={t('ui.limpiar_filtro')}
          >
            ✕
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9990]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[9991] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300/50 dark:border-zinc-700/50 shadow-xl overflow-hidden"
              style={menuStyle}
            >
              <div className="p-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('ui.buscar')}
                  className="w-full text-[12px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200 outline-none placeholder:text-zinc-400"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600 p-3">{t('ui.sin_resultados')}</p>
                )}
                {filtered.map((o) => (
                  <button
                    key={o.cod}
                    onClick={() => {
                      onChange(o.cod);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[12px] transition-colors cursor-pointer ${
                      o.cod === value
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {o.nombre}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export interface DropdownOption {
  value: number | string;
  label: string;
}

export function DropdownSelect({
  value,
  options,
  onChange,
  className = '',
}: {
  value: number | string;
  options: DropdownOption[];
  onChange: (v: number | string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const toggle = () => {
    if (!open) {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const menuStyle: CSSProperties = (() => {
    if (!rect) return { top: 0, left: 0 };
    const margin = 8;
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const altura = Math.min(options.length * 36 + 8, 300);
    if (rect.top + altura > window.innerHeight) {
      return { bottom: window.innerHeight - rect.top + 4, left, width };
    }
    return { top: rect.top, left, width };
  })();

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
          open
            ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
            : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <span className="truncate">{selected ? selected.label : ''}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9990]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[9991] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300/50 dark:border-zinc-700/50 shadow-xl overflow-hidden"
              style={menuStyle}
            >
              <div className="max-h-60 overflow-y-auto">
                {options.map((o) => (
                  <button
                    key={String(o.value)}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[12px] transition-colors cursor-pointer ${
                      o.value === value
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
