import { beforeEach, describe, expect, it, vi } from 'vitest';

const enviados: unknown[] = [];
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: (m: unknown) => {
        enviados.push(m);
        return Promise.resolve();
      },
    },
  },
}));

const { EmisorDeContenido } = await import('../../src/analytics/EmisorDeContenido.js');
const { INTERACCION, VEREDICTO } = await import('../../src/domain/analitica/eventos.js');

/** Los `kind` de interaccion emitidos, en orden. */
const kinds = (): number[] =>
  enviados
    .map((m) => (m as { evento: { clase: string; interaccion?: { kind: number } } }).evento)
    .flatMap((e) => (e.clase === 'interaccion' && e.interaccion ? [e.interaccion.kind] : []));

const desenlaces = (): number[] =>
  kinds().filter((k) => k === INTERACCION.hizoCaso || k === INTERACCION.continuoIgual);

const nuevo = () =>
  new EmisorDeContenido('s1', 'temu', () => 'https://example.test/ficha', () => 'cat');

describe('EmisorDeContenido: desenlaces de la advertencia', () => {
  beforeEach(() => {
    enviados.length = 0;
  });

  it('emite el abandono tras los cuatro veredictos, no solo tras alto y moderado', () => {
    for (const v of Object.values(VEREDICTO)) {
      enviados.length = 0;
      const e = nuevo();
      e.advertenciaMostrada(v);
      e.abandonoTrasLaAdvertencia();
      expect(desenlaces()).toEqual([INTERACCION.hizoCaso]);
    }
  });

  it('no emite abandono si no se mostro ninguna advertencia', () => {
    const e = nuevo();
    e.abandonoTrasLaAdvertencia();
    expect(desenlaces()).toEqual([]);
  });

  it('un clic de compra excluye el abandono posterior', () => {
    const e = nuevo();
    e.advertenciaMostrada(VEREDICTO.riesgoAlto);
    e.continuoPeseALaAdvertencia();
    e.abandonoTrasLaAdvertencia();
    expect(desenlaces()).toEqual([INTERACCION.continuoIgual]);
  });

  it('una ficha nueva en la misma pestana cierra el desenlace de la anterior', () => {
    const e = nuevo();
    e.advertenciaMostrada(VEREDICTO.riesgoModerado);
    e.fichaDetectada();
    expect(desenlaces()).toEqual([INTERACCION.hizoCaso]);
    // La ficha nueva aun no tiene advertencia: salir no emite nada mas.
    e.abandonoTrasLaAdvertencia();
    expect(desenlaces()).toEqual([INTERACCION.hizoCaso]);
  });

  it('el desenlace se emite una sola vez por advertencia', () => {
    const e = nuevo();
    e.advertenciaMostrada(VEREDICTO.riesgoBajo);
    e.abandonoTrasLaAdvertencia();
    e.abandonoTrasLaAdvertencia();
    e.continuoPeseALaAdvertencia();
    expect(desenlaces()).toEqual([INTERACCION.hizoCaso]);
  });
});
