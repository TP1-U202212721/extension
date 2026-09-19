import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AliExpressAdapter } from '../../src/extraction/adapters/aliexpress/AliExpressAdapter.js';

/**
 * Ficha REAL de es.aliexpress.com (item 1005012464953693) renderizada por un
 * navegador el 2026-09-19. Es la que se reporto con "No hay resenas que verificar"
 * pese a tener 8 valoraciones: el adaptador devolvia insumos vacios.
 *
 * Se le quitaron scripts, estilos y el contenido de los svg; la autoria de las
 * resenas se reemplazo por A***o.
 */
// Ruta desde la raiz del proyecto: con happy-dom, import.meta.url no es file://.
const ficha = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/aliexpress/ficha-resenas-sin-texto.html'),
  'utf8',
);
const doc = new DOMParser().parseFromString(ficha, 'text/html');
const insumos = new AliExpressAdapter().insumos(doc);

describe('AliExpress: insumos sobre una ficha real', () => {
  it('identifica la tienda', () => {
    expect(insumos.vendedor?.sellerName).toBeTruthy();
    expect(insumos.vendedor?.platform).toBe('AliExpress');
  });

  /** "90.6% valoraciones positivas" -> 9.4% negativas. */
  it('manda la proporcion negativa como complemento del porcentaje positivo', () => {
    expect(insumos.vendedor?.negativeRatingShare).toBeCloseTo(0.094, 3);
  });

  /**
   * Las ventas y la puntuacion de la ficha son de la PUBLICACION, no de la tienda:
   * no pueden viajar como si fueran del vendedor.
   */
  it('no confunde datos de la publicacion con datos de la tienda', () => {
    expect(insumos.vendedor).not.toHaveProperty('completedSales');
    expect(insumos.vendedor).not.toHaveProperty('ratingAverage');
    expect(insumos.vendedor).not.toHaveProperty('badgeTier');
  });

  it('lee las resenas con texto y descarta las que solo tienen estrellas', () => {
    expect(insumos.resenas).toHaveLength(1);
    expect(insumos.resenas[0]?.text).toContain('entregado y a tiempo');
    expect(insumos.resenas[0]?.rating).toBe(5);
  });

  it('no manda la autoria de las resenas', () => {
    for (const r of insumos.resenas) expect(r.text).not.toContain('A***o');
  });
});
