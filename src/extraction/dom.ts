/**
 * Utilidades de lectura del DOM compartidas por los adaptadores.
 *
 * Quedan solo las de presentacion. Las de interpretacion de caracteristicas se
 * fueron con `extraer()` al backend (docs/adr/0004). Todo lo de aqui opera sobre
 * el documento que el navegador YA renderizo: no hay fetch, ni iframes, ni
 * navegacion.
 */

/** Primer elemento que matchee en la cascada, o null. Nunca lanza. */
export const primero = (raiz: ParentNode, cascada: readonly string[]): Element | null => {
  for (const sel of cascada) {
    try {
      const el = raiz.querySelector(sel);
      if (el !== null) return el;
    } catch {
      // Selector invalido: se ignora y se sigue con el resto de la cascada.
    }
  }
  return null;
};

/** Todos los elementos que matcheen el primer selector productivo de la cascada. */
export const todos = (raiz: ParentNode, cascada: readonly string[]): readonly Element[] => {
  for (const sel of cascada) {
    try {
      const els = raiz.querySelectorAll(sel);
      if (els.length > 0) return [...els];
    } catch {
      /* selector invalido */
    }
  }
  return [];
};
