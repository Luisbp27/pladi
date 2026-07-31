import { useStore } from '@nanostores/react';
import { drawerOpen, selectedLayerLabel, featureProperties } from '../lib/store';

function PropertyRow({ prop }: { prop: { key: string; value: string } }) {
  return (
    <div className="flex items-start justify-between w-full py-2 border-b border-zinc-800/50">
      <span className="text-[11px] text-zinc-500 whitespace-nowrap min-w-[110px]">{prop.key}</span>
      <span className="text-[11px] text-zinc-200 text-right font-medium">{prop.value}</span>
    </div>
  );
}

export default function Drawer() {
  const $drawerOpen = useStore(drawerOpen);
  const $selectedLayerLabel = useStore(selectedLayerLabel);
  const $featureProperties = useStore(featureProperties);

  return (
    <>
      {/* Overlay — translucent dark backdrop when drawer is open */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          $drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => drawerOpen.set(false)}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-11 right-0 z-40 h-[calc(100vh-44px-36px)] w-[360px] bg-[#0f0f13] border-l border-zinc-800/50 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          $drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-3 p-4 h-full">
          {/* Header */}
          <div className="flex flex-col gap-0">
            <div className="flex items-center gap-1 mb-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="text-[11px] font-medium text-zinc-500">Detalle</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <h2 className="text-base font-bold text-zinc-100 truncate pr-2">
                {$selectedLayerLabel || '—'}
              </h2>
              <button
                onClick={() => drawerOpen.set(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer flex-shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <hr className="border-zinc-700/40" />

          {/* Properties list */}
          <div className="overflow-y-auto flex-1">
            {$featureProperties.length === 0 ? (
              <p className="text-[11px] text-zinc-600 mt-4">Sin datos disponibles</p>
            ) : (
              $featureProperties.map((prop, i) => (
                <PropertyRow key={i} prop={prop} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
