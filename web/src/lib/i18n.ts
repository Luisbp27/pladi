import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { dict as esDict, meses as mesesEs, type ClaveI18n } from './i18n/es';
import { dict as caDict, meses as mesesCa } from './i18n/ca';

export type Locale = 'ca' | 'es';

export const LOCALES: Locale[] = ['ca', 'es'];
export const DEFAULT_LOCALE: Locale = 'ca';
const STORAGE_KEY = 'pladi-locale';

type Dict = Record<ClaveI18n, string>;

const mods: Record<Locale, { dict: Dict; meses: string[] }> = {
  es: { dict: esDict as Dict, meses: mesesEs },
  ca: { dict: caDict, meses: mesesCa },
};

function detectar(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const win = window as unknown as { __pladiLocale?: string };
    const saved = win.__pladiLocale || localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'ca') return saved;
  } catch {
    // localStorage no disponible
  }
  return DEFAULT_LOCALE;
}

export const locale = atom<Locale>(detectar());

export function t(clave: ClaveI18n, params?: Record<string, string | number>): string {
  const dict = mods[locale.get()].dict;
  let s = dict[clave];
  if (s === undefined) {
    console.warn(`[i18n] clave inexistente: ${clave}`);
    return clave;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function useT(): typeof t {
  useStore(locale);
  return t;
}

export function useLocale(): Locale {
  return useStore(locale);
}

export function meses(): string[] {
  return mods[locale.get()].meses;
}

export function islaLabel(valor: string): string {
  const key = `islas.${valor}` as ClaveI18n;
  const dict = mods[locale.get()].dict;
  return dict[key] ?? valor;
}

export function estadoLabel(estado: string): string {
  const key = `dma.${estado}` as ClaveI18n;
  const dict = mods[locale.get()].dict;
  return dict[key] ?? estado;
}

/** Plural es/ca: singular solo con n === 1. */
export function plural(n: number, uno: string, otros: string): string {
  return n === 1 ? uno : otros;
}

export function collator(): Intl.Collator {
  return new Intl.Collator(locale.get() === 'ca' ? 'ca-ES' : 'es-ES');
}

function tituloPagina(l: Locale): string {
  const dict = mods[l].dict;
  const p = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (p.startsWith('/dashboards')) return dict['page.title_dashboards'];
  if (p.startsWith('/simulacion')) return dict['page.title_simulacion'];
  return dict['page.title_inicio'];
}

export function setLocale(l: Locale): void {
  locale.set(l);
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // sin persistencia disponible
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.title = tituloPagina(l);
  }
}
