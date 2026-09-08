import type { FeatureSet } from './domain/features.js';
import type { Verdict } from './domain/verdict.js';

/**
 * Contrato entre el content script y el background.
 *
 * El content script extrae, el background evalua. La red se hace desde el
 * background a proposito: asi la peticion no depende del CSP de la pagina del
 * marketplace, y la pagina del vendedor nunca ve una peticion nuestra.
 */
export interface EvaluarMensaje {
  readonly tipo: 'evaluar';
  readonly plataforma: string;
  readonly publicacionId: string;
  readonly features: FeatureSet;
}

export interface VeredictoRespuesta {
  readonly tipo: 'veredicto';
  readonly verdict: Verdict;
  /** Caracteristicas sobre las que se calculo el veredicto. */
  readonly features: FeatureSet;
}

/** El motor exige sesion y no hay ninguna activa. */
export interface SesionRequeridaRespuesta {
  readonly tipo: 'sesion-requerida';
}

export type Respuesta = VeredictoRespuesta | SesionRequeridaRespuesta;

export type Mensaje = EvaluarMensaje;

/**
 * Guardas de runtime. Un mensaje que cruza el limite entre content script y
 * background llega como `unknown`: asumir su forma es exactamente el tipo de
 * atajo que este proyecto no se permite.
 */
export const esEvaluarMensaje = (m: unknown): m is EvaluarMensaje =>
  typeof m === 'object' && m !== null && 'tipo' in m && m.tipo === 'evaluar';

export const esVeredictoRespuesta = (r: unknown): r is VeredictoRespuesta =>
  typeof r === 'object' && r !== null && 'tipo' in r && r.tipo === 'veredicto';

export const esSesionRequerida = (r: unknown): r is SesionRequeridaRespuesta =>
  typeof r === 'object' && r !== null && 'tipo' in r && r.tipo === 'sesion-requerida';
