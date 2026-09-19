import { describe, expect, it } from 'vitest';
import { insertarBadgeTarjeta, limpiarBadgesTarjeta } from '../../src/ui/badgeTarjeta.js';

const tarjeta = () => {
  document.body.innerHTML = '<div class="card"><img alt=""><a href="https://x.test/item/1.html">t</a></div>';
  const elemento = document.querySelector('.card') as HTMLElement;
  return { elemento, href: 'https://x.test/item/1.html' };
};

/**
 * Regresion: el enlace se agregaba al final de la tarjeta y, con tarjetas de alto
 * fijo (AliExpress), quedaba tapado por la imagen de la fila siguiente.
 */
describe('enlace de ScamShield en tarjetas de listado', () => {
  it('va superpuesto dentro de la tarjeta, sin cambiar su alto', () => {
    const t = tarjeta();
    const a = insertarBadgeTarjeta(t);
    expect(a?.parentElement).toBe(t.elemento);
    expect(a?.style.position).toBe('absolute');
    expect(t.elemento.style.position).toBe('relative');
    expect(a?.getAttribute('href')).toBe(t.href);
  });

  it('no se duplica si la tarjeta ya lo tiene', () => {
    const t = tarjeta();
    insertarBadgeTarjeta(t);
    expect(insertarBadgeTarjeta(t)).toBeNull();
    expect(t.elemento.querySelectorAll('[data-scamshield]')).toHaveLength(1);
  });

  it('vuelve a ponerse si la pagina repinta la tarjeta y se lo lleva', () => {
    const t = tarjeta();
    insertarBadgeTarjeta(t)?.remove();
    expect(insertarBadgeTarjeta(t)).not.toBeNull();
  });

  it('al invalidarse la extension se retiran los enlaces, no solo una marca', () => {
    const t = tarjeta();
    insertarBadgeTarjeta(t);
    limpiarBadgesTarjeta(document);
    expect(document.querySelectorAll('[data-scamshield]')).toHaveLength(0);
  });
});
