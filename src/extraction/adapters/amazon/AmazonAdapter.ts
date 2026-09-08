import {
  conocido,
  indeterminado,
  type FeatureSet,
  type FeatureValue,
  type Ordinal,
  type ProteccionDePago,
} from '../../../domain/features.js';
import { aCantidad, aDecimal, atributoEn, primero, textoEn, todos } from '../../dom.js';
import type { MarketplaceAdapter, Publicacion, TarjetaListado } from '../../MarketplaceAdapter.js';
import { ANCLA_BADGE, ENLACE_FICHA, SELECTORS, TARJETAS } from './selectors.js';

/** ASIN: 10 alfanumericos, casi siempre B0 + 8. */
const ASIN = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/;

/** "4.5 out of 5" / "4,5 de 5" / "4.5 de 5 estrellas". */
const PUNTUACION = /(\d+(?:[.,]\d+)?)\s*(?:out of|de)\s*5/i;
/** "1,234 ratings" / "1.234 calificaciones" / "1234 valoraciones". */
const RESENAS = /([\d.,]+)\s*(?:ratings?|reviews?|calificaciones|valoraciones|opiniones)/i;
/** "500+ bought in past month" / "mas de 500 compras el mes pasado". */
const COMPRAS = /([\d.,]+)\s*(mil|k|m)?\+?\s*(?:bought|compras|comprados)/i;

/**
 * Adaptador de Amazon.
 *
 * Solo lee el documento renderizado. Amazon no publica JSON-LD de producto, asi
 * que todo sale de los selectores de `selectors.ts`, con cascadas y degradacion
 * a `indeterminado` cuando ninguno matchea.
 */
export class AmazonAdapter implements MarketplaceAdapter {
  readonly plataforma = 'Amazon';

  esPlataforma(url: URL): boolean {
    return /(^|\.)amazon\./i.test(url.hostname);
  }

  reconoce(url: URL): boolean {
    return this.esPlataforma(url) && ASIN.test(url.pathname);
  }

  identificar(url: URL): Publicacion | null {
    const m = ASIN.exec(url.pathname);
    if (!this.esPlataforma(url) || m?.[1] === undefined) return null;
    return { plataforma: this.plataforma, publicacionId: m[1] };
  }

  anclaBadge(doc: Document): Element | null {
    return primero(doc, ANCLA_BADGE);
  }

  tarjetas(doc: Document): readonly TarjetaListado[] {
    const vistos = new Set<string>();
    const salida: TarjetaListado[] = [];
    for (const tarjeta of todos(doc, TARJETAS)) {
      const enlace = tarjeta.querySelector<HTMLAnchorElement>(ENLACE_FICHA);
      const href = enlace?.href ?? '';
      if (href === '' || vistos.has(href)) continue;
      vistos.add(href);
      salida.push({ elemento: tarjeta, href });
    }
    return salida;
  }

  extraer(doc: Document): FeatureSet {
    return {
      proteccionDePago: this.#proteccionDePago(doc),
      puntuacionDelProducto: this.#puntuacion(doc),
      presenciaDeResenas: this.#presenciaDeResenas(doc),
      politicasDeGarantia: this.#garantia(doc),
      volumenDeVentas: this.#ventas(doc),
      // Las tres de backend no se tocan aqui: las resuelve el motor de riesgo.
      veracidadDeDominio: indeterminado('La resuelve el motor de riesgo.'),
      reputacionDelVendedor: indeterminado('La resuelve el motor de riesgo.'),
      autenticidadDeResenas: indeterminado('La resuelve el motor de riesgo.'),
    };
  }

  #proteccionDePago(doc: Document): FeatureValue<ProteccionDePago> {
    const el = primero(doc, SELECTORS.proteccionDePago);
    if (el === null) {
      return indeterminado('La ficha no muestra informacion sobre la seguridad del pago.');
    }
    return conocido('declarada', 'La ficha declara transaccion segura a traves de Amazon.');
  }

  #puntuacion(doc: Document): FeatureValue<number> {
    // El valor vive en `title`/`aria-label` antes que en el texto visible.
    for (const atributo of SELECTORS.puntuacionAtributos) {
      const bruto = atributoEn(doc, SELECTORS.puntuacion, atributo);
      const valor = this.#leerPuntuacion(bruto);
      if (valor !== null) return valor;
    }
    const valor = this.#leerPuntuacion(textoEn(doc, SELECTORS.puntuacion));
    return valor ?? indeterminado('No se encontro la puntuacion promedio en la ficha.');
  }

  #leerPuntuacion(bruto: string): FeatureValue<number> | null {
    const m = PUNTUACION.exec(bruto);
    if (m?.[1] === undefined) return null;
    const n = aDecimal(m[1]);
    if (!Number.isFinite(n) || n < 0 || n > 5) return null;
    return conocido(n, `Puntuacion promedio de ${String(n)} sobre 5 segun la ficha.`);
  }

  #presenciaDeResenas(doc: Document): FeatureValue<boolean> {
    const m = RESENAS.exec(textoEn(doc, SELECTORS.cantidadResenas));
    if (m?.[1] !== undefined) {
      const n = aCantidad(m[1]);
      if (Number.isFinite(n)) {
        return conocido(n > 0, `La ficha declara ${String(n)} valoraciones.`);
      }
    }
    if (primero(doc, SELECTORS.bloqueResenas) !== null) {
      return conocido(true, 'La ficha incluye la seccion de opiniones de clientes.');
    }
    return indeterminado('No se encontro la seccion de opiniones en la ficha.');
  }

  #garantia(doc: Document): FeatureValue<Ordinal> {
    if (primero(doc, SELECTORS.garantia) === null) {
      return indeterminado('La ficha no declara politica de devolucion ni garantia.');
    }
    return conocido(2, 'La ficha declara politica de devolucion a traves de Amazon.');
  }

  #ventas(doc: Document): FeatureValue<number> {
    const m = COMPRAS.exec(textoEn(doc, SELECTORS.ventas));
    if (m?.[1] === undefined) {
      // Amazon no siempre muestra la prueba social. Que no este no significa
      // que sean cero ventas: eso seria inventar una observacion negativa.
      return indeterminado('La ficha no declara cuantas unidades se compraron.');
    }
    const n = aCantidad(`${m[1]}${m[2] ?? ''}`);
    if (!Number.isFinite(n)) {
      return indeterminado('No se pudo interpretar la cantidad de compras declarada.');
    }
    return conocido(n, `La ficha declara alrededor de ${String(n)} compras en el ultimo mes.`);
  }
}
