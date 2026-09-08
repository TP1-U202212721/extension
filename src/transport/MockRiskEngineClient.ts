import {
  conocido,
  indeterminado,
  FEATURE_IDS,
  resueltas,
  sinResolver,
  type FeatureSet,
} from '../domain/features.js';
import { ThresholdPolicy } from '../domain/policy/ThresholdPolicy.js';
import type { Evaluacion, EvaluacionSolicitud, RiskEngineClient } from './RiskEngineClient.js';

export type Escenario = 'alto' | 'moderado' | 'bajo' | 'evidencia-insuficiente';

/**
 * Motor simulado.
 *
 * Por defecto NO inventa valores: deja sin resolver las tres caracteristicas
 * que corresponden al backend, porque ese backend no existe todavia. El
 * resultado natural es `evidencia-insuficiente`, que es la respuesta honesta.
 *
 * Rellenarlas con valores favorables producia "riesgo bajo" a partir de casi
 * ninguna evidencia: exactamente el fallo que el modelo de tres estados existe
 * para impedir. Los escenarios forzados siguen disponibles para maquetar la UI,
 * pero hay que pedirlos explicitamente.
 *
 * TODO(backend): veracidadDeDominio requiere un endpoint que valide el dominio
 * (whois/dns). No existe nada de eso en ScamShieldAPI.
 * TODO(backend): reputacionDelVendedor requiere el historial agregado del
 * vendedor. Hoy solo existe GET /api/v1/Seller, que devuelve un riskLevel ya
 * calculado, no una reputacion.
 * TODO(backend): autenticidadDeResenas requiere DistilBERT. El servicio existe
 * (POST /predict) pero cuelga del backend, no es accesible desde la extension.
 */
export class MockRiskEngineClient implements RiskEngineClient {
  readonly id = 'mock';
  readonly #policy = new ThresholdPolicy();
  readonly #escenario: Escenario | undefined;

  /** Sin escenario forzado, el veredicto sale de las caracteristicas reales. */
  constructor(escenario?: Escenario) {
    this.#escenario = escenario;
  }

  evaluar(solicitud: EvaluacionSolicitud): Promise<Evaluacion> {
    if (this.#escenario !== undefined) {
      return Promise.resolve(this.#forzar(this.#escenario, solicitud.features));
    }
    // Se decide sobre las caracteristicas tal como llegaron: las de backend
    // quedan indeterminadas y la politica se abstiene.
    return Promise.resolve({
      verdict: this.#policy.decidir(solicitud.features),
      features: solicitud.features,
    });
  }

  /** Solo para maquetar la UI: rellena el backend con valores de ejemplo. */
  #conBackendDeEjemplo(f: FeatureSet): FeatureSet {
    return {
      ...f,
      veracidadDeDominio: conocido(3, 'Escenario de prueba: el dominio coincide con la plataforma.'),
      reputacionDelVendedor: conocido(2, 'Escenario de prueba: historial del vendedor.'),
      autenticidadDeResenas: conocido(0.18, 'Escenario de prueba: 18% con indicios de ser falsas.'),
    };
  }

  #forzar(escenario: Escenario, f: FeatureSet): Evaluacion {
    if (escenario === 'evidencia-insuficiente') {
      const vacio: FeatureSet = Object.fromEntries(
        FEATURE_IDS.map((id) => [id, indeterminado('Escenario de prueba: sin evidencia.')]),
      ) as unknown as FeatureSet;
      return { verdict: this.#policy.decidir(vacio), features: vacio };
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
    };
  }
}
