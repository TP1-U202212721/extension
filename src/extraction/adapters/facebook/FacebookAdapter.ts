import { todos } from '../../dom.js';
import type { Insumos } from '../../../domain/insumos.js';
import type {
  InsercionBadge,
  MarketplaceAdapter,
  Publicacion,
  TarjetaListado,
} from '../../MarketplaceAdapter.js';
import { categoriaGruesaDe, insumosDe } from './insumos.js';
import {
  bloqueDeLaFicha,
  bloqueDeLasFotos,
  fichaDesdeElDom,
  idDelPerfil,
  recorteDelPerfil,
  textoEmbebido,
} from './relay.js';

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
 * Donde anclar el badge: junto a los botones de la publicacion, que en
 * Marketplace son "Message", "Save" y "Share". El badge va ANTES del boton de
 * mensaje. Facebook ofusca sus clases, pero esos botones llevan `aria-label`
 * estable, traducido al idioma de la cuenta.
 *
 * Verificado sobre una publicacion real el 2026-09-21.
 */
const ANCLA_BADGE: readonly string[] = [
  '[role="button"][aria-label="Message"]',
  '[role="button"][aria-label="Mensaje"]',
  '[role="button"][aria-label="Enviar mensaje"]',
  '[role="button"][aria-label="Send message"]',
];

/**
 * Controles de compra. En Marketplace no se compra: se contacta al vendedor por
 * chat, y ese clic es el equivalente a "comprar" para lo que la tesis mide.
 */
const COMPRA: readonly string[] = ANCLA_BADGE;

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

  /**
   * Facebook deja en el DOM copias ocultas de sus botones (miden 0x0): el badge
   * tiene que colgar de la que se ve.
   */
  anclaBadge(doc: Document): Element | null {
    for (const boton of doc.querySelectorAll(ANCLA_BADGE.join(','))) {
      const caja = boton.getBoundingClientRect();
      if (caja.width > 0 && caja.height > 0) return boton;
    }
    return null;
  }

  insercionBadge(_ancla: Element): InsercionBadge {
    return 'antes';
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
    // Tambien vale el enlace al perfil normal: Facebook lo usa cuando quien
    // vende no tiene tienda, que es lo habitual en Marketplace.
    const id = enElEnlace ?? idDelPerfil(textoEmbebido(doc));
    return id === undefined ? null : PERFIL(id);
  }

  /**
   * Lo que se manda al backend. Una pagina de Facebook pesa mas de 10 MB y el
   * analizador acepta 8, asi que no se manda entera: de la ficha van su registro
   * y el bloque de las fotos; del perfil, las ventanas que hablan del vendedor.
   *
   * El backend lee exactamente lo mismo sobre este recorte que sobre la pagina
   * completa: busca dentro del registro de la publicacion, que es lo que va.
   */
  documentoParaAnalizar(doc: Document): string {
    const texto = textoEmbebido(doc);
    const id = ID.exec(doc.URL)?.[1];

    if (id === undefined) {
      return this.documento(doc, [recorteDelPerfil(texto)]);
    }

    // Facebook navega entre publicaciones sin recargar, y la ficha abierta asi NO
    // esta en los scripts: ahi queda solo el registro corto de "relacionados",
    // con titulo y precio pero sin descripcion. Cuando el incrustado no trae la
    // ficha completa, se lee del DOM, que si la muestra.
    const incrustada = bloqueDeLaFicha(texto, id);
    const completa = incrustada.includes('"redacted_description"');
    const delDom = completa ? '' : fichaDesdeElDom(doc, id);

    const partes = [
      // Primero la del DOM: el backend se queda con la primera que encuentre.
      delDom,
      incrustada,
      bloqueDeLasFotos(texto),
      recorteDelPerfil(texto),
    ];

    return this.documento(doc, partes);
  }

  /** Envuelve los trozos en el documento minimo que el backend sabe leer. */
  private documento(doc: Document, partes: readonly string[]): string {
    const util = partes.filter((p) => p !== '').join('\n');
    return (
      `<!DOCTYPE html><html><head><title>${doc.title.replace(/</g, '')}</title></head>` +
      `<body><script type="application/json">${util.replace(/<\//g, '<\\/')}</script></body></html>`
    );
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
