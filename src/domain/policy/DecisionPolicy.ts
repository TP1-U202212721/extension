import type { FeatureSet } from '../features.js';
import type { Verdict } from '../verdict.js';

/**
 * La regla de decision vive detras de esta interfaz a proposito: el umbral
 * concreto esta en revision y va a cambiar. Cambiar de politica no debe obligar
 * a tocar la extraccion, el transporte ni la presentacion.
 */
export interface DecisionPolicy {
  /** Identificador estable, para poder trazar que regla produjo un veredicto. */
  readonly id: string;
  decidir(features: FeatureSet): Verdict;
}
