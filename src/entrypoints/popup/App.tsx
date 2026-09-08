import { useEffect, useState } from 'react';
import { obtenerSesion, type Sesion } from '../../auth/sesion.js';
import { PanelSesion } from '../../ui/PanelSesion.js';
import { MockRiskEngineClient, type Escenario } from '../../transport/MockRiskEngineClient.js';
import { VerdictPanel } from '../../ui/VerdictPanel.js';
import type { Evaluacion } from '../../transport/RiskEngineClient.js';

const ESCENARIOS: readonly { readonly id: Escenario; readonly etiqueta: string }[] = [
  { id: 'bajo', etiqueta: 'Riesgo bajo' },
  { id: 'moderado', etiqueta: 'Moderado' },
  { id: 'alto', etiqueta: 'Riesgo alto' },
  { id: 'evidencia-insuficiente', etiqueta: 'Sin evidencia' },
];


/**
 * Maqueta de los cuatro desenlaces alimentada por el motor simulado, para poder
 * validarla con usuarios sin esperar al backend.
 */
export function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [escenario, setEscenario] = useState<Escenario>('bajo');

  useEffect(() => {
    let vigente = true;
    void obtenerSesion().then((s) => {
      if (!vigente) return;
      setSesion(s);
      setCargandoSesion(false);
    });
    return () => {
      vigente = false;
    };
  }, []);
  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null);

  // La maqueta usa el motor simulado a proposito: no consulta al backend ni
  // depende de que haya una publicacion abierta.
  useEffect(() => {
    setEvaluacion(new MockRiskEngineClient().simular(escenario));
  }, [escenario]);

  return (
    <div className="w-[420px] p-3">
      <header className="mb-3 flex items-baseline gap-2">
        <h1 className="text-lg font-extrabold text-blue-700">ScamShield</h1>
        <span className="text-xs text-slate-500">Estima el riesgo antes de pagar</span>
      </header>

      <div className="mb-3">
        <PanelSesion sesion={sesion} cargando={cargandoSesion} onCambio={setSesion} />
      </div>

      {/* Sin sesion no hay reporte, asi que tampoco se muestra su maqueta. */}
      {sesion !== null && (
        <>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        Maqueta de los desenlaces
      </p>
      <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1">
        {ESCENARIOS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setEscenario(e.id);
            }}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
              escenario === e.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {e.etiqueta}
          </button>
        ))}
      </div>

      {evaluacion !== null && (
        <VerdictPanel
          verdict={evaluacion.verdict}
          features={evaluacion.features}
          detalles={evaluacion.detalles}
          plataforma="Mercado Libre"
        />
      )}

      <p className="mt-2 text-center text-[10px] text-slate-400">
        Maqueta con motor simulado. Los datos no provienen de un analisis real.
      </p>
        </>
      )}
    </div>
  );
}

