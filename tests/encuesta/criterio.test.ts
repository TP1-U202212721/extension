import { describe, expect, it } from 'vitest';
import {
  ENCUESTA_INICIAL,
  MINIMO_CONSULTAS,
  cerrada,
  conConsultaResuelta,
  debeOfrecerse,
  type EstadoDeLaEncuesta,
} from '../../src/domain/encuesta/criterio.js';

const conConsultas = (n: number): EstadoDeLaEncuesta => {
  let estado = ENCUESTA_INICIAL;
  for (let i = 0; i < n; i += 1) estado = conConsultaResuelta(estado);
  return estado;
};

const ofrecer = (estado: EstadoDeLaEncuesta, extra?: Partial<Parameters<typeof debeOfrecerse>[0]>) =>
  debeOfrecerse({ estado, huboVeredicto: true, moduloEncendido: true, ...extra });

describe('cuando se ofrece la encuesta', () => {
  it('nunca en la primera consulta', () => {
    expect(ofrecer(conConsultas(1))).toBe(false);
    expect(ofrecer(conConsultas(MINIMO_CONSULTAS - 1))).toBe(false);
  });

  it('a partir de la tercera consulta resuelta', () => {
    expect(ofrecer(conConsultas(MINIMO_CONSULTAS))).toBe(true);
    expect(ofrecer(conConsultas(MINIMO_CONSULTAS + 5))).toBe(true);
  });

  /**
   * Sin veredicto no hay nada que calificar, y la nota no se podria cruzar con
   * ningun resultado: ese cruce es la razon de ser de la encuesta.
   */
  it('no cuando la consulta no llego a veredicto', () => {
    expect(ofrecer(conConsultas(10), { huboVeredicto: false })).toBe(false);
  });

  it('no cuando el modulo esta apagado en el servidor', () => {
    expect(ofrecer(conConsultas(10), { moduloEncendido: false })).toBe(false);
  });

  it('no se repite: ni tras responder ni tras descartar', () => {
    const muchas = conConsultas(20);
    expect(ofrecer(cerrada(muchas, 'enviada'))).toBe(false);
    expect(ofrecer(cerrada(muchas, 'descartada'))).toBe(false);
  });

  it('cerrarla no borra la cuenta de consultas', () => {
    const estado = cerrada(conConsultas(4), 'enviada');
    expect(estado.consultasResueltas).toBe(4);
  });
});
