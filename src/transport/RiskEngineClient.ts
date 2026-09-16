import type { FeatureSet } from '../domain/features.js';
import type { Insumos } from '../domain/insumos.js';
import type { Verdict } from '../domain/verdict.js';
import type { DetalleDominio } from './DomainVeracityClient.js';
import type { DetalleDocumento } from './DocumentAnalysisClient.js';
import type { DetalleVendedor } from './SellerReputationClient.js';
import type { DetalleResenas } from './ReviewAnalysisClient.js';

export interface EvaluacionSolicitud {
  readonly plataforma: string;
  readonly publicacionId: string;
  /** URL que el comprador ya tiene abierta. */
  readonly url: string;
  /** El documento que el navegador YA renderizo. Ver docs/adr/0004. */
  readonly html: string;
  /**
   * Lo que los analizadores de reputacion y de resenas necesitan y el documento
   * no devuelve. Lo lee el content script del DOM vivo: el service worker de
   * MV3 no tiene DOMParser, asi que el background no podria hacerlo.
   */
  readonly insumos: Insumos;
}

/**
 * Como le fue a la llamada de un analizador.
 *
 * Es lo que la analitica de uso reporta como `EAnalyzerOutcome`, y tiene que
 * salir de aqui: un timeout y un 500 llegan los dos a la presentacion como
 * "indeterminado", y para la tesis no son lo mismo. `omitido` es el analizador
 * apagado en `src/config.ts`, y queda fuera del denominador de la tasa de error
 * y de las muestras de latencia: no se intento, asi que no puede contar ni como
 * acierto ni como fallo.
 */
export type DesenlaceLlamada = 'correcto' | 'error' | 'tiempo-agotado' | 'omitido';

/** Lo que tardo y como termino cada analizador. Se mide, no se estima. */
export interface PasoDeTraza {
  readonly desenlace: DesenlaceLlamada;
  readonly duracionMs: number;
}

export interface Traza {
  readonly documento: PasoDeTraza;
  readonly dominio: PasoDeTraza;
  readonly vendedor: PasoDeTraza;
  readonly resenas: PasoDeTraza;
}

export const OMITIDO: PasoDeTraza = { desenlace: 'omitido', duracionMs: 0 };

export const SIN_TRAZA: Traza = {
  documento: OMITIDO,
  dominio: OMITIDO,
  vendedor: OMITIDO,
  resenas: OMITIDO,
};

/** Evidencia que acompana al veredicto, para la presentacion explicativa. */
export interface Detalles {
  readonly documento: DetalleDocumento | null;
  readonly dominio: DetalleDominio | null;
  readonly vendedor: DetalleVendedor | null;
  readonly resenas: DetalleResenas | null;
}

/**
 * Resultado de una evaluacion.
 *
 * Devuelve el veredicto Y el conjunto de caracteristicas sobre el que se
 * calculo. No es redundante: si la presentacion mostrara unas caracteristicas y
 * el veredicto viniera de otras, el panel podria decir "riesgo bajo" junto a
 * seis caracteristicas sin verificar, que es justo lo que este diseno impide.
 */
export interface Evaluacion {
  readonly verdict: Verdict;
  readonly features: FeatureSet;
  readonly detalles: Detalles;
  /**
   * Como termino y cuanto tardo cada analizador. Se devuelve con el veredicto
   * porque es cuando se sabe: reconstruirlo despues obligaria a medir dos veces
   * o a inventar la latencia.
   */
  readonly traza: Traza;
}

/**
 * Puerto del motor de riesgo. Dos implementaciones intercambiables desde
 * src/config.ts sin tocar nada mas.
 */
export interface RiskEngineClient {
  readonly id: string;
  evaluar(solicitud: EvaluacionSolicitud): Promise<Evaluacion>;
}

/** Se lanza cuando el motor exige sesion y no hay una activa. */
export class SesionRequeridaError extends Error {
  constructor() {
    super('El motor de riesgo requiere una sesion iniciada.');
    this.name = 'SesionRequeridaError';
  }
}

export const SIN_DETALLES: Detalles = {
  documento: null,
  dominio: null,
  vendedor: null,
  resenas: null,
};
