import { describe, expect, it } from 'vitest';
import { FacebookAdapter } from '../../src/extraction/adapters/facebook/FacebookAdapter.js';
import { datosDelPerfil } from '../../src/extraction/adapters/facebook/insumos.js';
import {
  bloqueDeLaFicha,
  cuantasFotos,
  descuento,
  perfilDesdeElDom,
  textoEmbebido,
} from '../../src/extraction/adapters/facebook/relay.js';
import { adapterPara } from '../../src/extraction/registry.js';

const fb = new FacebookAdapter();

const ID = '1234567890123456';
const URL_FICHA = `https://www.facebook.com/marketplace/item/${ID}/`;

describe('Facebook: reconocimiento de la publicacion', () => {
  it('reconoce la ficha por el id tras /marketplace/item/', () => {
    const url = new URL(URL_FICHA);
    expect(fb.reconoce(url)).toBe(true);
    expect(fb.identificar(url)).toEqual({
      plataforma: 'Facebook Marketplace',
      publicacionId: ID,
    });
  });

  it('el perfil del vendedor y la portada son Facebook, pero no son una ficha', () => {
    const perfil = new URL('https://www.facebook.com/marketplace/profile/100011122233344/');
    expect(fb.esPlataforma(perfil)).toBe(true);
    expect(fb.reconoce(perfil)).toBe(false);
    expect(fb.reconoce(new URL('https://www.facebook.com/marketplace/'))).toBe(false);
  });

  it('no confunde dominios que solo contienen el nombre', () => {
    expect(
      fb.esPlataforma(new URL(`https://facebook.com.ofertas.xyz/marketplace/item/${ID}`)),
    ).toBe(false);
    expect(fb.esPlataforma(new URL('https://mifacebook.com/'))).toBe(false);
  });

  it('el registro elige el adaptador de Facebook', () => {
    expect(adapterPara('https://www.facebook.com/marketplace/')?.plataforma).toBe(
      'Facebook Marketplace',
    );
  });
});

/**
 * Estado con la forma REAL que Facebook incrusta, comprobada sobre una publicacion
 * de facebook.com/marketplace el 2026-09-21 (sin sesion iniciada).
 *
 * Trae dos publicaciones a proposito: la abierta y una relacionada. La pagina real
 * traia 22, y leer sin acotar devolvia el titulo y el precio de otra.
 */
const registro = (
  id: string,
  titulo: string,
  precio: string,
  tachado: string,
  extra = '',
): string =>
  // El titulo vive en un registro diminuto y el resto cuelga de su padre, que es
  // como Facebook lo manda de verdad.
  `{"story":{"__typename":"GroupCommerceProductItem","id":"${id}",` +
  `"marketplace_listing_title":"${titulo}","base_marketplace_listing_title":"${titulo}"},` +
  `"listing_price":{"amount":"${precio}","formatted_amount":"PEN ${precio}"},` +
  `"strikethrough_price":${tachado === '' ? 'null' : `{"amount":"${tachado}"}`},` +
  `"redacted_description":{"text":"Alquilo para matrimonios, acepto yape. Sin garantia."},` +
  `"marketplace_listing_category":{"slug":"${titulo.startsWith('Nissan') ? 'vehicles' : 'bikes'}","id":"759201041254543"},` +
  `"marketplace_listing_seller":null,"commerce_badges_info":{"source_summary":null,"badges":[]},` +
  `"is_live":true${extra}}`;

/** Las fotos solo estan en el bloque del visor, no en el registro de la ficha. */
const fotos = (cuantas: number): string =>
  `"marketplace_product_details_page":{"target":{"__typename":"GroupCommerceProductItem","id":"${ID}",` +
  `"listing_photos":[${Array.from({ length: cuantas }, () => '{"__typename":"ProductImage"}').join(',')}]}}`;

const estado = (extra = ''): string =>
  `{"require":[["RelayPrefetchedStreamCache","next",[],["x",{"__bbox":{"result":{"data":{` +
  `"viewer":{${fotos(8)}},` +
  `"listings":[${registro(ID, 'Carcochitas', '11000.00', '', extra)},` +
  `${registro('9999999999999999', 'Nissan Hikari 1987', '25000.00', '30000.00')}]` +
  `}}}}]]]}`;

/** happy-dom deja fijar la URL del documento; los tipos de `window` no lo saben. */
const conUrl = window as unknown as { happyDOM: { setURL: (url: string) => void } };

const cargar = (json: string, html = '', url = URL_FICHA): Document => {
  conUrl.happyDOM.setURL(url);
  document.documentElement.innerHTML =
    `<head><title>Marketplace</title></head><body>${html}` +
    `<script>${json}</script></body>`;
  return document;
};

describe('Facebook: lo que publica la ficha', () => {
  /** Lo primero que hace todo: quedarse con el registro de ESTA publicacion. */
  it('acota al registro de la publicacion abierta, no al de las relacionadas', () => {
    const bloque = bloqueDeLaFicha(estado(), ID);

    expect(bloque).toContain('Carcochitas');
    expect(bloque).not.toContain('Nissan');
    expect(descuento(bloque)).toBeUndefined(); // esta no tiene precio tachado
    expect(cuantasFotos(estado())).toBe(8);
  });

  it('lee la categoria de la publicacion abierta', () => {
    expect(fb.insumos(cargar(estado())).categoria).toBe('bikes');
    expect(fb.categoriaGruesa(cargar(estado()))).toBe('bikes');
  });

  it('sin el id en la URL no se lee nada: mejor eso que leer otro anuncio', () => {
    const doc = cargar(estado(), '', 'https://www.facebook.com/marketplace/');
    expect(fb.insumos(doc).categoria).toBe('');
  });

  it('calcula el descuento solo cuando hay precio tachado', () => {
    const relacionada = bloqueDeLaFicha(estado(), '9999999999999999');

    expect(relacionada).toContain('Nissan');
    expect(descuento(relacionada)).toBeCloseTo(16.67, 1); // 30000 -> 25000
  });

  it('encuentra el perfil del vendedor por el enlace de la ficha', () => {
    const doc = cargar(estado(), '<a href="/marketplace/profile/100055566677788/">Ver perfil</a>');

    expect(fb.perfilDelVendedor(doc)).toBe(
      'https://www.facebook.com/marketplace/profile/100055566677788/',
    );
  });

  /**
   * Facebook escapa las barras en su JSON, y en la ficha al vendedor lo llama
   * `marketplace_listing_seller`, no `seller`. Con los patrones anteriores no se
   * encontraba el perfil, y por eso no se abria solo.
   */
  it('encuentra el perfil con las barras escapadas y con el nombre largo de la clave', () => {
    const conVendedor = estado().replace(
      '"marketplace_listing_seller":null',
      '"marketplace_listing_seller":{"__typename":"User","id":"100055566677788"},' +
        '"seo":{"url":"https:\\\\/\\\\/www.facebook.com\\\\/marketplace\\\\/profile\\\\/100055566677788\\\\/"}',
    );

    expect(fb.perfilDelVendedor(cargar(conVendedor))).toBe(
      'https://www.facebook.com/marketplace/profile/100055566677788/',
    );
  });

  /**
   * Sin sesion iniciada Facebook manda `"marketplace_listing_seller":null`, y sin
   * vendedor no hay perfil que ofrecer ni datos que mandar.
   */
  it('sin vendedor no devuelve datos ni perfil', () => {
    const doc = cargar(estado());

    expect(fb.insumos(doc).vendedor).toBeNull();
    expect(fb.perfilDelVendedor(doc)).toBeNull();
  });

  /** Facebook deja copias ocultas de sus botones: el badge va en la que se ve. */
  it('ancla el badge antes del boton de mensaje visible', () => {
    const doc = cargar(
      estado(),
      '<div role="button" aria-label="Message">Message</div>',
    );
    const ancla = doc.querySelector('[aria-label="Message"]');
    // happy-dom no calcula cajas: se simula la del boton visible.
    Object.defineProperty(ancla as object, 'getBoundingClientRect', {
      value: () => ({ width: 164, height: 36 }),
      configurable: true,
    });

    const elegida = fb.anclaBadge(doc);
    expect(elegida?.getAttribute('aria-label')).toBe('Message');
    expect(elegida !== null && fb.insercionBadge(elegida)).toBe('antes');
  });

  /** En Marketplace no se compra: se escribe al vendedor, y ese clic es el que cuenta. */
  it('el control que mide la tesis es el boton de mensaje', () => {
    expect(fb.selectoresDeCompra().join(',')).toContain('aria-label="Message"');
  });
});

/**
 * PENDIENTE DE VERIFICAR: sin sesion iniciada Facebook no manda nada del vendedor,
 * asi que estos patrones siguen siendo los del scraper por URL del backend.
 */
describe('Facebook: lo que publica el perfil del vendedor', () => {
  const PERFIL =
    `{"data":{"seller":{"id":"100011122233344","short_name":"Juan",` +
    `"name":"Juan P\\u00e9rez"},"commerce_badges_info":{"badges":[{"text":"Calificaci\\u00f3n alta"}]},` +
    `"marketplace_followers":{"count":312},` +
    `"seller_stats":{"five_star_ratings_average":0,"five_star_total_rating_count_by_role":0},` +
    `"seller_buyer_combined":{"five_star_ratings_average":4.6,` +
    `"five_star_total_rating_count_by_role":27},` +
    `"listings":[` +
    `{"__typename":"GroupCommerceProductItem","id":"991100","is_live":true,"is_sold":false},` +
    `{"__typename":"GroupCommerceProductItem","id":"991101","is_live":true,"is_sold":false},` +
    `{"__typename":"GroupCommerceProductItem","id":"991102","is_live":true,"is_sold":true}]}}`;

  const perfil = (): Document =>
    cargar(PERFIL, '', 'https://www.facebook.com/marketplace/profile/100011122233344/');

  it('lee al vendedor con su distintivo, su promedio y sus calificaciones', () => {
    expect(fb.insumos(perfil()).vendedor).toEqual({
      sellerName: 'Juan Pérez',
      platform: 'Facebook Marketplace',
      ratingAverage: 4.6,
      ratingCount: 27,
      isRecognizedSeller: true,
      badgeLabel: 'Calificación alta',
    });
  });

  it('lee seguidores y publicaciones activas, sin contar las vendidas', () => {
    expect(datosDelPerfil(textoEmbebido(perfil()))).toEqual({
      seguidores: 312,
      publicacionesActivas: 2,
    });
  });

  /** Un vendedor sin distintivo trae el arreglo vacio: no se inventa uno. */
  it('con el arreglo de distintivos vacio no se declara distintivo', () => {
    const sinDistintivo = PERFIL.replace(
      '"badges":[{"text":"Calificaci\\u00f3n alta"}]',
      '"badges":[]',
    );
    const doc = cargar(
      sinDistintivo,
      '',
      'https://www.facebook.com/marketplace/profile/100011122233344/',
    );

    expect(fb.insumos(doc).vendedor).not.toHaveProperty('badgeLabel');
  });

  it('lo que el perfil no publica se omite, no se manda en cero', () => {
    const doc = cargar(
      '{"data":{"seller":{"id":"1"}}}',
      '',
      'https://www.facebook.com/marketplace/profile/1/',
    );

    expect(datosDelPerfil(textoEmbebido(doc))).toEqual({});
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
      'https://www.facebook.com/marketplace/',
    );
    const tarjetas = fb.tarjetas(doc);

    expect(tarjetas).toHaveLength(2);
    for (const t of tarjetas) {
      expect(t.href).toMatch(/\/marketplace\/item\/\d{10,20}/);
      expect(t.elemento.className).not.toBe('grilla');
    }
  });
});

/**
 * Facebook manda 0 en el promedio cuando NADIE ha calificado al vendedor. Si se
 * manda tal cual, el analizador de reputacion lo lee como "0 sobre 5, por debajo
 * de lo aceptable" y el veredicto sale riesgo alto sin una sola mala nota.
 */
describe('Facebook: un promedio de cero no es una calificacion', () => {
  it('se omite el promedio cuando vale cero', () => {
    const sinNotas = `{"data":{"seller":{"id":"1","short_name":"Ana"},` +
      `"seller_buyer_combined":{"five_star_ratings_average":0,` +
      `"five_star_total_rating_count_by_role":0}}}`;
    const doc = cargar(sinNotas, '', 'https://www.facebook.com/marketplace/profile/1/');
    const vendedor = fb.insumos(doc).vendedor;

    expect(vendedor).not.toHaveProperty('ratingAverage');
    expect(vendedor?.ratingCount).toBe(0);
  });
});

/**
 * Facebook navega entre publicaciones SIN recargar, y la ficha abierta asi no
 * esta en los scripts: ahi queda el registro corto de "relacionados", con titulo
 * y precio pero sin descripcion. Verificado el 2026-09-22 con sesion iniciada, y
 * es lo que hacia salir el analisis con 0% de caracteristicas.
 */
describe('Facebook: la ficha se lee del DOM cuando no esta en los scripts', () => {
  const RELACIONADA =
    `{"require":[["RelayPrefetchedStreamCache","next",[],["x",{"__bbox":{"result":{"data":{` +
    `"listings":[{"story":{"__typename":"GroupCommerceProductItem","id":"${ID}",` +
    `"marketplace_listing_title":"Arreglos florales"},` +
    `"listing_price":{"amount":"120.00"},"is_live":true}]}}}}]]]}`;

  const conDom = (): Document => {
    const doc = cargar(RELACIONADA);
    doc.title = '(20+) Marketplace - Arreglos florales | Facebook';
    const bloque = doc.createElement('div');
    bloque.innerHTML =
      '<div><div>Detalles</div><div>Arreglos a pedido, acepto yape. Sin garantia.</div></div>' +
      '<div><span>Informacion del vendedor</span><span>Se unio a Facebook en 2014</span></div>' +
      '<span>S/ 120</span>';
    doc.body.append(bloque);
    // happy-dom no calcula cajas: todo lo que se agrega aqui se considera visible.
    for (const el of doc.body.querySelectorAll('div, span')) {
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ width: 100, height: 20 }),
        configurable: true,
      });
    }
    return doc;
  };

  it('el documento que se manda trae titulo, descripcion y precio', () => {
    const enviado = fb.documentoParaAnalizar(conDom());

    expect(enviado).toContain('"marketplace_listing_title":"Arreglos florales"');
    expect(enviado).toContain('acepto yape');
    expect(enviado).toContain('"listing_price":{"amount":"120"}');
    expect(enviado).toContain('Se unio a Facebook en 2014');
  });

  /** Con la ficha completa incrustada no hace falta mirar el DOM. */
  it('cuando el estado si trae la ficha, se usa esa', () => {
    const enviado = fb.documentoParaAnalizar(cargar(estado()));

    expect(enviado).toContain('Carcochitas');
    expect(enviado).toContain('"redacted_description"');
  });
});

describe('Facebook: el perfil que se ve manda sobre el embebido', () => {
  /** Lo que Facebook pinta en la cabecera del perfil del vendedor. */
  const CABECERA =
    '<div>Joha Lisse</div><div>Se unió a Facebook en 2008</div>' +
    '<div>20+ publicaciones activas · 29 seguidores</div>' +
    '<div>Calificación alta</div>' +
    '<div>Calificación de 4,5 estrellas o más de al menos 5 compradores</div>' +
    '<div>4,8 · 23 calificaciones</div>';

  /** El estado embebido del mismo perfil: en cero, como llega de verdad. */
  const EMBEBIDO =
    '{"__typename":"User","marketplace_followers":{"count":15}' +
    ',"seller_stats":{"five_star_ratings_average":0' +
    ',"five_star_total_rating_count_by_role":0}' +
    ',"name":"Joha Lisse"},"commerce_badges_info":{"badges":[]}}';

  const visible = (): Document =>
    cargar(EMBEBIDO, CABECERA, 'https://www.facebook.com/marketplace/profile/100004395070520/');

  it('toma calificaciones, promedio e insignia de lo que muestra la pagina', () => {
    expect(fb.insumos(visible()).vendedor).toEqual({
      sellerName: 'Joha Lisse',
      platform: 'Facebook Marketplace',
      ratingAverage: 4.8,
      ratingCount: 23,
      isRecognizedSeller: true,
      badgeLabel: 'Calificación alta',
    });
  });

  it('manda al backend seguidores, publicaciones activas y alta con las claves que ya lee', () => {
    const leido = perfilDesdeElDom(visible());

    expect(leido).toContain('"marketplace_followers":{"count":29}');
    expect(leido).toContain('"active_listings_count":20');
    expect(leido).toContain('"five_star_total_rating_count_by_role":23');
    expect(leido).toContain('"five_star_ratings_average":4.8');
    expect(leido).toContain('Se unió a Facebook en 2008');
  });

  it('no inventa nada cuando la pagina no muestra datos del vendedor', () => {
    expect(perfilDesdeElDom(cargar('{}', '<div>Marketplace</div>'))).toBe('');
  });

  it('no toma por promedio un numero suelto de la pagina', () => {
    const doc = cargar('{}', '<div>S/ 4,5</div><div>3,2 kg de peso</div>');
    expect(perfilDesdeElDom(doc)).not.toContain('five_star_ratings_average');
  });

  /** El cartel dice que hacen falta "4,5 estrellas o mas": es el requisito, no su nota. */
  it('no confunde con el promedio lo que el cartel de la insignia exige', () => {
    const cartel = '<div>Calificación de 4,5 estrellas o más de al menos 5 compradores</div>';
    expect(perfilDesdeElDom(cargar('{}', cartel))).not.toContain('five_star_ratings_average');
  });

  /** El `<body>` tambien tiene los `<script>`: son 1.9 MB de JSON en una pagina real. */
  it('lee lo que se ve, no el estado embebido disfrazado de texto', () => {
    const doc = cargar('{"marketplace_followers":{"count":9999} seguidores', '<div>Hola</div>');
    expect(perfilDesdeElDom(doc)).toBe('');
  });
});

/**
 * Caso real (perfil 1159857241, 2026-09-22): el vendedor tiene sus calificaciones
 * en privado, asi que `seller_stats` llega en cero y solo el bloque combinado trae
 * las 3 calificaciones con promedio 5. Leer cada numero por su cuenta daba
 * "3 calificaciones" y "sin promedio" en el mismo panel.
 */
describe('Facebook: calificaciones privadas', () => {
  it('lee promedio y cantidad del mismo bloque, y manda el combinado', () => {
    const privado =
      '{"data":{"seller":{"id":"1159857241","short_name":"Joha"},' +
      '"marketplace_ratings_stats_by_role_v2":{"seller_ratings_are_private":true,' +
      '"seller_stats":{"five_star_ratings_average":0,"five_star_total_rating_count_by_role":0},' +
      '"seller_buyer_combined":{"five_star_ratings_average":5,' +
      '"five_star_total_rating_count_by_role":3}}}}';
    const doc = cargar(privado, '', 'https://www.facebook.com/marketplace/profile/1159857241/');

    expect(fb.insumos(doc).vendedor).toMatchObject({ ratingAverage: 5, ratingCount: 3 });
  });
});
