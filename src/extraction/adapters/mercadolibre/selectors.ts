/**
 * TODOS los selectores de MercadoLibre viven aqui y solo aqui.
 *
 * Son el punto de fallo conocido del sistema: una remaquetacion de la plataforma
 * los invalida. Aislarlos permite que ese fallo se arregle en un archivo y que,
 * mientras tanto, degrade a `indeterminado` en vez de romper la extension.
 *
 * Cada entrada es una cascada: se prueban en orden hasta que una matchee.
 */
export const SELECTORS = {
  /**
   * Proteccion de pago. OJO: el backend de TP1 usa este mismo selector tambien
   * para garantia (MercadoLibreHelper.cs:186), por lo que ambas caracteristicas
   * salen siempre identicas. Aqui son cosas distintas y se miden distinto.
   */
  proteccionDePago: [
    'a[href*="/compra-protegida"]',
    '[data-testid="protected-purchase"]',
    '#buybox-form a[href*="compra-protegida"]',
  ],

  /** Garantia del producto, en la ficha tecnica o en el buybox. */
  garantia: [
    '[data-testid="warranty"]',
    '.ui-pdp-buybox__quantity ~ * a[href*="garantia"]',
    '.ui-pdp-warranty',
  ],
  /**
   * Texto donde declara la garantia. En la ficha real aparece al final de la
   * descripcion ("Garantia del vendedor: 1 años") y en la tabla de
   * especificaciones ("Duracion del producto: 12 meses").
   */
  garantiaTexto: [
    '.ui-pdp-description__content',
    '.ui-vpp-striped-specs',
    '.ui-pdp-specs__table',
    '.andes-table',
  ],

  /**
   * Puntuacion promedio, 0.0 - 5.0. Solo se usa si el JSON-LD no la trae: en la
   * ficha real de MercadoLibre estos nodos ni siquiera existen cuando la
   * seccion de opiniones esta oculta, y el dato si esta en los datos
   * estructurados.
   */
  puntuacion: [
    '[data-testid="rating-value"]',
    '.ui-pdp-review__rating',
    '.ui-review-capability__rating__average',
  ],

  /** Cantidad de resenas / opiniones. */
  cantidadResenas: [
    '[data-testid="rating-amount"]',
    '.ui-pdp-review__amount',
    '.ui-review-capability__rating__label',
  ],

  /** Bloque de opiniones, para decidir presencia de resenas. */
  bloqueResenas: ['#reviews-capability', '.ui-pdp-reviews', '[data-testid="reviews"]'],

  /**
   * Ventas del vendedor: "+5 ventas".
   *
   * Van en el resumen del vendedor, NO en `.ui-pdp-subtitle`: ahi solo dice
   * "Nuevo". El selector anterior estaba mal y por eso el volumen de ventas
   * caia siempre a indeterminado.
   */
  ventas: [
    '.ui-pdp-seller-summary__header__subtitle',
    '.ui-seller-data-status__info-title',
    '.ui-pdp-subtitle',
  ],
} as const satisfies Record<string, readonly string[]>;

export { primero, textoDe } from '../../dom.js';

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


