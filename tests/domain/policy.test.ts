import { describe, expect, it } from 'vitest';
import {
  conocido,
  indeterminado,
  DIMENSIONS,
  FEATURE_IDS,
  FEATURE_META,
  featuresDeDimension,
  type FeatureSet,
} from '../../src/domain/features.js';
import { ThresholdPolicy } from '../../src/domain/policy/ThresholdPolicy.js';
import { esAbstencion } from '../../src/domain/verdict.js';

const policy = new ThresholdPolicy();

const todoIndeterminado = (): FeatureSet =>
  Object.fromEntries(
    FEATURE_IDS.map((id) => [id, indeterminado('sin evidencia')]),
  ) as unknown as FeatureSet;

/** Las cinco de cliente resueltas, las tres de backend sin resolver. */
const soloCliente = (): FeatureSet => ({
  ...todoIndeterminado(),
  proteccionDePago: conocido('declarada', 'enlace de compra protegida'),
  puntuacionDelProducto: conocido(4.8, 'promedio de la ficha'),
  presenciaDeResenas: conocido(true, '1250 opiniones'),
  politicasDeGarantia: conocido(2, 'garantia de fabrica'),
  volumenDeVentas: conocido(500, '+500 vendidos'),
});

const completo = (): FeatureSet => ({
  ...soloCliente(),
  veracidadDeDominio: conocido(5, 'dominio verificado'),
  reputacionDelVendedor: conocido(5, 'historial del vendedor'),
  autenticidadDeResenas: conocido(5, '10% con indicios'),
});

describe('las tres dimensiones', () => {
  it('reparten las ocho caracteristicas sin solapamiento', () => {
    const porDimension = [
      featuresDeDimension(DIMENSIONS.identidadDelSitio),
      featuresDeDimension(DIMENSIONS.fiabilidadDelVendedor),
      featuresDeDimension(DIMENSIONS.evidenciaDeLaComunidad),
    ];
    expect(porDimension.map((d) => d.length)).toEqual([1, 4, 3]);
    expect(porDimension.flat().sort()).toEqual([...FEATURE_IDS].sort());
  });

  it('identidad del sitio depende de una sola caracteristica, y es de backend', () => {
    // Este es el hallazgo del ADR 0002: es lo que hace que la regla se reduzca
    // en la practica a "veracidad de dominio resuelta, o no hay veredicto".
    const ids = featuresDeDimension(DIMENSIONS.identidadDelSitio);
    expect(ids).toEqual(['veracidadDeDominio']);
    expect(FEATURE_META.veracidadDeDominio.origen).toBe('backend');
  });
});

describe('ThresholdPolicy · abstencion', () => {
  it('se abstiene sin ninguna evidencia', () => {
    const v = policy.decidir(todoIndeterminado());
    expect(esAbstencion(v)).toBe(true);
  });

  it('se abstiene aunque las cinco de cliente resuelvan, por faltar identidad del sitio', () => {
    // r=5 supera el umbral r>=4, y aun asi abstiene: la condicion que manda es
    // la dimension, no el umbral.
    const v = policy.decidir(soloCliente());
    expect(esAbstencion(v)).toBe(true);
    if (esAbstencion(v)) {
      expect(v.resueltas).toHaveLength(5);
      expect(v.dimensionesVacias).toContain(DIMENSIONS.identidadDelSitio);
    }
  });

  it('emite veredicto cuando las tres dimensiones aportan', () => {
    const v = policy.decidir(completo());
    expect(v.kind).toBe('riesgo');
  });

  it('nunca presenta la falta de evidencia como riesgo bajo', () => {
    const v = policy.decidir(todoIndeterminado());
    expect(v.kind).not.toBe('riesgo');
  });
});

describe('ThresholdPolicy · niveles', () => {
  it('senales buenas dan riesgo bajo', () => {
    const v = policy.decidir(completo());
    expect(v).toMatchObject({ kind: 'riesgo', nivel: 'bajo' });
  });

  it('senales malas dan riesgo alto', () => {
    const v = policy.decidir({
      ...completo(),
      proteccionDePago: conocido('no-declarada', 'sin enlace'),
      veracidadDeDominio: conocido(1, 'dominio sospechoso'),
      reputacionDelVendedor: conocido(1, 'sin historial'),
      autenticidadDeResenas: conocido(1, '90% con indicios'),
      puntuacionDelProducto: conocido(1.5, 'promedio bajo'),
      presenciaDeResenas: conocido(false, 'sin opiniones'),
      politicasDeGarantia: conocido(0, 'sin garantia'),
      volumenDeVentas: conocido(1, '1 vendido'),
    });
    expect(v).toMatchObject({ kind: 'riesgo', nivel: 'alto' });
  });

  it('la confianza refleja cuantas caracteristicas sustentan el veredicto', () => {
    const v = policy.decidir(completo());
    if (v.kind === 'riesgo') {
      expect(v.confianza).toBe(1);
      expect(v.sustentan).toHaveLength(8);
      expect(v.sinResolver).toHaveLength(0);
    }
  });
});

/**
 * Dentro de un marketplace, el dominio y la pasarela son constantes de la
 * plataforma y no acreditan a ESTE vendedor. El caso es real: AliExpress,
 * publicacion 1005012763670050, medida el 2026-09-22.
 */
describe('ThresholdPolicy · dentro de un marketplace', () => {
  /** Vendedor con reportes en contra, sin resenas y con cuatro ventas. */
  const vendedorMalo = (): FeatureSet => ({
    ...todoIndeterminado(),
    proteccionDePago: conocido('declarada', 'compra protegida de la plataforma'),
    veracidadDeDominio: conocido(5, 'aliexpress.com es legitimo'),
    politicasDeGarantia: conocido(2, 'la ficha declara garantia'),
    reputacionDelVendedor: conocido(1, 'compradores anteriores reportan problemas'),
    puntuacionDelProducto: conocido(1, 'promedio de 1 sobre 5'),
    presenciaDeResenas: conocido(false, 'la publicacion no tiene resenas'),
    volumenDeVentas: conocido(4, 'aproximadamente 4 ventas'),
  });

  it('un vendedor en rojo da riesgo alto, sin los puntos que regala la plataforma', () => {
    const v = policy.decidir(vendedorMalo(), { enMarketplace: true });

    expect(v).toMatchObject({ kind: 'riesgo', nivel: 'alto' });
  });

  it('fuera del marketplace los mismos datos se quedan en moderado', () => {
    // En una tienda con dominio propio, que el dominio sea legitimo y declare
    // pasarela SI es evidencia, y por eso sostiene el veredicto.
    const v = policy.decidir(vendedorMalo(), { enMarketplace: false });

    expect(v).toMatchObject({ kind: 'riesgo', nivel: 'moderado' });
  });

  it('una publicacion sana del mismo marketplace sigue siendo riesgo bajo', () => {
    const v = policy.decidir(completo(), { enMarketplace: true });

    expect(v).toMatchObject({ kind: 'riesgo', nivel: 'bajo' });
  });

  it('sin contexto se comporta como antes, puntuando las ocho', () => {
    expect(policy.decidir(vendedorMalo())).toMatchObject({ nivel: 'moderado' });
  });
});
