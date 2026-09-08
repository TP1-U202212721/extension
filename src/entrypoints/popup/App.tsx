import { useEffect, useState } from 'react';
import { obtenerSesion, type Sesion } from '../../auth/sesion.js';
import { PanelSesion } from '../../ui/PanelSesion.js';
import { googleDisponible, uriDeRedireccion } from '../../auth/google.js';
import { conocido, indeterminado, FEATURE_IDS, type FeatureSet } from '../../domain/features.js';
import { MockRiskEngineClient, type Escenario } from '../../transport/MockRiskEngineClient.js';
import { VerdictPanel } from '../../ui/VerdictPanel.js';
import type { Verdict } from '../../domain/verdict.js';

const ESCENARIOS: readonly { readonly id: Escenario; readonly etiqueta: string }[] = [
  { id: 'bajo', etiqueta: 'Riesgo bajo' },
  { id: 'moderado', etiqueta: 'Moderado' },
  { id: 'alto', etiqueta: 'Riesgo alto' },
  { id: 'evidencia-insuficiente', etiqueta: 'Sin evidencia' },
];

const conCliente = (): FeatureSet =>
  ({
    ...Object.fromEntries(FEATURE_IDS.map((id) => [id, indeterminado('sin evidencia')])),
    proteccionDePago: conocido('declarada', 'La publicacion enlaza a la compra protegida.'),
    puntuacionDelProducto: conocido(4.8, 'Puntuacion promedio de 4.8 sobre 5 segun la pagina.'),
    presenciaDeResenas: conocido(true, 'La publicacion declara 1250 opiniones.'),
    politicasDeGarantia: conocido(2, 'La publicacion declara garantia de fabrica: 12 meses.'),
    volumenDeVentas: conocido(500, 'La publicacion declara aproximadamente 500 ventas.'),
    veracidadDeDominio: conocido(5, 'El dominio corresponde a la plataforma declarada.'),
    reputacionDelVendedor: conocido(2, 'Reputacion derivada del historial del vendedor.'),
    autenticidadDeResenas: conocido(0.18, 'El 18% de las resenas presenta indicios de ser falsa.'),
  }) as unknown as FeatureSet;

const sinEvidencia = (): FeatureSet =>
  Object.fromEntries(
    FEATURE_IDS.map((id) => [id, indeterminado('No se pudo leer de la pagina.')]),
  ) as unknown as FeatureSet;

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
  const [evaluacion, setEvaluacion] = useState<{
    verdict: Verdict;
    features: FeatureSet;
  } | null>(null);

  const features = escenario === 'evidencia-insuficiente' ? sinEvidencia() : conCliente();

  useEffect(() => {
    let vigente = true;
    void new MockRiskEngineClient(escenario)
      .evaluar({ plataforma: 'Mercado Libre', publicacionId: 'MPEU3173976853', features })
      .then((r) => {
        if (vigente) setEvaluacion(r);
      });
    return () => {
      vigente = false;
    };
  }, [escenario]);

  return (
    <div className="w-[420px] p-3">
      <header className="mb-3 flex items-baseline gap-2">
        <h1 className="text-lg font-extrabold text-blue-700">ScamShield</h1>
        <span className="text-xs text-slate-500">Estima el riesgo antes de pagar</span>
      </header>

      {!cargandoSesion && (
        <div className="mb-3">
          <PanelSesion sesion={sesion} onCambio={setSesion} />
        </div>
      )}

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
          plataforma="Mercado Libre"
        />
      )}

      <p className="mt-2 text-center text-[10px] text-slate-400">
        Maqueta con motor simulado. Los datos no provienen de un analisis real.
      </p>
        </>
      )}

      <UriDeRedireccion />
    </div>
  );
}

/**
 * La URI de redireccion de OAuth cambia por navegador y por instalacion: en
 * Chrome se deriva de la ruta desde la que se cargo la extension, y en Firefox
 * de un UUID aleatorio por perfil. Calcularla de antemano es adivinar, asi que
 * la extension muestra la suya para poder darla de alta en Google Cloud Console.
 */
function UriDeRedireccion() {
  const [copiado, setCopiado] = useState(false);
  if (!googleDisponible()) return null;

  const uri = uriDeRedireccion();
  if (uri === '') return null;

  return (
    <details className="mt-3 border-t border-slate-100 pt-2">
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-slate-400">
        URI de redireccion OAuth de esta instalacion
      </summary>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(uri).then(() => {
            setCopiado(true);
            setTimeout(() => {
              setCopiado(false);
            }, 1500);
          });
        }}
        title="Copiar"
        className="mt-1 w-full break-all rounded-lg bg-slate-100 px-2 py-1.5 text-left font-mono text-[10px] text-slate-600 hover:bg-slate-200"
      >
        {copiado ? 'Copiado' : uri}
      </button>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">
        Registrala como URI de redireccion autorizada en el cliente OAuth web del
        proyecto. Cambia si mueves la carpeta o cambias de navegador.
      </p>
    </details>
  );
}
