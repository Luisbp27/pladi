import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { activeLayers, layerLoading, panelCollapsed, toggleLayer } from '../lib/store';
import { CAPAS } from '../lib/api';

const ICON_PATHS: Record<string, string> = {
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'scan-line': 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2',
  'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'pie-chart': 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
};

function SvgIcon({ name, size = 14, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function LayerItem({ capa }: { capa: typeof CAPAS[number] }) {
  const $activeLayers = useStore(activeLayers);
  const $layerLoading = useStore(layerLoading);
  const isActive = $activeLayers[capa.id];
  const isLoading = $layerLoading[capa.id];

  return (
    <div className="flex items-center gap-2 w-full py-1">
      <div
        className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
        style={{ backgroundColor: `${capa.color}15` }}
      >
        <SvgIcon name={capa.icon} size={12} color={capa.color} />
      </div>
      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex-1">{capa.label}</span>
      {isLoading ? (
        <div
          className="w-3 h-3 border-2 rounded-full animate-spin border-t-transparent"
          style={{ borderColor: `${capa.color}40`, borderTopColor: capa.color }}
        />
      ) : (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium w-6 text-right">{capa.count}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        disabled={isLoading}
        onClick={() => toggleLayer(capa.id)}
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${
          isActive ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            isActive ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function LayerPanel() {
  const $panelCollapsed = useStore(panelCollapsed);
  const $activeLayers = useStore(activeLayers);

  // En móvil el panel arranca colapsado para no tapar el mapa
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      panelCollapsed.set(true);
    }
  }, []);

  const showDmaLegend = $activeLayers['masas'] || $activeLayers['unidades_demanda'];

  return (
    <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-300/40 dark:border-zinc-700/40 rounded-xl shadow-2xl w-60 p-3">
      {!$panelCollapsed ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1">
              <SvgIcon name="layers" size={14} color="#3b82f6" />
              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Capas</span>
            </div>
            <button
              onClick={() => panelCollapsed.set(true)}
              className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
          <hr className="border-zinc-300/40 dark:border-zinc-700/40" />
          {CAPAS.map((capa) => (
            <LayerItem key={capa.id} capa={capa} />
          ))}
          {showDmaLegend && (
            <>
              <hr className="border-zinc-300/40 dark:border-zinc-700/40" />
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                  Estado DMA (último año)
                </span>
                {[
                  { label: 'Buen estado', color: '#22c55e' },
                  { label: 'En riesgo', color: '#f59e0b' },
                  { label: 'Mal estado', color: '#f43f5e' },
                  { label: 'Sin dato', color: '#71717a' },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            <SvgIcon name="layers" size={14} color="#3b82f6" />
            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Capas</span>
          </div>
          <button
            onClick={() => panelCollapsed.set(false)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
