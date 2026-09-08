import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MercadoLibreAdapter } from '../../src/extraction/adapters/mercadolibre/MercadoLibreAdapter.js';
import { FEATURE_IDS, FEATURE_META, esConocida } from '../../src/domain/features.js';

const cargar = (nombre: string): Document => {
  const html = readFileSync(join(__dirname, '../fixtures/mercadolibre', nombre), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
};

const adapter = new MercadoLibreAdapter();

describe('MercadoLibreAdapter · reconocimiento de URL', () => {
  it('reconoce una ficha de producto', () => {
    const url = new URL('https://www.mercadolibre.com.pe/algo/up/MPEU3173976853');
    expect(adapter.reconoce(url)).toBe(true);
    expect(adapter.identificar(url)?.publicacionId).toBe('MPEU3173976853');
  });

  it('no reconoce la home ni una busqueda', () => {
    expect(adapter.reconoce(new URL('https://www.mercadolibre.com.pe/'))).toBe(false);
    expect(adapter.reconoce(new URL('https://listado.mercadolibre.com.pe/taladro'))).toBe(false);
  });

  it('no reconoce otra plataforma', () => {
    expect(adapter.reconoce(new URL('https://www.amazon.com/dp/B00TEST'))).toBe(false);
  });
});

describe('MercadoLibreAdapter · ficha completa', () => {
  const f = adapter.extraer(cargar('ficha-completa.html'));

  it('resuelve las cinco caracteristicas de cliente', () => {
    const cliente = FEATURE_IDS.filter((id) => FEATURE_META[id].origen === 'cliente');
    expect(cliente).toHaveLength(5);
    for (const id of cliente) {
      expect(esConocida(f[id]), `${id} deberia estar resuelta`).toBe(true);
    }
  });

  it('deja indeterminadas las tres de backend', () => {
    const backend = FEATURE_IDS.filter((id) => FEATURE_META[id].origen === 'backend');
    expect(backend).toHaveLength(3);
    for (const id of backend) {
      expect(f[id].kind).toBe('indeterminado');
    }
  });

  it('lee la puntuacion', () => {
    expect(f.puntuacionDelProducto).toMatchObject({ kind: 'conocido', valor: 4.8 });
  });

  it('lee las ventas expandiendo el "+500"', () => {
    expect(f.volumenDeVentas).toMatchObject({ kind: 'conocido', valor: 500 });
  });

  it('detecta la proteccion de pago por el enlace de compra protegida', () => {
    expect(f.proteccionDePago).toMatchObject({ kind: 'conocido', valor: 'declarada' });
  });

  it('detecta la garantia por separado de la proteccion de pago', () => {
    // El backend de TP1 usa el mismo selector para ambas y salen siempre
    // identicas (MercadoLibreHelper.cs:186). Aqui deben medir cosas distintas.
    expect(esConocida(f.politicasDeGarantia)).toBe(true);
    expect(f.politicasDeGarantia).not.toEqual(f.proteccionDePago);
  });

  it('detecta que hay resenas', () => {
    expect(f.presenciaDeResenas).toMatchObject({ kind: 'conocido', valor: true });
  });

  it('cada caracteristica resuelta trae su evidencia en texto', () => {
    for (const id of FEATURE_IDS) {
      const v = f[id];
      if (v.kind === 'conocido') expect(v.evidencia.length).toBeGreaterThan(10);
    }
  });
});

describe('MercadoLibreAdapter · degradacion', () => {
  it('ante una remaquetacion no lanza y degrada a indeterminado', () => {
    expect(() => adapter.extraer(cargar('ficha-degradada.html'))).not.toThrow();
    const f = adapter.extraer(cargar('ficha-degradada.html'));
    for (const id of FEATURE_IDS) {
      expect(f[id].kind, `${id} deberia quedar indeterminada`).toBe('indeterminado');
    }
  });

  it('ante un documento vacio tampoco lanza', () => {
    const vacio = new DOMParser().parseFromString('<html></html>', 'text/html');
    expect(() => adapter.extraer(vacio)).not.toThrow();
  });

  it('nunca devuelve un valor por defecto que se confunda con una observacion', () => {
    const f = adapter.extraer(cargar('ficha-degradada.html'));
    // El bug del backend de TP1: un selector que falla produce 0, indistinguible
    // de "cero ventas confirmadas". Aqui eso no puede pasar.
    expect(esConocida(f.volumenDeVentas)).toBe(false);
    expect(esConocida(f.puntuacionDelProducto)).toBe(false);
  });
});

describe('MercadoLibreAdapter · parseo de numeros', () => {
  // Regresion: aNumero trataba el punto siempre como separador de millar, asi
  // que "4.8" se convertia en 48 y la puntuacion caia a indeterminado.
  const conPuntuacion = (texto: string): Document =>
    new DOMParser().parseFromString(
      `<html><body><span class="ui-pdp-review__rating">${texto}</span></body></html>`,
      'text/html',
    );

  it.each([
    ['4.8', 4.8],
    ['4,8', 4.8],
    ['5', 5],
    ['3.25', 3.25],
  ])('lee la puntuacion "%s" como %s', (texto, esperado) => {
    expect(adapter.extraer(conPuntuacion(texto)).puntuacionDelProducto).toMatchObject({
      kind: 'conocido',
      valor: esperado,
    });
  });

  it('rechaza una puntuacion fuera de rango en vez de aceptarla', () => {
    expect(adapter.extraer(conPuntuacion('48')).puntuacionDelProducto.kind).toBe('indeterminado');
  });

  const conVentas = (texto: string): Document =>
    new DOMParser().parseFromString(
      `<html><body><span class="ui-pdp-subtitle">${texto}</span></body></html>`,
      'text/html',
    );

  it.each([
    ['Nuevo | +500 vendidos', 500],
    ['Nuevo | 1.250 vendidos', 1250],
    ['Nuevo | 1.2mil vendidos', 1200],
    ['Nuevo | 12 vendidos', 12],
  ])('lee las ventas de "%s" como %s', (texto, esperado) => {
    expect(adapter.extraer(conVentas(texto)).volumenDeVentas).toMatchObject({
      kind: 'conocido',
      valor: esperado,
    });
  });

  it('un subtitulo sin ventas queda indeterminado, no en cero', () => {
    expect(adapter.extraer(conVentas('Nuevo')).volumenDeVentas.kind).toBe('indeterminado');
  });
});

describe('MercadoLibreAdapter · ids de publicacion', () => {
  it.each([
    'https://www.mercadolibre.com.pe/algo/up/MPEU3173976853',
    'https://articulo.mercadolibre.com.pe/MPE-123456789-taladro-_JM',
    'https://articulo.mercadolibre.com.ar/MLA-987654321-algo-_JM',
  ])('reconoce %s', (href) => {
    expect(adapter.reconoce(new URL(href))).toBe(true);
  });
});
