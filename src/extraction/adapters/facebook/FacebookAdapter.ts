import { todos } from '../../dom.js';
import type { Insumos } from '../../../domain/insumos.js';
import type { MarketplaceAdapter, Publicacion, TarjetaListado } from '../../MarketplaceAdapter.js';
import { categoriaGruesaDe, insumosDe } from './insumos.js';
import { idDelPerfil, textoEmbebido } from './relay.js';

/** Ficha de Marketplace: `/marketplace/item/1234567890123456/`. */
const ID = /\/marketplace\/item\/(\d{10,20})/;

/** Perfil publico del vendedor, que es donde viven sus calificaciones. */
const PERFIL = (id: string): string =>
  `https://www.facebook.com/marketplace/profile/${id}/`;

/**
 * Enlace a una ficha dentro del listado. Facebook ofusca sus clases, asi que la
 * tarjeta se deduce del enlace, igual que en Temu.
 */
const ENLACE_FICHA = 'a[href*="/marketplace/item/"]';
/** Cuantos niveles subir como maximo desde el enlace buscando la tarjeta. */
const MAX_NIVELES = 6;

/**
 * Donde anclar el badge en la ficha. PENDIENTE: Facebook exige sesion iniciada,
 * asi que la ficha no se pudo capturar con un navegador automatizado para
 * verificar selectores. Sin ancla, el content script fija el badge en una
 * esquina: se ve y funciona, solo que no junto al precio.
 */
const ANCLA_BADGE: readonly string[] = [];

/**
 * Controles de compra. En Marketplace no hay: la compra se cierra por chat, con
 * "Enviar mensaje". Se deja vacio hasta verificarlo sobre una ficha real.
 */
const COMPRA: readonly string[] = [];

/** Ids de fichas enlazadas dentro de un elemento. */
const idsDentro = (el: Element): Set<string> => {
  const ids = new Set<string>();
  for (const a of el.querySelectorAll<HTMLAnchorElement>(ENLACE_FICHA)) {
    const id = ID.exec(a.getAttribute('href') ?? '')?.[1];
    if (id !== undefined) ids.add(id);
  }
  return ids;
};

/** El ancestro mas cercano con la imagen del producto que no abarca otras fichas. */
const tarjetaDe = (enlace: Element, id: string): Element | null => {
  let el = enlace.parentElement;
  for (let n = 0; el !== null && n < MAX_NIVELES; n += 1, el = el.parentElement) {
    const ids = idsDentro(el);
    if (ids.size > 1 || !ids.has(id)) return null;
    if (el.querySelector('img') !== null) return el;
  }
  return null;
};

/**
 * Adaptador de Facebook Marketplace.
 *
 * Dos diferencias con el resto de plataformas:
 *
 * 1. No lee el DOM sino el estado que Facebook incrusta en la pagina (ver
 *    `relay.ts`), porque sus clases son ofuscadas y cambian solas.
 * 2. Los datos del vendedor NO estan en la ficha: viven en su perfil. Por eso
 *    expone `perfilDelVendedor`, y el badge ofrece revisarlo. La extension no
 *    lo abre por su cuenta.
 */
export class FacebookAdapter implements MarketplaceAdapter {
  readonly plataforma = 'Facebook Marketplace';

  esPlataforma(url: URL): boolean {
    return /(^|\.)facebook\.com$/i.test(url.hostname);
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
    return ANCLA_BADGE.length === 0 ? null : doc.querySelector(ANCLA_BADGE.join(','));
  }

  /**
   * El perfil sale del enlace de la ficha; si la maquetacion cambia, del id que
   * el propio estado embebido trae.
   */
  perfilDelVendedor(doc: Document): string | null {
    const enlace = doc.querySelector<HTMLAnchorElement>('a[href*="/marketplace/profile/"]');
    const enElEnlace = /\/marketplace\/profile\/(\d{10,17})/.exec(
      enlace?.getAttribute('href') ?? '',
    )?.[1];
    const id = enElEnlace ?? idDelPerfil(textoEmbebido(doc));
    return id === undefined ? null : PERFIL(id);
  }

  tarjetas(doc: Document): readonly TarjetaListado[] {
    const vistos = new Set<string>();
    const salida: TarjetaListado[] = [];
    for (const enlace of todos(doc, [ENLACE_FICHA])) {
      const href = (enlace as HTMLAnchorElement).href;
      const id = ID.exec(href)?.[1];
      if (id === undefined || vistos.has(id)) continue;
      const tarjeta = tarjetaDe(enlace, id);
      if (tarjeta === null) continue;
      vistos.add(id);
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
