import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { obtenerSesion, type Sesion } from '../../auth/sesion.js';
import { PanelSesion } from '../../ui/PanelSesion.js';
import { VerdictPanel } from '../../ui/VerdictPanel.js';
import type { Evaluacion } from '../../transport/RiskEngineClient.js';

interface AnalisisAlmacenado extends Evaluacion {
  readonly plataforma: string;
  readonly publicacionId: string;
  readonly timestamp: number;
}

/**
 * Resultado real del analisis del motor de riesgo, almacenado por el content
 * script cuando el comprador hace clic en el badge.
 */
export function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [analisis, setAnalisis] = useState<AnalisisAlmacenado | null>(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(true);

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

  // Leer el analisis real del storage del browser, usando la URL de la pestana activa.
  useEffect(() => {
    void (async () => {
      const pestanas = await browser.tabs.query({ active: true, currentWindow: true });
      const pestana = pestanas[0];
      if (pestana === undefined || pestana.url === undefined) {
        setCargandoAnalisis(false);
        return;
      }
      const clave = `analisis:${pestana.url}`;
      const datos = await browser.storage.local.get(clave);
      const item = datos[clave] as AnalisisAlmacenado | undefined;
      setAnalisis(item ?? null);
      setCargandoAnalisis(false);
    })();
  }, []);

  return (
    <div className="w-[420px] p-3">
      <header className="mb-3 flex items-baseline gap-2">
        <h1 className="text-lg font-extrabold text-blue-700">ScamShield</h1>
        <span className="text-xs text-slate-500">Estima el riesgo antes de pagar</span>
      </header>

      <div className="mb-3">
        <PanelSesion sesion={sesion} cargando={cargandoSesion} onCambio={setSesion} />
      </div>

      {sesion !== null && (
        <>
          {cargandoAnalisis && (
            <p className="text-center text-xs text-slate-500">Cargando analisis...</p>
          )}

          {!cargandoAnalisis && analisis === null && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-semibold text-slate-700">Sin analisis para esta pagina</p>
              <p className="mt-1 text-xs text-slate-500">
                Abre una publicacion de un marketplace y haz clic en el badge de ScamShield para
                analizarla.
              </p>
            </div>
          )}

          {!cargandoAnalisis && analisis !== null && (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Analisis de {analisis.plataforma}
              </p>
              <VerdictPanel
                verdict={analisis.verdict}
                features={analisis.features}
                detalles={analisis.detalles}
                plataforma={analisis.plataforma}
              />
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Analisis realizado el{' '}
                {new Date(analisis.timestamp).toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
