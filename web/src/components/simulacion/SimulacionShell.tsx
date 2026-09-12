import { useEffect, useState } from 'react';
import {
  fetchMunicipios,
  fetchSimulacion,
  fetchSimulacionBalance,
  ISLAS,
  MAX_ESCENARIOS,
  RANGO_SLIDER_PCT,
  SIMULACION_MOCK,
  type SimulacionBalanceResp,
  type SimulacionEscenario,
  type SimulacionResp,
} from '../../lib/api';
import type { SelectOption } from '../dashboards/ui';
import { ErrorBox, Spinner } from '../dashboards/ui';
import { islaLabel, useT } from '../../lib/i18n';
import PanelEscenarios from './PanelEscenarios';
import ResultadosSimulacion from './ResultadosSimulacion';

// sessionStorage: los escenarios sobreviven a recargas y a la navegación dentro
// de la web, pero se resetean al cerrar la pestaña/navegador.
const STORAGE_KEY = 'pladi:simulacion:v1';

interface EscenarioGuardado {
  id: string;
  n: number;
  iph_pct: number;
  censo_pct: number;
  lluvia_pct: number;
}

interface Persistido {
  escenarios: EscenarioGuardado[];
  counter: number;
  visible: Record<string, boolean>;
}

function clampPct(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-RANGO_SLIDER_PCT, Math.min(RANGO_SLIDER_PCT, n));
}

function cargar(): Persistido {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { escenarios: [], counter: 1, visible: {} };
    const p = JSON.parse(raw) as Partial<Persistido>;
    const escenarios = Array.isArray(p.escenarios)
      ? p.escenarios
          .filter((e) => e && typeof e.id === 'string')
          .slice(0, MAX_ESCENARIOS)
          .map((e) => ({
            id: e.id,
            n: typeof e.n === 'number' && e.n > 0 ? Math.floor(e.n) : 1,
            iph_pct: clampPct(e.iph_pct),
            censo_pct: clampPct(e.censo_pct),
            lluvia_pct: clampPct(e.lluvia_pct),
          }))
      : [];
    const visible = p.visible && typeof p.visible === 'object' ? (p.visible as Record<string, boolean>) : {};
    const counter = typeof p.counter === 'number' && p.counter > 0 ? Math.floor(p.counter) : 1;
    return { escenarios, counter, visible };
  } catch {
    return { escenarios: [], counter: 1, visible: {} };
  }
}

export default function SimulacionShell() {
  const t = useT();
  const [isla, setIsla] = useState('Baleares');
  const [municipio, setMunicipio] = useState('');
  const [municipios, setMunicipios] = useState<SelectOption[]>([]);
  const [hasta, setHasta] = useState(2030);
  const [est, setEst] = useState<Persistido>(cargar);
  const [activo, setActivo] = useState('');
  const [data, setData] = useState<SimulacionResp | null>(null);
  const [dataBalance, setDataBalance] = useState<SimulacionBalanceResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const { escenarios, counter, visible } = est;

  // Los nombres se generan al render (idioma activo) a partir del número
  const escenariosView: SimulacionEscenario[] = escenarios.map((e) => ({
    ...e,
    nombre: t('simul.escenario_n', { n: e.n }),
  }));

  const escenarioNombre = (n: number) => t('simul.escenario_n', { n });

  // Las respuestas de la API repiten el nombre enviado: se reemplaza por el
  // nombre actual (para que el switch ca/es los retraduzca sin refetch)
  const nombrePorId = new Map(escenariosView.map((e) => [e.id, e.nombre]));
  const dataView: SimulacionResp | null = data
    ? { ...data, escenarios: data.escenarios.map((e) => ({ ...e, nombre: nombrePorId.get(e.id) ?? e.nombre })) }
    : null;
  const dataBalanceView: SimulacionBalanceResp | null = dataBalance
    ? {
        ...dataBalance,
        escenarios: dataBalance.escenarios.map((e) => ({ ...e, nombre: nombrePorId.get(e.id) ?? e.nombre })),
      }
    : null;

  useEffect(() => {
    let alive = true;
    fetchMunicipios(isla === 'Baleares' ? undefined : isla)
      .then((r) => {
        if (!alive) return;
        setMunicipios(r.municipios.map((m) => ({ cod: m.cod_municipio, nombre: m.nombre_municipio })));
      })
      .catch(() => alive && setMunicipios([]));
    return () => {
      alive = false;
    };
  }, [isla]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(est));
    } catch {
      // almacenamiento no disponible: los escenarios viven solo en memoria
    }
  }, [est]);

  useEffect(() => {
    if (activo && escenarios.some((e) => e.id === activo)) return;
    setActivo(escenarios[0]?.id ?? '');
  }, [escenarios, activo]);

  useEffect(() => {
    let alive = true;
    setErr('');
    if (escenarios.length === 0) {
      setData(null);
      setDataBalance(null);
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    const t = setTimeout(() => {
      const params = {
        isla,
        municipio: municipio || undefined,
        hasta,
        escenarios: escenarios.map((e) => ({ ...e, nombre: escenarioNombre(e.n) })),
      };
      Promise.all([fetchSimulacion(params), fetchSimulacionBalance(params)])
        .then(([r, b]) => {
          if (!alive) return;
          setData(r);
          setDataBalance(b);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          setErr(String(e));
          setLoading(false);
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [isla, municipio, hasta, escenarios]);

  const cambiarIsla = (i: string) => {
    setIsla(i);
    setMunicipio('');
  };

  const addEscenario = () => {
    if (escenarios.length >= MAX_ESCENARIOS) return;
    const id = crypto.randomUUID();
    setEst((s) => ({
      escenarios: [...s.escenarios, { id, n: counter, iph_pct: 0, censo_pct: 0, lluvia_pct: 0 }],
      counter: s.counter + 1,
      visible: { ...s.visible, [id]: true },
    }));
    setActivo(id);
  };

  const removeEscenario = (id: string) => {
    setEst((s) => {
      const next = { ...s.visible };
      delete next[id];
      return { ...s, escenarios: s.escenarios.filter((e) => e.id !== id), visible: next };
    });
  };

  const updateEscenario = (id: string, patch: Partial<SimulacionEscenario>) => {
    setEst((s) => ({
      ...s,
      escenarios: s.escenarios.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  };

  const toggleVisible = (id: string) =>
    setEst((s) => ({ ...s, visible: { ...s.visible, [id]: !(s.visible[id] ?? true) } }));

  return (
    <div className="h-dvh w-full flex flex-col pt-11 pb-9 bg-zinc-50 dark:bg-[#09090b] overflow-hidden">
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-zinc-50/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/50">
        <h1 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#a855f7' }} />
          {t('simul.titulo')}
        </h1>
        {SIMULACION_MOCK && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Mock
          </span>
        )}
        <div className="ml-auto flex gap-1 overflow-x-auto no-scrollbar max-w-[62vw] sm:max-w-none">
          {['Baleares', ...ISLAS].map((i) => (
            <button
              key={i}
              onClick={() => cambiarIsla(i)}
              className={`shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                isla === i
                  ? 'bg-violet-500/10 text-violet-500 border-violet-500/30'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300/60 dark:border-zinc-700/60 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {islaLabel(i)}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-5 max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-4 lg:items-start">
          <PanelEscenarios
            isla={isla}
            municipio={municipio}
            municipios={municipios}
            onMunicipio={setMunicipio}
            hasta={hasta}
            onHasta={setHasta}
            escenarios={escenariosView}
            onUpdate={updateEscenario}
            onAdd={addEscenario}
            onRemove={removeEscenario}
            visible={visible}
            onToggleVisible={toggleVisible}
          />
          <div className="flex-1 min-w-0">
            {escenarios.length === 0 && !err ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300/60 dark:border-zinc-700/60 p-12 text-center min-h-[300px]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{t('simul.sin_esc')}</p>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500 max-w-xs">
                  {t('simul.sin_esc_sub')}
                </p>
              </div>
            ) : (
              <>
                {err && <ErrorBox msg={err} />}
                {!err && loading && <Spinner />}
                {!err && !loading && dataView && (
                  <ResultadosSimulacion
                    data={dataView}
                    balance={dataBalanceView}
                    visible={visible}
                    activo={activo}
                    setActivo={setActivo}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
