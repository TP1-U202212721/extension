import type {
  MarketplaceAdapter,
  Publicacion,
  TarjetaListado,
} from '../../MarketplaceAdapter.js';
import { ANCLA_BADGE, TARJETAS, primero } from './selectors.js';

/**
 * MLA123456789, MPE123456789, y la variante de catalogo con U intercalada:
 * MPEU3173976853. La U aparece en las fichas /up/ y sin ella el reconocimiento
 * falla justo en las publicaciones mas comunes.
 */
const ID_PUBLICACION = /\b(ML[A-Z]|MPE|MCO|MLC)U?-?(\d{6,})\b/;





/**
 * Adaptador de Mercado Libre.
 *
 * Ya NO extrae caracteristicas: eso lo hace el backend sobre el documento que
 * esta extension le entrega (docs/adr/0004). Aqui solo queda lo que es
 * irreduciblemente del cliente.
 */
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
}
