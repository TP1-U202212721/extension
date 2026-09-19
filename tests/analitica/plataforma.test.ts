import { describe, expect, it } from 'vitest';
import { plataformaAnalitica } from '../../src/analytics/Analitica.js';
import { PLATAFORMA } from '../../src/domain/analitica/eventos.js';

/** Cada adaptador tiene su fila en `EUsagePlatform`; lo desconocido cae en 99. */
describe('plataforma de la analitica', () => {
  it('cada adaptador tiene su propio valor', () => {
    expect(plataformaAnalitica('Mercado Libre')).toBe(PLATAFORMA.mercadoLibre);
    expect(plataformaAnalitica('Amazon')).toBe(PLATAFORMA.amazon);
    expect(plataformaAnalitica('AliExpress')).toBe(PLATAFORMA.aliExpress);
    expect(plataformaAnalitica('eBay')).toBe(PLATAFORMA.ebay);
    expect(plataformaAnalitica('Temu')).toBe(6);
  });

  it('una plataforma nueva no pierde el evento', () => {
    expect(plataformaAnalitica('Walmart')).toBe(PLATAFORMA.otra);
  });
});
