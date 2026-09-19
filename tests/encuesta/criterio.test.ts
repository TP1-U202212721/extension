import { describe, expect, it } from 'vitest';
import {
  ENCUESTA_INICIAL,
  ESPERA_MINIMA_MS,
  MAXIMO_POR_DIA,
  alDia,
  conEnvio,
  consentimientoVigente,
  debeOfrecerse,
  sinConsentimiento,
  type EstadoDeLaEncuesta,
} from '../../src/domain/encuesta/criterio.js';

const LUNES = Date.parse('2026-09-21T15:00:00Z');
const MARTES = Date.parse('2026-09-22T15:00:00Z');
const V1 = 'consent-v1';

/** `n` envios el mismo dia, espaciados lo suficiente. */
const conEnvios = (n: number, desde = LUNES): EstadoDeLaEncuesta => {
  let estado = ENCUESTA_INICIAL;
  for (let i = 0; i < n; i += 1) estado = conEnvio(estado, desde + i * ESPERA_MINIMA_MS, V1);
  return estado;
};

const ofrecer = (
  estado: EstadoDeLaEncuesta,
  ahora: number,
  extra?: Partial<Parameters<typeof debeOfrecerse>[0]>,
) => debeOfrecerse({ estado, ahora, huboVeredicto: true, moduloEncendido: true, ...extra });

describe('la encuesta se ofrece en cada consulta', () => {
  it('desde la primera consulta con veredicto', () => {
    expect(ofrecer(ENCUESTA_INICIAL, LUNES)).toBe(true);
  });

  it('otra vez en la consulta siguiente, pasada la espera minima', () => {
    expect(ofrecer(conEnvios(1), LUNES + ESPERA_MINIMA_MS)).toBe(true);
  });

  /** Sin veredicto no hay nada que calificar ni con que cruzar la nota. */
  it('no cuando la consulta no llego a veredicto', () => {
    expect(ofrecer(ENCUESTA_INICIAL, LUNES, { huboVeredicto: false })).toBe(false);
  });

  it('no cuando el modulo esta apagado en el servidor', () => {
    expect(ofrecer(ENCUESTA_INICIAL, LUNES, { moduloEncendido: false })).toBe(false);
  });
});

describe('los topes son los mismos que aplica el backend', () => {
  it('no dentro de la espera minima tras un envio', () => {
    expect(ofrecer(conEnvios(1), LUNES + ESPERA_MINIMA_MS - 1)).toBe(false);
  });

  it('deja de ofrecerse al llegar al maximo diario', () => {
    const despues = LUNES + (MAXIMO_POR_DIA + 1) * ESPERA_MINIMA_MS;
    expect(ofrecer(conEnvios(MAXIMO_POR_DIA), despues)).toBe(false);
    expect(ofrecer(conEnvios(MAXIMO_POR_DIA - 1), despues)).toBe(true);
  });

  it('el tope se reinicia al dia siguiente (UTC)', () => {
    const lleno = conEnvios(MAXIMO_POR_DIA);
    expect(ofrecer(lleno, MARTES)).toBe(true);
    expect(alDia(lleno, MARTES).enviadasHoy).toBe(0);
  });

  it('el primer envio del dia nuevo cuenta desde uno', () => {
    expect(conEnvio(conEnvios(MAXIMO_POR_DIA), MARTES, V1).enviadasHoy).toBe(1);
  });
});

describe('el consentimiento se recuerda por version del texto', () => {
  it('no hay consentimiento antes del primer envio', () => {
    expect(consentimientoVigente(ENCUESTA_INICIAL, V1)).toBe(false);
  });

  it('tras enviar, esa misma version queda aceptada', () => {
    expect(consentimientoVigente(conEnvios(1), V1)).toBe(true);
  });

  it('si el texto cambia de version, se vuelve a pedir', () => {
    expect(consentimientoVigente(conEnvios(1), 'consent-v2')).toBe(false);
  });

  it('retirarlo obliga a pedirlo otra vez', () => {
    expect(consentimientoVigente(sinConsentimiento(conEnvios(1)), V1)).toBe(false);
  });

  it('una version vacia nunca cuenta como aceptada', () => {
    expect(consentimientoVigente(conEnvio(ENCUESTA_INICIAL, LUNES, ''), '')).toBe(false);
  });
});
