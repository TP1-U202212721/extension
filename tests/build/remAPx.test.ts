import { describe, expect, it } from 'vitest';
import { cssSinRem, remAPx } from '../../src/build/remAPx.js';

describe('pasar los rem del css a px', () => {
  it('convierte los valores de las declaraciones', () => {
    expect(cssSinRem('.x{padding:2rem;margin:.5rem}')).toBe('.x{padding:32px;margin:8px}');
  });

  it('convierte las variables de Tailwind', () => {
    expect(cssSinRem(':root{--spacing:.25rem}')).toBe(':root{--spacing:4px}');
  });

  it('convierte dentro de calc', () => {
    expect(cssSinRem('.p{max-height:calc(100vh - 2rem)}')).toBe('.p{max-height:calc(100vh - 32px)}');
  });

  it('convierte las consultas @media, que se miden contra la fuente inicial', () => {
    expect(cssSinRem('@media (min-width:40rem){.a{gap:1rem}}')).toBe(
      '@media (min-width:640px){.a{gap:16px}}',
    );
  });

  /**
   * Tailwind mete el valor dentro del NOMBRE de la clase. Tocarlo dejaba el CSS
   * sin aplicar, porque el elemento sigue llevando la clase con `rem`: asi se
   * perdio el alto maximo del panel, y con el, su scroll.
   */
  it('NO toca el selector, que lleva el valor en su nombre', () => {
    const css = '.max-h-\\[calc\\(100vh-2rem\\)\\]{max-height:calc(100vh - 2rem)}';

    expect(cssSinRem(css)).toBe('.max-h-\\[calc\\(100vh-2rem\\)\\]{max-height:calc(100vh - 32px)}');
  });

  it('tampoco toca un selector dentro de una @media', () => {
    const css = '@media (min-width:40rem){.p-\\[2rem\\]{padding:2rem}}';

    expect(cssSinRem(css)).toBe('@media (min-width:640px){.p-\\[2rem\\]{padding:32px}}');
  });

  it('la conversion suelta sigue estando disponible para un valor', () => {
    expect(remAPx('1.5rem 2rem')).toBe('24px 32px');
  });
});
