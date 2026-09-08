import { useEffect, useState } from 'react';
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
    veracidadDeDominio: conocido(3, 'El dominio corresponde a la plataforma declarada.'),
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
  const [escenario, setEscenario] = useState<Escenario>('bajo');
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const features = escenario === 'evidencia-insuficiente' ? sinEvidencia() : conCliente();

  useEffect(() => {
    let vigente = true;
    void new MockRiskEngineClient(escenario)
      .evaluar({ plataforma: 'Mercado Libre', publicacionId: 'MPEU3173976853', features })
      .then((v) => {
        if (vigente) setVerdict(v);
      });
    return () => {
      vigente = false;
    };
  }, [escenario]);

  return (
    <div className="w-[420px] p-3">
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

      {verdict !== null && (
        <VerdictPanel verdict={verdict} features={features} plataforma="Mercado Libre" />
      )}

      <p className="mt-2 text-center text-[10px] text-slate-400">
        Maqueta con motor simulado. Los datos no provienen de un analisis real.
      </p>
    </div>
  );
}
