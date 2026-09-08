/**
 * TODOS los selectores de Amazon viven aqui y solo aqui.
 *
 * ESTADO DE VERIFICACION: cascadas construidas sobre los identificadores
 * estables y documentados de Amazon (`#acrPopover`, `#acrCustomerReviewText`,
 * `#buybox`), pero **no contrastadas todavia contra HTML real capturado**, a
 * diferencia de MercadoLibre. Hasta que haya un fixture en
 * tests/fixtures/amazon/ hay que asumir que alguna cascada falla y degrada a
 * `indeterminado`, que es el comportamiento correcto pero no el deseable.
 *
 * Amazon es el unico de los cuatro que NO publica JSON-LD de tipo Product en la
 * ficha, asi que aqui todo depende de los selectores. Se prefieren los `id`,
 * que Amazon conserva por compatibilidad con su propio codigo, sobre las clases
 * `a-*`, que cambian con el tema.
 */
export const SELECTORS = {
  /**
   * Puntuacion. El numero vive en el atributo `title` ("4.5 out of 5 stars" /
   * "4,5 de 5 estrellas") o en el texto oculto `.a-icon-alt`, no en el texto
   * visible del bloque.
   */
  puntuacion: [
    '#acrPopover',
    '#averageCustomerReviews [data-hook="rating-out-of-text"]',
    '#averageCustomerReviews .a-icon-alt',
    'span[data-hook="rating-out-of-text"]',
  ],
  /** Atributos donde buscar la puntuacion, en orden. */
  puntuacionAtributos: ['title', 'aria-label'],

  /** Cantidad de valoraciones: "1,234 ratings" / "1.234 calificaciones". */
  cantidadResenas: [
    '#acrCustomerReviewText',
    '[data-hook="total-review-count"]',
    '#reviewsMedley .a-size-base',
  ],

  /** Bloque de opiniones, para decidir presencia de resenas. */
  bloqueResenas: ['#reviewsMedley', '#customerReviews', '#cm-cr-dp-review-list'],

  /**
   * Prueba social de ventas: "500+ bought in past month".
   * Es lo mas cercano a volumen de ventas que Amazon expone en la ficha.
   */
  ventas: [
    '#social-proofing-faceout-title-tk_bought',
    '#socialProofingAsinFaceout_feature_div',
    '[data-csa-c-content-id="social-proofing-faceout-title-tk_bought"]',
  ],

  /**
   * Devoluciones y garantia. Amazon las presenta como politica de devolucion
   * en el buybox y como soporte del producto mas abajo.
   */
  garantia: [
    '#productSupportAndReturnPolicy-return-policy-anchor-text',
    '#RETURNS_POLICY',
    'a[href*="return-policy"]',
    'a[href*="returns-policy"]',
    '#warranty_feature_div',
  ],

  /**
   * Proteccion de pago. Amazon la declara como "Secure transaction" junto al
   * metodo de pago, y su garantia de la A a la Z cubre la compra.
   */
  proteccionDePago: [
    '#tabular-buybox a[href*="transaction-security"]',
    'a[href*="a-to-z-guarantee"]',
    '#paymentInformation',
    '.tabular-buybox-text[tabular-attribute-name="Payment"]',
  ],
} as const satisfies Record<string, readonly string[]>;

/** Anclaje del badge: la columna derecha con el boton de compra. */
export const ANCLA_BADGE: readonly string[] = [
  '#desktop_buybox',
  '#buybox',
  '#rightCol',
  '#addToCart_feature_div',
];

/** Tarjetas de resultados y carruseles. */
export const TARJETAS: readonly string[] = [
  'div[data-asin][data-component-type="s-search-result"]',
  'li.a-carousel-card',
  'div[data-asin]:not([data-asin=""])',
];

/** Enlaces a ficha dentro de una tarjeta. */
export const ENLACE_FICHA = 'a[href*="/dp/"], a[href*="/gp/product/"]';
