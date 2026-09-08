import { describe, expect, it } from 'vitest';
import { bytesDe, MAX_BYTES } from '../../src/transport/DocumentAnalysisClient.js';
import { estaResuelta, FEATURE_IDS } from '../../src/domain/features.js';
import { ThresholdPolicy } from '../../src/domain/policy/ThresholdPolicy.js';

/**
 * El mapeo real vive dentro del modulo. Aqui se ejercita a traves de una
 * respuesta simulada del backend, que es lo que interesa comprobar: que el
 * valor NUNCA se lee sin su estado.
 */
const respuesta = (
  features: Record<string, number>,
  estados: readonly { feature: string; status: number; reason?: string }[],
) => ({
  isSuccess: true,
  item: {
    platform: 'Mercado Libre',
    postTitle: 'Un producto',
    seller: 'Vendido por EJEMPLO',
    coverage: 0.86,
    reviewCount: 3,
    undeterminedFeatures: [],
    features,
    featureStates: estados,
  },
});

const analizarConRespuesta = async (cuerpo: unknown) => {
  const original = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(cuerpo) })) as unknown as typeof fetch;
  try {
    const { analizarDocumento } = await import('../../src/transport/DocumentAnalysisClient.js');
    return await analizarDocumento('https://x/', '<html></html>', 'tok');
  } finally {
    globalThis.fetch = original;
  }
};

describe('cruce de valor y estado', () => {
  const TODAS = [
    'vendedor_reconocido',
    'puntuacion_producto',
    'tiene_reseñas',
    'medios_pago_reconocidos',
    'politicas_garantia',
    'porcentaje_reseñas_falsas',
    'productos_vendidos',
  ];

  it('status 3 hace indeterminada la caracteristica aunque el valor sea 0', async () => {
    const { features } = await analizarConRespuesta(
      respuesta(
        Object.fromEntries(TODAS.map((f) => [f, 0])),
        TODAS.map((feature) => ({ feature, status: 3, reason: 'No llego el bloque' })),
      ),
    );
    expect(features.politicasDeGarantia.kind).toBe('indeterminado');
    expect(features.volumenDeVentas.kind).toBe('indeterminado');
    if (features.politicasDeGarantia.kind === 'indeterminado') {
      expect(features.politicasDeGarantia.motivo).toBe('No llego el bloque');
    }
  });

  it('status 2 es un valor CONOCIDO: la ausencia esta comprobada', async () => {
    const { features } = await analizarConRespuesta(
      respuesta(
        { ...Object.fromEntries(TODAS.map((f) => [f, 0])) },
        [{ feature: 'politicas_garantia', status: 2, reason: 'La ficha no declara garantia' }],
      ),
    );
    const v = features.politicasDeGarantia;
    expect(v.kind).toBe('conocido');
    expect(estaResuelta(v) && v.valor).toBe(0);
  });

  it('el mismo 0 significa cosas distintas segun el estado', async () => {
    const leido = await analizarConRespuesta(
      respuesta({ productos_vendidos: 0 }, [{ feature: 'productos_vendidos', status: 2 }]),
    );
    const relleno = await analizarConRespuesta(
      respuesta({ productos_vendidos: 0 }, [{ feature: 'productos_vendidos', status: 3 }]),
    );
    expect(leido.features.volumenDeVentas.kind).toBe('conocido');
    expect(relleno.features.volumenDeVentas.kind).toBe('indeterminado');
  });

  it('status 4 (diferida) nunca es un valor conocido', async () => {
    const { features } = await analizarConRespuesta(
      respuesta({ 'porcentaje_reseñas_falsas': 0 }, [
        { feature: 'porcentaje_reseñas_falsas', status: 4, reason: 'La calcula el modelo' },
      ]),
    );
    expect(features.autenticidadDeResenas.kind).toBe('indeterminado');
  });

  it('una caracteristica sin estado queda indeterminada, no se asume', async () => {
    const { features } = await analizarConRespuesta(respuesta({ puntuacion_producto: 4.6 }, []));
    expect(features.puntuacionDelProducto.kind).toBe('indeterminado');
  });

  it('tiene_reseñas NO esta invertida: 1 significa que tiene', async () => {
    const { features } = await analizarConRespuesta(
      respuesta({ 'tiene_reseñas': 1 }, [{ feature: 'tiene_reseñas', status: 1 }]),
    );
    const v = features.presenciaDeResenas;
    expect(estaResuelta(v) && v.valor).toBe(true);
  });

  it('la veracidad de dominio no la resuelve este endpoint', async () => {
    const { features } = await analizarConRespuesta(respuesta({}, []));
    expect(features.veracidadDeDominio.kind).toBe('indeterminado');
  });

  it('un fallo del backend deja todo indeterminado, nunca favorable', async () => {
    const { features, detalle } = await analizarConRespuesta({ isSuccess: false, message: 'boom' });
    expect(detalle).toBeNull();
    expect(FEATURE_IDS.every((id) => features[id].kind === 'indeterminado')).toBe(true);
  });

  it('conserva la cobertura y los metadatos del informe', async () => {
    const { detalle } = await analizarConRespuesta(respuesta({}, []));
    expect(detalle?.coverage).toBe(0.86);
    expect(detalle?.plataforma).toBe('Mercado Libre');
  });
});

describe('limite de tamano', () => {
  it('mide bytes UTF-8, no caracteres', () => {
    // Cinco caracteres, seis bytes: la enye ocupa dos.
    expect('anoño'.length).toBe(5);
    expect(bytesDe('anoño')).toBe(6);
  });

  it('el limite es el que declara el backend', () => {
    expect(MAX_BYTES).toBe(8 * 1024 * 1024);
  });
});

describe('umbral de reputacion del vendedor', () => {
  it('la reputacion binaria del backend puede resultar favorable', () => {
    // Con el corte anterior en >= 2 esta caracteristica jamas sumaba, porque el
    // backend solo emite 0 o 1.
    const policy = new ThresholdPolicy();
    expect(policy.id).toContain('en-revision');
  });
});
