
import type { Insumos } from '../domain/insumos.js';

export interface Publicacion {
  readonly plataforma: string;
  readonly publicacionId: string;
}

/**
 * Una tarjeta de listado o carrusel dentro de una pagina.
 *
 * Las tarjetas NO traen las caracteristicas: solo imagen, titulo y precio. Por
 * eso aqui nunca se emite un veredicto. El badge que se inserta es un enlace a
 * la ficha: el comprador hace el clic y la navegacion es suya. Ir a buscar cada
 * ficha para puntuar la tarjeta seria scraping, y esta prohibido.
 */
export interface TarjetaListado {
  /** Nodo donde insertar el enlace. */
  readonly elemento: Element;
  /** Destino de la ficha, tal como ya figura en la pagina. */
  readonly href: string;
}

/**
 * Puerto de extraccion. Una implementacion por marketplace.
 *
 * Contrato que toda implementacion debe cumplir:
 *
 * 1. SOLO LECTURA del documento ya renderizado. Nada de `fetch`, nada de
 *    navegacion, nada de iframes, nada de peticiones que el usuario no hubiera
 *    cursado igual. La extension interpreta la pagina que el navegador ya
 *    entrego; no la visita de nuevo.
 * 2. NUNCA lanza. Un cambio de maquetacion degrada a `indeterminado`, no rompe.
 * 3. NUNCA devuelve un valor por defecto que se confunda con una observacion.
 *    Si el selector no matchea, el estado es `indeterminado` con su motivo.
 */
/** `dentro`: primer hijo del ancla. `antes`: hermano previo del ancla. */
export type InsercionBadge = 'dentro' | 'antes';

export interface MarketplaceAdapter {
  readonly plataforma: string;
  /**
   * Decide si la URL pertenece a esta plataforma, sea ficha, busqueda o home.
   * Es lo que habilita insertar badges en tarjetas de listado, donde no hay
   * ficha que identificar.
   */
  esPlataforma(url: URL): boolean;
  /** Decide si esta URL corresponde a una ficha de producto concreta. */
  reconoce(url: URL): boolean;
  identificar(url: URL): Publicacion | null;
  /**
   * Donde insertar el badge dentro de la pagina. Devuelve null si no encuentra
   * un anclaje reconocible; en ese caso el content script lo fija en una esquina
   * para que la extension nunca quede invisible por un cambio de maquetacion.
   */
  anclaBadge(doc: Document): Element | null;
  /**
   * Como insertar el badge respecto del ancla. Por defecto `dentro` (primer hijo),
   * que sirve cuando el ancla es un CONTENEDOR. Si el ancla es un control, como el
   * boton de comprar, hay que devolver `antes`: meter el badge dentro de un boton
   * lo tapa y lo deja sin texto.
   */
  insercionBadge?(ancla: Element): InsercionBadge;
  /**
   * URL del perfil publico del vendedor, cuando la ficha no publica sus datos y
   * viven en otra pagina. Devolver null (o no implementarlo) significa que todo
   * lo del vendedor ya esta en la ficha.
   *
   * La extension NO abre esa pagina por su cuenta: solo la ofrece, y la abre si
   * el comprador lo pide. Ver `revisarVendedor` en el content script.
   */
  perfilDelVendedor?(doc: Document): string | null;

  /**
   * Que documento mandarle al backend, cuando la pagina entera no sirve.
   *
   * Por defecto viaja el `outerHTML` completo (docs/adr/0004). Facebook pesa mas
   * de 10 MB y el analizador acepta 8, asi que ahi se manda solo el trozo que
   * describe la publicacion. El ADR ya preveia mover el recorte al cliente.
   */
  documentoParaAnalizar?(doc: Document): string;

  /** Tarjetas de listado o carrusel presentes en la pagina. Vacio si no hay. */
  tarjetas(doc: Document): readonly TarjetaListado[];

  /**
   * Insumos de los analizadores de reputacion y de resenas, que no reciben el
   * documento sino datos ya estructurados.
   *
   * Es la unica lectura de contenido que sobrevive en el cliente, y esta aqui
   * por decision del backend, no por diseno de esta capa: ver docs/adr/0006.
   * Lo que no se pueda leer se OMITE; nunca se rellena.
   */
  insumos(doc: Document): Insumos;

  /**
   * Categoria GRUESA de la ficha, para la analitica de uso. Vacia si no se leyo.
   *
   * Gruesa quiere decir los primeros escalones de las migas de pan
   * ("electronica/audio"), no el ultimo. El ultimo es casi el titulo del
   * producto, y el titulo no se emite: ver `src/domain/analitica/sitio.ts`.
   *
   * Es una lectura distinta de la de `insumos`, que si toma el escalon mas
   * especifico porque el clasificador de resenas lo usa como contexto y no sale
   * del navegador salvo hacia ese analizador.
   */
  categoriaGruesa(doc: Document): string;

  /**
   * Selectores de los controles de compra de la ficha ("Comprar ahora",
   * "Agregar al carrito").
   *
   * NO se pulsan ni se leen: solo sirven para reconocer un clic del comprador y
   * poder decir si siguio hacia el pago pese a una advertencia de riesgo, que es
   * la pregunta central de la tesis. La extension no automatiza nada de la
   * compra.
   *
   * Vacio es una respuesta valida: sin selectores, esa interaccion no se emite.
   */
  selectoresDeCompra(): readonly string[];
}
