/**
 * Lectura del estado que Facebook incrusta en la pagina.
 *
 * Facebook ofusca sus clases y monta la pagina con Relay: lo estable no es el
 * DOM sino el JSON que viene dentro de los `<script>` de la propia pagina
 * (`marketplace_followers`, `five_star_ratings_average`, ...). Es la misma
 * fuente que leia el scraper por URL del backend (`FacebookHelper`), y la misma
 * idea que ya usamos en Temu.
 *
 * Aqui NO se interpretan caracteristicas: eso lo hace el backend sobre el
 * documento que la extension le entrega (docs/adr/0004). Lo que se lee aqui es
 * lo minimo para la reputacion, las resenas y el enlace al perfil.
 *
 * Verificado contra una publicacion real de facebook.com/marketplace el
 * 2026-09-21, SIN sesion iniciada. Lo del vendedor (`marketplace_listing_seller`)
 * llega en null mientras no haya sesion, asi que esos patrones siguen sin
 * verificar y estan marcados uno por uno.
 *
 * La pagina trae los datos de MUCHAS publicaciones (las relacionadas: 22 en la
 * que se verifico). Por eso nada se busca en el texto entero: primero se acota
 * al registro de ESTA publicacion con `bloqueDeLaFicha`, y ahi dentro se lee.
 * Buscar suelto devolvia el titulo y el precio de otro anuncio.
 */

/** Todo el texto de los scripts embebidos, que es donde vive el estado. */
export const textoEmbebido = (doc: Document): string => {
  const partes: string[] = [];
  for (const script of doc.querySelectorAll('script:not([src])')) {
    const t = script.textContent;
    if (t.length > 0) partes.push(t);
  }
  return partes.join('\n');
};

/** Primer grupo capturado del patron, o undefined. */
const capturar = (texto: string, patron: RegExp): string | undefined =>
  patron.exec(texto)?.[1];

const numero = (crudo: string | undefined): number | undefined => {
  if (crudo === undefined) return undefined;
  const n = Number.parseFloat(crudo);
  return Number.isFinite(n) ? n : undefined;
};

/** Facebook escapa el JSON embebido: "Calificación" y similares. */
const desescapar = (crudo: string): string =>
  crudo.replace(/\\u([\dA-Fa-f]{4})/g, (_, c: string) =>
    String.fromCharCode(Number.parseInt(c, 16)),
  );

/** Hasta donde se busca hacia atras el comienzo del registro. */
const MAX_RETROCESO = 20000;

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

/** Comienzo del objeto que envuelve a `indice`, mirando hacia atras. */
const inicioDelObjeto = (texto: string, indice: number): number => {
  let profundidad = 0;
  const tope = Math.max(0, indice - MAX_RETROCESO);
  for (let i = indice; i >= tope; i -= 1) {
    const c = texto[i];
    if (c === '}') profundidad += 1;
    else if (c === '{') {
      if (profundidad === 0) return i;
      profundidad -= 1;
    }
  }
  return -1;
};

/**
 * El registro que describe ESTA publicacion, acotado a su objeto JSON.
 *
 * Facebook normaliza sus datos en registros sueltos y la pagina trae los de
 * muchas publicaciones (22 en la que se verifico). El registro bueno es el que
 * esta junto al id y trae el titulo: por eso se recorta el objeto entero, y no
 * una ventana de caracteres, que mezclaba una publicacion con la siguiente.
 *
 * Devuelve cadena vacia si no se encuentra: no leer nada es mejor que leer otro
 * anuncio.
 */
export const bloqueDeLaFicha = (texto: string, publicacionId: string): string => {
  const marca = `"${publicacionId}"`;
  for (let i = texto.indexOf(marca); i >= 0; i = texto.indexOf(marca, i + 1)) {
    const registro = inicioDelObjeto(texto, i);
    if (registro < 0) continue;
    const fin = finDelObjeto(texto, registro);
    if (fin < 0 || !texto.slice(registro, fin + 1).includes('"marketplace_listing_title"')) continue;

    // El registro del titulo es diminuto: el precio, la descripcion, la categoria
    // y el vendedor cuelgan del objeto de UN NIVEL ARRIBA. Verificado el
    // 2026-09-21: ahi estan los cuatro y no entra ninguna publicacion vecina.
    const padre = inicioDelObjeto(texto, registro - 1);
    if (padre < 0) return texto.slice(registro, fin + 1);
    const finDelPadre = finDelObjeto(texto, padre);
    return finDelPadre < 0 ? texto.slice(registro, fin + 1) : texto.slice(padre, finDelPadre + 1);
  }
  return '';
};

/**
 * El bloque del visor de fotos (`marketplace_product_details_page` → `target`),
 * que es el unico que las trae y ya viene acotado a esta publicacion.
 */
export const bloqueDeLasFotos = (texto: string): string => {
  const pdp = texto.indexOf('"marketplace_product_details_page"');
  if (pdp < 0) return '';
  const objetivo = texto.indexOf('"target":{', pdp);
  if (objetivo < 0) return '';
  const inicio = texto.indexOf('{', objetivo + '"target":'.length - 1);
  const fin = finDelObjeto(texto, inicio);
  return fin < 0 ? '' : texto.slice(inicio, fin + 1);
};

export const PATRONES = {
  /**
   * Id del perfil del vendedor dentro de la ficha. Facebook escapa las barras en
   * su JSON (`marketplace\/profile\/`), asi que la barra puede venir escapada.
   */
  perfil: /marketplace\\?\/profile\\?\/(\d{10,17})/,
  /**
   * El mismo id, cuando solo viene dentro del objeto del vendedor. En la ficha
   * la clave es `marketplace_listing_seller`; en el perfil, `seller`.
   */
  vendedorId: /"(?:marketplace_listing_)?seller"\s*:\s*\{[^}]{0,300}?"id"\s*:\s*"(\d{10,17})"/,
  seguidores: /"marketplace_followers":\{"count":(\d+)\}/,
  promedio: /"five_star_ratings_average"\s*:\s*([\d.]+)/,
  cuantasCalificaciones:
    /"seller_buyer_combined"\s*:\s*\{[^}]*?"five_star_total_rating_count_by_role"\s*:\s*(\d+)/,
  /** SIN VERIFICAR: el vendedor llega en null sin sesion iniciada. */
  nombre: /"name":"([^"]+)"\},"commerce_badges_info"/,
  nombreCorto: /"short_name":"([^"]+)"/,
  /** "marketplace_listing_category":{"slug":"antiques", ...}. */
  categoria: /"marketplace_listing_category":\{[^}]*?"slug":"([^"]+)"/,
  /** Titulo de la publicacion, ya dentro de su registro. */
  titulo: /"marketplace_listing_title":"([^"]+)"/,
  /**
   * El distintivo del vendedor. Se exige que el arreglo traiga uno: cuando no
   * tiene, Facebook manda `"badges":[]` y buscar un "text" cercano capturaba
   * cualquier otra cosa.
   */
  distintivo: /"commerce_badges_info":\{[^[]*?"badges":\[\{[^\]]{0,400}?"text":"([^"]{3,60})"/,
  /** Fotos de la publicacion. Son `ProductImage`, no `MarketplaceListingPhoto`. */
  foto: /"__typename":"ProductImage"/g,
  precio: /"listing_price":\{[^}]*?"amount":"([\d.]+)"/,
  /** Puede venir en null, y entonces no hay descuento que calcular. */
  precioTachado: /"strikethrough_price":(?:null|\{[^}]*?"amount":"([\d.]+)")/,
  descripcion: /"redacted_description":\{"text":"((?:[^"\\]|\\.)*)"/,
  /** Una publicacion activa del vendedor: ni vendida ni dada de baja. */
  publicacionActiva:
    /"GroupCommerceProductItem","id":"(\d+)"(?:(?!"GroupCommerceProductItem").)*?"is_live":true(?:(?!"GroupCommerceProductItem").)*?"is_sold":false/gs,
  /** Cada valoracion que un comprador dejo al vendedor. */
  bloqueDeResena: /\{"__typename":"MarketplaceC2CSellerRating".{200,3000}?"cursor":/gs,
  textoDeResena: /"review_text":(?:null|"([^"]*)")/,
  estrellas: /"rating_value":"([^"]+)"/,
} as const;

/** "FIVE_STAR_THREE" → 3. */
export const estrellasDe = (valor: string | undefined): number | undefined =>
  ({
    FIVE_STAR_ONE: 1,
    FIVE_STAR_TWO: 2,
    FIVE_STAR_THREE: 3,
    FIVE_STAR_FOUR: 4,
    FIVE_STAR_FIVE: 5,
  })[valor ?? ''];

export const idDelPerfil = (texto: string): string | undefined =>
  capturar(texto, PATRONES.perfil) ?? capturar(texto, PATRONES.vendedorId);

export const seguidores = (texto: string): number | undefined =>
  numero(capturar(texto, PATRONES.seguidores));

/**
 * Promedio del vendedor, de 0 a 5.
 *
 * Un 0 NO es una nota psima: Facebook manda 0 cuando el vendedor no tiene
 * ninguna calificacion. Mandarlo como puntuacion hacia que el analizador de
 * reputacion lo leyera como "0.0 sobre 5, por debajo de lo aceptable" y empujara
 * el veredicto a riesgo alto sin que nadie lo hubiera calificado mal.
 */
export const promedio = (texto: string): number | undefined => {
  const n = numero(capturar(texto, PATRONES.promedio));
  return n !== undefined && n > 0 && n <= 5 ? n : undefined;
};

export const cuantasCalificaciones = (texto: string): number | undefined =>
  numero(capturar(texto, PATRONES.cuantasCalificaciones));

export const nombreDelVendedor = (texto: string): string => {
  const crudo = capturar(texto, PATRONES.nombre) ?? capturar(texto, PATRONES.nombreCorto);
  return crudo === undefined ? '' : desescapar(crudo).trim();
};

export const distintivo = (texto: string): string | undefined => {
  const crudo = capturar(texto, PATRONES.distintivo);
  return crudo === undefined ? undefined : desescapar(crudo).trim();
};

/** La categoria de la publicacion, tal como Facebook la nombra: "antiques". */
export const categoria = (bloque: string): string => {
  const crudo = capturar(bloque, PATRONES.categoria);
  return crudo === undefined ? '' : desescapar(crudo).trim();
};

/**
 * Cuantas fotos trae la publicacion. Se cuentan sobre el bloque del visor: en el
 * registro de la ficha no vienen.
 */
export const cuantasFotos = (texto: string): number =>
  (bloqueDeLasFotos(texto).match(PATRONES.foto) ?? []).length;

/** Descuento en porcentaje, solo si hay precio tachado mayor que el vigente. */
export const descuento = (bloque: string): number | undefined => {
  const ahora = numero(capturar(bloque, PATRONES.precio));
  const antes = numero(capturar(bloque, PATRONES.precioTachado));
  if (ahora === undefined || antes === undefined || antes <= 0 || antes <= ahora) return undefined;
  return Math.round(((antes - ahora) / antes) * 10000) / 100;
};

/** Cuantas publicaciones activas distintas tiene el vendedor en la pagina. */
export const publicacionesActivas = (texto: string): number | undefined => {
  const ids = new Set<string>();
  for (const m of texto.matchAll(PATRONES.publicacionActiva)) {
    if (m[1] !== undefined) ids.add(m[1]);
  }
  return ids.size === 0 ? undefined : ids.size;
};

/** Marcas del perfil del vendedor que vale la pena conservar al recortar. */
const MARCAS_DEL_PERFIL: readonly string[] = [
  '"marketplace_followers"',
  '"five_star_ratings_average"',
  '"five_star_total_rating_count_by_role"',
  '"commerce_badges_info"',
  '"MarketplaceC2CSellerRating"',
  '"GroupCommerceProductItem"',
  '"short_name"',
  '"join_time"',
];

/** Cuanto texto se conserva alrededor de cada marca del perfil. */
const MARGEN = 3000;

/**
 * Recorta el perfil a los trozos que hablan del vendedor.
 *
 * Una pagina de Facebook pesa mas de 10 MB y el analizador acepta 8. Casi todo
 * es codigo y datos de otras cosas: lo unico que se necesita son las ventanas
 * alrededor de estas marcas.
 */
export const recorteDelPerfil = (texto: string): string => {
  const trozos: string[] = [];
  let hasta = 0;
  const cortes: { desde: number; hasta: number }[] = [];

  for (const marca of MARCAS_DEL_PERFIL) {
    for (let i = texto.indexOf(marca); i >= 0; i = texto.indexOf(marca, i + 1)) {
      cortes.push({ desde: Math.max(0, i - MARGEN), hasta: Math.min(texto.length, i + MARGEN) });
      if (cortes.length > 60) break;
    }
  }

  // Se unen los solapados para no repetir el mismo trozo muchas veces.
  cortes.sort((a, b) => a.desde - b.desde);
  for (const corte of cortes) {
    if (corte.hasta <= hasta) continue;
    trozos.push(texto.slice(Math.max(corte.desde, hasta), corte.hasta));
    hasta = corte.hasta;
  }

  return trozos.join('\n');
};

export interface ResenaDelVendedor {
  readonly text: string;
  readonly rating?: number;
}

/**
 * Las valoraciones que los compradores dejaron al vendedor. Solo se leen texto
 * y estrellas: quien las escribio no se lee ni se manda.
 */
export const resenasDelVendedor = (texto: string): readonly ResenaDelVendedor[] => {
  const salida: ResenaDelVendedor[] = [];
  const vistos = new Set<string>();
  for (const bloque of texto.matchAll(PATRONES.bloqueDeResena)) {
    const crudo = PATRONES.textoDeResena.exec(bloque[0])?.[1];
    if (crudo === undefined) continue;
    const text = desescapar(crudo).trim();
    if (text.length < 3 || vistos.has(text)) continue;
    vistos.add(text);
    const rating = estrellasDe(PATRONES.estrellas.exec(bloque[0])?.[1]);
    salida.push(rating === undefined ? { text } : { text, rating });
  }
  return salida;
};
