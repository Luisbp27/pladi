import { useStore } from '@nanostores/react';
import { LOCALES, locale, setLocale, type Locale } from '../lib/i18n';

export default function LocaleSwitcher() {
  const $locale = useStore(locale);

  return (
    <div
      className="flex items-center rounded-full border border-zinc-300/60 dark:border-zinc-700/60 overflow-hidden"
      role="group"
      aria-label="Idioma"
    >
      {LOCALES.map((l: Locale) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={$locale === l}
          className={`text-[10px] font-semibold px-2 py-1 transition-colors cursor-pointer ${
            $locale === l
              ? 'bg-blue-500/10 text-blue-500'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
