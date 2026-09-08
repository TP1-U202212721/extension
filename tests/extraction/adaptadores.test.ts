import { describe, expect, it } from 'vitest';
import { AmazonAdapter } from '../../src/extraction/adapters/amazon/AmazonAdapter.js';
import { EbayAdapter } from '../../src/extraction/adapters/ebay/EbayAdapter.js';
import { AliExpressAdapter } from '../../src/extraction/adapters/aliexpress/AliExpressAdapter.js';
import { adapterPara } from '../../src/extraction/registry.js';
import { FEATURE_IDS, estaResuelta, esConocida } from '../../src/domain/features.js';
import type { MarketplaceAdapter } from '../../src/extraction/MarketplaceAdapter.js';

const doc = (html: string): Document =>
  new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html');

const NUEVOS: readonly MarketplaceAdapter[] = [
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
];

describe('reconocimiento de plataforma y de ficha', () => {
  const casos: readonly [MarketplaceAdapter, string, string | null][] = [
    [new AmazonAdapter(), 'https://www.amazon.com/dp/B0CHX1W1XY', 'B0CHX1W1XY'],
    [new AmazonAdapter(), 'https://www.amazon.es/gp/product/B0CHX1W1XY?th=1', 'B0CHX1W1XY'],
    [new AmazonAdapter(), 'https://www.amazon.com/s?k=ps5', null],
    [new EbayAdapter(), 'https://www.ebay.com/itm/166234567890', '166234567890'],
    [new EbayAdapter(), 'https://www.ebay.es/itm/algun-titulo/166234567890?hash=x', '166234567890'],
    [new EbayAdapter(), 'https://www.ebay.com/sch/i.html?_nkw=ps5', null],
    [new AliExpressAdapter(), 'https://es.aliexpress.com/item/1005006123456789.html', '1005006123456789'],
    [new AliExpressAdapter(), 'https://www.aliexpress.us/item/1005006123456789.html?spm=a2g0o', '1005006123456789'],
    [new AliExpressAdapter(), 'https://es.aliexpress.com/w/wholesale-ps5.html', null],
  ];

  it.each(casos)('%s reconoce %s', (adapter, href, esperado) => {
    const url = new URL(href);
    expect(adapter.esPlataforma(url)).toBe(true);
    expect(adapter.identificar(url)?.publicacionId ?? null).toBe(esperado);
  });

  it('el registro elige el adaptador por dominio', () => {
    expect(adapterPara('https://www.ebay.com/itm/166234567890')?.plataforma).toBe('eBay');
    expect(adapterPara('https://www.amazon.com/dp/B0CHX1W1XY')?.plataforma).toBe('Amazon');
    expect(adapterPara('https://es.aliexpress.com/item/1005006123456789.html')?.plataforma).toBe(
      'AliExpress',
    );
    expect(adapterPara('https://www.ejemplo.com/')).toBeNull();
  });

  it('no confunde dominios que solo contienen el nombre', () => {
    // `hostname.includes('amazon.')` daba positivo aqui; el ancla `(^|\.)` no.
    expect(new AmazonAdapter().esPlataforma(new URL('https://no-amazon.ejemplo.com/dp/B0CHX1W1XY'))).toBe(
      false,
    );
  });
});

describe('degradacion: documento vacio o mutilado', () => {
  it.each(NUEVOS)('$plataforma no lanza y deja todo indeterminado', (adapter) => {
    const fs = adapter.extraer(doc(''));
    expect(FEATURE_IDS.every((id) => !esConocida(fs[id]))).toBe(true);
  });

  it.each(NUEVOS)('$plataforma tolera HTML corrupto sin excepcion', (adapter) => {
    const roto = doc('<div class="x-buybox"><span>4,,,8</span><div id="acrPopover" title="">');
    expect(() => adapter.extraer(roto)).not.toThrow();
    expect(() => adapter.tarjetas(roto)).not.toThrow();
    expect(() => adapter.anclaBadge(roto)).not.toThrow();
  });
});

describe('Amazon: lectura de la ficha', () => {
  const adapter = new AmazonAdapter();

  it('lee la puntuacion del atributo title, no del texto visible', () => {
    const fs = adapter.extraer(
      doc('<span id="acrPopover" title="4.5 out of 5 stars"><span>4.5</span></span>'),
    );
    const v = fs.puntuacionDelProducto;
    expect(estaResuelta(v) && v.valor).toBe(4.5);
  });

  it('acepta la variante en espanol', () => {
    const fs = adapter.extraer(doc('<span id="acrPopover" title="4,8 de 5 estrellas"></span>'));
    const v = fs.puntuacionDelProducto;
    expect(estaResuelta(v) && v.valor).toBe(4.8);
  });

  it('lee la cantidad de valoraciones con separador de miles', () => {
    const fs = adapter.extraer(doc('<span id="acrCustomerReviewText">1,234 ratings</span>'));
    const v = fs.presenciaDeResenas;
    expect(estaResuelta(v) && v.valor).toBe(true);
    expect(estaResuelta(v) && v.evidencia).toContain('1234');
  });

  it('lee la prueba social de compras', () => {
    const fs = adapter.extraer(
      doc('<span id="social-proofing-faceout-title-tk_bought">500+ bought in past month</span>'),
    );
    const v = fs.volumenDeVentas;
    expect(estaResuelta(v) && v.valor).toBe(500);
  });

  it('sin prueba social NO asume cero ventas', () => {
    expect(adapter.extraer(doc('<div id="buybox"></div>')).volumenDeVentas.kind).toBe(
      'indeterminado',
    );
  });

  it('encuentra las tarjetas por su enlace a la ficha', () => {
    const d = doc(
      '<div data-asin="B01" data-component-type="s-search-result">' +
        '<a class="a-link-normal" href="https://www.amazon.com/dp/B01">x</a></div>',
    );
    expect(adapter.tarjetas(d)).toHaveLength(1);
  });
});

describe('eBay: prioriza el JSON-LD sobre los selectores', () => {
  const adapter = new EbayAdapter();

  it('toma la puntuacion del JSON-LD aunque el CSS diga otra cosa', () => {
    const d = doc(
      '<script type="application/ld+json">' +
        '{"@type":"Product","aggregateRating":{"ratingValue":4.7,"ratingCount":88}}</script>' +
        '<div class="x-rating__average">1.0</div>',
    );
    const fs = adapter.extraer(d);
    const v = fs.puntuacionDelProducto;
    expect(estaResuelta(v) && v.valor).toBe(4.7);
    const r = fs.presenciaDeResenas;
    expect(estaResuelta(r) && r.valor).toBe(true);
  });

  it('cae a los selectores si el JSON-LD esta corrupto', () => {
    const d = doc(
      '<script type="application/ld+json">{roto</script>' +
        '<div class="x-rating__average">4.2</div>',
    );
    const v = adapter.extraer(d).puntuacionDelProducto;
    expect(estaResuelta(v) && v.valor).toBe(4.2);
  });

  it('lee las unidades vendidas', () => {
    const fs = adapter.extraer(doc('<div class="x-quantity__availability">123 sold</div>'));
    const v = fs.volumenDeVentas;
    expect(estaResuelta(v) && v.valor).toBe(123);
  });

  it('declara la proteccion de pago cuando aparece la garantia de eBay', () => {
    const fs = adapter.extraer(doc('<a href="https://x/money-back-guarantee">g</a>'));
    const v = fs.proteccionDePago;
    expect(estaResuelta(v) && v.valor).toBe('declarada');
  });
});

describe('AliExpress: sobrevive al hash de las clases', () => {
  const adapter = new AliExpressAdapter();

  it('matchea una clase con hash generado en el build', () => {
    const fs = adapter.extraer(doc('<div class="reviewer--sold--ItfQdOK">1000+ sold</div>'));
    const v = fs.volumenDeVentas;
    expect(estaResuelta(v) && v.valor).toBe(1000);
  });

  it('descarta un numero fuera de la escala en vez de darlo por bueno', () => {
    // El selector `[class*=]` es laxo y puede capturar el precio.
    const fs = adapter.extraer(doc('<div class="rating--wrap--DQRRgb">129.90</div>'));
    expect(fs.puntuacionDelProducto.kind).toBe('indeterminado');
  });

  it('lee la puntuacion cuando si cae en la escala', () => {
    const fs = adapter.extraer(doc('<div class="reviewer--rating--xrSqSMU">4,8</div>'));
    const v = fs.puntuacionDelProducto;
    expect(estaResuelta(v) && v.valor).toBe(4.8);
  });
});
