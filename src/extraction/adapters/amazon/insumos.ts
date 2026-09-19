import type { DatosDelVendedor, Insumos, ResenaLeida } from '../../../domain/insumos.js';
import { primero, todos } from '../../dom.js';

/**
 * Insumos de los analizadores de reputacion y de resenas para Amazon.
 *
 * Selectores verificados contra fichas reales de amazon.com renderizadas en
 * espanol (2026-09-19). Son los mismos que usa el backend en
 * AmazonDocumentSelectors: si Amazon cambia la maquetacion, hay que corregir los
 * dos (docs/adr/0006).
 */
export const SELECTORES = {
  vendedorExterno: ['#sellerProfileTriggerId'],
  /** "Vendido por Amazon.com" cuando no hay vendedor externo. */
  comerciante: ['#merchantInfoFeature_feature_div .offer-display-feature-text', '#merchant-info'],
  resena: ["[data-hook='review']"],
  textoResena: ["[data-hook='reviewRichContentContainer']", "[data-hook='review-body']"],
  estrellas: ["[data-hook='review-star-rating']", "[data-hook='cmps-review-star-rating']"],
  migas: ['#wayfinding-breadcrumbs_feature_div li a'],
} as const;

const texto = (raiz: ParentNode, cascada: readonly string[]): string =>
  primero(raiz, cascada)?.textContent.replace(/\s+/g, ' ').trim() ?? '';

/**
 * Amazon no pone en la ficha la reputacion del vendedor externo: vive en su
 * perfil, en otra pagina, y la extension no navega. Solo viaja el nombre; el
 * resto se omite. Cuando vende Amazon, el vendedor es Amazon.com.
 */
export const datosDelVendedor = (doc: Document): DatosDelVendedor | null => {
  const externo = texto(doc, SELECTORES.vendedorExterno);
  if (externo !== '') return { sellerName: externo, platform: 'Amazon' };
  if (/amazon/i.test(texto(doc, SELECTORES.comerciante))) {
    return { sellerName: 'Amazon.com', platform: 'Amazon', isRecognizedSeller: true };
  }
  return null;
};

/** Las resenas que el navegador YA renderizo. La autoria no se lee. */
export const resenasVisibles = (doc: Document): readonly ResenaLeida[] => {
  const salida: ResenaLeida[] = [];
  const vistos = new Set<string>();
  for (const item of todos(doc, SELECTORES.resena)) {
    const text = texto(item, SELECTORES.textoResena);
    if (text.length < 3 || vistos.has(text)) continue;
    vistos.add(text);
    const m = /\d+(?:[.,]\d+)?/.exec(texto(item, SELECTORES.estrellas));
    const rating = m === null ? undefined : Math.round(Number.parseFloat(m[0].replace(',', '.')));
    salida.push(rating !== undefined && rating >= 1 && rating <= 5 ? { text, rating } : { text });
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
