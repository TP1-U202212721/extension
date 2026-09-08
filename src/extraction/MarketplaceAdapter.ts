import type { FeatureSet } from '../domain/features.js';

export interface Publicacion {
  readonly plataforma: string;
  readonly publicacionId: string;
}

/**
 * Puerto de extraccion. Una implementacion por marketplace.
 *
 * Contrato que toda implementacion debe cumplir:
 *
 * 1. SOLO LECTURA del documento ya renderizado. Nada de `fetch`, nada de
 *    navegacion, nada de iframes, nada de peticiones que el usuario no hubiera
 *    cursado igual. La extension interpreta la pagina que el navegador ya
 *    entrego; no la visita de nuevo.
 * 2. NUNCA lanza. Un cambio de maquetacion degrada a `indeterminado`, no rompe.
 * 3. NUNCA devuelve un valor por defecto que se confunda con una observacion.
 *    Si el selector no matchea, el estado es `indeterminado` con su motivo.
 */
export interface MarketplaceAdapter {
  readonly plataforma: string;
  /** Decide si esta URL corresponde a una ficha de producto de esta plataforma. */
  reconoce(url: URL): boolean;
  identificar(url: URL): Publicacion | null;
  /** Extrae solo las caracteristicas de cliente; las de backend quedan indeterminadas. */
  extraer(doc: Document): FeatureSet;
}
