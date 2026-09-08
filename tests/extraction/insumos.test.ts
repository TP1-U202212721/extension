import { describe, expect, it } from 'vitest';
import { MercadoLibreAdapter } from '../../src/extraction/adapters/mercadolibre/MercadoLibreAdapter.js';
import { consultarReputacion } from '../../src/transport/SellerReputationClient.js';
import { consultarAutenticidad } from '../../src/transport/ReviewAnalysisClient.js';
import type { TokenProvider } from '../../src/auth/TokenProvider.js';

const doc = (html: string): Document =>
  new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html');

const adapter = new MercadoLibreAdapter();
const tokens: TokenProvider = { id: 'prueba', obtener: () => Promise.resolve('tok') };

/** Captura el cuerpo que de verdad sale por la red. */
const cuerpoEnviado = async (correr: () => Promise<unknown>): Promise<Record<string, unknown>> => {
  const original = globalThis.fetch;
  let cuerpo = '';
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    cuerpo = typeof init?.body === 'string' ? init.body : '';
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ isSuccess: false, message: 'no importa' }),
    });
  }) as unknown as typeof fetch;
  try {
    await correr();
  } finally {
    globalThis.fetch = original;
  }
  return JSON.parse(cuerpo) as Record<string, unknown>;
};

/** La ficha con todos los datos del vendedor a la vista. */
const FICHA_COMPLETA = `
  <div class="ui-seller-data-header">
    <div class="ui-seller-data-header__title-container">TIENDA EJEMPLO SAC</div>
    <p class="ui-seller-data-status__lider-seller">MercadoLider Platinum</p>
    <p class="ui-pdp-seller-summary__header__subtitle">+1.2mil ventas</p>
    <p class="ui-seller-data-status__thermometer-title">4,7</p>
    <p class="ui-seller-data-status__title">Vende desde 2019</p>
  </div>`;

/** La misma ficha con el bloque del vendedor mutilado. */
const FICHA_MUTILADA = `
  <div class="ui-seller-data-header">
    <div class="ui-seller-data-header__title-container">TIENDA EJEMPLO SAC</div>
  </div>`;

describe('lo que se lee, se lee', () => {
  it('extrae los cinco campos cuando la ficha los publica', () => {
    const v = adapter.insumos(doc(FICHA_COMPLETA)).vendedor;
    expect(v?.sellerName).toBe('TIENDA EJEMPLO SAC');
    expect(v?.completedSales).toBe(1200);
    expect(v?.ratingAverage).toBe(4.7);
    expect(v?.memberSinceYear).toBe(2019);
    expect(v?.badgeTier).toBe(4);
  });

  it('distingue los niveles del distintivo', () => {
    const tier = (etiqueta: string) =>
      adapter.insumos(
        doc(
          `<div class="ui-seller-data-header">
             <div class="ui-seller-data-header__title-container">X</div>
             <p class="ui-seller-data-status__lider-seller">${etiqueta}</p>
           </div>`,
        ),
      ).vendedor?.badgeTier;
    expect(tier('MercadoLider')).toBe(2);
    expect(tier('MercadoLider Gold')).toBe(3);
    expect(tier('MercadoLider Platinum')).toBe(4);
  });

  it('sin nombre de vendedor no se consulta al analizador', () => {
    expect(adapter.insumos(doc('<div class="ui-pdp-container"></div>')).vendedor).toBeNull();
  });
});

describe('OMITIR NO ES MANDAR CERO', () => {
  const AUSENTES = [
    'completedSales',
    'ratingAverage',
    'memberSinceYear',
    'memberSince',
    'badgeTier',
    'badgeLabel',
    'negativeRatingShare',
    'claimShare',
    'cancellationShare',
    'onTimeDeliveryShare',
  ];

  it('lo que no se leyo no aparece en el objeto extraido', () => {
    const v = adapter.insumos(doc(FICHA_MUTILADA)).vendedor;
    expect(v).not.toBeNull();
    for (const clave of AUSENTES) {
      expect(Object.hasOwn(v as object, clave)).toBe(false);
    }
  });

  it('lo que no se leyo NO viaja en la peticion', async () => {
    const v = adapter.insumos(doc(FICHA_MUTILADA)).vendedor;
    if (v === null) throw new Error('la ficha si identifica al vendedor');
    const cuerpo = await cuerpoEnviado(() => consultarReputacion(v, tokens));

    expect(cuerpo['sellerName']).toBe('TIENDA EJEMPLO SAC');
    for (const clave of AUSENTES) {
      // Si esto falla, el backend leeria una senal desfavorable sobre un
      // vendedor del que no se midio nada. Es el fallo que no se puede cometer.
      expect(Object.hasOwn(cuerpo, clave)).toBe(false);
    }
  });

  it('un null explicito tampoco viaja', async () => {
    const cuerpo = await cuerpoEnviado(() =>
      consultarReputacion(
        { sellerName: 'X', platform: 'Mercado Libre', completedSales: null as unknown as number },
        tokens,
      ),
    );
    expect(Object.hasOwn(cuerpo, 'completedSales')).toBe(false);
  });

  it('una lectura fallida que produce NaN tampoco viaja', async () => {
    const cuerpo = await cuerpoEnviado(() =>
      consultarReputacion({ sellerName: 'X', platform: 'ML', ratingAverage: Number.NaN }, tokens),
    );
    expect(Object.hasOwn(cuerpo, 'ratingAverage')).toBe(false);
  });

  it('un cero LEIDO si viaja: es una observacion', async () => {
    const cuerpo = await cuerpoEnviado(() =>
      consultarReputacion({ sellerName: 'X', platform: 'ML', completedSales: 0 }, tokens),
    );
    expect(cuerpo['completedSales']).toBe(0);
  });
});

describe('resenas: solo las que el navegador ya renderizo', () => {
  const CON_RESENAS = `
    <div class="ui-review-capability__comments">
      <article>
        <p data-testid="comment-content-component">Llego antes de lo previsto</p>
        <span data-testid="comment-rating" aria-label="5 de 5"></span>
      </article>
      <article>
        <p data-testid="comment-content-component">No funciono y no responden</p>
      </article>
    </div>`;

  it('lee el texto de cada opinion visible', () => {
    const r = adapter.insumos(doc(CON_RESENAS)).resenas;
    expect(r).toHaveLength(2);
    expect(r[0]?.text).toBe('Llego antes de lo previsto');
  });

  it('omite el rating de la opinion que no lo muestra', () => {
    const r = adapter.insumos(doc(CON_RESENAS)).resenas;
    expect(r[0]?.rating).toBe(5);
    expect(Object.hasOwn(r[1] as object, 'rating')).toBe(false);
  });

  it('el rating ausente NO viaja como 0 en la peticion', async () => {
    const r = adapter.insumos(doc(CON_RESENAS)).resenas;
    const cuerpo = await cuerpoEnviado(() => consultarAutenticidad(r, 'Audio', tokens));
    const enviadas = cuerpo['reviews'] as Record<string, unknown>[];
    expect(enviadas[0]?.['rating']).toBe(5);
    // Un 0 aqui seria una resena de una estrella que nadie escribio.
    expect(Object.hasOwn(enviadas[1] ?? {}, 'rating')).toBe(false);
  });

  it('una ficha sin opiniones produce lista vacia, no una resena en blanco', () => {
    expect(adapter.insumos(doc('<div class="ui-pdp-container"></div>')).resenas).toHaveLength(0);
  });

  it('no duplica el mismo comentario leido por dos selectores', () => {
    const d = doc(
      '<article><p data-testid="comment-content-component">Mismo texto</p>' +
        '<p data-testid="comment-content-component">Mismo texto</p></article>',
    );
    expect(adapter.insumos(d).resenas).toHaveLength(1);
  });
});
