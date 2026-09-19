import { primero, todos } from '../../dom.js';
import { SIN_INSUMOS, type Insumos } from '../../../domain/insumos.js';
import type { MarketplaceAdapter, Publicacion, TarjetaListado } from '../../MarketplaceAdapter.js';

/**
 * Ficha de Temu: `/pe/<slug>-g-601103619029359.html` o `/pe-es/...`. El numero
 * tras `-g-` es el identificador de la publicacion (goods id).
 */
const ID = /-g-(\d{6,})\.html/;

/**
 * Temu ofusca TODAS sus clases (`_2ugbvrpI`, `_1TeP2qll`) y las regenera en cada
 * despliegue, asi que no sirven como selectores. Lo unico estable es el enlace a
 * la ficha, con su goods id.
 *
 * Por eso la tarjeta se deduce desde el enlace: es el ancestro mas cercano que ya
 * contiene la imagen del producto, siempre que no abarque otras fichas (seria la
 * grilla entera). El atributo `data-tooltip="goodName-<id>"` NO sirve: marca solo
 * el titulo, y el enlace colgado ahi quedaba sobre el texto.
 *
 * Verificado contra el listado real de temu.com renderizado el 2026-09-19.
 */
const ENLACE_FICHA = 'a[href*="-g-"]';
/** Cuantos niveles subir como maximo desde el enlace buscando la tarjeta. */
const MAX_NIVELES = 8;

/**
 * Donde anclar el badge en la ficha. PENDIENTE: Temu redirige a la portada a
 * cualquier navegador automatizado, asi que la ficha no se pudo capturar para
 * verificar selectores. Sin ancla, el content script fija el badge en una
 * esquina de la ventana: se ve y funciona, solo que no junto al boton de compra.
 */
const ANCLA_BADGE: readonly string[] = [];

/** Controles de compra. PENDIENTE por lo mismo que el ancla. */
const COMPRA: readonly string[] = [];

/** Goods ids distintos enlazados dentro de un elemento. */
const idsDentro = (el: Element): Set<string> => {
  const ids = new Set<string>();
  for (const a of el.querySelectorAll<HTMLAnchorElement>(ENLACE_FICHA)) {
    const id = ID.exec(a.href)?.[1];
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
 * Adaptador de Temu.
 *
 * Como el resto, no extrae caracteristicas: eso lo hace el backend sobre el
 * documento que esta extension le entrega (docs/adr/0004).
 */
export class TemuAdapter implements MarketplaceAdapter {
  readonly plataforma = 'Temu';

  esPlataforma(url: URL): boolean {
    return /(^|\.)temu\.com$/i.test(url.hostname);
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
    return ANCLA_BADGE.length === 0 ? null : primero(doc, ANCLA_BADGE);
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

  /**
   * PENDIENTE hasta tener fichas reales. Devolver nada deja reputacion y resenas
   * sin resolver, que es lo correcto: inventar campos los moveria en contra del
   * vendedor sin haber medido.
   */
  insumos(_doc: Document): Insumos {
    return SIN_INSUMOS;
  }

  categoriaGruesa(_doc: Document): string {
    return '';
  }

  selectoresDeCompra(): readonly string[] {
    return COMPRA;
  }
}
