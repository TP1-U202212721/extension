/**
 * Las reglas de la cola de analitica, sin almacenamiento ni relojes.
 *
 * Todo lo que decide QUE se manda, CUANDO se vuelve a intentar y QUE se tira
 * cuando la cola crece vive aqui, en funciones puras que se pueden fijar con
 * tests. `src/analytics/ColaAnalitica.ts` solo pone el almacenamiento, la alarma
 * y la red alrededor.
 */

import { MAX_EVENTOS_POR_LOTE, type EventoUso } from './eventos.js';

/**
 * Un evento esperando su turno, con la sesion a la que pertenece.
 *
 * La sesion viaja por evento y no por cola porque el sobre del lote lleva UN
 * `sessionId`, y en la cola pueden convivir eventos de varias pestanas. Sin
 * esto, un lote mezclaria sesiones y el servidor atribuiria los eventos de una
 * pestana a otra.
 */
export interface EventoEnCola {
  readonly sesionId: string;
  readonly evento: EventoUso;
}

export interface EstadoDeLaCola {
  readonly pendientes: readonly EventoEnCola[];
  /** Intentos fallidos seguidos. Gobierna el retroceso exponencial. */
  readonly intentos: number;
  /** Epoch ms antes del cual no se vuelve a intentar. */
  readonly noAntesDe: number;
  /** El servidor dijo que el modulo esta apagado. Se deja de emitir. */
  readonly apagado: boolean;
}

export const COLA_VACIA: EstadoDeLaCola = {
  pendientes: [],
  intentos: 0,
  noAntesDe: 0,
  apagado: false,
};

/**
 * Eventos que se guardan como mucho.
 *
 * Con la ingesta caida, la cola crece sin fin y se come el almacenamiento del
 * navegador del comprador. Al llegar al tope se tiran LOS MAS VIEJOS: son los
 * que mas cerca estan de caducar por el limite de 7 dias del contrato, asi que
 * son los que menos se pierden.
 */
export const MAX_EN_COLA = 500;

/** Eventos acumulados que disparan un envio inmediato. */
export const UMBRAL_DE_ENVIO = 20;

/** Con menos de esto, se espera al siguiente tic periodico. */
export const INTERVALO_MINUTOS = 1;

const MINUTO = 60_000;
/** Media hora. Mas alla, reintentar mas seguido no arregla nada. */
const ESPERA_MAXIMA_MS = 30 * MINUTO;
/** Con el modulo apagado en el servidor no se vuelve a preguntar en un dia. */
export const ESPERA_APAGADO_MS = 24 * 60 * MINUTO;

/**
 * Levanta la pausa cuando se cumple el plazo.
 *
 * Que el modulo estuviera apagado en el servidor hace un dia no significa que lo
 * siga estando, y la extension no tiene forma de enterarse si deja de preguntar
 * para siempre.
 */
export const reactivarSiToca = (estado: EstadoDeLaCola, ahora: number): EstadoDeLaCola =>
  estado.apagado && ahora >= estado.noAntesDe ? COLA_VACIA : estado;

export const encolar = (
  estado: EstadoDeLaCola,
  nuevos: readonly EventoEnCola[],
  ahora: number,
): EstadoDeLaCola => {
  const base = reactivarSiToca(estado, ahora);
  // Con la analitica apagada en el servidor no se acumula nada: guardar eventos
  // que nadie va a recibir solo gasta el almacenamiento del comprador.
  if (base.apagado) return base;
  const pendientes = [...base.pendientes, ...nuevos];
  return {
    ...base,
    pendientes: pendientes.slice(Math.max(0, pendientes.length - MAX_EN_COLA)),
  };
};

/**
 * El siguiente lote: los eventos mas viejos de UNA sola sesion.
 *
 * Se agrupa por sesion porque el sobre solo admite una, y se elige la de la
 * cabeza de la cola para que ninguna sesion pueda quedarse atras indefinidamente
 * mientras otra sigue produciendo.
 */
export const siguienteLote = (
  estado: EstadoDeLaCola,
): { readonly sesionId: string; readonly eventos: readonly EventoUso[] } | null => {
  const cabeza = estado.pendientes[0];
  if (cabeza === undefined) return null;

  const eventos = estado.pendientes
    .filter((e) => e.sesionId === cabeza.sesionId)
    .slice(0, MAX_EVENTOS_POR_LOTE)
    .map((e) => e.evento);

  return { sesionId: cabeza.sesionId, eventos };
};

/** Saca de la cola los eventos que el servidor ya proceso, por su `eventId`. */
export const quitar = (
  estado: EstadoDeLaCola,
  enviados: readonly EventoUso[],
): EstadoDeLaCola => {
  const ids = new Set(enviados.map((e) => e.eventId));
  return {
    ...estado,
    pendientes: estado.pendientes.filter((e) => !ids.has(e.evento.eventId)),
    intentos: 0,
    noAntesDe: 0,
  };
};

/**
 * Retroceso exponencial: 1, 2, 4, 8, 16 y 30 minutos.
 *
 * Empieza en un minuto y no en un segundo porque nada de esto es urgente: si la
 * ingesta esta caida, machacarla no la levanta, y la analitica no puede competir
 * por la red con el veredicto que el comprador esta esperando.
 */
export const esperaTrasFallo = (intentos: number): number =>
  Math.min(MINUTO * 2 ** Math.max(0, intentos), ESPERA_MAXIMA_MS);

export const conFallo = (estado: EstadoDeLaCola, ahora: number): EstadoDeLaCola => ({
  ...estado,
  intentos: estado.intentos + 1,
  noAntesDe: ahora + esperaTrasFallo(estado.intentos),
});

/** El servidor tiene la analitica apagada: se tira lo acumulado y se calla. */
export const conModuloApagado = (ahora: number): EstadoDeLaCola => ({
  pendientes: [],
  intentos: 0,
  noAntesDe: ahora + ESPERA_APAGADO_MS,
  apagado: true,
});

export const puedeEnviar = (estado: EstadoDeLaCola, ahora: number): boolean =>
  !estado.apagado && estado.pendientes.length > 0 && ahora >= estado.noAntesDe;
