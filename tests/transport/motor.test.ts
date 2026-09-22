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

describe('motor real: la compuerta de abstencion va antes del modelo', () => {
  const TODAS = [
    'vendedor_reconocido',
    'puntuacion_producto',
    'tiene_reseñas',
    'medios_pago_reconocidos',
    'politicas_garantia',
    'productos_vendidos',
  ];

  const documento = (status: number) => ({
    isSuccess: true,
    item: {
      platform: 'Mercado Libre',
      postTitle: 'Un producto',
      seller: 'Vendido por EJEMPLO',
      coverage: 0.86,
      reviewCount: 3,
      undeterminedFeatures: [],
      features: Object.fromEntries(TODAS.map((f) => [f, 4])),
      featureStates: TODAS.map((feature) => ({ feature, status, reason: 'prueba' })),
      // El modelo dice "riesgo bajo" pase lo que pase: la compuerta decide si cuenta.
      riskModel: { result: 3, filledInputs: [] },
    },
  });

  const dominio = {
    isSuccess: true,
    item: { host: 'x', registrableDomain: 'x', veracity: 5, confidence: 4, coverage: 1 },
  };

  const conBackend = async (status: number, conDominio: boolean) => {
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      const cuerpo = url.includes('DomainAnalysis') ? dominio : documento(status);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(cuerpo) });
    }) as unknown as typeof fetch;
    try {
      const m = motor('tok', { documento: true, dominio: conDominio, vendedor: false, resenas: false });
      return await m.evaluar(SOLICITUD);
    } finally {
      globalThis.fetch = original;
    }
  };

  it('sin evidencia suficiente se abstiene aunque el modelo diga riesgo bajo', async () => {
    const { verdict } = await conBackend(3, true);
    expect(verdict.kind).toBe('evidencia-insuficiente');
  });

  it('con una dimension vacia se abstiene aunque el modelo diga riesgo bajo', async () => {
    const { verdict } = await conBackend(1, false);
    expect(verdict.kind).toBe('evidencia-insuficiente');
    if (verdict.kind === 'evidencia-insuficiente') {
      expect(verdict.dimensionesVacias).toContain('identidad-del-sitio');
    }
  });

  it('cuando la compuerta deja pasar, el nivel lo decide el modelo', async () => {
    const { verdict } = await conBackend(1, true);
    expect(verdict.kind).toBe('riesgo');
    if (verdict.kind === 'riesgo') expect(verdict.nivel).toBe('bajo');
  });
});
