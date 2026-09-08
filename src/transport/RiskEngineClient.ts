import type { FeatureSet } from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';

export interface EvaluacionSolicitud {
  readonly plataforma: string;
  /** Solo el identificador de la publicacion, nunca la URL completa ni el HTML. */
  readonly publicacionId: string;
  readonly features: FeatureSet;
}

/**
 * Resultado de una evaluacion.
 *
 * Devuelve el veredicto Y el conjunto de caracteristicas sobre el que se
 * calculo. No es redundante: el motor puede resolver caracteristicas que el
 * cliente no pudo, y la presentacion tiene que mostrar exactamente lo que
 * sustenta el veredicto. Si mostrara las del cliente y el veredicto viniera de
 * otras, el panel podria decir "riesgo bajo" junto a seis caracteristicas sin
 * verificar, que es precisamente lo que este diseno debe impedir.
 */
export interface Evaluacion {
  readonly verdict: Verdict;
  readonly features: FeatureSet;
}

/**
 * Puerto del motor de riesgo. Dos implementaciones intercambiables desde
 * src/config.ts sin tocar nada mas.
 */
export interface RiskEngineClient {
  readonly id: string;
  evaluar(solicitud: EvaluacionSolicitud): Promise<Evaluacion>;
}
