import type { DatosDelVendedor, Insumos, ResenaLeida } from '../../../domain/insumos.js';
import { primero, todos } from '../../dom.js';

/**
 * Insumos de los analizadores de reputacion y de resenas para eBay.
 *
 * Selectores verificados contra fichas reales de ebay.com abiertas en un
 * navegador real (2026-09-19). Son los mismos que usa el backend en
 * EbayDocumentSelectors: si eBay cambia la maquetacion, hay que corregir los dos
 * (docs/adr/0006).
 */
export const SELECTORES = {
  vendedor: ['.x-sellercard-atf__about-seller-item--seller-name'],
  /** "(13968)": puntaje de valoraciones del vendedor. */
  puntaje: ["[data-testid='x-sellercard-atf__about-seller']"],
  /** "98.7% positive feedback • 68K items sold". */
  destacados: ['.x-store-information__highlights'],
  /** "Joined Nov 2024". */
  datos: ['.x-store-information .ux-icon-text__text'],
  /** Distintivo del propio articulo; "Top Rated" tambien sale en el pie de pagina. */
  distintivo: ['.x-shop-with-confidence .ux-section-icon-with-details__data-title'],
  /**
   * De donde salen las valoraciones.
   *
   * eBay tenia pestanas y la primera era la de ESTE articulo. En la maqueta
   * nueva no hay pestanas sino un desplegable ("All ratings / Positive /
   * Neutral / Negative") y la lista es la del VENDEDOR, titulada
   * "Seller feedback (646)". Se aceptan las dos: sin el respaldo, el panel se
   * quedaba sin una sola resena aunque la pagina mostrara ocho, y con la
   * dimension comunitaria vacia el veredicto salia siempre
   * "evidencia insuficiente". Verificado el 2026-09-22.
   */
  panelDelArticulo: [".fdbk-detail-list [role='tabpanel']", '.fdbk-detail-list'],
  valoracion: '.fdbk-container',
  comentario: '.fdbk-container__details__comment',
  autor: '.fdbk-container__details__info__username',
  tipo: '[data-test-type]',
  migas: ['nav.breadcrumbs li', '.seo-breadcrumbs-container li'],
} as const;

const texto = (raiz: ParentNode, cascada: readonly string[]): string =>
  primero(raiz, cascada)?.textContent.replace(/\s+/g, ' ').trim() ?? '';

/** "68K" → 68000, "2.8K" → 2800, "146" → 146. */
const cantidad = (crudo: string): number | undefined => {
  const m = /([\d.,]+)\s*(k)?/i.exec(crudo);
  if (m?.[1] === undefined) return undefined;
  const n = Number.parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(m[2] === undefined ? n : n * 1000);
};

/**
 * Lo que la ficha de eBay publica sobre el vendedor: porcentaje de valoraciones
 * positivas, cuantas tiene, cuanto vendio y desde que ano esta. eBay calcula el
 * porcentaje sobre positivas y negativas, asi que la proporcion negativa es su
 * complemento. Lo que no se lee se omite; nunca se rellena.
 */
export const datosDelVendedor = (doc: Document): DatosDelVendedor | null => {
  const sellerName = texto(doc, SELECTORES.vendedor);
  if (sellerName === '') return null;

  const destacados = texto(doc, SELECTORES.destacados);
  const positivo = /([\d.,]+)\s*%/.exec(destacados)?.[1];
  const porcentaje = positivo === undefined ? undefined : Number.parseFloat(positivo.replace(',', '.'));
  const negativa =
    porcentaje !== undefined && porcentaje >= 0 && porcentaje <= 100
      ? Math.round((100 - porcentaje) * 10) / 1000
      : undefined;

  const vendidos = /([\d.,]+\s*k?)\s*items? sold/i.exec(destacados)?.[1];
  const ventas = vendidos === undefined ? undefined : cantidad(vendidos);

  const puntaje = /\(([\d.,]+)\)/.exec(texto(doc, SELECTORES.puntaje))?.[1];
  const valoraciones = puntaje === undefined ? undefined : cantidad(puntaje);

  const desde = todos(doc, SELECTORES.datos)
    .map((e) => /joined\s+\w+\s+(\d{4})/i.exec(e.textContent)?.[1])
    .find((a) => a !== undefined);

  const distintivo = todos(doc, SELECTORES.distintivo)
    .map((e) => e.textContent.trim())
    .find((t) => /top rated/i.test(t));

  return {
    sellerName,
    platform: 'eBay',
    ...(negativa !== undefined && { negativeRatingShare: negativa }),
    ...(ventas !== undefined && { completedSales: ventas }),
    ...(valoraciones !== undefined && { ratingCount: valoraciones }),
    ...(desde !== undefined && { memberSinceYear: Number(desde) }),
    ...(distintivo !== undefined && { isRecognizedSeller: true, badgeLabel: distintivo }),
  };
};

/** Positiva, neutral y negativa llevadas a estrellas, igual que en el backend. */
const ESTRELLAS: Readonly<Record<string, number>> = { positive: 5, neutral: 3, negative: 1 };

/**
 * Las valoraciones que los compradores dejaron sobre ESTE articulo. Los
 * "comentarios automatizados de eBay" los escribe eBay y se descartan. La
 * autoria no se manda.
 */
export const resenasVisibles = (doc: Document): readonly ResenaLeida[] => {
  const panel = primero(doc, SELECTORES.panelDelArticulo);
  if (panel === null) return [];

  const salida: ResenaLeida[] = [];
  for (const item of panel.querySelectorAll(SELECTORES.valoracion)) {
    if (/automat/i.test(item.querySelector(SELECTORES.autor)?.textContent ?? '')) continue;
    const text = item.querySelector(SELECTORES.comentario)?.textContent.trim() ?? '';
    if (text.length < 3) continue;
    const rating = ESTRELLAS[item.querySelector(SELECTORES.tipo)?.getAttribute('data-test-type') ?? ''];
    salida.push(rating === undefined ? { text } : { text, rating });
  }
  return salida;
};

const migas = (doc: Document): readonly string[] =>
  todos(doc, SELECTORES.migas)
    .map((e) => e.textContent.trim())
    .filter((t) => t !== '');

export const categoriaDe = (doc: Document): string => migas(doc).at(-1) ?? '';

export const categoriaGruesaDe = (doc: Document): string => migas(doc).slice(0, 2).join('/');

export const insumosDe = (doc: Document): Insumos => ({
  vendedor: datosDelVendedor(doc),
  resenas: resenasVisibles(doc),
  categoria: categoriaDe(doc),
});
