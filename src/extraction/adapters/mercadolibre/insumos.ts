import type { DatosDelVendedor, Insumos, ResenaLeida } from '../../../domain/insumos.js';
import { primero, todos } from '../../dom.js';
import { RESENAS, VENDEDOR } from './selectors.js';

/** "+5 ventas", "+1.2mil ventas", "1000 ventas". */
const VENTAS = /\+?\s*([\d.,]+)\s*(mil|k)?\s*(?:vendid|venta)/i;
/** "4.8" o "4,8", acotado a la escala. */
const PUNTUACION = /\b([0-5](?:[.,]\d+)?)\b/;
/** "Vende desde 2019", "Se unio en 2019", "Miembro desde 2019". */
const ANIO = /(?:desde|en)\s+(?:el\s+)?(?:año\s+)?((?:19|20)\d{2})/i;
/** "Gold", "Platinum", "MercadoLider". */
const GOLD = /gold/i;
const PLATINUM = /platinum|plat[ií]no/i;
const LIDER = /mercado\s*l[ií]der/i;

const texto = (raiz: ParentNode, cascada: readonly string[]): string =>
  primero(raiz, cascada)?.textContent.trim() ?? '';

/** Texto de todos los nodos de la cascada, unido. Util cuando el dato esta en una lista. */
const textos = (raiz: ParentNode, cascada: readonly string[]): string =>
  todos(raiz, cascada)
    .map((e) => e.textContent.trim())
    .join(' · ');

const aDecimal = (s: string): number => Number.parseFloat(s.replace(',', '.'));
const aEntero = (s: string): number => Number.parseInt(s.replace(/[.,\s]/g, ''), 10);

/**
 * Lee un numero solo si de verdad esta. Devuelve `undefined` para que la clave
 * no viaje: ver la regla de omision en src/domain/insumos.ts.
 */
const ventasDe = (raiz: ParentNode): number | undefined => {
  const m = VENTAS.exec(textos(raiz, VENDEDOR.ventas));
  if (m?.[1] === undefined) return undefined;
  const base = m[2] === undefined ? aEntero(m[1]) : Math.round(aDecimal(m[1]) * 1000);
  return Number.isFinite(base) && base >= 0 ? base : undefined;
};

const puntuacionDe = (raiz: ParentNode): number | undefined => {
  const m = PUNTUACION.exec(texto(raiz, VENDEDOR.puntuacion));
  if (m?.[1] === undefined) return undefined;
  const n = aDecimal(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : undefined;
};

const anioDe = (raiz: ParentNode): number | undefined => {
  const m = ANIO.exec(textos(raiz, VENDEDOR.antiguedad));
  if (m?.[1] === undefined) return undefined;
  const n = Number.parseInt(m[1], 10);
  const actual = new Date().getFullYear();
  // Un año fuera de rango es una lectura fallida, no un vendedor antiguo.
  return n >= 1999 && n <= actual ? n : undefined;
};

/**
 * Nivel del distintivo: 2 basico, 3 intermedio (Gold), 4 maximo (Platinum).
 *
 * La AUSENCIA del distintivo no se traduce a 1 ("sin distintivo"): que la ficha
 * no lo muestre puede significar que el vendedor no lo tiene o que el bloque no
 * llego, y son dos hechos distintos. Se omite.
 */
const distintivoDe = (raiz: ParentNode): { badgeTier?: number; badgeLabel?: string } => {
  const etiqueta = texto(raiz, VENDEDOR.distintivo);
  if (etiqueta === '' || !LIDER.test(etiqueta)) return {};
  const tier = PLATINUM.test(etiqueta) ? 4 : GOLD.test(etiqueta) ? 3 : 2;
  return { badgeTier: tier, badgeLabel: etiqueta };
};

/**
 * Lo que la ficha de Mercado Libre publica sobre el vendedor.
 *
 * Todo campo que no se pueda leer con confianza queda `undefined` y no viaja.
 * No hay ni un valor por defecto en esta funcion, y eso es intencional.
 */
export const datosDelVendedor = (doc: Document): DatosDelVendedor | null => {
  const bloque = primero(doc, VENDEDOR.bloque) ?? doc;
  const sellerName = texto(doc, VENDEDOR.nombre);
  // Sin identificar al vendedor no tiene sentido preguntar por su reputacion.
  if (sellerName === '') return null;

  const { badgeTier, badgeLabel } = distintivoDe(bloque);
  const anio = anioDe(bloque);
  const ventas = ventasDe(bloque);
  const puntuacion = puntuacionDe(bloque);

  // El spread condicional NO es estilo: con `exactOptionalPropertyTypes` el
  // compilador rechaza asignar `undefined` a un campo opcional, asi que la
  // regla de omision queda verificada en tiempo de compilacion y no solo por
  // convencion.
  //
  // Reclamos, cancelaciones y entregas a tiempo NO estan en la ficha del
  // producto: viven en la pagina de reputacion del vendedor, y visitarla seria
  // navegacion automatizada. Se omiten a proposito, no por no encontrarlos.
  return {
    sellerName,
    platform: 'Mercado Libre',
    ...(anio !== undefined && { memberSinceYear: anio }),
    ...(ventas !== undefined && { completedSales: ventas }),
    ...(badgeTier !== undefined && { badgeTier }),
    ...(badgeLabel !== undefined && { badgeLabel }),
    ...(puntuacion !== undefined && { ratingAverage: puntuacion }),
  };
};

/** Estrellas de una opinion, si la ficha las muestra. */
const estrellasDe = (comentario: Element): number | undefined => {
  const contenedor = comentario.closest('article, li, div') ?? comentario;
  for (const sel of RESENAS.estrellas) {
    const el = contenedor.querySelector(sel);
    const bruto = `${el?.getAttribute('aria-label') ?? ''} ${el?.textContent ?? ''}`;
    const m = /([0-5])\s*(?:de|\/|out of)?\s*5?/.exec(bruto);
    if (m?.[1] !== undefined) {
      const n = Number.parseInt(m[1], 10);
      if (n >= 0 && n <= 5) return n;
    }
  }
  return undefined;
};

/**
 * Las opiniones que el navegador YA renderizo.
 *
 * No se pagina ni se pide nada: si la ficha muestra tres, se mandan tres, y el
 * analizador informa su propia cobertura. Ir a buscar el resto seria scraping.
 */
export const resenasVisibles = (doc: Document): readonly ResenaLeida[] => {
  const salida: ResenaLeida[] = [];
  const vistos = new Set<string>();

  for (const el of todos(doc, RESENAS.comentario)) {
    const text = el.textContent.trim();
    if (text.length < 3 || vistos.has(text)) continue;
    vistos.add(text);
    const rating = estrellasDe(el);
    salida.push(rating === undefined ? { text } : { text, rating });
  }
  return salida;
};

/** Ultima miga de pan: la categoria mas especifica. */
export const categoriaDe = (doc: Document): string => {
  const migas = todos(doc, RESENAS.categoria);
  const ultima = migas.at(-1);
  return ultima?.textContent.trim() ?? '';
};

/**
 * Los dos primeros escalones de las migas de pan.
 *
 * Los PRIMEROS y no el ultimo: son los generales ("Electronica, Audio y Video",
 * "Audio"), y son los unicos que la analitica puede emitir. El ultimo escalon
 * describe el producto concreto y se queda en el navegador.
 */
export const categoriaGruesaDe = (doc: Document): string =>
  todos(doc, RESENAS.categoria)
    .slice(0, 2)
    .map((e) => e.textContent.trim())
    .filter((t) => t !== '')
    .join('/');

export const insumosDeMercadoLibre = (doc: Document): Insumos => ({
  vendedor: datosDelVendedor(doc),
  resenas: resenasVisibles(doc),
  categoria: categoriaDe(doc),
});
