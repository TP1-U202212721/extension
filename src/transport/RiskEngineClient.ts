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
