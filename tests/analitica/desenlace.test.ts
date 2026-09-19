import { describe, expect, it } from 'vitest';
import { bloqueDeAnalisis, CODIGO_DE_CARACTERISTICA } from '../../src/analytics/desenlace.js';
import {
  conocido,
  indeterminado,
  noAplica,
  FEATURE_IDS,
  type FeatureSet,
} from '../../src/domain/features.js';
import type { Verdict } from '../../src/domain/verdict.js';
import type { Detalles, Traza } from '../../src/transport/RiskEngineClient.js';
import { SIN_DETALLES, SIN_TRAZA } from '../../src/transport/RiskEngineClient.js';
import type { DetalleDominio } from '../../src/transport/DomainVeracityClient.js';
import type { DetalleVendedor } from '../../src/transport/SellerReputationClient.js';
import type { DetalleResenas } from '../../src/transport/ReviewAnalysisClient.js';
import { TOPE } from '../../src/domain/analitica/topes.js';

const TODO_INDETERMINADO: FeatureSet = Object.fromEntries(
  FEATURE_IDS.map((id) => [id, indeterminado('sin evidencia')]),
) as unknown as FeatureSet;

const ABSTENCION: Verdict = {
  kind: 'evidencia-insuficiente',
  resueltas: [],
  sinResolver: [...FEATURE_IDS],
  dimensionesVacias: [],
  motivo: 'sin evidencia',
};

const dominio = (extra: Partial<DetalleDominio> = {}): DetalleDominio => ({
  host: 'articulo.mercadolibre.com.pe',
  registrableDomain: 'mercadolibre.com.pe',
  veracity: 2,
  veracityLabel: 'Sospechoso',
  score: 38,
  confidence: 4,
  confidenceLabel: 'Alta',
  coverage: 0.88,
  summary: 'resumen',
  riskSignals: [
    { code: 'morphology.typosquatting', familyLabel: 'Morfologia', statusLabel: '', explanation: '' },
    { code: 'morphology.lure_keywords', familyLabel: 'Morfologia', statusLabel: '', explanation: '' },
  ],
  trustSignals: [
    { code: 'registration.domain_age', familyLabel: 'Registro', statusLabel: '', explanation: '' },
  ],
  unverifiedSignals: [
    { code: 'reputation.feeds', familyLabel: 'Reputacion', statusLabel: '', explanation: '' },
  ],
  limitations: ['El nombre del dominio imita por escasos caracteres a una marca conocida.'],
  ...extra,
});

const vendedor = (extra: Partial<DetalleVendedor> = {}): DetalleVendedor => ({
  sellerName: 'TIENDA EJEMPLO SAC',
  reputation: 3,
  reputationLabel: 'Sin verificar',
  score: 52,
  confidence: 2,
  confidenceLabel: 'Baja',
  coverage: 0.4,
  summary: 'resumen',
  riskSignals: [
    { code: 'ratings.mostly_negative', familyLabel: 'Valoraciones', statusLabel: '', explanation: '' },
  ],
  trustSignals: [],
  unverifiedSignals: [
    { code: 'aftersales.claims', familyLabel: 'Postventa', statusLabel: '', explanation: '' },
  ],
  limitations: ['El vendedor acumula una tasa de reclamos alta.'],
  ...extra,
});

const resenas = (extra: Partial<DetalleResenas> = {}): DetalleResenas => ({
  authenticity: 2,
  authenticityLabel: 'Con muchas senales',
  status: 1,
  statusLabel: 'Evaluadas',
  confidence: 3,
  confidenceLabel: 'Media',
  suspectRate: 0.3847,
  submittedCount: 40,
  evaluatedCount: 40,
  suspectCount: 15,
  coverage: 0.95,
  summary: 'resumen',
  limitations: [],
  ...extra,
});

const traza = (extra: Partial<Traza> = {}): Traza => ({
  documento: { desenlace: 'correcto', duracionMs: 220 },
  dominio: { desenlace: 'correcto', duracionMs: 1480 },
  vendedor: { desenlace: 'tiempo-agotado', duracionMs: 9000 },
  resenas: { desenlace: 'omitido', duracionMs: 0 },
  ...extra,
});

describe('bloque de analisis', () => {
  it('traduce el veredicto y lleva el puntaje que decidio la politica', () => {
    const verdict: Verdict = {
      kind: 'riesgo',
      nivel: 'moderado',
      puntaje: 46,
      confianza: 0.75,
      sustentan: [],
      sinResolver: [],
    };

    const b = bloqueDeAnalisis({
      verdict,
      features: {
        ...TODO_INDETERMINADO,
        proteccionDePago: conocido('declarada', 'x'),
        puntuacionDelProducto: conocido(4.6, 'x'),
        presenciaDeResenas: conocido(true, 'x'),
        volumenDeVentas: conocido(5000, 'x'),
        veracidadDeDominio: conocido(2, 'x'),
        reputacionDelVendedor: conocido(3, 'x'),
      },
      detalles: SIN_DETALLES,
      traza: SIN_TRAZA,
      duracionMs: 1830,
    });

    expect(b.verdict).toBe(2);
    expect(b.score).toBe(46);
    expect(b.durationMs).toBe(1830);
    // 6 de 8 resueltas = 0.75 → confianza 3, los mismos cortes que el backend.
    expect(b.confidence).toBe(3);
    expect(b).not.toHaveProperty('abstentionReason');
  });

  it('en una abstencion no se inventa un puntaje', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: SIN_DETALLES,
      traza: SIN_TRAZA,
      duracionMs: 900,
    });

    expect(b.verdict).toBe(4);
    expect(b).not.toHaveProperty('score');
    // Sin analizadores caidos, lo que falto fue evidencia.
    expect(b.abstentionReason).toBe(1);
  });

  it('una abstencion con un analizador caido la atribuye al analizador', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: SIN_DETALLES,
      traza: traza(),
      duracionMs: 9000,
    });
    expect(b.abstentionReason).toBe(4);
  });

  it('emite el estado de las ocho caracteristicas, con su motivo', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: {
        ...TODO_INDETERMINADO,
        puntuacionDelProducto: conocido(4.6, 'x'),
        presenciaDeResenas: noAplica('la ficha no tiene bloque de opiniones'),
        politicasDeGarantia: indeterminado('ningun selector', 'sin-selector'),
        volumenDeVentas: indeterminado('el analizador tardo', 'tiempo-agotado'),
      },
      detalles: SIN_DETALLES,
      traza: SIN_TRAZA,
      duracionMs: 10,
    });

    expect(b.features).toHaveLength(8);
    const por = (code: string) => b.features.find((f) => f.code === code);

    expect(por('puntuacion_producto')).toEqual({ code: 'puntuacion_producto', outcome: 1 });
    // Una ausencia confirmada es un hecho: desenlace propio, no indeterminada.
    expect(por('tiene_resenas')).toEqual({ code: 'tiene_resenas', outcome: 2 });
    expect(por('politicas_garantia')).toEqual({
      code: 'politicas_garantia',
      outcome: 3,
      reason: 1,
    });
    expect(por('productos_vendidos')).toEqual({
      code: 'productos_vendidos',
      outcome: 3,
      reason: 5,
    });
    // Sin causa conocida no se inventa ninguna: 99 es "motivo no clasificado".
    expect(por('veracidad_dominio')).toEqual({ code: 'veracidad_dominio', outcome: 3, reason: 99 });
  });

  it('nunca emite el valor de una caracteristica, solo su nombre', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: {
        ...TODO_INDETERMINADO,
        puntuacionDelProducto: conocido(4.6, 'Puntuacion promedio de 4.6 sobre 5 segun la ficha.'),
        volumenDeVentas: conocido(5000, 'La ficha declara aproximadamente 5000 ventas.'),
      },
      detalles: SIN_DETALLES,
      traza: SIN_TRAZA,
      duracionMs: 10,
    });

    const json = JSON.stringify(b.features);
    expect(json).not.toContain('4.6');
    expect(json).not.toContain('5000');
    expect(json).not.toContain('ficha');
  });

  it('reporta la latencia y el desenlace de cada analizador', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: SIN_DETALLES,
      traza: traza(),
      duracionMs: 9000,
    });

    expect(b.analyzers).toEqual([
      { analyzer: 1, outcome: 1, durationMs: 220 },
      { analyzer: 2, outcome: 1, durationMs: 1480 },
      { analyzer: 3, outcome: 3, durationMs: 9000 },
      // El omitido no se intento: no puede aportar latencia.
      { analyzer: 4, outcome: 4, durationMs: 0 },
    ]);
  });

  it('emite el veredicto de cada analizador que respondio', () => {
    const detalles: Detalles = {
      documento: null,
      dominio: dominio(),
      vendedor: vendedor(),
      resenas: resenas(),
    };

    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles,
      traza: SIN_TRAZA,
      duracionMs: 10,
    });

    expect(b.verdicts).toEqual([
      { analyzer: 2, level: 2, confidence: 4, score: 38, coverage: 0.88 },
      { analyzer: 3, level: 3, confidence: 2, score: 52, coverage: 0.4 },
      { analyzer: 4, level: 2, confidence: 3, coverage: 0.95, suspectReviewRate: 0.3847 },
    ]);
  });

  it('un analizador que no respondio no produce fila', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: { documento: null, dominio: dominio(), vendedor: null, resenas: null },
      traza: SIN_TRAZA,
      duracionMs: 10,
    });
    expect(b.verdicts.map((v) => v.analyzer)).toEqual([2]);
  });

  /**
   * `suspectRate` en null significa que NO hubo medicion. Un 0 se leeria como
   * "ninguna resena es falsa", que es lo contrario de lo que se sabe.
   */
  it('sin medicion de resenas no se emite la proporcion', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: {
        documento: null,
        dominio: null,
        vendedor: null,
        resenas: resenas({ suspectRate: null, authenticity: 3, confidence: 0 }),
      },
      traza: SIN_TRAZA,
      duracionMs: 10,
    });

    expect(b.verdicts).toHaveLength(1);
    expect(b.verdicts[0]).not.toHaveProperty('suspectReviewRate');
    // Una confianza de 0 esta fuera de la escala 1-4: es "sin dato", se omite.
    expect(b.verdicts[0]).not.toHaveProperty('confidence');
  });

  it('emite los topes que de verdad actuaron, por su codigo', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: { documento: null, dominio: dominio(), vendedor: vendedor(), resenas: resenas() },
      traza: SIN_TRAZA,
      duracionMs: 10,
    });
    expect(b.caps).toEqual([TOPE.typosquatting, TOPE.tasaDeReclamosAlta]);
  });

  it('cuenta las senales por familia y no emite sus codigos', () => {
    const b = bloqueDeAnalisis({
      verdict: ABSTENCION,
      features: TODO_INDETERMINADO,
      detalles: { documento: null, dominio: dominio(), vendedor: vendedor(), resenas: null },
      traza: SIN_TRAZA,
      duracionMs: 10,
    });

    expect(b.signalFamilies).toEqual([
      // dominio: 1 registro (1 a favor), 4 morfologia (2 en contra), 6 reputacion (1 sin verificar)
      { analyzer: 2, family: 1, risk: 0, trust: 1, unverified: 0 },
      { analyzer: 2, family: 4, risk: 2, trust: 0, unverified: 0 },
      { analyzer: 2, family: 6, risk: 0, trust: 0, unverified: 1 },
      // vendedor: 4 valoraciones (1 en contra), 5 postventa (1 sin verificar)
      { analyzer: 3, family: 4, risk: 1, trust: 0, unverified: 0 },
      { analyzer: 3, family: 5, risk: 0, trust: 0, unverified: 1 },
    ]);

    expect(JSON.stringify(b.signalFamilies)).not.toContain('typosquatting');
  });

  it('las ocho caracteristicas tienen nombre propio y en ASCII', () => {
    const codigos = FEATURE_IDS.map((id) => CODIGO_DE_CARACTERISTICA[id]);
    expect(new Set(codigos).size).toBe(FEATURE_IDS.length);
    for (const c of codigos) expect(c).toMatch(/^[a-z_]+$/);
  });
});
