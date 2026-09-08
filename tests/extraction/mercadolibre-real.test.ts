import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MercadoLibreAdapter } from '../../src/extraction/adapters/mercadolibre/MercadoLibreAdapter.js';
import { leerProducto } from '../../src/extraction/adapters/mercadolibre/jsonLd.js';
import { esConocida } from '../../src/domain/features.js';

/**
 * Tests contra estructuras capturadas de una ficha real de MercadoLibre Peru,
 * no contra un fixture inventado. Cada asercion refleja un dato que estaba
 * efectivamente en la pagina.
 */
const doc = (): Document =>
  new DOMParser().parseFromString(
    readFileSync(join(__dirname, '../fixtures/mercadolibre/ficha-real-ps5.html'), 'utf-8'),
    'text/html',
  );

const adapter = new MercadoLibreAdapter();

describe('JSON-LD de la ficha real', () => {
  it('encuentra el nodo Product entre varios bloques ld+json', () => {
    const ld = leerProducto(doc());
    expect(ld).not.toBeNull();
    expect(ld?.ratingValue).toBe(4.9);
    expect(ld?.reviewCount).toBe(9);
    expect(ld?.ratingCount).toBe(24);
    expect(ld?.price).toBe(2479);
  });

  it('no lanza con un ld+json corrupto', () => {
    const roto = new DOMParser().parseFromString(
      '<html><head><script type="application/ld+json">{no es json</script></head><body></body></html>',
      'text/html',
    );
    expect(() => leerProducto(roto)).not.toThrow();
    expect(leerProducto(roto)).toBeNull();
  });
});

describe('MercadoLibreAdapter contra la ficha real', () => {
  const f = adapter.extraer(doc());

  it('lee la puntuacion de los datos estructurados, no del DOM', () => {
    // En esta ficha la seccion de opiniones esta oculta: no existe ningun nodo
    // .ui-pdp-review__rating. El dato solo esta en el JSON-LD.
    expect(f.puntuacionDelProducto).toMatchObject({ kind: 'conocido', valor: 4.9 });
  });

  it('detecta que hay resenas por el reviewCount', () => {
    expect(f.presenciaDeResenas).toMatchObject({ kind: 'conocido', valor: true });
  });

  it('lee las ventas del resumen del vendedor', () => {
    // "+5 ventas" vive en .ui-pdp-seller-summary__header__subtitle.
    // El .ui-pdp-subtitle de esta ficha solo dice "Nuevo".
    expect(f.volumenDeVentas).toMatchObject({ kind: 'conocido', valor: 5 });
  });

  it('detecta la proteccion de pago por el enlace de compra protegida', () => {
    expect(f.proteccionDePago).toMatchObject({ kind: 'conocido', valor: 'declarada' });
  });

  it('detecta la garantia declarada en la descripcion', () => {
    expect(esConocida(f.politicasDeGarantia)).toBe(true);
  });

  it('resuelve las cinco caracteristicas de cliente', () => {
    for (const id of [
      'proteccionDePago',
      'puntuacionDelProducto',
      'presenciaDeResenas',
      'politicasDeGarantia',
      'volumenDeVentas',
    ] as const) {
      expect(esConocida(f[id]), `${id} deberia resolverse en la ficha real`).toBe(true);
    }
  });

  it('encuentra el ancla del badge en el buybox real', () => {
    expect(adapter.anclaBadge(doc())).not.toBeNull();
  });

  it('reconoce la URL canonica de la ficha', () => {
    const url = new URL(
      'https://www.mercadolibre.com.pe/ps5-playstation-5-1-tb-nuevo-caja-sellada-garantia-1-ano/up/MPEU2463052894',
    );
    expect(adapter.reconoce(url)).toBe(true);
    expect(adapter.identificar(url)?.publicacionId).toBe('MPEU2463052894');
  });
});
