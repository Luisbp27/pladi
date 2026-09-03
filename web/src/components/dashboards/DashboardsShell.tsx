import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { dashIsla, dashVista } from '../../lib/store';
import { ISLAS } from '../../lib/api';
import { islaLabel, useT } from '../../lib/i18n';
import type { ClaveI18n } from '../../lib/i18n/es';
import DashboardGeneral from './DashboardGeneral';
import DashboardInfiltrada from './DashboardInfiltrada';
import DashboardBalance from './DashboardBalance';
import DashboardAbastecimiento from './DashboardAbastecimiento';
import DashboardPresion from './DashboardPresion';
import DashboardOcupacion from './DashboardOcupacion';

const GRUPOS: { id: string; clave: ClaveI18n; icon: string; items: { id: string; clave: ClaveI18n; icon: string }[] }[] = [
  {
    id: 'rh',
    clave: 'dash.shell.recursos',
    icon: 'M12 2l6 6h-4v6h4l-6 6-6-6h4V8H6l6-6z',
    items: [
      { id: 'infiltrada', clave: 'dash.shell.infiltrada', icon: 'M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17h-8v-2.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z' },
      { id: 'balance', clave: 'dash.shell.balance', icon: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z' },
      { id: 'abastecimiento', clave: 'dash.shell.abastecimiento', icon: 'M4 6h16M5 6v3a7 7 0 0 0 14 0V6M12 13v4m-2.5 0a2.5 2.5 0 0 0 5 0c0-1.8-1.6-2.6-2.5-4-.9 1.4-2.5 2.2-2.5 4z' },
    ],
  },
  {
    id: 'turismo',
    clave: 'dash.shell.turismo',
    icon: 'M16 8a4 4 0 1 0-8 0c0 2 1 3 2 4v2h4v-2c1-1 2-2 2-4zM9 18h6',
    items: [
      { id: 'presion', clave: 'dash.shell.presion', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
      { id: 'ocupacion', clave: 'dash.shell.ocupacion', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01' },
    ],
  },
];

const GENERAL_ITEM = {
  id: 'general',
  clave: 'dash.shell.vision' as ClaveI18n,
  icon: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z',
};

// Acento de color por vista (diferenciación visual dentro de los grupos)
const VISTA_ACCENT: Record<string, string> = {
  general: '#3b82f6',
  infiltrada: '#3b82f6',
  balance: '#06b6d4',
  abastecimiento: '#22c55e',
  presion: '#f59e0b',
  ocupacion: '#f43f5e',
};

export default function DashboardsShell() {
  const t = useT();
  const isla = useStore(dashIsla);
  const vista = useStore(dashVista);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presetTarget, setPresetTarget] = useState<string | null>(null);
  const [presetMasa, setPresetMasa] = useState<string | undefined>(undefined);
  const [presetMunicipio, setPresetMunicipio] = useState<string | undefined>(undefined);
  const [presetNivel, setPresetNivel] = useState<'masa' | 'ud' | undefined>(undefined);
  const [presetUd, setPresetUd] = useState<string | undefined>(undefined);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ rh: true, turismo: true });

  // Presets desde el mapa ("Más detalle"): se leen una sola vez y se limpia la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vistaParam = params.get('vista');
    const masa = params.get('masa');
    const municipio = params.get('municipio');
    const ud = params.get('ud');
    const nivel = params.get('nivel');
    if (!vistaParam && !masa && !municipio && !ud) return;

    if (vistaParam) {
      dashVista.set(vistaParam);
      setPresetTarget(vistaParam);
    }
    if (masa) setPresetMasa(masa);
    if (municipio) setPresetMunicipio(municipio);
    if (ud) setPresetUd(ud);
    if (nivel === 'masa' || nivel === 'ud') setPresetNivel(nivel);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const goVista = (id: string) => {
    dashVista.set(id);
    setSidebarOpen(false);
    // Los presets del "Más detalle" no persisten al navegar manualmente
    setPresetTarget(null);
    setPresetMasa(undefined);
    setPresetMunicipio(undefined);
    setPresetUd(undefined);
    setPresetNivel(undefined);
  };

  return (
    <div className="h-screen w-screen flex pt-11 pb-9 bg-zinc-50 dark:bg-[#09090b] overflow-hidden">
      {/* Backdrop móvil del sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-zinc-900/30 dark:bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-30 h-[calc(100vh-44px-36px)] w-60 shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-300/40 dark:border-zinc-800/50 p-3 transition-transform duration-300`}
      >
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
          {t('dash.shell.titulo')}
        </p>
        <nav className="flex flex-col gap-1">
          <SidebarItem
            item={{ id: GENERAL_ITEM.id, label: t(GENERAL_ITEM.clave), icon: GENERAL_ITEM.icon }}
            active={vista === GENERAL_ITEM.id}
            onClick={() => goVista(GENERAL_ITEM.id)}
          />

          {GRUPOS.map((g) => {
            const open = openGroups[g.id] ?? true;
            const hasActive = g.items.some((i) => i.id === vista);
            return (
              <div key={g.id} className="mt-1.5">
                <button
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [g.id]: !open }))}
                  className={`flex items-center gap-2 px-3 py-1.5 w-full rounded-lg text-left text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                    hasActive ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={g.icon} />
                  </svg>
                  {t(g.clave)}
                  <svg
                    width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`ml-auto transition-transform ${open ? '' : '-rotate-90'}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {open && (
                  <div className="flex flex-col gap-1 mt-1 ml-3 border-l border-zinc-200/60 dark:border-zinc-800/60 pl-2">
                    {g.items.map((item) => (
                      <SidebarItem
                        key={item.id}
                        item={{ id: item.id, label: t(item.clave), icon: item.icon }}
                        active={vista === item.id}
                        onClick={() => goVista(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-zinc-50/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/50">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden text-zinc-500 cursor-pointer"
            aria-label={t('dash.shell.abrir_menu')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>

          <h1 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: VISTA_ACCENT[vista] ?? '#3b82f6' }}
            />
            {vista === GENERAL_ITEM.id
              ? t(GENERAL_ITEM.clave)
              : (() => {
                  const item = GRUPOS.flatMap((g) => g.items).find((i) => i.id === vista);
                  return item ? t(item.clave) : '';
                })()}
          </h1>

          <div className="ml-auto flex gap-1 overflow-x-auto no-scrollbar max-w-[62vw] sm:max-w-none">
            {['Baleares', ...ISLAS].map((i) => (
              <button
                key={i}
                onClick={() => dashIsla.set(i)}
                className={`shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isla === i
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {islaLabel(i)}
              </button>
            ))}
          </div>
        </header>

        <main className="p-5 max-w-[1400px] mx-auto">
          {vista === 'general' && <DashboardGeneral />}
          {vista === 'infiltrada' && (
            <DashboardInfiltrada masaInicial={vista === presetTarget ? presetMasa : undefined} />
          )}
          {vista === 'balance' && (
            <DashboardBalance
              nivelInicial={vista === presetTarget ? presetNivel : undefined}
              masaInicial={vista === presetTarget ? presetMasa : undefined}
              udInicial={vista === presetTarget ? presetUd : undefined}
            />
          )}
          {vista === 'abastecimiento' && (
            <DashboardAbastecimiento municipioInicial={vista === presetTarget ? presetMunicipio : undefined} />
          )}
          {vista === 'presion' && <DashboardPresion />}
          {vista === 'ocupacion' && <DashboardOcupacion />}
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: { id: string; label: string; icon: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-medium transition-colors cursor-pointer ${
        active
          ? 'bg-blue-500/10 text-blue-500'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={item.icon} />
      </svg>
      {item.label}
    </button>
  );
}
