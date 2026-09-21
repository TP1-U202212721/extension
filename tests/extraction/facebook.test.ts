import { describe, expect, it } from 'vitest';
import { FacebookAdapter } from '../../src/extraction/adapters/facebook/FacebookAdapter.js';
import { datosDelPerfil } from '../../src/extraction/adapters/facebook/insumos.js';
import { textoEmbebido } from '../../src/extraction/adapters/facebook/relay.js';
import { adapterPara } from '../../src/extraction/registry.js';

const fb = new FacebookAdapter();

describe('Facebook: reconocimiento de la publicacion', () => {
  it('reconoce la ficha por el id tras /marketplace/item/', () => {
    const url = new URL('https://www.facebook.com/marketplace/item/1234567890123456/');
    expect(fb.reconoce(url)).toBe(true);
    expect(fb.identificar(url)).toEqual({
      plataforma: 'Facebook Marketplace',
      publicacionId: '1234567890123456',
    });
  });

  it('el perfil del vendedor y la portada son Facebook, pero no son una ficha', () => {
    const perfil = new URL('https://www.facebook.com/marketplace/profile/100011122233344/');
    expect(fb.esPlataforma(perfil)).toBe(true);
    expect(fb.reconoce(perfil)).toBe(false);
    expect(fb.reconoce(new URL('https://www.facebook.com/marketplace/'))).toBe(false);
  });

  it('no confunde dominios que solo contienen el nombre', () => {
    expect(fb.esPlataforma(new URL('https://facebook.com.ofertas.xyz/marketplace/item/1234567890123456'))).toBe(
      false,
    );
    expect(fb.esPlataforma(new URL('https://mifacebook.com/'))).toBe(false);
  });

  it('el registro elige el adaptador de Facebook', () => {
    expect(adapterPara('https://www.facebook.com/marketplace/')?.plataforma).toBe(
      'Facebook Marketplace',
    );
  });
});

/**
 * Documento DERIVADO: reproduce la forma del estado que Facebook incrusta, con
 * los mismos campos que leia el scraper por URL del backend (`FacebookHelper`).
 * Los patrones siguen PENDIENTES de verificar contra una ficha real: Facebook
 * exige sesion iniciada y no se pudo capturar con un navegador automatizado.
 */
const estado = (extra: string): string =>
  `{"data":{"viewer":{"marketplace_product_details_page":{"target":{"id":"1234567890123456",` +
  `"marketplace_listing_title":"Bicicleta montanera rodado 29",` +
  `"marketplace_listing_category":{"name":"Bicicletas","seo_info":{"seo_url":"/marketplace/category/bikes"}},` +
  `"story":{"actors":[{"name":"Juan P\\u00e9rez"},"commerce_badges_info":{"badges":[{"text":"Calificaci\\u00f3n alta"}]}]},` +
  `"seller":{"id":"100011122233344","short_name":"Juan"}${extra}}}}}}`;

const cargar = (json: string, html = ''): Document =>
  new DOMParser().parseFromString(
    `<!DOCTYPE html><html><head><title>Marketplace</title></head><body>${html}` +
      `<script>requireLazy(["RelayPrefetchedStreamCache"],function(c){c.next("x",${json})})</script>` +
      `</body></html>`,
    'text/html',
  );

describe('Facebook: lo que publica la ficha', () => {
  const doc = cargar(estado(''));

  it('lee al vendedor con su distintivo, sin inventar lo que no esta', () => {
    const { vendedor } = fb.insumos(doc);
    expect(vendedor).toEqual({
      sellerName: 'Juan Pérez',
      platform: 'Facebook Marketplace',
      isRecognizedSeller: true,
      badgeLabel: 'Calificación alta',
    });
  });

  it('lee la categoria de la publicacion', () => {
    expect(fb.insumos(doc).categoria).toBe('Bicicletas');
    expect(fb.categoriaGruesa(doc)).toBe('Bicicletas');
  });

  /** Las calificaciones viven en el perfil: en la ficha no hay ninguna. */
  it('no trae resenas', () => {
    expect(fb.insumos(doc).resenas).toEqual([]);
  });

  it('encuentra el perfil del vendedor por el enlace de la ficha', () => {
    const conEnlace = cargar(
      estado(''),
      '<a href="/marketplace/profile/100055566677788/">Ver perfil</a>',
    );
    expect(fb.perfilDelVendedor(conEnlace)).toBe(
      'https://www.facebook.com/marketplace/profile/100055566677788/',
    );
  });

  /** Si la maquetacion cambia y el enlace no esta, queda el id del estado. */
  it('y si no hay enlace, por el id del vendedor en el estado', () => {
    expect(fb.perfilDelVendedor(doc)).toBe(
      'https://www.facebook.com/marketplace/profile/100011122233344/',
    );
  });

  it('sin vendedor reconocible no devuelve datos ni perfil', () => {
    const vacio = cargar('{"data":{}}');
    expect(fb.insumos(vacio).vendedor).toBeNull();
    expect(fb.perfilDelVendedor(vacio)).toBeNull();
  });
});

describe('Facebook: lo que publica el perfil del vendedor', () => {
  const PERFIL =
    `,"marketplace_followers":{"count":312}` +
    `,"five_star_ratings_average":4.6` +
    `,"seller_buyer_combined":{"five_star_total_rating_count_by_role":27}` +
    `,"listings":[` +
    `{"__typename":"GroupCommerceProductItem","id":"991100","is_live":true,"is_sold":false},` +
    `{"__typename":"GroupCommerceProductItem","id":"991101","is_live":true,"is_sold":false},` +
    `{"__typename":"GroupCommerceProductItem","id":"991102","is_live":true,"is_sold":true}]`;

  const doc = cargar(estado(PERFIL));

  it('lee promedio y cantidad de calificaciones', () => {
    const { vendedor } = fb.insumos(doc);
    expect(vendedor?.ratingAverage).toBe(4.6);
    expect(vendedor?.ratingCount).toBe(27);
  });

  it('lee seguidores y publicaciones activas, sin contar las vendidas', () => {
    expect(datosDelPerfil(textoEmbebido(doc))).toEqual({
      seguidores: 312,
      publicacionesActivas: 2,
    });
  });

  it('lo que el perfil no publica se omite, no se manda en cero', () => {
    const sinNada = cargar(estado(''));
    expect(datosDelPerfil(textoEmbebido(sinNada))).toEqual({});
    expect(fb.insumos(sinNada).vendedor).not.toHaveProperty('ratingAverage');
  });

  it('lee las valoraciones con sus estrellas, sin quien las escribio', () => {
    const relleno = 'x'.repeat(220);
    const conResenas = cargar(
      estado(
        `,"ratings":[` +
          `{"__typename":"MarketplaceC2CSellerRating","rating_value":"FIVE_STAR_FIVE","review_text":"Todo bien, muy puntual","rater_name":"Ana","relleno":"${relleno}","cursor":"1"},` +
          `{"__typename":"MarketplaceC2CSellerRating","rating_value":"FIVE_STAR_TWO","review_text":"Nunca llego el producto","rater_name":"Luis","relleno":"${relleno}","cursor":"2"}]`,
      ),
    );
    const { resenas } = fb.insumos(conResenas);
    expect(resenas).toEqual([
      { text: 'Todo bien, muy puntual', rating: 5 },
      { text: 'Nunca llego el producto', rating: 2 },
    ]);
  });
});

describe('Facebook: tarjetas del listado', () => {
  it('cada tarjeta es el contenedor con la imagen, y no la grilla entera', () => {
    const doc = cargar(
      '{"data":{}}',
      `<div class="grilla">
         <div class="t"><a href="/marketplace/item/1111111111111111/"><img src="data:,"><span>Uno</span></a></div>
         <div class="t"><a href="/marketplace/item/2222222222222222/"><img src="data:,"><span>Dos</span></a></div>
       </div>`,
    );
    const tarjetas = fb.tarjetas(doc);
    expect(tarjetas).toHaveLength(2);
    for (const t of tarjetas) {
      expect(t.href).toMatch(/\/marketplace\/item\/\d{10,20}/);
      expect(t.elemento.className).not.toBe('grilla');
    }
  });
});
