import { useT } from '../lib/i18n';
import LocaleSwitcher from './LocaleSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

function linkClase(activo: boolean): string {
  return `flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
    activo
      ? 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300 ring-1 ring-blue-500/30 dark:ring-blue-400/30'
      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-gray-800/40'
  }`;
}

export default function Navbar({ path }: { path?: string }) {
  const t = useT();
  const raw = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  // Astro.url.pathname en build incluye /index.html (o barra final) → normalizar
  const actual = (raw.endsWith('/index.html') ? raw.slice(0, -'index.html'.length) : raw).replace(/\/+$/, '') || '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-lg border-b border-zinc-200/40 dark:border-zinc-800/40 h-11">
      <div className="flex items-center justify-between w-full h-full px-4">
        <a href="/" className="flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M8 14L24 6L40 14L37 18.5L24 12.5L11 18.5Z" fill="#60a5fa"/><path d="M6 27L24 18L42 27L38.5 31.5L24 24.5L9.5 31.5Z" fill="#3b82f6"/><path d="M4 40L24 30L44 40L40 44L24 37.5L8 44Z" fill="#1d4ed8"/></svg>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">pladi</span>
        </a>

        <div className="flex items-center gap-1">
          <a href="/" className={linkClase(actual === '/')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            <span className="hidden sm:inline">{t('nav.inicio')}</span>
          </a>
          <a href="/dashboards" className={linkClase(actual === '/dashboards')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <span className="hidden sm:inline">{t('nav.dashboards')}</span>
          </a>
          <a href="/simulacion" className={linkClase(actual.startsWith('/simulacion'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>
            <span className="hidden sm:inline">{t('nav.simulacion')}</span>
          </a>
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}
