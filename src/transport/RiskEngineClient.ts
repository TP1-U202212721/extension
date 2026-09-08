import type { FeatureSet } from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';

export interface EvaluacionSolicitud {
  readonly plataforma: string;
  /** Solo el identificador de la publicacion, nunca la URL completa ni el HTML. */
  readonly publicacionId: string;
  readonly features: FeatureSet;
}

/**
 * Puerto del motor de riesgo. Dos implementaciones intercambiables desde
 * src/config.ts sin tocar nada mas.
 */
export interface RiskEngineClient {
  readonly id: string;
  evaluar(solicitud: EvaluacionSolicitud): Promise<Verdict>;
}
