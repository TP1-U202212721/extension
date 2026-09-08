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



/**
 * ────────────────────────────────────────────────────────────────────────────
 * INSUMOS DE LOS ANALIZADORES DE REPUTACION Y DE RESENAS
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Estos selectores SI interpretan contenido, a diferencia de los de arriba.
 * Estan aqui, y solo aqui, porque `/SellerReputation/Estimate` y
 * `/ReviewAnalysis/Authenticity` no reciben el documento sino datos ya
 * estructurados, asi que alguien tiene que leerlos del DOM y ese alguien es la
 * extension. El costo asumido esta en docs/adr/0006: duplican conocimiento de
 * maquetacion que el backend tambien tiene.
 *
 * ESTADO DE VERIFICACION: `ventas` esta contrastado contra HTML real de una
 * ficha de Mercado Libre Peru; el resto **no**. Lo que la disciplina de omision
 * garantiza es que un selector que falla produce una clave ausente, o sea una
 * senal "no verificable", y nunca una senal en contra del vendedor.
 */
export const VENDEDOR = {
  /** Nombre de la tienda o del vendedor. Sin esto no se consulta al analizador. */
  nombre: [
    'div.ui-seller-data-header__title-container',
    '.ui-pdp-seller__header__title',
    '.ui-box-component .ui-pdp-seller__link-trigger',
    '.ui-seller-info__title',
  ],

  /** Bloque del vendedor. Si no llego, no se afirma nada sobre el vendedor. */
  bloque: ['.ui-seller-data-header', '.ui-pdp-seller', '[class*="ui-seller-data"]'],

  /** Distintivo de lider: "MercadoLider", "MercadoLider Gold", "Platinum". */
  distintivo: [
    '.ui-seller-data-status__lider-seller',
    '[class*="lider-seller"]',
    '.ui-pdp-seller__status-title',
  ],

  /** "+5 ventas", "+1000 ventas". Verificado contra HTML real. */
  ventas: [
    '.ui-pdp-seller-summary__header__subtitle',
    '.ui-seller-data-status__info-title',
    '.ui-pdp-seller__list-item',
  ],

  /** Puntuacion agregada del vendedor, 0 a 5. */
  puntuacion: [
    '.ui-seller-data-status__thermometer-title',
    '.ui-review-capability__rating__average',
    '[class*="seller-reputation"] [class*="rating"]',
  ],

  /** "Vende desde 2019", "Se unio en 2019". */
  antiguedad: [
    '.ui-seller-data-status__title',
    '.ui-pdp-seller__list-item',
    '.ui-seller-info__status-info',
  ],

  /** Termometro de reputacion. Su nivel llega en una clase o en el aria-label. */
  termometro: ['.ui-thermometer', '[class*="ui-thermometer"]'],
} as const satisfies Record<string, readonly string[]>;

export const RESENAS = {
  /** Texto de cada opinion ya renderizada. */
  comentario: [
    '[data-testid="comment-content-component"]',
    '.ui-review-capability-comments__comment__content',
    '.ui-review-capability-comments__comment',
    '.ui-review-capability__comments article p',
  ],

  /** Estrellas de una opinion concreta, normalmente en el aria-label. */
  estrellas: ['[data-testid="comment-rating"]', '[class*="comment__rating"]', '.andes-visually-hidden'],

  /** Migas de pan: dan la categoria del producto. */
  categoria: ['.andes-breadcrumb__link', '.ui-pdp-breadcrumb a'],
} as const satisfies Record<string, readonly string[]>;
