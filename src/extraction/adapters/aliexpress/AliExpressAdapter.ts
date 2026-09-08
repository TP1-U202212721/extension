import { primero, todos } from '../../dom.js';
import type { MarketplaceAdapter, Publicacion, TarjetaListado } from '../../MarketplaceAdapter.js';

const ID = /\/item\/(\d{6,})\.html/;

/** Donde anclar el badge dentro de la ficha. Cascada: si nada matchea, posicion fija. */
const ANCLA_BADGE: readonly string[] = ['[class*="buy-now--"]', '[class*="product-action--"]', '[class*="pdp-info-right"]', '.product-action'];

/** Tarjetas de listado y carrusel. Solo se les inserta un enlace, nunca un veredicto. */
const TARJETAS: readonly string[] = ['[class*="search-item-card-wrapper"]', '[class*="list--gallery--"]', '.product-card'];
const ENLACE_FICHA = 'a[href*="/item/"]';

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
}
