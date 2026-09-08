import { describe, expect, it } from 'vitest';
import { conocido, indeterminado, FEATURE_IDS, type FeatureSet } from '../../src/domain/features.js';
import { MockRiskEngineClient } from '../../src/transport/MockRiskEngineClient.js';
import {
  HttpRiskEngineClient,
  SesionRequeridaError,
} from '../../src/transport/HttpRiskEngineClient.js';
import { esAbstencion } from '../../src/domain/verdict.js';

const vacio = (): FeatureSet =>
  Object.fromEntries(
    FEATURE_IDS.map((id) => [id, indeterminado('sin evidencia')]),
  ) as unknown as FeatureSet;

/** Las cinco de cliente resueltas, como en una ficha real completa. */
const soloCliente = (): FeatureSet => ({
  ...vacio(),
  proteccionDePago: conocido('declarada', 'enlace de compra protegida'),
  puntuacionDelProducto: conocido(4.9, 'JSON-LD de la pagina'),
  presenciaDeResenas: conocido(true, '9 opiniones'),
  politicasDeGarantia: conocido(2, 'garantia del vendedor'),
  volumenDeVentas: conocido(5, '+5 ventas'),
});

const solicitud = (features: FeatureSet) => ({
  plataforma: 'Mercado Libre',
  publicacionId: 'MPEU2463052894',
  features,
});

describe('MockRiskEngineClient · honestidad', () => {
  it('NO inventa valores: sin backend, se abstiene', async () => {
    // Regresion del bug que producia "riesgo bajo" con 2 de 8 caracteristicas:
    // el mock rellenaba las tres de backend con valores favorables.
    const { verdict } = await new MockRiskEngineClient().evaluar(solicitud(soloCliente()));
    expect(esAbstencion(verdict)).toBe(true);
  });

  it('con una publicacion casi sin datos tambien se abstiene', async () => {
    const pobre: FeatureSet = {
      ...vacio(),
      proteccionDePago: conocido('declarada', 'enlace de compra protegida'),
      politicasDeGarantia: conocido(1, 'la ficha menciona garantia'),
    };
    const { verdict } = await new MockRiskEngineClient().evaluar(solicitud(pobre));
    expect(esAbstencion(verdict)).toBe(true);
    expect(verdict.kind).not.toBe('riesgo');
  });

  it('devuelve las caracteristicas sobre las que decidio', async () => {
    // Asi el panel no puede mostrar un veredicto que sus datos no sustentan.
    const f = soloCliente();
    const r = await new MockRiskEngineClient().evaluar(solicitud(f));
    expect(r.features).toStrictEqual(f);
  });

  it('produce los cuatro desenlaces solo si se piden explicitamente', async () => {
    for (const esc of ['alto', 'moderado', 'bajo'] as const) {
      const { verdict } = await new MockRiskEngineClient(esc).evaluar(solicitud(soloCliente()));
      expect(verdict).toMatchObject({ kind: 'riesgo', nivel: esc });
    }
    const { verdict } = await new MockRiskEngineClient('evidencia-insuficiente').evaluar(
      solicitud(soloCliente()),
    );
    expect(esAbstencion(verdict)).toBe(true);
  });

  it('en un escenario forzado, lo mostrado coincide con lo que sustenta', async () => {
    const r = await new MockRiskEngineClient('bajo').evaluar(solicitud(soloCliente()));
    if (r.verdict.kind === 'riesgo') {
      for (const id of r.verdict.sustentan) {
        expect(r.features[id].kind).toBe('conocido');
      }
    }
  });

  it('no toca la red', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('el mock no debe llamar a la red');
    };
    await expect(new MockRiskEngineClient().evaluar(solicitud(soloCliente()))).resolves.toBeDefined();
    globalThis.fetch = original;
  });
});

describe('HttpRiskEngineClient · sesion y fallos', () => {
  const conToken = (): Promise<string> => Promise.resolve('jwt-de-prueba');
  const sinToken = (): Promise<null> => Promise.resolve(null);

  it('sin sesion pide iniciar sesion en vez de evaluar', async () => {
    const cliente = new HttpRiskEngineClient('https://ejemplo.invalid', sinToken, 50);
    await expect(cliente.evaluar(solicitud(soloCliente()))).rejects.toBeInstanceOf(
      SesionRequeridaError,
    );
  });

  it('un 401 del servidor tambien pide sesion', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response('', { status: 401 }));
    const cliente = new HttpRiskEngineClient('https://ejemplo.invalid', conToken, 50);
    await expect(cliente.evaluar(solicitud(soloCliente()))).rejects.toBeInstanceOf(
      SesionRequeridaError,
    );
    globalThis.fetch = original;
  });

  it('ante un error de red se abstiene, nunca dice riesgo bajo', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('sin conexion'));
    const { verdict } = await new HttpRiskEngineClient(
      'https://ejemplo.invalid',
      conToken,
      50,
    ).evaluar(solicitud(soloCliente()));
    expect(esAbstencion(verdict)).toBe(true);
    globalThis.fetch = original;
  });

  it('ante un 500 se abstiene', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response('', { status: 500 }));
    const { verdict } = await new HttpRiskEngineClient(
      'https://ejemplo.invalid',
      conToken,
      50,
    ).evaluar(solicitud(soloCliente()));
    expect(esAbstencion(verdict)).toBe(true);
    globalThis.fetch = original;
  });
});
