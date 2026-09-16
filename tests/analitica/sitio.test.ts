import { describe, expect, it } from 'vitest';
import { categoriaGruesa, dominioRegistrable } from '../../src/domain/analitica/sitio.js';

/**
 * La barrera de privacidad de la analitica, fijada donde se puede comprobar.
 *
 * Si alguno de estos casos empieza a fallar, la extension esta a un paso de
 * emitir la ruta de una ficha, que es exactamente lo que el paper afirma que no
 * hace.
 */
describe('dominio registrable', () => {
  const casos: readonly [string, string | null][] = [
    // La ruta revela QUE producto mira una persona. Nunca sobrevive.
    ['https://articulo.mercadolibre.com.pe/MPE-449861158-audifonos-_JM', 'mercadolibre.com.pe'],
    ['https://www.mercadolibre.com.pe/p/MPEU3173976853?ref=x#reviews', 'mercadolibre.com.pe'],
    ['https://www.amazon.com/dp/B0CHX1W1XY', 'amazon.com'],
    ['https://www.amazon.com.mx/gp/product/B0CHX1W1XY', 'amazon.com.mx'],
    ['https://es.aliexpress.com/item/1005006123456789.html', 'aliexpress.com'],
    ['https://www.ebay.es/itm/un-titulo-larguisimo/166234567890', 'ebay.es'],
    ['https://www.ebay.co.uk/itm/166234567890', 'ebay.co.uk'],
    // Sin subdominio ni puerto ni credenciales.
    ['https://tienda.oficial.mercadolibre.com.ar:8443/x', 'mercadolibre.com.ar'],
    ['HTTPS://WWW.AMAZON.COM/dp/X', 'amazon.com'],
    ['https://amazon.com.', 'amazon.com'],
  ];

  it.each(casos)('%s se reduce a %s', (href, esperado) => {
    expect(dominioRegistrable(href)).toBe(esperado);
  });

  it('nunca conserva la ruta, la query ni el fragmento', () => {
    const d = dominioRegistrable(
      'https://articulo.mercadolibre.com.pe/MPE-449861158-audifonos-bluetooth-_JM?quantity=1#opiniones',
    );
    expect(d).not.toBeNull();
    expect(d).not.toContain('/');
    expect(d).not.toContain('?');
    expect(d).not.toContain('#');
    expect(d).not.toContain('MPE');
  });

  it('descarta lo que no es un dominio que se pueda reportar', () => {
    // Una IP es un dato personal y el modulo no guarda ninguna.
    expect(dominioRegistrable('http://190.12.88.4/ficha')).toBeNull();
    expect(dominioRegistrable('http://[2001:db8::1]/x')).toBeNull();
    expect(dominioRegistrable('http://localhost:3000/x')).toBeNull();
    expect(dominioRegistrable('no es una url')).toBeNull();
    expect(dominioRegistrable('')).toBeNull();
  });
});

describe('categoria gruesa', () => {
  it('conserva como mucho dos segmentos, sin tildes y en minusculas', () => {
    expect(categoriaGruesa('Electrónica, Audio y Video/Audio/Audífonos Bluetooth')).toBe(
      'electronica audio y video/audio',
    );
  });

  it('descarta un segmento que parece un titulo de producto', () => {
    // Mas de cinco palabras: eso ya no es una categoria.
    expect(categoriaGruesa('Audifonos inalambricos bluetooth 5.3 con estuche de carga')).toBe('');
  });

  it('descarta un segmento con un identificador dentro', () => {
    expect(categoriaGruesa('Tecnologia/MPE449861158')).toBe('tecnologia');
  });

  it('acepta las migas separadas por el caracter que use la plataforma', () => {
    expect(categoriaGruesa('Tecnologia > Audio > Auriculares')).toBe('tecnologia/audio');
  });

  it('devuelve vacio cuando no se leyo nada', () => {
    expect(categoriaGruesa('')).toBe('');
    expect(categoriaGruesa('   /  / ')).toBe('');
  });
});
