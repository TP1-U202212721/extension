import { primero, todos } from '../../dom.js';
import { SIN_INSUMOS, type Insumos } from '../../../domain/insumos.js';
import type {
  InsercionBadge,
  MarketplaceAdapter,
  Publicacion,
  TarjetaListado,
} from '../../MarketplaceAdapter.js';

const ID = /\/item\/(\d{6,})\.html/;

/**
 * Donde anclar el badge dentro de la ficha. Cascada: si nada matchea, posicion fija.
 *
 * Los primeros son los CONTROLES de compra y el badge va ANTES de ellos, como
 * hermano: justo encima de "Comprar ahora", que es el punto de decision. Antes se
 * insertaba como primer hijo del boton y lo tapaba entero, dejandolo sin texto.
 * Los ultimos son contenedores y ahi si va dentro.
 */
const ANCLA_ANTES: readonly string[] = [
  'button[data-pl="product-buy-now"]',
  '[class*="buy-now--"]',
  '[class*="buynow"]',
];
const ANCLA_DENTRO: readonly string[] = ['[class*="product-action--"]', '.product-action', '[class*="pdp-info-right"]'];
const ANCLA_BADGE: readonly string[] = [...ANCLA_ANTES, ...ANCLA_DENTRO];

/** Tarjetas de listado y carrusel. Solo se les inserta un enlace, nunca un veredicto. */
const TARJETAS: readonly string[] = ['[class*="search-item-card-wrapper"]', '[class*="list--gallery--"]', '.product-card'];
const ENLACE_FICHA = 'a[href*="/item/"]';

/**
 * Controles de compra. Se usan SOLO para reconocer el clic del comprador y saber
 * si siguio hacia el pago pese a la advertencia. Nunca se pulsan.
 */
const COMPRA: readonly string[] = [
  'button[data-pl="product-buy-now"]',
  'button[data-pl="product-add-to-cart"]',
  '[class*="buynow"] button',
  '[class*="addcart"] button',
];

/**
 * Adaptador de AliExpress.
 *
 * Ya NO extrae caracteristicas: eso lo hace el backend sobre el documento que
 * esta extension le entrega (docs/adr/0004). Aqui solo queda lo que es
 * irreduciblemente del cliente: que publicacion es, donde poner el badge, y que
 * tarjetas del carrusel enlazar.
 */
export class AliExpressAdapter implements MarketplaceAdapter {
  readonly plataforma = 'AliExpress';

  esPlataforma(url: URL): boolean {
    return /(^|\.)aliexpress\./i.test(url.hostname);
  }

  reconoce(url: URL): boolean {
    return this.esPlataforma(url) && ID.test(url.pathname);
  }

  identificar(url: URL): Publicacion | null {
    const m = ID.exec(url.pathname);
    if (!this.esPlataforma(url) || m?.[1] === undefined) return null;
    return { plataforma: this.plataforma, publicacionId: m[1] };
  }

  anclaBadge(doc: Document): Element | null {
    return primero(doc, ANCLA_BADGE);
  }

  insercionBadge(ancla: Element): InsercionBadge {
    return ANCLA_ANTES.some((selector) => ancla.matches(selector)) ? 'antes' : 'dentro';
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

  /**
   * Sin implementar para AliExpress. Devolver nada deja las dos caracteristicas sin
   * resolver, que es el comportamiento correcto: inventar campos las moveria en
   * contra del vendedor sin haber medido.
   */
  insumos(_doc: Document): Insumos {
    return SIN_INSUMOS;
  }

  /**
   * Sin lectura de migas de pan para esta plataforma, igual que `insumos`.
   * Devolver vacio deja el evento sin categoria, que es exactamente lo que
   * corresponde: inventarla seria peor que no tenerla.
   */
  categoriaGruesa(_doc: Document): string {
    return '';
  }

  selectoresDeCompra(): readonly string[] {
    return COMPRA;
  }
}
