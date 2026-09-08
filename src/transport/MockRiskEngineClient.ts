import {
  conocido,
  indeterminado,
  FEATURE_IDS,
  resueltas,
  sinResolver,
  type FeatureSet,
} from '../domain/features.js';
import { ThresholdPolicy } from '../domain/policy/ThresholdPolicy.js';
import type { Verdict } from '../domain/verdict.js';
import type { EvaluacionSolicitud, RiskEngineClient } from './RiskEngineClient.js';

export type Escenario = 'alto' | 'moderado' | 'bajo' | 'evidencia-insuficiente';

/**
 * Motor simulado. Resuelve localmente las tres caracteristicas que hoy
 * corresponden al backend y aplica la politica de decision real, de modo que la
 * maqueta produce los cuatro desenlaces de forma determinista.
 *
 * TODO(backend): veracidadDeDominio requiere un endpoint que valide el dominio
 * (whois/dns). No existe nada de eso en ScamShieldAPI.
 * TODO(backend): reputacionDelVendedor requiere consultar el historial agregado
 * del vendedor. Hoy solo existe GET /api/v1/Seller, que devuelve un riskLevel ya
 * calculado, no una reputacion.
 * TODO(backend): autenticidadDeResenas requiere DistilBERT. El servicio existe
 * (POST /predict) pero cuelga del backend, no es accesible desde la extension.
 */
export class MockRiskEngineClient implements RiskEngineClient {
  readonly id = 'mock';
  readonly #policy = new ThresholdPolicy();
  readonly #escenario: Escenario | undefined;

  /** Sin escenario forzado, deriva el veredicto de las caracteristicas reales. */
  constructor(escenario?: Escenario) {
    this.#escenario = escenario;
  }

  evaluar(solicitud: EvaluacionSolicitud): Promise<Verdict> {
    if (this.#escenario !== undefined) {
      return Promise.resolve(this.#forzar(this.#escenario, solicitud.features));
    }
    return Promise.resolve(this.#policy.decidir(this.#conBackendSimulado(solicitud.features)));
  }

  /** Rellena las tres caracteristicas de backend con valores plausibles. */
  #conBackendSimulado(f: FeatureSet): FeatureSet {
    return {
      ...f,
      veracidadDeDominio: conocido(3, 'Dominio simulado: coincide con la plataforma declarada.'),
      reputacionDelVendedor: conocido(2, 'Reputacion simulada a partir del historial del vendedor.'),
      autenticidadDeResenas: conocido(0.18, 'Proporcion simulada de resenas artificiales.'),
    };
  }

  #forzar(escenario: Escenario, f: FeatureSet): Verdict {
    if (escenario === 'evidencia-insuficiente') {
      const vacio: FeatureSet = Object.fromEntries(
        FEATURE_IDS.map((id) => [id, indeterminado('Escenario de prueba: sin evidencia.')]),
      ) as unknown as FeatureSet;
      return this.#policy.decidir(vacio);
    }

    const base = this.#conBackendSimulado(f);
    return {
      kind: 'riesgo',
      nivel: escenario,
      confianza: resueltas(base).length / FEATURE_IDS.length,
      sustentan: resueltas(base),
      sinResolver: sinResolver(base),
    };
  }
}
