import type { ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { theme } from '../../lib/store';

export const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9', '#f43f5e'];

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
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  positiveGood?: boolean;
  sub?: string;
}) {
  const deltaGood = delta !== null && delta !== undefined && (delta >= 0) === positiveGood;
  const deltaColor =
    delta === null || delta === undefined
      ? 'text-zinc-400 dark:text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
      : deltaGood
        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
        : 'text-rose-500 bg-rose-500/10 border-rose-500/20';

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-zinc-400 dark:text-zinc-500">{unit}</span>}
        {delta !== null && delta !== undefined && (
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
