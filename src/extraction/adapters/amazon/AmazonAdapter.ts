import { primero, todos } from '../../dom.js';
import { SIN_INSUMOS, type Insumos } from '../../../domain/insumos.js';
import type { MarketplaceAdapter, Publicacion, TarjetaListado } from '../../MarketplaceAdapter.js';

const ID = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/;

/** Donde anclar el badge dentro de la ficha. Cascada: si nada matchea, posicion fija. */
const ANCLA_BADGE: readonly string[] = ['#desktop_buybox', '#buybox', '#rightCol', '#addToCart_feature_div'];

/** Tarjetas de listado y carrusel. Solo se les inserta un enlace, nunca un veredicto. */
const TARJETAS: readonly string[] = ['div[data-asin][data-component-type="s-search-result"]', 'li.a-carousel-card', 'div[data-asin]:not([data-asin=""])'];
const ENLACE_FICHA = 'a[href*="/dp/"], a[href*="/gp/product/"]';

/**
 * Adaptador de Amazon.
 *
 * Ya NO extrae caracteristicas: eso lo hace el backend sobre el documento que
 * esta extension le entrega (docs/adr/0004). Aqui solo queda lo que es
 * irreduciblemente del cliente: que publicacion es, donde poner el badge, y que
 * tarjetas del carrusel enlazar.
 */
export class AmazonAdapter implements MarketplaceAdapter {
  readonly plataforma = 'Amazon';

  esPlataforma(url: URL): boolean {
    return /(^|\.)amazon\./i.test(url.hostname);
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
   * Sin implementar para Amazon. Devolver nada deja las dos caracteristicas sin
   * resolver, que es el comportamiento correcto: inventar campos las moveria en
   * contra del vendedor sin haber medido.
   */
  insumos(_doc: Document): Insumos {
    return SIN_INSUMOS;
  }
}
