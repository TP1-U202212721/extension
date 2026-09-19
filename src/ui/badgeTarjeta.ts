import type { TarjetaListado } from '../extraction/MarketplaceAdapter.js';

/** Marca del enlace insertado: sirve para no duplicarlo y para retirarlo despues. */
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
/**
 * El enlace va SUPERPUESTO en la esquina superior izquierda de la tarjeta, no
 * agregado al final.
 *
 * Las grillas de listado (AliExpress) dan a cada tarjeta un alto fijo: un enlace
 * agregado al final se salia por debajo y quedaba tapado por la imagen de la
 * tarjeta de la fila siguiente. Superpuesto y con posicion absoluta no cambia el
 * alto de la tarjeta, no empuja nada y ningun vecino lo puede tapar.
 */
export const insertarBadgeTarjeta = (tarjeta: TarjetaListado): HTMLAnchorElement | null => {
  const card = tarjeta.elemento;
  // Se comprueba el ENLACE y no una marca en la tarjeta: si la pagina repinta la
  // tarjeta y se lleva el enlace, hay que volver a ponerlo.
  if (card.querySelector(`[${MARCA}]`) !== null) return null;

  const doc = card.ownerDocument;
  const vista = doc.defaultView;
  if (vista !== null && vista.getComputedStyle(card).position === 'static') {
    (card as HTMLElement).style.position = 'relative';
  }

  const a = doc.createElement('a');
  a.href = tarjeta.href;
  a.textContent = 'ScamShield · abrir para analizar';
  a.title = 'Abrir la publicacion para analizarla con ScamShield';
  a.setAttribute('aria-label', 'Abrir la publicacion para analizarla con ScamShield');
  a.setAttribute(MARCA, '');

  Object.assign(a.style, {
    position: 'absolute',
    top: '8px',
    left: '8px',
    zIndex: '2147483646',
    display: 'inline-block',
    maxWidth: 'calc(100% - 16px)',
    padding: '4px 8px',
    border: '1px solid #bedbff',
    borderRadius: '999px',
    background: 'rgba(239, 246, 255, 0.96)',
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)',
    color: '#1447e6',
    font: '600 11px/1.3 system-ui, -apple-system, sans-serif',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textDecoration: 'none',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);

  card.append(a);
  return a;
};

/** Quita los enlaces insertados, para cuando el content script se invalida. */
export const limpiarBadgesTarjeta = (doc: Document): void => {
  for (const el of doc.querySelectorAll(`[${MARCA}]`)) el.remove();
};
