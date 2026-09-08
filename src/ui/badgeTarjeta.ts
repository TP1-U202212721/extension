import type { TarjetaListado } from '../extraction/MarketplaceAdapter.js';

/** Marca para no insertar dos veces en la misma tarjeta cuando el DOM cambia. */
const MARCA = 'data-scamshield';

/**
 * Inserta en una tarjeta de listado un enlace a su ficha.
 *
 * Deliberadamente es un `<a href>` y no un boton con JavaScript: la navegacion
 * la hace el comprador con su propio clic, igual que si hubiera pulsado el
 * titulo de la tarjeta. La extension no navega por su cuenta.
 *
 * Y deliberadamente NO muestra un veredicto: la tarjeta no contiene ninguna de
 * las ocho caracteristicas. Prometer un nivel de riesgo aqui seria inventarlo.
 *
 * Se construye con DOM plano y estilos en linea en vez de React: hay decenas de
 * tarjetas por pagina, y montar un arbol por cada una no se justifica.
 */
export const insertarBadgeTarjeta = (tarjeta: TarjetaListado): HTMLAnchorElement | null => {
  if (tarjeta.elemento.hasAttribute(MARCA)) return null;
  tarjeta.elemento.setAttribute(MARCA, '');

  const doc = tarjeta.elemento.ownerDocument;
  const a = doc.createElement('a');
  a.href = tarjeta.href;
  a.textContent = 'ScamShield · abrir para analizar';
  a.setAttribute('aria-label', 'Abrir la publicacion para analizarla con ScamShield');

  Object.assign(a.style, {
    display: 'block',
    margin: '8px 0 0',
    padding: '6px 8px',
    border: '1px solid #bedbff',
    borderRadius: '8px',
    background: '#eff6ff',
    color: '#1447e6',
    font: '600 11px/1.3 system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);

  tarjeta.elemento.append(a);
  return a;
};

/** Quita todos los badges insertados, para cuando el content script se invalida. */
export const limpiarBadgesTarjeta = (doc: Document): void => {
  for (const el of doc.querySelectorAll(`[${MARCA}]`)) {
    el.removeAttribute(MARCA);
  }
};
