import { describe, expect, it } from 'vitest';
import { AmazonAdapter } from '../../src/extraction/adapters/amazon/AmazonAdapter.js';
import { EbayAdapter } from '../../src/extraction/adapters/ebay/EbayAdapter.js';
import { AliExpressAdapter } from '../../src/extraction/adapters/aliexpress/AliExpressAdapter.js';
import { MercadoLibreAdapter } from '../../src/extraction/adapters/mercadolibre/MercadoLibreAdapter.js';
import { adapterPara } from '../../src/extraction/registry.js';
import type { MarketplaceAdapter } from '../../src/extraction/MarketplaceAdapter.js';

const doc = (html: string): Document =>
  new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html');

const TODOS: readonly MarketplaceAdapter[] = [
  new MercadoLibreAdapter(),
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
];

describe('identificacion de la publicacion', () => {
  const casos: readonly [MarketplaceAdapter, string, string | null][] = [
    [new MercadoLibreAdapter(), 'https://articulo.mercadolibre.com.pe/MPE-449861158-x-_JM', 'MPE449861158'],
    [new MercadoLibreAdapter(), 'https://www.mercadolibre.com.pe/x/p/MPEU3173976853', 'MPEU3173976853'],
    [new AmazonAdapter(), 'https://www.amazon.com/dp/B0CHX1W1XY', 'B0CHX1W1XY'],
    [new AmazonAdapter(), 'https://www.amazon.es/gp/product/B0CHX1W1XY?th=1', 'B0CHX1W1XY'],
    [new AmazonAdapter(), 'https://www.amazon.com/s?k=ps5', null],
    [new EbayAdapter(), 'https://www.ebay.com/itm/166234567890', '166234567890'],
    [new EbayAdapter(), 'https://www.ebay.es/itm/un-titulo/166234567890?hash=x', '166234567890'],
    [new EbayAdapter(), 'https://www.ebay.com/sch/i.html?_nkw=ps5', null],
    [new AliExpressAdapter(), 'https://es.aliexpress.com/item/1005006123456789.html', '1005006123456789'],
    [new AliExpressAdapter(), 'https://es.aliexpress.com/w/wholesale-ps5.html', null],
  ];

  it.each(casos)('%s en %s', (adapter, href, esperado) => {
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
    const url = new URL('https://no-amazon.ejemplo.com/dp/B0CHX1W1XY');
    expect(new AmazonAdapter().esPlataforma(url)).toBe(false);
  });
});

describe('presentacion: nunca lanza sobre un documento cualquiera', () => {
  it.each(TODOS)('$plataforma tolera HTML vacio o corrupto', (adapter) => {
    for (const html of ['', '<div class="x-buybox"><span>roto', '<a href="#">x</a>']) {
      expect(() => adapter.anclaBadge(doc(html))).not.toThrow();
      expect(() => adapter.tarjetas(doc(html))).not.toThrow();
    }
  });

  it.each(TODOS)('$plataforma no inventa tarjetas donde no las hay', (adapter) => {
    expect(adapter.tarjetas(doc('<p>nada</p>'))).toHaveLength(0);
  });

  it('Amazon encuentra la tarjeta por su enlace a la ficha', () => {
    const d = doc(
      '<div data-asin="B01" data-component-type="s-search-result">' +
        '<a href="https://www.amazon.com/dp/B01">x</a></div>',
    );
    expect(new AmazonAdapter().tarjetas(d)).toHaveLength(1);
  });

  it('Mercado Libre sube desde el enlace hasta la tarjeta', () => {
    const d = doc('<div class="poly-card"><div><a href="/MPE-449861158-x-_JM">x</a></div></div>');
    const t = new MercadoLibreAdapter().tarjetas(d);
    expect(t).toHaveLength(1);
    expect(t[0]?.elemento.className).toContain('poly-card');
  });
});

/**
 * Regresion: en AliExpress el badge se insertaba como primer hijo del boton
 * "Comprar ahora" y lo tapaba entero. Junto a un control va ANTES, como hermano;
 * dentro solo cuando el ancla es un contenedor.
 */
describe('AliExpress: el badge no tapa el boton de comprar', () => {
  const ali = new AliExpressAdapter();

  it('se ancla al boton de comprar y va antes que el, no dentro', () => {
    const d = doc(`
      <div class="product-action--wrap">
        <div class="buy-now--buynow--x1"><button data-pl="product-buy-now">Comprar ahora</button></div>
        <button data-pl="product-add-to-cart">Agregar al carrito</button>
      </div>`);
    const ancla = ali.anclaBadge(d);
    expect(ancla?.getAttribute('data-pl')).toBe('product-buy-now');
    expect(ancla !== null && ali.insercionBadge(ancla)).toBe('antes');
  });

  it('sin boton reconocible, cae al contenedor y ahi si va dentro', () => {
    const d = doc(`<div class="pdp-info-right--r1"><p>Cantidad</p></div>`);
    const ancla = ali.anclaBadge(d);
    expect(ancla?.className).toContain('pdp-info-right');
    expect(ancla !== null && ali.insercionBadge(ancla)).toBe('dentro');
  });
});
