import { primero, todos } from '../../dom.js';
import type { Insumos } from '../../../domain/insumos.js';
import type {
  InsercionBadge,
  MarketplaceAdapter,
  Publicacion,
  TarjetaListado,
} from '../../MarketplaceAdapter.js';
import { categoriaGruesaDe, insumosDe } from './insumos.js';

const ID = /\/itm\/(?:.*\/)?(\d{11,12})(?:[/?]|$)/;

/**
 * Donde anclar el badge dentro de la ficha: justo antes de los botones "Buy It
 * Now" / "Add to cart". Cascada: si nada matchea, posicion fija. Verificado
 * contra fichas reales de ebay.com (2026-09-19).
 */
const ANCLA_BADGE: readonly string[] = ['[data-testid="x-buybox-cta"]', '.x-buybox-cta', '.x-buybox__cta'];

/**
 * Tarjetas de listado y carrusel. Solo se les inserta un enlace, nunca un
 * veredicto. La busqueda de ebay.com usa `li.s-card` desde 2026; `li.s-item`
 * queda para los sitios que aun no migraron.
 */
const TARJETAS: readonly string[] = [
  'li.s-card',
  'li.s-item',
  'li.brwrvr__item-card',
  '.str-item-card',
  '[data-testid="item-card"]',
];
const ENLACE_FICHA = 'a[href*="/itm/"]';

/**
 * Controles de compra. Se usan SOLO para reconocer el clic del comprador y saber
 * si siguio hacia el pago pese a la advertencia. Nunca se pulsan.
 */
const COMPRA: readonly string[] = [
  '[data-testid="x-bin-action"] a',
  '[data-testid="x-bin-action"] button',
  '#binBtn_btn',
  '#atcBtn_btn_1',
  'a[href*="/buy/"]',
];

/**
 * Adaptador de eBay.
 *
 * Ya NO extrae caracteristicas: eso lo hace el backend sobre el documento que
 * esta extension le entrega (docs/adr/0004). Aqui solo queda lo que es
 * irreduciblemente del cliente: que publicacion es, donde poner el badge, y que
 * tarjetas del carrusel enlazar.
 */
export class EbayAdapter implements MarketplaceAdapter {
  readonly plataforma = 'eBay';

  esPlataforma(url: URL): boolean {
    return /(^|\.)ebay\./i.test(url.hostname);
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

  insercionBadge(_ancla: Element): InsercionBadge {
    return 'antes';
  }

  tarjetas(doc: Document): readonly TarjetaListado[] {
    const vistos = new Set<string>();
    const salida: TarjetaListado[] = [];
    for (const tarjeta of todos(doc, TARJETAS)) {
      const enlace = tarjeta.querySelector<HTMLAnchorElement>(ENLACE_FICHA);
      const href = enlace?.href ?? '';
      // La busqueda trae una tarjeta plantilla que enlaza a /itm/123456: no es un
      // articulo. Solo cuentan los enlaces con un item id real.
      if (href === '' || vistos.has(href) || !ID.test(href)) continue;
      vistos.add(href);
      salida.push({ elemento: tarjeta, href });
    }
    return salida;
  }

  insumos(doc: Document): Insumos {
    return insumosDe(doc);
  }

  categoriaGruesa(doc: Document): string {
    return categoriaGruesaDe(doc);
  }

  selectoresDeCompra(): readonly string[] {
    return COMPRA;
  }
}
