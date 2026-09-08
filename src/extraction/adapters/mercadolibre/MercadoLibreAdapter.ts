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
import {
  ANCLA_BADGE,
  TARJETAS,
  TARJETA_ENLACE,
  primero,
  primero2,
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

/** "+500 vendidos", "1.2mil vendidos", "12 vendidos". */
const VENTAS = /([\d.,]+)\s*(mil|k)?\s*vendid/i;

/** "Garantia de fabrica: 12 meses", "Garantia del vendedor: 30 dias". */
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

  reconoce(url: URL): boolean {
    return url.hostname.includes('mercadolibre.') && ID_PUBLICACION.test(url.href);
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

  tarjetas(doc: Document): readonly TarjetaListado[] {
    const vistas = new Set<Element>();
    const salida: TarjetaListado[] = [];

    for (const sel of TARJETAS) {
      for (const el of doc.querySelectorAll(sel)) {
        if (vistas.has(el)) continue;
        vistas.add(el);

        const enlace = primero2(el, TARJETA_ENLACE);
        const href = enlace?.getAttribute('href') ?? '';
        // Sin un enlace a una ficha reconocible, la tarjeta se ignora: el badge
        // solo tiene sentido si hay adonde ir.
        if (href === '' || !ID_PUBLICACION.test(href)) continue;

        salida.push({ elemento: el, href });
      }
    }
    return salida;
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
