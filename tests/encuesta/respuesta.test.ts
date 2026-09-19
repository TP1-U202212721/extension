import { describe, expect, it } from 'vitest';
import {
  enviarRespuesta,
  huellaDeConsulta,
  obtenerInstrumento,
  type RespuestaDeEncuesta,
} from '../../src/feedback/FeedbackClient.js';
import { normalizarConsulta } from '../../src/domain/encuesta/huella.js';
import { contextoDelVeredicto } from '../../src/domain/encuesta/contexto.js';
import {
  ALCANCE,
  TIPO_DE_VEREDICTO,
  plataformaDeEncuesta,
} from '../../src/domain/encuesta/instrumento.js';
import { conocido, indeterminado, FEATURE_IDS, type FeatureSet } from '../../src/domain/features.js';
import type { Verdict } from '../../src/domain/verdict.js';

const FICHA = 'https://articulo.mercadolibre.com.pe/MPE-449861158-audifonos-bluetooth-_JM?ref=x#op';

const BASE: RespuestaDeEncuesta = {
  respondentId: '8f14e45f-ea2b-4c1b-9a3d-0e5a6b7c8d90',
  rating: 4,
  comment: '',
  consentGiven: true,
  consentVersion: 'consentimiento-v1',
  instrumentCode: 'satisfaccion-global',
  scope: ALCANCE.unaConsulta,
  platform: 1,
  consulta: FICHA,
  verdictKind: TIPO_DE_VEREDICTO.riesgoEstimado,
  verdictValue: 2,
  verdictConfidence: 3,
};

const capturando = async <T>(
  respuesta: { status?: number; ok?: boolean; cuerpo?: unknown } | 'red-caida',
  correr: () => Promise<T>,
): Promise<{ resultado: T; cuerpo: Record<string, unknown>; headers: unknown }> => {
  const original = globalThis.fetch;
  let enviado = '{}';
  let headers: unknown;

  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    if (typeof init?.body === 'string') enviado = init.body;
    headers = init?.headers;
    if (respuesta === 'red-caida') return Promise.reject(new Error('sin red'));
    return Promise.resolve({
      ok: respuesta.ok ?? true,
      status: respuesta.status ?? 200,
      json: () => Promise.resolve(respuesta.cuerpo ?? {}),
    });
  }) as unknown as typeof fetch;

  try {
    const resultado = await correr();
    return { resultado, cuerpo: JSON.parse(enviado) as Record<string, unknown>, headers };
  } finally {
    globalThis.fetch = original;
  }
};

describe('huella de la consulta', () => {
  it('normaliza igual que el servidor: sin esquema, sin query, sin fragmento', () => {
    expect(normalizarConsulta(FICHA)).toBe(
      'articulo.mercadolibre.com.pe/mpe-449861158-audifonos-bluetooth-_jm',
    );
  });

  it('la misma ficha con distinto ?ref= da la misma huella', async () => {
    const a = await huellaDeConsulta('https://x.mercadolibre.com.pe/MPE-1-y-_JM?ref=a');
    const b = await huellaDeConsulta('https://x.mercadolibre.com.pe/MPE-1-y-_JM?ref=b#c');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fichas distintas dan huellas distintas', async () => {
    const a = await huellaDeConsulta('https://x.mercadolibre.com.pe/MPE-1-y-_JM');
    const b = await huellaDeConsulta('https://x.mercadolibre.com.pe/MPE-2-y-_JM');
    expect(a).not.toBe(b);
  });
});

describe('envio de la respuesta', () => {
  /**
   * La prueba central de privacidad de este modulo: el contrato admite la URL y
   * la extension manda su huella. La ruta de la ficha no sale del navegador.
   */
  it('manda la huella y jamas la URL', async () => {
    const { cuerpo } = await capturando({}, () => enviarRespuesta(BASE));

    expect(cuerpo['inquiryReference']).toMatch(/^[0-9a-f]{64}$/);
    const json = JSON.stringify(cuerpo);
    expect(json).not.toContain('MPE-449861158');
    expect(json).not.toContain('audifonos');
    expect(json).not.toContain('mercadolibre');
    expect(json).not.toContain('http');
  });

  it('lleva el contexto: plataforma y veredicto', async () => {
    const { cuerpo } = await capturando({}, () => enviarRespuesta(BASE));
    expect(cuerpo['scope']).toBe(2);
    expect(cuerpo['platform']).toBe(1);
    expect(cuerpo['verdictKind']).toBe(4);
    expect(cuerpo['verdictValue']).toBe(2);
    expect(cuerpo['verdictConfidence']).toBe(3);
  });

  it('el consentimiento viaja con su version y nunca se asume', async () => {
    const { cuerpo } = await capturando({}, () => enviarRespuesta(BASE));
    expect(cuerpo['consentGiven']).toBe(true);
    expect(cuerpo['consentVersion']).toBe('consentimiento-v1');
  });

  it('sin consentimiento no se envia nada', async () => {
    const original = globalThis.fetch;
    let llamado = false;
    globalThis.fetch = (() => {
      llamado = true;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    try {
      const r = await enviarRespuesta({ ...BASE, consentGiven: false });
      expect(r.tipo).toBe('fallo');
      expect(llamado).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('un comentario vacio se omite en vez de viajar en blanco', async () => {
    const { cuerpo } = await capturando({}, () => enviarRespuesta({ ...BASE, comment: '   ' }));
    expect(cuerpo).not.toHaveProperty('comment');
  });

  it('sin veredicto no se manda un valor ordinal huerfano', async () => {
    const { cuerpo } = await capturando({}, () =>
      enviarRespuesta({
        ...BASE,
        verdictKind: TIPO_DE_VEREDICTO.ninguno,
        verdictValue: null,
      }),
    );
    expect(cuerpo['verdictKind']).toBe(0);
    expect(cuerpo).not.toHaveProperty('verdictValue');
  });

  /** Es anonimo: exigir cuenta para opinar sesgaria la muestra. */
  it('no manda ninguna credencial', async () => {
    const { headers } = await capturando({}, () => enviarRespuesta(BASE));
    expect(JSON.stringify(headers)).not.toContain('Authorization');
  });

  it('409, 429 y 503 cierran la encuesta sin insistir', async () => {
    for (const status of [409, 429, 503]) {
      const { resultado } = await capturando({ ok: false, status }, () => enviarRespuesta(BASE));
      expect(resultado.tipo).toBe('cerrada');
    }
  });

  it('la red caida no cierra la encuesta: se puede reintentar', async () => {
    const { resultado } = await capturando('red-caida', () => enviarRespuesta(BASE));
    expect(resultado.tipo).toBe('fallo');
  });
});

describe('instrumento', () => {
  it('se lee tal como lo publica el backend, sin preguntas cableadas', async () => {
    const { resultado } = await capturando(
      {
        cuerpo: {
          IsSuccess: true,
          Item: {
            ModuleEnabled: true,
            Code: 'satisfaccion-global',
            Version: 1,
            Title: 'Satisfaccion con ScamShield',
            ConsentVersion: 'consentimiento-v1',
            ConsentText: 'Tu respuesta se usa de forma anonima.',
            AllowsComment: true,
            MaxCommentLength: 1000,
            Items: [
              {
                Code: 'global',
                Prompt: 'Que tan satisfecho quedaste?',
                Dimension: 1,
                DimensionLabel: 'Satisfaccion global',
                Scale: 1,
                ScaleLabel: 'Estrellas, 1 a 5',
                MinValue: 1,
                MaxValue: 5,
                Position: 1,
                Optional: false,
                ReverseScored: false,
              },
            ],
          },
        },
      },
      obtenerInstrumento,
    );

    expect(resultado?.moduleEnabled).toBe(true);
    expect(resultado?.consentText).not.toBe('');
    expect(resultado?.items).toHaveLength(1);
    expect(resultado?.items[0]?.prompt).toBe('Que tan satisfecho quedaste?');
  });

  it('ante un fallo no se inventa un instrumento de repuesto', async () => {
    const { resultado } = await capturando('red-caida', obtenerInstrumento);
    expect(resultado).toBeNull();
  });
});

describe('contexto del veredicto', () => {
  const vacio: FeatureSet = Object.fromEntries(
    FEATURE_IDS.map((id) => [id, indeterminado('x')]),
  ) as unknown as FeatureSet;

  it('traduce el nivel de riesgo a la escala de su tipo', () => {
    const alto: Verdict = {
      kind: 'riesgo',
      nivel: 'alto',
      puntaje: 20,
      confianza: 0.5,
      sustentan: [],
      sinResolver: [],
    };
    expect(contextoDelVeredicto(alto, vacio).verdictKind).toBe(TIPO_DE_VEREDICTO.riesgoEstimado);
    expect(contextoDelVeredicto(alto, vacio).verdictValue).toBe(1);
    expect(
      contextoDelVeredicto({ ...alto, nivel: 'bajo' }, vacio).verdictValue,
    ).toBe(3);
  });

  it('una abstencion no lleva valor de veredicto', () => {
    const ctx = contextoDelVeredicto(
      {
        kind: 'evidencia-insuficiente',
        resueltas: [],
        sinResolver: [],
        dimensionesVacias: [],
        motivo: 'x',
      },
      vacio,
    );
    expect(ctx.verdictKind).toBe(TIPO_DE_VEREDICTO.ninguno);
    expect(ctx.verdictValue).toBeNull();
  });

  it('la confianza sale de las caracteristicas resueltas', () => {
    const casi: FeatureSet = { ...vacio };
    const conSeis = FEATURE_IDS.slice(0, 7).reduce<FeatureSet>(
      (acc, id) => ({ ...acc, [id]: conocido(1, 'x') }),
      casi,
    );
    expect(
      contextoDelVeredicto(
        { kind: 'evidencia-insuficiente', resueltas: [], sinResolver: [], dimensionesVacias: [], motivo: 'x' },
        conSeis,
      ).verdictConfidence,
    ).toBe(4);
  });
});

describe('plataforma de la encuesta', () => {
  /**
   * El enumerado de la encuesta NO es el de la analitica: aqui el 2 es Facebook
   * Marketplace. Mandar Amazon como 2 la contaria como Facebook al exportar.
   */
  it('no confunde el enumerado con el de la analitica', () => {
    expect(plataformaDeEncuesta('Mercado Libre')).toBe(1);
    expect(plataformaDeEncuesta('AliExpress')).toBe(3);
    expect(plataformaDeEncuesta('Amazon')).toBe(4);
    expect(plataformaDeEncuesta('eBay')).toBe(5);
    expect(plataformaDeEncuesta('Temu')).toBe(6);
    expect(plataformaDeEncuesta('Walmart')).toBe(99);
    expect(plataformaDeEncuesta('')).toBe(0);
  });
});
