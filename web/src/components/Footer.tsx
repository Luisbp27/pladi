import { useT } from '../lib/i18n';

const FUENTES = [
  { nombre: 'DGRH', url: 'https://www.caib.es/sites/aigua/es/inicio/?campa=yes' },
  { nombre: 'AEMET', url: 'https://www.aemet.es/es/portada' },
  { nombre: 'IDEIB', url: 'https://ideib.caib.es/cataleg/srv/cat/catalog.search;jsessionid=2B828610C6089CE6F5DFB9B1E21F254A#/home' },
  { nombre: 'IBESTAT', url: 'https://ibestat.es/' },
  { nombre: 'Open-Meteo', url: 'https://open-meteo.com/' },
];

export default function Footer() {
  const t = useT();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 dark:bg-zinc-950/90 border-t border-zinc-200/40 dark:border-zinc-800/40 h-9 flex items-center">
      <div className="flex items-center justify-between w-full px-4 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">{t('footer.fuentes')}</span>
          {FUENTES.map((f) => (
            <a
              key={f.nombre}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
            >
              {f.nombre}
            </a>
          ))}
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 shrink-0">{t('footer.copyright')}</span>
      </div>
    </footer>
  );
}
