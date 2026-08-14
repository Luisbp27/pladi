import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { dashEntidad, dashIsla, dashVista } from '../../lib/store';
import { ISLAS } from '../../lib/api';
import DashboardGeneral from './DashboardGeneral';
import DashboardLluvia from './DashboardLluvia';
import DashboardAbastecimiento from './DashboardAbastecimiento';
import DashboardPresion from './DashboardPresion';
import DashboardOcupacion from './DashboardOcupacion';

const VISTAS = [
  { id: 'general', label: 'Visión general', icon: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z' },
  { id: 'lluvia', label: 'Lluvia', icon: 'M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17h-8v-2.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z' },
  { id: 'abastecimiento', label: 'Abastecimiento', icon: 'M12 2l6 6h-4v6h4l-6 6-6-6h4V8H6l6-6z' },
  { id: 'presion', label: 'Presión humana', icon: 'M16 8a4 4 0 1 0-8 0c0 2 1 3 2 4v2h4v-2c1-1 2-2 2-4zM9 18h6' },
  { id: 'ocupacion', label: 'Ocupación turística', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01' },
];

export default function DashboardsShell() {
  const isla = useStore(dashIsla);
  const vista = useStore(dashVista);
  const entidad = useStore(dashEntidad);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get('tipo');
    const cod = params.get('cod');
    if (tipo && cod) {
      dashEntidad.set({ tipo, cod, nombre: params.get('nombre') ?? cod });
      if (tipo === 'masa') dashVista.set('lluvia');
    }
  }, []);

  return (
    <div className="h-screen w-screen flex pt-11 pb-9 bg-zinc-50 dark:bg-[#09090b] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-30 h-[calc(100vh-44px-36px)] w-60 shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-300/40 dark:border-zinc-800/50 p-3 transition-transform duration-300`}
      >
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
          Dashboards
        </p>
        <nav className="flex flex-col gap-1">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                dashVista.set(v.id);
                setSidebarOpen(false);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-medium transition-colors cursor-pointer ${
                vista === v.id
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={v.icon} />
              </svg>
              {v.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-zinc-50/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/50">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden text-zinc-500 cursor-pointer"
            aria-label="Abrir menú"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>

          <h1 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {VISTAS.find((v) => v.id === vista)?.label}
          </h1>

          {entidad && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-500">
              <span className="font-medium capitalize">{entidad.tipo}:</span>
              <span className="truncate max-w-[140px]">{entidad.nombre}</span>
              <button
                onClick={() => {
                  dashEntidad.set(null);
                  dashIsla.set('Baleares');
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="ml-0.5 text-violet-400 hover:text-violet-300 cursor-pointer"
                aria-label="Quitar filtro"
              >
                ✕
              </button>
            </div>
          )}

          <div className="ml-auto flex gap-1">
            {['Baleares', ...ISLAS].map((i) => (
              <button
                key={i}
                onClick={() => dashIsla.set(i)}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isla === i
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </header>

        <main className="p-5 max-w-[1400px] mx-auto">
          {vista === 'general' && <DashboardGeneral />}
          {vista === 'lluvia' && <DashboardLluvia masaInicial={entidad?.tipo === 'masa' ? entidad.cod : undefined} />}
          {vista === 'abastecimiento' && <DashboardAbastecimiento />}
          {vista === 'presion' && <DashboardPresion />}
          {vista === 'ocupacion' && <DashboardOcupacion />}
        </main>
      </div>
    </div>
  );
}
