import {
  conocido,
  indeterminado,
  FEATURE_IDS,
  resueltas,
  sinResolver,
  type FeatureSet,
} from '../domain/features.js';
import { ThresholdPolicy } from '../domain/policy/ThresholdPolicy.js';
import {
  SIN_DETALLES,
  type Evaluacion,
  type EvaluacionSolicitud,
  type RiskEngineClient,
} from './RiskEngineClient.js';

export type Escenario = 'alto' | 'moderado' | 'bajo' | 'evidencia-insuficiente';

/**
 * Motor simulado. YA NO ES EL CAMINO POR DEFECTO: existe para desarrollar sin
 * backend y para maquetar los cuatro desenlaces (ver src/config.ts).
 *
 * Sin escenario forzado NO inventa nada: no tiene de donde leer el documento,
 * asi que deja todo indeterminado y la politica se abstiene. Rellenarlo con
 * valores favorables producia "riesgo bajo" a partir de casi ninguna evidencia,
 * que es exactamente el fallo que el modelo de tres estados existe para
 * impedir.
 */
export class MockRiskEngineClient implements RiskEngineClient {
  readonly id = 'mock';
  readonly #policy = new ThresholdPolicy();
  readonly #escenario: Escenario | undefined;

  /** Sin escenario forzado, el veredicto sale de las caracteristicas reales. */
  constructor(escenario?: Escenario) {
    this.#escenario = escenario;
  }

  evaluar(_solicitud: EvaluacionSolicitud): Promise<Evaluacion> {
    return Promise.resolve(this.#forzar(this.#escenario ?? 'evidencia-insuficiente', VACIO));
  }

  /** Maqueta un desenlace concreto, para la UI del popup. */
  simular(escenario: Escenario): Evaluacion {
    return this.#forzar(escenario, VACIO);
  }

  /** Solo para maquetar la UI: rellena con valores de ejemplo. */
  #conBackendDeEjemplo(f: FeatureSet): FeatureSet {
    return {
      ...f,
      proteccionDePago: conocido('declarada', 'Escenario de prueba: compra protegida.'),
      puntuacionDelProducto: conocido(4.8, 'Escenario de prueba: 4.8 sobre 5.'),
      presenciaDeResenas: conocido(true, 'Escenario de prueba: la ficha publica opiniones.'),
      politicasDeGarantia: conocido(1, 'Escenario de prueba: garantia declarada.'),
      volumenDeVentas: conocido(500, 'Escenario de prueba: 500 ventas.'),
      veracidadDeDominio: conocido(5, 'Escenario de prueba: el dominio coincide con la plataforma.'),
      reputacionDelVendedor: conocido(5, 'Escenario de prueba: trayectoria establecida.'),
      autenticidadDeResenas: conocido(5, 'Escenario de prueba: resenas autenticas.'),
    };
  }

  #forzar(escenario: Escenario, f: FeatureSet): Evaluacion {
    if (escenario === 'evidencia-insuficiente') {
      const vacio: FeatureSet = Object.fromEntries(
        FEATURE_IDS.map((id) => [id, indeterminado('Escenario de prueba: sin evidencia.')]),
      ) as unknown as FeatureSet;
      return { verdict: this.#policy.decidir(vacio), features: vacio, detalles: SIN_DETALLES };
    }

    const base = this.#conBackendDeEjemplo(f);
    return {
      verdict: {
        kind: 'riesgo',
        nivel: escenario,
        confianza: resueltas(base).length / FEATURE_IDS.length,
        sustentan: resueltas(base),
        sinResolver: sinResolver(base),
      },
      features: base,
      detalles: SIN_DETALLES,
    };
  }
}

/** Punto de partida de los escenarios: nada leido de ninguna pagina. */
const VACIO: FeatureSet = Object.fromEntries(
  FEATURE_IDS.map((id) => [id, indeterminado('Escenario de prueba: sin evidencia.')]),
) as unknown as FeatureSet;
