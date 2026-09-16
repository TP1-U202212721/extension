import { describe, expect, it } from 'vitest';
import { enviarLote } from '../../src/analytics/UsageAnalyticsClient.js';
import { PLATAFORMA, TIPO, type Lote } from '../../src/domain/analitica/eventos.js';
import { dominioRegistrable } from '../../src/domain/analitica/sitio.js';

const sitio = dominioRegistrable('https://articulo.mercadolibre.com.pe/MPE-449861158-audifonos-_JM');
if (sitio === null) throw new Error('el fixture tiene que producir un dominio');

const LOTE: Lote = {
  clientVersion: '0.1.0',
  pseudonym: '8f14e45fceea167a5a36dedd4bea2543',
  sessionId: 'c9f0f895fb98ab9159f51fd0297e236d',
  events: [
    {
      eventId: 'e1',
      type: TIPO.consultaEnviada,
      platform: PLATAFORMA.mercadoLibre,
      site: sitio,
      category: 'tecnologia/audio',
      occurredAt: '2026-09-15T12:00:00.000Z',
    },
  ],
};

/** Sustituye `fetch` y devuelve lo que la extension llego a mandar. */
const conRespuesta = async <T>(
  respuesta: { status?: number; ok?: boolean; cuerpo?: unknown } | 'red-caida',
  correr: () => Promise<T>,
): Promise<{ resultado: T; cuerpo: string }> => {
  const original = globalThis.fetch;
  let enviado = '';

  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    enviado = typeof init?.body === 'string' ? init.body : '';
    if (respuesta === 'red-caida') return Promise.reject(new Error('sin red'));
    return Promise.resolve({
      ok: respuesta.ok ?? true,
      status: respuesta.status ?? 200,
      json: () => Promise.resolve(respuesta.cuerpo),
    });
  }) as unknown as typeof fetch;

  try {
    return { resultado: await correr(), cuerpo: enviado };
  } finally {
    globalThis.fetch = original;
  }
};

const EXITO = {
  IsSuccess: true,
  Item: {
    ModuleEnabled: true,
    Accepted: 1,
    Duplicates: 0,
    Rejected: 0,
    Sanitized: 0,
    RejectionReasons: [],
  },
};

describe('ingesta de eventos de uso', () => {
  it('lee la respuesta venga en PascalCase o en camelCase', async () => {
    const pascal = await conRespuesta({ cuerpo: EXITO }, () => enviarLote(LOTE, 'tok'));
    expect(pascal.resultado).toEqual({
      tipo: 'procesado',
      aceptados: 1,
      duplicados: 0,
      rechazados: 0,
      recortados: 0,
      motivos: [],
    });

    const camel = await conRespuesta(
      {
        cuerpo: {
          isSuccess: true,
          item: {
            moduleEnabled: true,
            accepted: 1,
            duplicates: 0,
            rejected: 0,
            sanitized: 0,
            rejectionReasons: [],
          },
        },
      },
      () => enviarLote(LOTE, 'tok'),
    );
    expect(camel.resultado.tipo).toBe('procesado');
  });

  it('el cuerpo no lleva la ruta de la ficha', async () => {
    const { cuerpo } = await conRespuesta({ cuerpo: EXITO }, () => enviarLote(LOTE, 'tok'));

    expect(cuerpo).toContain('mercadolibre.com.pe');
    expect(cuerpo).not.toContain('MPE-449861158');
    expect(cuerpo).not.toContain('audifonos');
    expect(cuerpo).not.toContain('articulo.');
  });

  it('con el modulo apagado deja de reintentar', async () => {
    const { resultado } = await conRespuesta(
      { cuerpo: { IsSuccess: true, Item: { ModuleEnabled: false, Accepted: 0, Duplicates: 0, Rejected: 0, Sanitized: 0, RejectionReasons: [] } } },
      () => enviarLote(LOTE, 'tok'),
    );
    expect(resultado.tipo).toBe('apagado');
  });

  /** Un 400 es culpa del lote y no del momento: reintentarlo es un bucle. */
  it('un lote invalido se descarta en vez de reintentarse', async () => {
    const { resultado } = await conRespuesta({ ok: false, status: 400, cuerpo: {} }, () =>
      enviarLote(LOTE, 'tok'),
    );
    expect(resultado.tipo).toBe('descartar');
  });

  it('una sesion caducada o un 500 se reintentan', async () => {
    for (const status of [401, 403, 500, 503]) {
      const { resultado } = await conRespuesta({ ok: false, status, cuerpo: {} }, () =>
        enviarLote(LOTE, 'tok'),
      );
      expect(resultado.tipo).toBe('reintentar');
    }
  });

  it('la red caida nunca lanza', async () => {
    const { resultado } = await conRespuesta('red-caida', () => enviarLote(LOTE, 'tok'));
    expect(resultado.tipo).toBe('reintentar');
  });
});
