/**
 * TODOS los selectores de eBay viven aqui y solo aqui.
 *
 * ESTADO DE VERIFICACION: construidos sobre las clases del sistema de diseno de
 * eBay (`x-*`, `ux-*`) y sus `data-testid`, que son estables entre
 * remaquetaciones porque los usa su propio codigo. **No contrastados todavia
 * contra HTML real capturado**, a diferencia de MercadoLibre.
 *
 * eBay si publica JSON-LD de tipo Product en la ficha, asi que la puntuacion y
 * la cantidad de resenas se leen preferentemente de ahi y estos selectores solo
 * actuan de respaldo.
 */
export const SELECTORS = {
  puntuacion: [
    '[data-testid="x-star-rating"]',
    '.x-rating__average',
    '.ux-summary__start--rating',
    '.reviews-star-rating',
  ],

  cantidadResenas: [
    '[data-testid="x-rating-count"]',
    '.x-rating__count',
    '.ux-summary__count',
  ],

  bloqueResenas: ['#rwid', '.reviews', '[data-testid="x-review-section"]'],

  /** "123 sold" / "123 vendidos", en el enlace al historial de compras. */
  ventas: [
    '.x-quantity__availability',
    'a[href*="purchase-history"]',
    '[data-testid="x-quantity"]',
    '.d-quantity__availability',
  ],

  /** Devoluciones: "30 days returns" / "Devoluciones en 30 dias". */
  garantia: [
    '[data-testid="x-returns-minview"]',
    '.x-returns-minview',
    '#returnsSection',
    '.ux-labels-values--returns',
  ],

  /** Garantia de devolucion del dinero de eBay, en el buybox. */
  proteccionDePago: [
    '.ux-labels-values--buyerProtection',
    '[data-testid="ux-labels-values--buyerProtection"]',
    'a[href*="money-back-guarantee"]',
    '.x-buybox__money-back',
  ],
} as const satisfies Record<string, readonly string[]>;

export const ANCLA_BADGE: readonly string[] = [
  '.x-buybox__cta',
  '.x-buybox',
  '[data-testid="x-buybox"]',
  '#mainContent',
];

export const TARJETAS: readonly string[] = [
  'li.s-item',
  'li.brwrvr__item-card',
  '.str-item-card',
  '[data-testid="item-card"]',
];

export const ENLACE_FICHA = 'a[href*="/itm/"]';
