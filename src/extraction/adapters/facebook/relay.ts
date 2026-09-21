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
 * PENDIENTE DE VERIFICAR contra una ficha real: los patrones vienen del scraper
 * anterior y Facebook los cambia seguido. Por eso todos estan en este archivo.
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

export const PATRONES = {
  /** Id del perfil del vendedor dentro de la ficha. */
  perfil: /marketplace\/profile\/(\d{10,17})/,
  /** El mismo id, cuando solo viene dentro del objeto del vendedor. */
  vendedorId: /"seller"\s*:\s*\{[^}]*?"id"\s*:\s*"(\d{10,17})"/,
  seguidores: /"marketplace_followers":\{"count":(\d+)\}/,
  promedio: /"five_star_ratings_average"\s*:\s*([\d.]+)/,
  cuantasCalificaciones:
    /"seller_buyer_combined"\s*:\s*\{[^}]*?"five_star_total_rating_count_by_role"\s*:\s*(\d+)/,
  nombre: /"name":"([^"]+)"\},"commerce_badges_info"/,
  nombreCorto: /"short_name":"([^"]+)"/,
  categoria: /"name":"([^"]+)","seo_info":/,
  /** El distintivo que Facebook da al vendedor, p. ej. "Calificacion alta". */
  distintivo: /"commerce_badges_info"[\s\S]{0,400}?"text"\s*:\s*"([^"]{3,60})"/,
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

export const promedio = (texto: string): number | undefined => {
  const n = numero(capturar(texto, PATRONES.promedio));
  return n !== undefined && n >= 0 && n <= 5 ? n : undefined;
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

export const categoria = (texto: string): string => {
  const crudo = capturar(texto, PATRONES.categoria);
  return crudo === undefined ? '' : desescapar(crudo).trim();
};

/** Cuantas publicaciones activas distintas tiene el vendedor en la pagina. */
export const publicacionesActivas = (texto: string): number | undefined => {
  const ids = new Set<string>();
  for (const m of texto.matchAll(PATRONES.publicacionActiva)) {
    if (m[1] !== undefined) ids.add(m[1]);
  }
  return ids.size === 0 ? undefined : ids.size;
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
