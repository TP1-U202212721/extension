import {
  conocido,
  indeterminado,
  type FeatureSet,
  type FeatureValue,
  type Ordinal,
  type ProteccionDePago,
} from '../../../domain/features.js';
import { aCantidad, aDecimal, primero, textoEn, todos } from '../../dom.js';
import { leerProducto } from '../../jsonLd.js';
import type { MarketplaceAdapter, Publicacion, TarjetaListado } from '../../MarketplaceAdapter.js';
import { ANCLA_BADGE, ENLACE_FICHA, SELECTORS, TARJETAS } from './selectors.js';

/** Numero de articulo de eBay: 11 o 12 digitos en /itm/. */
const ITEM = /\/itm\/(?:.*\/)?(\d{11,12})(?:[/?]|$)/;

const PUNTUACION = /(\d+(?:[.,]\d+)?)/;
const RESENAS = /([\d.,]+)\s*(?:product )?(?:ratings?|reviews?|valoraciones|opiniones)/i;
/** "123 sold" / "123 vendidos" / "Mas de 10 vendidos". */
const VENDIDOS = /([\d.,]+)\s*(mil|k|m)?\+?\s*(?:sold|vendidos?)/i;

/**
 * Adaptador de eBay.
 *
 * Prioriza el JSON-LD que eBay publica en la ficha sobre los selectores CSS,
 * por la misma razon que en MercadoLibre: los datos estructurados son un
 * contrato que la plataforma mantiene para los buscadores, las clases no.
 */
export class EbayAdapter implements MarketplaceAdapter {
  readonly plataforma = 'eBay';

  esPlataforma(url: URL): boolean {
    return /(^|\.)ebay\./i.test(url.hostname);
  }

  reconoce(url: URL): boolean {
    return this.esPlataforma(url) && ITEM.test(url.pathname);
  }

  identificar(url: URL): Publicacion | null {
    const m = ITEM.exec(url.pathname);
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
    const ld = leerProducto(doc);
    return {
      proteccionDePago: this.#proteccionDePago(doc),
      puntuacionDelProducto: this.#puntuacion(doc, ld?.ratingValue),
      presenciaDeResenas: this.#presenciaDeResenas(doc, ld?.ratingCount ?? ld?.reviewCount),
      politicasDeGarantia: this.#garantia(doc),
      volumenDeVentas: this.#ventas(doc),
      veracidadDeDominio: indeterminado('La resuelve el motor de riesgo.'),
      reputacionDelVendedor: indeterminado('La resuelve el motor de riesgo.'),
      autenticidadDeResenas: indeterminado('La resuelve el motor de riesgo.'),
    };
  }

  #proteccionDePago(doc: Document): FeatureValue<ProteccionDePago> {
    if (primero(doc, SELECTORS.proteccionDePago) === null) {
      return indeterminado('La ficha no menciona la garantia de devolucion del dinero.');
    }
    return conocido('declarada', 'La ficha declara la garantia de devolucion del dinero de eBay.');
  }

  #puntuacion(doc: Document, deLd: number | undefined): FeatureValue<number> {
    if (deLd !== undefined && deLd >= 0 && deLd <= 5) {
      return conocido(deLd, `Puntuacion promedio de ${String(deLd)} sobre 5 segun la ficha.`);
    }
    const m = PUNTUACION.exec(textoEn(doc, SELECTORS.puntuacion));
    if (m?.[1] === undefined) {
      return indeterminado('No se encontro la puntuacion promedio en la ficha.');
    }
    const n = aDecimal(m[1]);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      return indeterminado('No se pudo interpretar la puntuacion de la ficha.');
    }
    return conocido(n, `Puntuacion promedio de ${String(n)} sobre 5 segun la ficha.`);
  }

  #presenciaDeResenas(doc: Document, deLd: number | undefined): FeatureValue<boolean> {
    if (deLd !== undefined) {
      return conocido(deLd > 0, `La ficha declara ${String(deLd)} valoraciones.`);
    }
    const m = RESENAS.exec(textoEn(doc, SELECTORS.cantidadResenas));
    if (m?.[1] !== undefined) {
      const n = aCantidad(m[1]);
      if (Number.isFinite(n)) return conocido(n > 0, `La ficha declara ${String(n)} valoraciones.`);
    }
    if (primero(doc, SELECTORS.bloqueResenas) !== null) {
      return conocido(true, 'La ficha incluye la seccion de resenas del producto.');
    }
    return indeterminado('No se encontro la seccion de resenas en la ficha.');
  }

  #garantia(doc: Document): FeatureValue<Ordinal> {
    if (primero(doc, SELECTORS.garantia) === null) {
      return indeterminado('La ficha no declara politica de devoluciones.');
    }
    return conocido(2, 'La ficha declara politica de devoluciones.');
  }

  #ventas(doc: Document): FeatureValue<number> {
    const m = VENDIDOS.exec(textoEn(doc, SELECTORS.ventas));
    if (m?.[1] === undefined) {
      return indeterminado('La ficha no declara cuantas unidades se vendieron.');
    }
    const n = aCantidad(`${m[1]}${m[2] ?? ''}`);
    if (!Number.isFinite(n)) {
      return indeterminado('No se pudo interpretar la cantidad de ventas declarada.');
    }
    return conocido(n, `La ficha declara aproximadamente ${String(n)} unidades vendidas.`);
  }
}
