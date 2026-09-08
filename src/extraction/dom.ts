/**
 * Utilidades de lectura del DOM compartidas por todos los adaptadores.
 *
 * Todo lo de aqui opera sobre el documento que el navegador YA renderizo. No
 * hay fetch, ni iframes, ni navegacion: esa es la restriccion central del
 * diseno y vive en este nivel para que ningun adaptador pueda saltarsela sin
 * que se note.
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

export const textoDe = (el: Element | null): string => el?.textContent.trim() ?? '';

/** Texto del primer elemento de la cascada. Cadena vacia si no hay ninguno. */
export const textoEn = (raiz: ParentNode, cascada: readonly string[]): string =>
  textoDe(primero(raiz, cascada));

/**
 * Valor de un atributo del primer elemento de la cascada. Util donde el dato
 * vive en `title`, `aria-label` o `content` y no en el texto visible, que es lo
 * habitual en Amazon.
 */
export const atributoEn = (
  raiz: ParentNode,
  cascada: readonly string[],
  atributo: string,
): string => primero(raiz, cascada)?.getAttribute(atributo)?.trim() ?? '';

/**
 * Decimal con coma o punto: "4,8" y "4.8" son 4.8.
 *
 * Va separado de `aEntero` a proposito. Una sola funcion que quitara los puntos
 * como separador de miles convertia "4.8" en 48, que es un error real que este
 * proyecto ya cometio una vez.
 */
export const aDecimal = (s: string): number => Number.parseFloat(s.replace(',', '.'));

/** Entero con separadores de miles: "1.250" y "1,250" son 1250. */
export const aEntero = (s: string): number => Number.parseInt(s.replace(/[.,\s]/g, ''), 10);

/**
 * Cantidad abreviada: "1.2k", "5 mil", "10K+" -> numero.
 * Devuelve NaN si no reconoce nada, para que el llamador degrade.
 */
export const aCantidad = (s: string): number => {
  const m = /([\d.,]+)\s*(mil|k|m)?/i.exec(s);
  if (m?.[1] === undefined) return Number.NaN;
  const sufijo = m[2]?.toLowerCase();
  if (sufijo === undefined) return aEntero(m[1]);
  const base = aDecimal(m[1]);
  if (!Number.isFinite(base)) return Number.NaN;
  return Math.round(base * (sufijo === 'm' ? 1_000_000 : 1000));
};
