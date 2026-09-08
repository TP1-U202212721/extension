/**
 * TODOS los selectores de AliExpress viven aqui y solo aqui.
 *
 * ESTADO DE VERIFICACION: **no contrastados todavia contra HTML real
 * capturado**, a diferencia de MercadoLibre.
 *
 * AliExpress es el caso mas hostil de los cuatro: usa CSS Modules y sus clases
 * llevan un hash generado en cada build (`rating--wrap--DQRRgb`). Un selector
 * exacto quedaria invalidado con el proximo despliegue, asi que aqui se usa
 * `[class*="prefijo--"]`, que sobrevive al hash porque el prefijo semantico se
 * conserva. Es mas laxo y puede matchear de mas: por eso el valor siempre se
 * valida antes de darlo por conocido.
 */
export const SELECTORS = {
  puntuacion: [
    '[class*="reviewer--rating--"]',
    '[class*="rating--wrap--"]',
    '.overview-rating-average',
    '[class*="ratings--rating--"]',
  ],

  cantidadResenas: [
    '[class*="reviewer--reviews--"]',
    '[class*="rating--reviews--"]',
    '.product-reviewer-reviews',
  ],

  bloqueResenas: ['#nav-review', '[class*="reviews--"]', '.product-reviewer'],

  /** "1000+ sold" / "1000+ vendidos". */
  ventas: [
    '[class*="reviewer--sold--"]',
    '[class*="trade--soldCount--"]',
    '.product-reviewer-sold',
  ],

  /** Devoluciones gratis y garantia, en el bloque de servicios del vendedor. */
  garantia: [
    '[class*="returns--"]',
    '[class*="Guarantees--"]',
    '[class*="shipping--freeReturn--"]',
  ],

  /** Proteccion al comprador de AliExpress. */
  proteccionDePago: [
    '[class*="buyerProtection--"]',
    '[class*="protection--"]',
    'a[href*="buyer-protection"]',
  ],
} as const satisfies Record<string, readonly string[]>;

export const ANCLA_BADGE: readonly string[] = [
  '[class*="buy-now--"]',
  '[class*="product-action--"]',
  '[class*="pdp-info-right"]',
  '.product-action',
];

export const TARJETAS: readonly string[] = [
  '[class*="search-item-card-wrapper"]',
  '[class*="list--gallery--"]',
  '.product-card',
];

export const ENLACE_FICHA = 'a[href*="/item/"]';
