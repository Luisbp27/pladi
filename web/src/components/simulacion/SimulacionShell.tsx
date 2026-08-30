import { useEffect, useState } from 'react';
import {
  fetchMunicipios,
  fetchSimulacion,
  ISLAS,
  SIMULACION_MOCK,
  type SimulacionEscenario,
  type SimulacionResp,
} from '../../lib/api';
import type { SelectOption } from '../dashboards/ui';
import { ErrorBox, Spinner } from '../dashboards/ui';
import PanelEscenarios from './PanelEscenarios';
import ResultadosSimulacion from './ResultadosSimulacion';

const ESCENARIOS_INICIALES: SimulacionEscenario[] = [
  { id: 'tendencial', nombre: 'Tendencial', iph_pct: 0, ocupacion_pct: 0, lluvia_pct: 0 },
  { id: 'presion', nombre: 'Mayor presión humana', iph_pct: 20, ocupacion_pct: 10, lluvia_pct: 0 },
];

export default function SimulacionShell() {
  const [isla, setIsla] = useState('Baleares');
  const [municipio, setMunicipio] = useState('');
  const [municipios, setMunicipios] = useState<SelectOption[]>([]);
  const [hasta, setHasta] = useState(2030);
  const [escenarios, setEscenarios] = useState<SimulacionEscenario[]>(ESCENARIOS_INICIALES);
  const [visible, setVisible] = useState<Record<string, boolean>>({ tendencial: true, presion: true });
  const [activo, setActivo] = useState('presion');
  const [data, setData] = useState<SimulacionResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isla === 'Baleares') {
      setMunicipio('');
      setMunicipios([]);
      return;
    }
    let alive = true;
    fetchMunicipios(isla)
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
    let alive = true;
    setLoading(true);
    setErr('');
    const t = setTimeout(() => {
      fetchSimulacion({
        isla: isla === 'Baleares' ? undefined : isla,
        municipio: municipio || undefined,
        hasta,
        escenarios,
      })
        .then((r) => {
          if (!alive) return;
          setData(r);
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

  return (
    <div className="h-screen w-screen flex flex-col pt-11 pb-9 bg-zinc-50 dark:bg-[#09090b] overflow-hidden">
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-zinc-50/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/50">
        <h1 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#a855f7' }} />
          Simulación
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
              {i}
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
            escenarios={escenarios}
            onEscenarios={setEscenarios}
            visible={visible}
            onToggleVisible={(id) => setVisible((v) => ({ ...v, [id]: !(v[id] ?? true) }))}
          />
          <div className="flex-1 min-w-0">
            {err && <ErrorBox msg={err} />}
            {!err && loading && <Spinner />}
            {!err && !loading && data && <ResultadosSimulacion data={data} visible={visible} activo={activo} />}
          </div>
        </div>
      </div>
    </div>
  );
}
