/**
 * Selectores de Mercado Libre que siguen siendo del cliente.
 *
 * Los de caracteristicas se fueron al backend (docs/adr/0004). Aqui solo quedan
 * los de presentacion: donde anclar el badge y que nodo hace de tarjeta. Si una
 * remaquetacion los invalida, el badge cae a una posicion fija; el veredicto no
 * depende de ellos.
 */
export { primero } from '../../dom.js';

/**
 * Anclaje del badge dentro de la ficha: la columna del buybox, arriba de los
 * datos de envio. Cascada, como todo lo demas: si ninguno matchea, el content
 * script cae a una posicion fija.
 */
export const ANCLA_BADGE: readonly string[] = [
  '.ui-pdp-container__col-right .ui-pdp-payment',
  '.ui-pdp-container__col-right form',
  '#buybox-form',
  '.ui-pdp-buybox',
  '.ui-pdp-container__col-right',
];

/**
 * Tarjetas de listado y de los carruseles de recomendaciones. Solo se usan para
 * insertar un enlace a la ficha: de la tarjeta no se extrae ninguna
 * caracteristica, porque no las tiene.
 */
export const TARJETAS: readonly string[] = [
  '.poly-card',
  '.ui-recommendations-card',
  '.andes-card.ui-search-result',
  'li.ui-search-layout__item',
];


