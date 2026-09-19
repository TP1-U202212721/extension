import { describe, expect, it } from 'vitest';
import { esperarElemento } from '../../src/extraction/dom.js';

describe('esperar el ancla del badge', () => {
  it('si ya esta, la devuelve sin esperar', async () => {
    document.body.innerHTML = '<div id="compra"></div>';
    const el = await esperarElemento(document.body, () => document.querySelector('#compra'), 1000);
    expect(el?.id).toBe('compra');
  });

  /** Temu pinta el boton despues de document_idle. */
  it('espera a que aparezca despues', async () => {
    document.body.innerHTML = '';
    const espera = esperarElemento(document.body, () => document.querySelector('#compra'), 1000);
    setTimeout(() => {
      document.body.innerHTML = '<div id="compra"></div>';
    }, 20);
    expect((await espera)?.id).toBe('compra');
  });

  it('si no aparece, se rinde y devuelve null', async () => {
    document.body.innerHTML = '';
    expect(await esperarElemento(document.body, () => document.querySelector('#nunca'), 30)).toBeNull();
  });
});
