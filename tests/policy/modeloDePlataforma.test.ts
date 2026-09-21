import { describe, expect, it } from 'vitest';
import { veredictoDelModelo } from '../../src/domain/policy/modeloDePlataforma.js';
import { conocido, indeterminado, FEATURE_IDS, type FeatureSet } from '../../src/domain/features.js';

/** Todas resueltas salvo las que se pidan sin resolver. */
const features = (sinResolver: readonly string[] = []): FeatureSet =>
  Object.fromEntries(
    FEATURE_IDS.map((id) => [
      id,
      sinResolver.includes(id) ? indeterminado('No se pudo leer.') : conocido(3, 'Leido de la ficha.'),
    ]),
  ) as unknown as FeatureSet;

/**
 * En Facebook Marketplace el nivel de riesgo lo decide el modelo de la plataforma,
 * no la politica de la extension.
 */
describe('veredicto del modelo de la plataforma', () => {
  it('traduce cada clase a su nivel de riesgo', () => {
    expect(veredictoDelModelo({ clase: 1, rellenadas: [] }, features())).toMatchObject({
      kind: 'riesgo',
      nivel: 'alto',
    });
    expect(veredictoDelModelo({ clase: 2, rellenadas: [] }, features())).toMatchObject({
      nivel: 'moderado',
    });
    expect(veredictoDelModelo({ clase: 3, rellenadas: [] }, features())).toMatchObject({
      nivel: 'bajo',
    });
  });

  /** La clase 4 no es un nivel de riesgo: es que el vendedor no tiene historial. */
  it('la clase 4 se presenta como falta de evidencia, nunca como seguridad', () => {
    const v = veredictoDelModelo({ clase: 4, rellenadas: [] }, features());

    expect(v?.kind).toBe('evidencia-insuficiente');
    expect(v?.kind === 'evidencia-insuficiente' && v.motivo).toContain('historial');
  });

  /** Una clase nueva no se interpreta: decide la politica, como en el resto. */
  it('una clase que no se reconoce se ignora', () => {
    expect(veredictoDelModelo({ clase: 7, rellenadas: [] }, features())).toBeNull();
    expect(veredictoDelModelo({ clase: 0, rellenadas: [] }, features())).toBeNull();
  });

  it('la confianza refleja cuantas caracteristicas se resolvieron', () => {
    const todas = veredictoDelModelo({ clase: 3, rellenadas: [] }, features());
    const aMedias = veredictoDelModelo(
      { clase: 3, rellenadas: ['sellerSeniorityInDays'] },
      features(FEATURE_IDS.slice(0, 4)),
    );

    expect(todas).toMatchObject({ confianza: 1 });
    expect(aMedias?.kind === 'riesgo' && aMedias.confianza).toBeLessThan(1);
  });

  it('el veredicto lleva que caracteristicas lo sustentan y cuales faltaron', () => {
    const v = veredictoDelModelo({ clase: 2, rellenadas: [] }, features([FEATURE_IDS[0]]));

    expect(v?.kind === 'riesgo' && v.sinResolver).toEqual([FEATURE_IDS[0]]);
    expect(v?.kind === 'riesgo' && v.sustentan).toHaveLength(FEATURE_IDS.length - 1);
  });
});
