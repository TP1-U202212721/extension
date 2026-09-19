import type { DatosDelVendedor, Insumos, ResenaLeida } from '../../../domain/insumos.js';
import { SIN_INSUMOS } from '../../../domain/insumos.js';

/**
 * Insumos de los analizadores de reputacion y de resenas para Temu.
 *
 * Temu ofusca sus clases, asi que no se leen del DOM: se leen del estado inicial
 * que la ficha incrusta en un script inline, `window.rawData={"store":{...}}`. El
 * content script no ve las variables de la pagina, pero si el texto del script.
 * Es la misma fuente que usa el backend en TemuDocumentExtractor: si Temu cambia
 * la forma de esos datos, hay que corregir los dos (docs/adr/0006).
 *
 * Verificado contra una ficha real de temu.com/pe-en el 2026-09-19.
 */

type Json = Record<string, unknown>;

const esObjeto = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const en = (raiz: unknown, ...claves: string[]): unknown =>
  claves.reduce<unknown>((v, k) => (esObjeto(v) ? v[k] : undefined), raiz);

/** Temu manda algunos numeros como cadena ("4.8", "1,620"). */
const numero = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = Number.parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const cadena = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;

/** Indice de la llave que cierra el objeto que abre en `inicio`, respetando cadenas. */
const finDelObjeto = (texto: string, inicio: number): number => {
  let profundidad = 0;
  let enCadena = false;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) {
      if (c === '\\') i += 1;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') enCadena = true;
    else if (c === '{') profundidad += 1;
    else if (c === '}') {
      profundidad -= 1;
      if (profundidad === 0) return i;
    }
  }
  return -1;
};

/** El `store` del estado inicial, o null si la ficha no lo trae o no es JSON. */
export const estadoInicial = (doc: Document): Json | null => {
  for (const script of doc.querySelectorAll('script:not([src])')) {
    const texto = script.textContent;
    const m = /window\.rawData\s*=\s*\{/.exec(texto);
    if (m === null) continue;
    const inicio = m.index + m[0].length - 1;
    const fin = finDelObjeto(texto, inicio);
    if (fin < 0) return null;
    try {
      const store = en(JSON.parse(texto.slice(inicio, fin + 1)), 'store');
      return esObjeto(store) ? store : null;
    } catch {
      return null;
    }
  }
  return null;
};

const ID_EN_URL = /-g-(\d{6,})\.html/;

/**
 * Temu navega entre fichas sin recargar: el script puede ser del producto
 * anterior. Si la URL y los datos dicen goods id distintos, no se usa nada.
 */
const esDeEstaFicha = (store: Json, doc: Document): boolean => {
  const enUrl = ID_EN_URL.exec(doc.URL)?.[1];
  const enDatos = cadena(en(store, 'goods', 'goodsId')) ?? cadena(store.goodsId);
  return enUrl === undefined || enDatos === undefined || enUrl === enDatos;
};

/** "83K+" → 83000, "1.2K+" → 1200, "856" → 856. */
const cantidad = (v: unknown): number | undefined => {
  const m = /([\d.,]+)\s*(k)?/i.exec(cadena(v) ?? '');
  if (m?.[1] === undefined) return undefined;
  const n = Number.parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(m[2] === undefined ? n : n * 1000);
};

/**
 * Lo que la ficha de Temu publica sobre la TIENDA: puntuacion (0 a 5), cuantas
 * valoraciones la sostienen y cuanto lleva vendido. No publica antiguedad ni un
 * distintivo equivalente al MercadoLider: se omiten. Una tienda sin valoraciones
 * trae 0 estrellas; eso no es una mala puntuacion y tambien se omite.
 */
const datosDelVendedor = (store: Json): DatosDelVendedor | null => {
  const tienda = en(store, 'mall', 'mallData');
  const sellerName = cadena(en(tienda, 'mallName'))?.trim() ?? '';
  if (sellerName === '') return null;

  const estrellas = numero(en(tienda, 'mallStar'));
  const valoraciones =
    numero(en(store, 'reviewStore', 'mallReview', 'reviewNum')) ?? numero(en(tienda, 'reviewNumStr'));
  // ["83K+", "Sold"]: el numero y su rotulo por separado.
  const unidad = en(tienda, 'goodsSalesNumUnit');
  const ventas = Array.isArray(unidad) ? cantidad(unidad[0]) : undefined;

  return {
    sellerName,
    platform: 'Temu',
    ...(estrellas !== undefined && estrellas > 0 && estrellas <= 5 && { ratingAverage: estrellas }),
    ...(valoraciones !== undefined && valoraciones >= 0 && { ratingCount: valoraciones }),
    ...(ventas !== undefined && { completedSales: ventas }),
  };
};

/** Las resenas que trae la ficha. La autoria no se lee. */
const resenas = (store: Json): readonly ResenaLeida[] => {
  const lista = en(store, 'review', 'reviewData', 'reviewInfoList');
  if (!Array.isArray(lista)) return [];
  const salida: ResenaLeida[] = [];
  const vistos = new Set<string>();
  for (const item of lista) {
    const text = cadena(en(item, 'comment'))?.trim() ?? '';
    if (text.length < 3 || vistos.has(text)) continue;
    vistos.add(text);
    const rating = numero(en(item, 'score'));
    salida.push(rating !== undefined && rating >= 1 && rating <= 5 ? { text, rating } : { text });
  }
  return salida;
};

/** Escalones de las migas, sin "Home" (optId negativo). */
const migas = (store: Json): readonly string[] => {
  const lista = store.crumbOptList;
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((c) => (numero(en(c, 'optId')) ?? 0) >= 0)
    .map((c) => cadena(en(c, 'optName'))?.trim() ?? '')
    .filter((t) => t !== '');
};

const vigente = (doc: Document): Json | null => {
  const store = estadoInicial(doc);
  return store !== null && esDeEstaFicha(store, doc) ? store : null;
};

export const categoriaGruesaDe = (doc: Document): string => {
  const store = vigente(doc);
  return store === null ? '' : migas(store).slice(0, 2).join('/');
};

export const insumosDe = (doc: Document): Insumos => {
  const store = vigente(doc);
  if (store === null) return SIN_INSUMOS;
  return {
    vendedor: datosDelVendedor(store),
    resenas: resenas(store),
    categoria: migas(store).at(-1) ?? '',
  };
};
