import type { FeatureSet } from '../features.js';
import type { Verdict } from '../verdict.js';

/**
 * Donde ocurre la compra, que cambia como se leen algunas caracteristicas.
 *
 * Dentro de un marketplace conocido, el dominio y la pasarela de pago son
 * CONSTANTES de la plataforma: `ebay.com` siempre tiene TLS y siempre ofrece
 * proteccion al comprador, venda quien venda. No dicen nada de este vendedor, y
 * contarlas a favor diluye a las que si hablan de el. En una tienda con dominio
 * propio es al reves: ahi el dominio y el pago son la evidencia principal.
 */
export interface ContextoDelVeredicto {
  /** true cuando la publicacion vive en un marketplace que la extension reconoce. */
  readonly enMarketplace: boolean;
}

/**
 * La regla de decision vive detras de esta interfaz a proposito: el umbral
 * concreto esta en revision y va a cambiar. Cambiar de politica no debe obligar
 * a tocar la extraccion, el transporte ni la presentacion.
 */
export interface DecisionPolicy {
  /** Identificador estable, para poder trazar que regla produjo un veredicto. */
  readonly id: string;
  decidir(features: FeatureSet, contexto?: ContextoDelVeredicto): Verdict;
}
