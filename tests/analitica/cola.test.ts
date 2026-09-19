import { describe, expect, it } from 'vitest';
import {
  COLA_VACIA,
  MAX_EN_COLA,
  conFallo,
  conModuloApagado,
  encolar,
  esperaTrasFallo,
  puedeEnviar,
  quitar,
  reactivarSiToca,
  siguienteLote,
  type EstadoDeLaCola,
  type EventoEnCola,
} from '../../src/domain/analitica/cola.js';
import { PLATAFORMA, TIPO, type EventoUso } from '../../src/domain/analitica/eventos.js';

const AHORA = Date.parse('2026-09-15T12:00:00.000Z');

const evento = (id: string): EventoUso => ({
  eventId: id,
  type: TIPO.fichaDetectada,
  platform: PLATAFORMA.mercadoLibre,
  occurredAt: '2026-09-15T12:00:00.000Z',
});

const enCola = (id: string, sesionId = 's1'): EventoEnCola => ({
  sesionId,
  evento: evento(id),
});

describe('cola de analitica', () => {
  it('acumula en orden', () => {
    const estado = encolar(encolar(COLA_VACIA, [enCola('a')], AHORA), [enCola('b')], AHORA);
    expect(estado.pendientes.map((e) => e.evento.eventId)).toEqual(['a', 'b']);
  });

  /**
   * Con la ingesta caida la cola crece sin fin y se come el almacenamiento del
   * comprador. Se tiran los mas viejos, que son los que mas cerca estan de
   * caducar por el limite de 7 dias del contrato.
   */
  it('no crece sin limite: descarta los mas viejos', () => {
    const muchos = Array.from({ length: MAX_EN_COLA + 10 }, (_, i) => enCola(`e${String(i)}`));
    const estado = encolar(COLA_VACIA, muchos, AHORA);

    expect(estado.pendientes).toHaveLength(MAX_EN_COLA);
    expect(estado.pendientes[0]?.evento.eventId).toBe('e10');
  });

  /**
   * El sobre del lote lleva UN `sessionId`. Sin agrupar, los eventos de una
   * pestana se atribuirian a la sesion de otra.
   */
  it('un lote nunca mezcla dos sesiones', () => {
    const estado = encolar(
      COLA_VACIA,
      [enCola('a', 's1'), enCola('b', 's2'), enCola('c', 's1')],
      AHORA,
    );

    const lote = siguienteLote(estado);
    expect(lote?.sesionId).toBe('s1');
    expect(lote?.eventos.map((e) => e.eventId)).toEqual(['a', 'c']);
  });

  it('lo enviado sale de la cola y reinicia el retroceso', () => {
    const estado: EstadoDeLaCola = {
      ...encolar(COLA_VACIA, [enCola('a'), enCola('b')], AHORA),
      intentos: 3,
      noAntesDe: AHORA + 60_000,
    };

    const despues = quitar(estado, [evento('a')]);
    expect(despues.pendientes.map((e) => e.evento.eventId)).toEqual(['b']);
    expect(despues.intentos).toBe(0);
    expect(despues.noAntesDe).toBe(0);
  });

  it('el retroceso crece y se detiene en media hora', () => {
    expect(esperaTrasFallo(0)).toBe(60_000);
    expect(esperaTrasFallo(1)).toBe(120_000);
    expect(esperaTrasFallo(4)).toBe(16 * 60_000);
    expect(esperaTrasFallo(10)).toBe(30 * 60_000);
  });

  it('tras un fallo no se reintenta antes de tiempo', () => {
    const estado = conFallo(encolar(COLA_VACIA, [enCola('a')], AHORA), AHORA);
    expect(puedeEnviar(estado, AHORA)).toBe(false);
    expect(puedeEnviar(estado, AHORA + 59_000)).toBe(false);
    expect(puedeEnviar(estado, AHORA + 61_000)).toBe(true);
  });

  it('una cola vacia no dispara ningun envio', () => {
    expect(puedeEnviar(COLA_VACIA, AHORA)).toBe(false);
    expect(siguienteLote(COLA_VACIA)).toBeNull();
  });

  /**
   * Con el modulo apagado en el servidor no hay nada que mandar y no se acumula:
   * guardar eventos que nadie va a recibir solo gasta el almacenamiento.
   */
  it('con el modulo apagado se tira lo acumulado y se deja de encolar', () => {
    const apagada = conModuloApagado(AHORA);
    expect(apagada.pendientes).toEqual([]);

    const despues = encolar(apagada, [enCola('a')], AHORA + 1000);
    expect(despues.pendientes).toEqual([]);
    expect(puedeEnviar(despues, AHORA + 1000)).toBe(false);
  });

  it('pasado el plazo se vuelve a preguntar: el modulo pudo encenderse', () => {
    const apagada = conModuloApagado(AHORA);
    const undiadespues = AHORA + 24 * 60 * 60_000 + 1;

    expect(reactivarSiToca(apagada, undiadespues).apagado).toBe(false);
    const despues = encolar(apagada, [enCola('a')], undiadespues);
    expect(despues.pendientes).toHaveLength(1);
  });
});
