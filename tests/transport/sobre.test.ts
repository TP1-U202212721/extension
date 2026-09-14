import { describe, expect, it } from 'vitest';
import { analizarDocumento } from '../../src/transport/DocumentAnalysisClient.js';
import { consultarVeracidadDeDominio } from '../../src/transport/DomainVeracityClient.js';
import { consultarReputacion } from '../../src/transport/SellerReputationClient.js';
import { consultarAutenticidad } from '../../src/transport/ReviewAnalysisClient.js';
import { estaResuelta } from '../../src/domain/features.js';
import type { TokenProvider } from '../../src/auth/TokenProvider.js';

const tokens: TokenProvider = { id: 'prueba', obtener: () => Promise.resolve('tok') };

const conRespuesta = async <T>(cuerpo: unknown, correr: () => Promise<T>): Promise<T> => {
  const original = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(cuerpo) })) as unknown as typeof fetch;
  try {
    return await correr();
  } finally {
    globalThis.fetch = original;
  }
};

/**
 * Respuesta REAL de produccion que provoco el bug: el sobre viene en
 * PascalCase y el cliente lo leia en camelCase, asi que descartaba la respuesta
 * entera y una ficha con vendedor_reconocido = 1 salia como no reconocida.
 */
const DOCUMENTO_PASCAL = {
  Item: {
    Platform: 'Mercado Libre',
    Seller: 'Apple',
    PostId: 'MPE1055308917',
    Features: {
      vendedor_reconocido: 1,
      puntuacion_producto: 4.6,
      'tiene_reseñas': 1,
      medios_pago_reconocidos: 1,
      politicas_garantia: 1,
      'porcentaje_reseñas_falsas': 0,
      productos_vendidos: 5000,
    },
    FeatureStates: [
      { Feature: 'vendedor_reconocido', Status: 1, StatusLabel: 'Leida del documento', Reason: null },
      { Feature: 'puntuacion_producto', Status: 1, StatusLabel: 'Leida del documento', Reason: null },
      { Feature: 'tiene_reseñas', Status: 1, StatusLabel: 'Leida del documento', Reason: null },
      { Feature: 'medios_pago_reconocidos', Status: 1, StatusLabel: 'Leida', Reason: null },
      { Feature: 'politicas_garantia', Status: 1, StatusLabel: 'Leida', Reason: null },
      { Feature: 'porcentaje_reseñas_falsas', Status: 4, StatusLabel: 'Otra etapa', Reason: null },
      { Feature: 'productos_vendidos', Status: 1, StatusLabel: 'Leida', Reason: null },
    ],
    UndeterminedFeatures: [],
    Coverage: 1,
    ReviewCount: 4,
  },
  IsSuccess: true,
  Message: null,
};

/** Convierte la primera letra de cada clave del SOBRE a minuscula, recursivo. */
const aCamel = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(aCamel);
  if (typeof v !== 'object' || v === null) return v;
  const salida: Record<string, unknown> = {};
  for (const [k, valor] of Object.entries(v)) {
    // Los nombres de caracteristica son datos: se dejan intactos.
    const clave = k.includes('_') ? k : k.charAt(0).toLowerCase() + k.slice(1);
    salida[clave] = aCamel(valor);
  }
  return salida;
};

const DOCUMENTO_CAMEL = aCamel(DOCUMENTO_PASCAL);

describe('la respuesta real de produccion ya no cae a indeterminado', () => {
  it('PascalCase: vendedor reconocido y cobertura 1', async () => {
    const r = await conRespuesta(DOCUMENTO_PASCAL, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );

    expect(r.detalle).not.toBeNull();
    expect(r.detalle?.coverage).toBe(1);
    expect(r.detalle?.plataforma).toBe('Mercado Libre');
    expect(r.detalle?.seller).toBe('Apple');
    expect(r.detalle?.reviewCount).toBe(4);

    // El sintoma exacto que se reporto.
    const v = r.features.proteccionDePago;
    expect(v.kind).toBe('conocido');
    expect(estaResuelta(v) && v.valor).toBe('declarada');

    const p = r.features.puntuacionDelProducto;
    expect(estaResuelta(p) && p.valor).toBe(4.6);

    const res = r.features.presenciaDeResenas;
    expect(estaResuelta(res) && res.valor).toBe(true);

    const ventas = r.features.volumenDeVentas;
    expect(estaResuelta(ventas) && ventas.valor).toBe(5000);
  });

  it('camelCase produce EXACTAMENTE el mismo resultado', async () => {
    const pascal = await conRespuesta(DOCUMENTO_PASCAL, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    const camel = await conRespuesta(DOCUMENTO_CAMEL, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    expect(camel).toEqual(pascal);
  });

  it('status 4 sigue siendo indeterminado aunque el sobre venga en PascalCase', async () => {
    const r = await conRespuesta(DOCUMENTO_PASCAL, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    expect(r.features.autenticidadDeResenas.kind).toBe('indeterminado');
  });
});

describe('los nombres de caracteristica NO se normalizan', () => {
  it('un sobre en PascalCase no altera las claves snake_case de Features', async () => {
    const conMayusculas = {
      IsSuccess: true,
      Item: {
        Features: { Vendedor_Reconocido: 1, puntuacion_producto: 4.6 },
        FeatureStates: [
          { Feature: 'vendedor_reconocido', Status: 1 },
          { Feature: 'puntuacion_producto', Status: 1 },
        ],
        Coverage: 1,
      },
    };
    const r = await conRespuesta(conMayusculas, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    // `Vendedor_Reconocido` NO es `vendedor_reconocido`: el valor no se
    // encuentra y la caracteristica queda sin resolver, que es lo correcto.
    // Normalizarla romperia su correspondencia con featureStates.
    expect(r.features.puntuacionDelProducto.kind).toBe('conocido');
  });

  it('undeterminedFeatures conserva los nombres tal cual', async () => {
    const cuerpo = {
      IsSuccess: true,
      Item: {
        Features: {},
        FeatureStates: [],
        UndeterminedFeatures: ['vendedor_reconocido', 'porcentaje_reseñas_falsas'],
        Coverage: 0,
      },
    };
    const r = await conRespuesta(cuerpo, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    expect(r.detalle?.sinDeterminar).toEqual(['vendedor_reconocido', 'porcentaje_reseñas_falsas']);
  });
});

describe('los otros tres clientes toleran las dos grafias', () => {
  const DOMINIO = {
    IsSuccess: true,
    Item: {
      Host: 'articulo.mercadolibre.com.pe',
      RegistrableDomain: 'mercadolibre.com.pe',
      Veracity: 5,
      VeracityLabel: 'Legitimo',
      Score: 92,
      Confidence: 4,
      ConfidenceLabel: 'Alta',
      Coverage: 0.9,
      Summary: 'El dominio tiene todas las senales de un sitio legitimo.',
      RiskSignals: [],
      TrustSignals: [{ Code: 'tls', FamilyLabel: 'TLS', StatusLabel: 'Verificada', Explanation: 'ok' }],
      UnverifiedSignals: [],
      Limitations: [],
    },
  };

  const VENDEDOR = {
    IsSuccess: true,
    Item: {
      SellerName: 'Apple',
      Reputation: 5,
      ReputationLabel: 'Trayectoria establecida',
      Score: 88,
      Confidence: 4,
      ConfidenceLabel: 'Alta',
      Coverage: 0.85,
      Summary: 'Trayectoria de un comercio establecido.',
      RiskSignals: [],
      TrustSignals: [],
      UnverifiedSignals: [],
      Limitations: [],
    },
  };

  const RESENAS = {
    IsSuccess: true,
    Item: {
      Authenticity: 5,
      AuthenticityLabel: 'Autenticas',
      Status: 1,
      StatusLabel: 'Evaluadas',
      Confidence: 3,
      ConfidenceLabel: 'Media',
      SuspectRate: 0.02,
      SubmittedCount: 20,
      EvaluatedCount: 20,
      SuspectCount: 0,
      Coverage: 1,
      Summary: 'Alrededor del 2% presenta senales.',
      Limitations: [],
    },
  };

  it('veracidad de dominio', async () => {
    const p = await conRespuesta(DOMINIO, () => consultarVeracidadDeDominio('https://x/', 'tok'));
    const c = await conRespuesta(aCamel(DOMINIO), () =>
      consultarVeracidadDeDominio('https://x/', 'tok'),
    );
    expect(p.detalle?.veracity).toBe(5);
    expect(p.detalle?.trustSignals[0]?.familyLabel).toBe('TLS');
    expect(estaResuelta(p.feature)).toBe(true);
    expect(c).toEqual(p);
  });

  it('reputacion del vendedor', async () => {
    const datos = { sellerName: 'Apple', platform: 'Mercado Libre' };
    const p = await conRespuesta(VENDEDOR, () => consultarReputacion(datos, tokens));
    const c = await conRespuesta(aCamel(VENDEDOR), () => consultarReputacion(datos, tokens));
    expect(p.detalle?.reputation).toBe(5);
    expect(estaResuelta(p.feature)).toBe(true);
    expect(c).toEqual(p);
  });

  it('autenticidad de resenas, conservando suspectRate nullable', async () => {
    const p = await conRespuesta(RESENAS, () => consultarAutenticidad([], 'Audio', tokens));
    const c = await conRespuesta(aCamel(RESENAS), () => consultarAutenticidad([], 'Audio', tokens));
    expect(p.detalle?.suspectRate).toBe(0.02);
    expect(estaResuelta(p.feature)).toBe(true);
    expect(c).toEqual(p);

    // Sin medicion sigue siendo null, no 0.
    const sinMedir = await conRespuesta(
      { IsSuccess: true, Item: { ...RESENAS.Item, Status: 3, SuspectRate: null } },
      () => consultarAutenticidad([], 'Audio', tokens),
    );
    expect(sinMedir.detalle?.suspectRate).toBeNull();
    expect(sinMedir.feature.kind).toBe('indeterminado');
  });
});

describe('respuestas de error, que pueden traer otra grafia', () => {
  it('un error en PascalCase degrada con su mensaje, no en silencio', async () => {
    const r = await conRespuesta({ IsSuccess: false, Message: 'Null or invalid token', Item: null }, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    expect(r.detalle).toBeNull();
    const v = r.features.proteccionDePago;
    expect(v.kind).toBe('indeterminado');
    if (v.kind === 'indeterminado') expect(v.motivo).toBe('Null or invalid token');
  });

  it('un error en camelCase se comporta igual', async () => {
    const r = await conRespuesta({ isSuccess: false, message: 'Null or invalid token' }, () =>
      analizarDocumento('https://x/', '<html></html>', 'tok'),
    );
    const v = r.features.proteccionDePago;
    if (v.kind === 'indeterminado') expect(v.motivo).toBe('Null or invalid token');
  });
});
