
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
  /** Tarjetas de listado o carrusel presentes en la pagina. Vacio si no hay. */
  tarjetas(doc: Document): readonly TarjetaListado[];
}
