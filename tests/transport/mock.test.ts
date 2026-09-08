import { describe, expect, it } from 'vitest';
import { indeterminado, FEATURE_IDS, type FeatureSet } from '../../src/domain/features.js';
import { MockRiskEngineClient } from '../../src/transport/MockRiskEngineClient.js';
import { HttpRiskEngineClient } from '../../src/transport/HttpRiskEngineClient.js';
import { esAbstencion } from '../../src/domain/verdict.js';

const vacio = (): FeatureSet =>
  Object.fromEntries(
    FEATURE_IDS.map((id) => [id, indeterminado('sin evidencia')]),
  ) as unknown as FeatureSet;

const solicitud = { plataforma: 'Mercado Libre', publicacionId: 'MPE123456', features: vacio() };

describe('MockRiskEngineClient', () => {
  it('produce los cuatro desenlaces de forma determinista', async () => {
    for (const esc of ['alto', 'moderado', 'bajo'] as const) {
      const v = await new MockRiskEngineClient(esc).evaluar(solicitud);
      expect(v).toMatchObject({ kind: 'riesgo', nivel: esc });
    }
    const abst = await new MockRiskEngineClient('evidencia-insuficiente').evaluar(solicitud);
    expect(esAbstencion(abst)).toBe(true);
  });

  it('sin escenario forzado, deriva el veredicto de las caracteristicas', async () => {
    const v = await new MockRiskEngineClient().evaluar(solicitud);
    // Las de cliente vienen vacias, asi que abstiene pese a simular el backend.
    expect(esAbstencion(v)).toBe(true);
  });

  it('no toca la red', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('el mock no debe llamar a la red');
    };
    await expect(new MockRiskEngineClient('bajo').evaluar(solicitud)).resolves.toBeDefined();
    globalThis.fetch = original;
  });
});

describe('HttpRiskEngineClient · seguridad ante fallos', () => {
  it('ante un error de red se abstiene, nunca dice riesgo bajo', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('sin conexion'));
    const v = await new HttpRiskEngineClient('https://ejemplo.invalid', 50).evaluar(solicitud);
    expect(esAbstencion(v)).toBe(true);
    globalThis.fetch = original;
  });

  it('ante un 500 se abstiene', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response('', { status: 500 }));
    const v = await new HttpRiskEngineClient('https://ejemplo.invalid', 50).evaluar(solicitud);
    expect(esAbstencion(v)).toBe(true);
    globalThis.fetch = original;
  });
});
