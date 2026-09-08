import { describe, expect, it } from 'vitest';
import { aFeature, type DetalleDominio } from '../../src/transport/DomainVeracityClient.js';
import { estaResuelta, type Veracidad } from '../../src/domain/features.js';

const detalle = (veracity: Veracidad, confidence: number): DetalleDominio => ({
  host: 'articulo.mercadolibre.com.pe',
  registrableDomain: 'mercadolibre.com.pe',
  veracity,
  veracityLabel: 'etiqueta',
  score: 50,
  confidence,
  confidenceLabel: confidence <= 2 ? 'Baja' : 'Alta',
  coverage: 0.5,
  summary: 'resumen del analizador',
  riskSignals: [],
  trustSignals: [],
  unverifiedSignals: [],
  limitations: [],
});

describe('veracidad de dominio -> los tres estados', () => {
  // El punto delicado del contrato: el nivel 3 del backend significa dos cosas
  // distintas y lo que las separa es la confianza.
  it('nivel 3 con confianza baja queda indeterminado', () => {
    for (const confianza of [1, 2]) {
      expect(aFeature(detalle(3, confianza)).kind).toBe('indeterminado');
    }
  });

  it('nivel 3 con confianza media o alta es un valor conocido', () => {
    for (const confianza of [3, 4]) {
      const v = aFeature(detalle(3, confianza));
      expect(v.kind).toBe('conocido');
      if (estaResuelta(v)) expect(v.valor).toBe(3);
    }
  });

  it('los demas niveles son conocidos aunque la confianza sea baja', () => {
    for (const nivel of [1, 2, 4, 5] as const) {
      const v = aFeature(detalle(nivel, 1));
      expect(v.kind).toBe('conocido');
      if (estaResuelta(v)) expect(v.valor).toBe(nivel);
    }
  });

  it('el valor conocido conserva el resumen del backend como evidencia', () => {
    const v = aFeature(detalle(5, 4));
    if (estaResuelta(v)) expect(v.evidencia).toBe('resumen del analizador');
  });
});
