import type { DatosDelVendedor, Insumos, ResenaLeida } from '../../../domain/insumos.js';
import { primero, todos } from '../../dom.js';

/**
 * Insumos de los analizadores de reputacion y de resenas para AliExpress.
 *
 * Selectores verificados contra fichas reales de es.aliexpress.com renderizadas
 * por un navegador (2026-09-19). Son los mismos que usa el backend en
 * AliExpressDocumentSelectors: si AliExpress cambia la maquetacion, hay que
 * corregir los dos (docs/adr/0006).
 *
 * AliExpress usa `data-pl` estables para lo principal y clases con sufijo
 * hasheado (`store-info--desc--lBC4CUb`), por eso esas se buscan por prefijo.
 */
export const SELECTORES = {
  tienda: ["[data-pl='store-name']"],
  /** "94.7% valoraciones positivas | 13.2K Seguidores". */
  descripcionTienda: ["[class*='store-info--desc']"],
  resena: ["[class*='list--itemBox']"],
  textoResena: ["[class*='list--itemReview']"],
  estrellaLlena: "[class*='stars--box'] .comet-icon-starreviewfilled",
  migas: ["[class*='cross-link--breadcrumb'] a"],
} as const;

const PORCENTAJE = /([\d.,]+)\s*%/;

const texto = (raiz: ParentNode, cascada: readonly string[]): string =>
  primero(raiz, cascada)?.textContent.trim() ?? '';

/**
 * Proporcion de valoraciones negativas de la tienda, en [0, 1].
 *
 * AliExpress publica el porcentaje de valoraciones POSITIVAS de la tienda, que
 * calcula sobre positivas y negativas (las neutras no cuentan), asi que la
 * proporcion negativa es su complemento. Si el porcentaje no se lee, se omite.
 */
const proporcionNegativa = (doc: Document): number | undefined => {
  const m = PORCENTAJE.exec(texto(doc, SELECTORES.descripcionTienda));
  if (m?.[1] === undefined) return undefined;
  const positivo = Number.parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(positivo) || positivo < 0 || positivo > 100) return undefined;
  return Math.round((100 - positivo) * 10) / 1000;
};

/**
 * Lo que la ficha de AliExpress publica sobre la tienda.
 *
 * La ficha NO muestra antiguedad de la tienda, ventas totales de la tienda ni un
 * distintivo equivalente al MercadoLider: se omiten, no se rellenan. Las ventas y
 * la puntuacion que se ven en la ficha son de la PUBLICACION, no de la tienda, y
 * mandarlas como si fueran del vendedor seria mezclar dos cosas distintas.
 */
export const datosDelVendedor = (doc: Document): DatosDelVendedor | null => {
  const sellerName = texto(doc, SELECTORES.tienda);
  if (sellerName === '') return null;

  const negativa = proporcionNegativa(doc);
  return {
    sellerName,
    platform: 'AliExpress',
    ...(negativa !== undefined && { negativeRatingShare: negativa }),
  };
};

/**
 * Las resenas que el navegador YA renderizo. No se pagina ni se pide nada.
 *
 * AliExpress muestra resenas sin texto (solo estrellas y la variante comprada):
 * esas se descartan, porque el analizador de autenticidad trabaja sobre el texto.
 * La autoria no se lee.
 */
export const resenasVisibles = (doc: Document): readonly ResenaLeida[] => {
  const salida: ResenaLeida[] = [];
  const vistos = new Set<string>();

  for (const item of todos(doc, SELECTORES.resena)) {
    const text = texto(item, SELECTORES.textoResena);
    if (text.length < 3 || vistos.has(text)) continue;
    vistos.add(text);
    const estrellas = item.querySelectorAll(SELECTORES.estrellaLlena).length;
    salida.push(estrellas >= 1 && estrellas <= 5 ? { text, rating: estrellas } : { text });
  }
  return salida;
};

/** Escalones de las migas, sin "Inicio". AliExpress a menudo solo muestra "Inicio". */
const migas = (doc: Document): readonly string[] =>
  todos(doc, SELECTORES.migas)
    .map((e) => e.textContent.trim())
    .filter((t) => t !== '' && !/^inicio$/i.test(t));

/** Categoria mas especifica, para dar contexto al clasificador. */
export const categoriaDe = (doc: Document): string => migas(doc).at(-1) ?? '';

/** Los dos primeros escalones: los unicos que la analitica puede emitir. */
export const categoriaGruesaDe = (doc: Document): string => migas(doc).slice(0, 2).join('/');

export const insumosDe = (doc: Document): Insumos => ({
  vendedor: datosDelVendedor(doc),
  resenas: resenasVisibles(doc),
  categoria: categoriaDe(doc),
});
