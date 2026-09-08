import {
  conocido,
  indeterminado,
  type FeatureSet,
  type Ordinal,
} from '../../../domain/features.js';
import type {
  MarketplaceAdapter,
  Publicacion,
  TarjetaListado,
} from '../../MarketplaceAdapter.js';
import { leerProducto } from './jsonLd.js';
import {
  ANCLA_BADGE,
  TARJETAS,
  primero,
  SELECTORS,
  textoDe,
} from './selectors.js';

/**
 * MLA123456789, MPE123456789, y la variante de catalogo con U intercalada:
 * MPEU3173976853. La U aparece en las fichas /up/ y sin ella el reconocimiento
 * falla justo en las publicaciones mas comunes.
 */
const ID_PUBLICACION = /\b(ML[A-Z]|MPE|MCO|MLC)U?-?(\d{6,})\b/;

/**
 * "4.8" o "4,8" dentro de un texto cualquiera.
 * El cuantificador es `\d+` y no `\d`: con un solo digito, un texto como "48"
 * capturaba "4" y se aceptaba como puntuacion valida en silencio.
 */
const PUNTUACION = /(\d+(?:[.,]\d+)?)\s*(?:de\s*5)?/;

/** "+500 vendidos", "1.2mil vendidos", "12 vendidos", "+5 ventas". */
const VENTAS = /([\d.,]+)\s*(mil|k)?\s*(?:vendid|venta)/i;

/**
 * "Garantia de fabrica: 12 meses", "Garantia del vendedor: 1 años".
 * En la ficha real la garantia aparece al final de la descripcion, no en un
 * nodo propio.
 */
const GARANTIA_TEXTO = /garant[ií]a\s+(?:de\s+f[aá]brica|del\s+vendedor)/i;

/** "4.8" o "4,8" -> 4.8. Para valores con parte decimal. */
const aDecimal = (s: string): number | null => {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** "1.250" o "1,250" -> 1250. Para enteros con separador de millar. */
const aEntero = (s: string): number | null => {
  const n = Number.parseInt(s.replace(/[.,]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

export class MercadoLibreAdapter implements MarketplaceAdapter {
  readonly plataforma = 'Mercado Libre';

  esPlataforma(url: URL): boolean {
    return url.hostname.includes('mercadolibre.');
  }

  reconoce(url: URL): boolean {
    return this.esPlataforma(url) && ID_PUBLICACION.test(url.href);
  }

  identificar(url: URL): Publicacion | null {
    const m = ID_PUBLICACION.exec(url.href);
    if (m === null) return null;
    // Se normaliza sin el guion: /up/MPEU3173976853 y /MPE-123456789 conviven.
    return { plataforma: this.plataforma, publicacionId: m[0].replace('-', '') };
  }

  anclaBadge(doc: Document): Element | null {
    return primero(doc, ANCLA_BADGE);
  }

  /**
   * Tarjetas de listado y carrusel.
   *
   * No se buscan por nombre de clase sino por sus enlaces: el patron de URL de
   * una ficha ("/MPE123456789", "/up/MPEU3173976853") es parte del esquema
   * publico de la plataforma y sobrevive a las remaquetaciones, mientras que las
   * clases CSS cambian sin aviso. De cada enlace se sube al contenedor que
   * parece la tarjeta.
   */
  tarjetas(doc: Document): readonly TarjetaListado[] {
    const porContenedor = new Map<Element, TarjetaListado>();

    for (const a of doc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (!ID_PUBLICACION.test(href)) continue;

      const contenedor = this.#contenedorDeTarjeta(a);
      if (contenedor === null || porContenedor.has(contenedor)) continue;
      porContenedor.set(contenedor, { elemento: contenedor, href });
    }
    return [...porContenedor.values()];
  }

  /** Sube desde el enlace hasta el nodo que hace de tarjeta. */
  #contenedorDeTarjeta(enlace: Element): Element | null {
    let n: Element | null = enlace;
    for (let i = 0; i < 6 && n !== null; i += 1) {
      if (n.matches(TARJETAS.join(','))) return n;
      n = n.parentElement;
    }
    return null;
  }

  /**
   * Cada caracteristica se resuelve de forma independiente: que una falle no
   * afecta a las demas, y ninguna lanza.
   */
  extraer(doc: Document): FeatureSet {
    return {
      proteccionDePago: this.#proteccionDePago(doc),
      puntuacionDelProducto: this.#puntuacion(doc),
      presenciaDeResenas: this.#presenciaDeResenas(doc),
      politicasDeGarantia: this.#garantia(doc),
      volumenDeVentas: this.#ventas(doc),

      // Las tres de backend no se resuelven en el cliente, por diseno.
      veracidadDeDominio: indeterminado('La resuelve el motor de riesgo.'),
      reputacionDelVendedor: indeterminado('La resuelve el motor de riesgo.'),
      autenticidadDeResenas: indeterminado('La resuelve el motor de riesgo.'),
    };
  }

  #proteccionDePago(doc: Document): FeatureSet['proteccionDePago'] {
    const el = primero(doc, SELECTORS.proteccionDePago);
    if (el === null) {
      // Ausencia del enlace no prueba que el pago sea inseguro: solo que la
      // pagina no lo declara. Ese matiz es el nucleo del modelo de tres estados.
      return indeterminado('La publicacion no declara proteccion de pago de forma verificable.');
    }
    return conocido('declarada', 'La publicacion enlaza a la compra protegida de la plataforma.');
  }

  #puntuacion(doc: Document): FeatureSet['puntuacionDelProducto'] {
    // Los datos estructurados de la pagina son mas estables que las clases CSS.
    const ld = leerProducto(doc);
    if (ld?.ratingValue !== undefined && ld.ratingValue >= 0 && ld.ratingValue <= 5) {
      return conocido(
        ld.ratingValue,
        `Puntuacion promedio de ${String(ld.ratingValue)} sobre 5 segun los datos de la pagina.`,
      );
    }

    const texto = textoDe(primero(doc, SELECTORS.puntuacion));
    if (texto === '') return indeterminado('No se encontro la puntuacion en la pagina.');

    const m = PUNTUACION.exec(texto);
    const n = m?.[1] !== undefined ? aDecimal(m[1]) : null;
    if (n === null || n < 0 || n > 5) {
      return indeterminado(`La puntuacion leida no es interpretable: "${texto}".`);
    }
    return conocido(n, `Puntuacion promedio de ${String(n)} sobre 5 segun la pagina.`);
  }

  #presenciaDeResenas(doc: Document): FeatureSet['presenciaDeResenas'] {
    const ld = leerProducto(doc);
    const conteo = ld?.reviewCount ?? ld?.ratingCount;
    if (conteo !== undefined) {
      return conocido(conteo > 0, `La pagina declara ${String(conteo)} opiniones.`);
    }

    const bloque = primero(doc, SELECTORS.bloqueResenas);
    const cantidad = textoDe(primero(doc, SELECTORS.cantidadResenas));

    if (bloque === null && cantidad === '') {
      return indeterminado('No se encontro la seccion de opiniones.');
    }
    const m = /(\d[\d.,]*)/.exec(cantidad);
    const n = m?.[1] !== undefined ? aEntero(m[1]) : null;
    if (n !== null) {
      return conocido(n > 0, `La publicacion declara ${String(n)} opiniones.`);
    }
    return conocido(bloque !== null, 'La pagina muestra una seccion de opiniones.');
  }

  #garantia(doc: Document): FeatureSet['politicasDeGarantia'] {
    const el = primero(doc, SELECTORS.garantia);
    if (el !== null) {
      return conocido<Ordinal>(2, `La publicacion declara garantia: "${textoDe(el)}".`);
    }
    const ficha = textoDe(primero(doc, SELECTORS.garantiaTexto));
    if (GARANTIA_TEXTO.test(ficha)) {
      return conocido<Ordinal>(1, 'La ficha tecnica menciona una garantia.');
    }
    return indeterminado('La publicacion no declara politicas de garantia de forma verificable.');
  }

  #ventas(doc: Document): FeatureSet['volumenDeVentas'] {
    const texto = textoDe(primero(doc, SELECTORS.ventas));
    if (texto === '') return indeterminado('No se encontro el subtitulo con las ventas.');

    const m = VENTAS.exec(texto);
    if (m?.[1] === undefined) {
      return indeterminado(`El subtitulo no declara ventas: "${texto}".`);
    }
    // Con sufijo ("1.2mil") el numero es decimal; sin el ("1.250") los puntos
    // son separador de millar. Confundirlos convierte 1.2mil en 12.
    const base = m[2] !== undefined ? aDecimal(m[1]) : aEntero(m[1]);
    if (base === null) return indeterminado(`Cantidad de ventas no interpretable: "${texto}".`);

    const n = m[2] !== undefined ? Math.round(base * 1000) : Math.round(base);
    return conocido(n, `La publicacion declara aproximadamente ${String(n)} ventas.`);
  }
}
