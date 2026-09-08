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
  /** Texto de la ficha donde suele aparecer "Garantia de fabrica: 12 meses". */
  garantiaTexto: ['.ui-pdp-specs__table', '.andes-table', '.ui-pdp-list--specs'],

  /** Puntuacion promedio, 0.0 - 5.0. */
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

  /** Subtitulo con las ventas: "Nuevo | +500 vendidos". */
  ventas: ['.ui-pdp-subtitle', '[data-testid="product-subtitle"]', '.ui-pdp-header__subtitle'],
} as const satisfies Record<string, readonly string[]>;

/** Primer elemento que matchee en la cascada, o null. */
export const primero = (doc: Document, cascada: readonly string[]): Element | null => {
  for (const sel of cascada) {
    const el = doc.querySelector(sel);
    if (el !== null) return el;
  }
  return null;
};

export const textoDe = (el: Element | null): string => el?.textContent.trim() ?? '';

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
