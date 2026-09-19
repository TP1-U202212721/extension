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
