import { describe, expect, it } from 'vitest';
import { MockRiskEngineClient } from '../../src/transport/MockRiskEngineClient.js';
import { BackendRiskEngineClient } from '../../src/transport/BackendRiskEngineClient.js';
import { SesionRequeridaError } from '../../src/transport/RiskEngineClient.js';
import { ThresholdPolicy } from '../../src/domain/policy/ThresholdPolicy.js';
import { FEATURE_IDS, esConocida } from '../../src/domain/features.js';
import type { TokenProvider } from '../../src/auth/TokenProvider.js';
import { SIN_INSUMOS } from '../../src/domain/insumos.js';

const SOLICITUD = {
  plataforma: 'Mercado Libre',
  publicacionId: 'MPE449861158',
  url: 'https://articulo.mercadolibre.com.pe/MPE-449861158-x-_JM',
  html: '<html></html>',
  insumos: SIN_INSUMOS,
};

const tokens = (valor: string | null): TokenProvider => ({
  id: 'prueba',
  obtener: () => Promise.resolve(valor),
});

const APAGADOS = { documento: false, dominio: false, vendedor: false, resenas: false };

const motor = (t: string | null, analizadores = APAGADOS) =>
  new BackendRiskEngineClient(new ThresholdPolicy(), tokens(t), analizadores);

describe('motor real: credenciales', () => {
  it('sin token no evalua: lanza SesionRequeridaError', async () => {
    await expect(motor(null).evaluar(SOLICITUD)).rejects.toBeInstanceOf(SesionRequeridaError);
  });

  it('el motor no sabe de donde sale el token, solo lo pide', async () => {
    let pedido = 0;
    const proveedor: TokenProvider = {
      id: 'contador',
      obtener: () => {
        pedido += 1;
        return Promise.resolve('tok');
      },
    };
    const m = new BackendRiskEngineClient(new ThresholdPolicy(), proveedor, APAGADOS);
    await m.evaluar(SOLICITUD);
    expect(pedido).toBe(1);
  });
});

describe('motor real: degradacion', () => {
  it('con todos los analizadores apagados se abstiene, nunca riesgo bajo', async () => {
    const { verdict, features } = await motor('tok').evaluar(SOLICITUD);
    expect(verdict.kind).toBe('evidencia-insuficiente');
    expect(FEATURE_IDS.every((id) => !esConocida(features[id]))).toBe(true);
  });

  it('un analizador caido deja su caracteristica indeterminada, no favorable', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('red caida'));
    try {
      const m = motor('tok', { documento: true, dominio: true, vendedor: false, resenas: false });
      const { verdict, features } = await m.evaluar(SOLICITUD);
      expect(verdict.kind).toBe('evidencia-insuficiente');
      expect(esConocida(features.veracidadDeDominio)).toBe(false);
      expect(esConocida(features.puntuacionDelProducto)).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('un analizador apagado no fabrica valores', async () => {
    const { features } = await motor('tok').evaluar(SOLICITUD);
    expect(features.reputacionDelVendedor.kind).toBe('indeterminado');
    expect(features.autenticidadDeResenas.kind).toBe('indeterminado');
  });
});

describe('motor simulado', () => {
  it('sin escenario forzado no inventa nada', async () => {
    const { verdict, features } = await new MockRiskEngineClient().evaluar(SOLICITUD);
    expect(verdict.kind).toBe('evidencia-insuficiente');
    expect(FEATURE_IDS.every((id) => !esConocida(features[id]))).toBe(true);
  });

  it('los cuatro escenarios de maqueta son coherentes con sus caracteristicas', () => {
    const m = new MockRiskEngineClient();
    for (const nivel of ['bajo', 'moderado', 'alto'] as const) {
      const e = m.simular(nivel);
      expect(e.verdict.kind).toBe('riesgo');
      if (e.verdict.kind === 'riesgo') expect(e.verdict.nivel).toBe(nivel);
    }
    expect(m.simular('evidencia-insuficiente').verdict.kind).toBe('evidencia-insuficiente');
  });
});
