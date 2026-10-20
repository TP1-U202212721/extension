import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TemuAdapter } from '../../src/extraction/adapters/temu/TemuAdapter.js';
import { adapterPara } from '../../src/extraction/registry.js';

const temu = new TemuAdapter();

describe('Temu: reconocimiento de la publicacion', () => {
  it('reconoce la ficha por el goods id tras -g-', () => {
    const url = new URL('https://www.temu.com/pe-es/reloj-inteligente-deportivo-g-606298603137124.html');
    expect(temu.reconoce(url)).toBe(true);
    expect(temu.identificar(url)).toEqual({ plataforma: 'Temu', publicacionId: '606298603137124' });
  });

  it('tambien con el prefijo /pe/', () => {
    const url = new URL('https://www.temu.com/pe/aspiradora-g-607592025837768.html');
    expect(temu.identificar(url)?.publicacionId).toBe('607592025837768');
  });

  it('la portada y la busqueda son Temu, pero no son una ficha', () => {
    const portada = new URL('https://www.temu.com/pe-es/');
    const busqueda = new URL('https://www.temu.com/pe-es/search_result.html?search_key=audifonos');
    expect(temu.esPlataforma(portada)).toBe(true);
    expect(temu.reconoce(portada)).toBe(false);
    expect(temu.reconoce(busqueda)).toBe(false);
  });

  it('no confunde dominios que solo contienen el nombre', () => {
    expect(temu.esPlataforma(new URL('https://temu.com.estafa.xyz/x-g-123456789.html'))).toBe(false);
    expect(temu.esPlataforma(new URL('https://mitemu.com/'))).toBe(false);
  });

  it('el registro elige el adaptador de Temu', () => {
    expect(adapterPara('https://www.temu.com/pe-es/')?.plataforma).toBe('Temu');
  });
});

/**
 * Listado REAL de temu.com renderizado por un navegador el 2026-09-19 (la
 * portada; la busqueda redirige a ella para visitantes automatizados). Se le
 * quitaron scripts, estilos e imagenes. Temu ofusca todas las clases: la tarjeta
 * se reconoce por `data-tooltip="goodName-<id>"`.
 */
describe('Temu: tarjetas de listado sobre la pagina real', () => {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/temu/listado-portada.html'), 'utf8');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tarjetas = temu.tarjetas(doc);

  it('encuentra las tarjetas de producto', () => {
    expect(tarjetas.length).toBeGreaterThan(10);
  });

  it('cada tarjeta enlaza a una ficha, sin repetir', () => {
    for (const t of tarjetas) expect(t.href).toMatch(/-g-\d{6,}\.html/);
    expect(new Set(tarjetas.map((t) => t.href)).size).toBe(tarjetas.length);
  });
});

/**
 * Ficha REAL de temu.com/pe-en (goods 605502004140234) abierta en un navegador
 * real el 2026-09-19, reducida: el `window.rawData` conserva solo los campos que
 * se leen, sin autoria de las resenas. Es la misma fixture que usa el backend.
 */
describe('Temu: ficha real', () => {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/temu/ficha-con-resenas.html'), 'utf8');
  const URL_FICHA = 'https://www.temu.com/pe-en/aretes-g-605502004140234.html';

  /** happy-dom deja fijar la URL del documento; los tipos de `window` no lo saben. */
  const conUrl = window as unknown as { happyDOM: { setURL: (url: string) => void } };

  const cargar = (contenido: string, url: string): Document => {
    conUrl.happyDOM.setURL(url);
    document.documentElement.innerHTML = new DOMParser()
      .parseFromString(contenido, 'text/html')
      .documentElement.innerHTML;
    return document;
  };

  it('ancla el badge antes del boton principal, no en los de las recomendaciones', () => {
    const doc = cargar(html, URL_FICHA);
    const ancla = temu.anclaBadge(doc);
    expect(ancla?.textContent).toContain('Add to cart!');
    expect(ancla?.getAttribute('data-type')).toBeNull();
    expect(ancla !== null && temu.insercionBadge(ancla)).toBe('antes');
  });

  it('reconoce el clic en el boton principal de compra, aunque caiga en el texto interior', () => {
    const doc = cargar(html, URL_FICHA);
    const texto = doc.querySelector('[role="button"]:not([data-type]) span');
    expect(texto).not.toBeNull();
    expect(texto !== null && temu.esControlDeCompra(texto)).toBe(true);
  });

  it('no toma por compra el "Add to cart" de una recomendacion ni el titulo', () => {
    const doc = cargar(html, URL_FICHA);
    const recomendacion = doc.querySelector('[data-type="goodsCart"]');
    const titulo = doc.querySelector('h1');
    expect(recomendacion !== null && temu.esControlDeCompra(recomendacion)).toBe(false);
    expect(titulo !== null && temu.esControlDeCompra(titulo)).toBe(false);
  });

  it('lee la tienda: puntuacion, valoraciones y ventas de la tienda', () => {
    const { vendedor } = temu.insumos(cargar(html, URL_FICHA));
    expect(vendedor).toEqual({
      sellerName: 'Ldeal and you',
      platform: 'Temu',
      ratingAverage: 4.8,
      ratingCount: 1620,
      completedSales: 83_000,
    });
  });

  it('lee las resenas con sus estrellas, sin autoria', () => {
    const { resenas, categoria } = temu.insumos(cargar(html, URL_FICHA));
    expect(resenas).toHaveLength(4);
    expect(resenas.every((r) => r.rating === 5)).toBe(true);
    expect(resenas.map((r) => r.text)).toContain('Está hermoso, me gusta mucho.');
    expect(categoria).toBe("Women's Jewelry");
  });

  it('la categoria gruesa son los dos primeros escalones sin Home', () => {
    expect(temu.categoriaGruesa(cargar(html, URL_FICHA))).toBe("Jewelry & Accessories/Women's Jewelry");
  });

  /** Temu navega sin recargar: el script puede ser de la ficha anterior. */
  it('no usa datos que son de otra publicacion', () => {
    const doc = cargar(html, 'https://www.temu.com/pe-en/otro-g-601099512345678.html');
    expect(temu.insumos(doc)).toEqual({ vendedor: null, resenas: [], categoria: '' });
  });

  it('una tienda sin puntuacion omite la puntuacion, no manda cero', () => {
    const { vendedor } = temu.insumos(cargar(html.replace('"mallStar":4.8', '"mallStar":0'), URL_FICHA));
    expect(vendedor).not.toHaveProperty('ratingAverage');
  });

  it('sin estado inicial no hay insumos', () => {
    const doc = cargar('<html><body><h1>Algo</h1></body></html>', URL_FICHA);
    expect(temu.insumos(doc).vendedor).toBeNull();
  });
});
