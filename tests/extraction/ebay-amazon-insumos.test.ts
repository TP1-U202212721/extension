import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AmazonAdapter } from '../../src/extraction/adapters/amazon/AmazonAdapter.js';
import { EbayAdapter } from '../../src/extraction/adapters/ebay/EbayAdapter.js';

// Ruta desde la raiz del proyecto: con happy-dom, import.meta.url no es file://.
const cargar = (ruta: string): Document =>
  new DOMParser().parseFromString(
    readFileSync(resolve(process.cwd(), 'tests/fixtures', ruta), 'utf8'),
    'text/html',
  );

const ebay = new EbayAdapter();
const amazon = new AmazonAdapter();

/**
 * Fichas REALES de ebay.com abiertas en un navegador real el 2026-09-19. Son las
 * mismas fixtures que usa el backend (ScamShieldTests/.../Fixtures/Ebay).
 */
describe('eBay: ficha real', () => {
  const topRated = cargar('ebay/ficha-top-rated.html');

  it('lee al vendedor: porcentaje, valoraciones, ventas, antiguedad y distintivo', () => {
    expect(ebay.insumos(topRated).vendedor).toEqual({
      sellerName: 'Beauty2007',
      platform: 'eBay',
      negativeRatingShare: 0.013,
      completedSales: 68_000,
      ratingCount: 13_968,
      memberSinceYear: 2024,
      isRecognizedSeller: true,
      badgeLabel: 'Top Rated Plus',
    });
  });

  it('sin distintivo no lo inventa, y el "Top Rated" del pie no cuenta', () => {
    const vendedor = ebay.insumos(cargar('ebay/ficha-tienda-de-marca.html')).vendedor;
    expect(vendedor?.sellerName).toBe('Cleer Audio');
    expect(vendedor?.negativeRatingShare).toBe(0);
    expect(vendedor?.memberSinceYear).toBe(2013);
    expect(vendedor).not.toHaveProperty('isRecognizedSeller');
  });

  it('lee solo las valoraciones de este articulo, sin las automaticas de eBay', () => {
    const { resenas, categoria } = ebay.insumos(topRated);
    expect(resenas).toHaveLength(7);
    expect(resenas.every((r) => r.rating === 5)).toBe(true);
    expect(resenas.some((r) => r.text.startsWith('Order delivered on time'))).toBe(false);
    expect(categoria).toBe('Headsets');
  });

  it('la categoria gruesa son los dos primeros escalones', () => {
    expect(ebay.categoriaGruesa(topRated)).toBe('Electronics/Cell Phones & Accessories');
  });

  it('ancla el badge antes de los botones de compra', () => {
    const ancla = ebay.anclaBadge(topRated);
    expect(ancla?.getAttribute('data-testid')).toBe('x-buybox-cta');
    expect(ancla !== null && ebay.insercionBadge(ancla)).toBe('antes');
  });

  it('reconoce los botones de compra', () => {
    expect(topRated.querySelector(ebay.selectoresDeCompra().join(','))).not.toBeNull();
  });
});

/** Busqueda REAL de ebay.com, recortada a sus 12 primeras tarjetas. */
describe('eBay: tarjetas del listado real', () => {
  const tarjetas = ebay.tarjetas(cargar('ebay/listado-busqueda.html'));

  /** Las dos primeras tarjetas son plantillas de eBay que enlazan a /itm/123456. */
  it('encuentra las tarjetas li.s-card, sin la plantilla, y cada una enlaza a una ficha', () => {
    expect(tarjetas).toHaveLength(10);
    for (const t of tarjetas) expect(t.href).toMatch(/\/itm\/\d{11,12}/);
  });
});

/**
 * Fichas REALES de amazon.com renderizadas en espanol el 2026-09-19. Son las
 * mismas fixtures que usa el backend (ScamShieldTests/.../Fixtures/Amazon).
 */
describe('Amazon: ficha real', () => {
  const conResenas = cargar('amazon/ficha-con-resenas.html');

  it('del vendedor externo solo viaja el nombre: su reputacion no esta en la ficha', () => {
    expect(amazon.insumos(conResenas).vendedor).toEqual({ sellerName: 'duanyuekj', platform: 'Amazon' });
  });

  it('lee las resenas renderizadas con sus estrellas, sin autoria', () => {
    const { resenas, categoria } = amazon.insumos(conResenas);
    expect(resenas).toHaveLength(13);
    expect(resenas.every((r) => r.rating !== undefined && r.rating >= 1 && r.rating <= 5)).toBe(true);
    expect(resenas.some((r) => r.text.includes('double tap'))).toBe(false);
    expect(categoria).toBe('Audífonos Intraurales');
  });

  it('sin resenas renderizadas no inventa ninguna', () => {
    expect(amazon.insumos(cargar('amazon/ficha-sin-resenas-renderizadas.html')).resenas).toEqual([]);
  });

  it('la categoria gruesa son los dos primeros escalones', () => {
    expect(amazon.categoriaGruesa(conResenas)).toBe('Electrónica/Audífonos, auriculares y accesorios');
  });

  it('ancla el badge en la caja de compra y reconoce sus botones', () => {
    expect(amazon.anclaBadge(conResenas)?.id).toBe('desktop_buybox');
    expect(conResenas.querySelector(amazon.selectoresDeCompra().join(','))).not.toBeNull();
  });
});

/** Busqueda REAL de amazon.com, recortada a sus 10 primeros resultados. */
describe('Amazon: tarjetas del listado real', () => {
  const tarjetas = amazon.tarjetas(cargar('amazon/listado-busqueda.html'));

  /** 3 de los 10 son patrocinados: enlazan a una redireccion, no a la ficha. */
  it('encuentra los resultados organicos y cada uno enlaza a una ficha', () => {
    expect(tarjetas).toHaveLength(7);
    for (const t of tarjetas) expect(t.href).toMatch(/\/(dp|gp\/product)\//);
  });
});

/**
 * eBay cambio la maqueta de las valoraciones: ya no hay pestanas por articulo
 * sino un desplegable, y la lista es la del vendedor ("Seller feedback (646)").
 * Verificado el 2026-09-22 sobre una ficha real. Con el selector viejo la
 * extension devolvia CERO resenas aunque la pagina mostrara ocho, y eso dejaba
 * la dimension comunitaria vacia: el veredicto salia siempre
 * "evidencia insuficiente", incluso con el vendedor en rojo.
 */
describe('eBay: la maqueta nueva de valoraciones', () => {
  const conDesplegable = (): Document =>
    new DOMParser().parseFromString(
      `<html><body><div class="fdbk-detail-list">
        <h2 class="fdbk-detail-list__title"><span>Seller feedback</span><span>(646)</span></h2>
        <div class="fdbk-detail-list__rating-filter"><button>All ratings</button></div>
        <div class="fdbk-container">
          <span class="fdbk-container__details__info__username">u***g (65)</span>
          <span data-test-type="positive"></span>
          <div class="fdbk-container__details__comment">Item came exactly as described.</div>
        </div>
        <div class="fdbk-container">
          <span class="fdbk-container__details__info__username">eBay automated feedback</span>
          <span data-test-type="positive"></span>
          <div class="fdbk-container__details__comment">Comentario automatizado.</div>
        </div>
        <div class="fdbk-container">
          <span class="fdbk-container__details__info__username">a***b (12)</span>
          <span data-test-type="negative"></span>
          <div class="fdbk-container__details__comment">Nunca llego el paquete.</div>
        </div>
      </div></body></html>`,
      'text/html',
    );

  it('lee las valoraciones aunque ya no haya pestanas', () => {
    expect(ebay.insumos(conDesplegable()).resenas).toEqual([
      { text: 'Item came exactly as described.', rating: 5 },
      { text: 'Nunca llego el paquete.', rating: 1 },
    ]);
  });

  it('sigue leyendo la maqueta con pestanas', () => {
    const conPestanas = new DOMParser().parseFromString(
      `<html><body><div class="fdbk-detail-list">
        <div role="tabpanel"><div class="fdbk-container">
          <span class="fdbk-container__details__info__username">c***d (9)</span>
          <span data-test-type="positive"></span>
          <div class="fdbk-container__details__comment">Todo perfecto.</div>
        </div></div>
      </div></body></html>`,
      'text/html',
    );

    expect(ebay.insumos(conPestanas).resenas).toEqual([{ text: 'Todo perfecto.', rating: 5 }]);
  });
});
