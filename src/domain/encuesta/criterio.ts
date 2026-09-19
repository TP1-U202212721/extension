/**
 * Cuando se ofrece la encuesta de satisfaccion.
 *
 * ── EL CRITERIO, Y POR QUE ESTE ─────────────────────────────────────────────
 * Se ofrece UNA sola vez, y solo cuando se cumplen las cuatro condiciones:
 *
 * 1. **No en la primera consulta.** Hacen falta `MINIMO_CONSULTAS` analisis
 *    resueltos en esta instalacion. A la primera, la persona todavia no tiene
 *    con que opinar: calificaria la novedad, no la herramienta. El protocolo de
 *    la tesis mide satisfaccion con el uso, no primera impresion.
 *
 * 2. **Sobre una consulta que dio veredicto.** Si el motor fallo o exigio
 *    sesion, no hay resultado que calificar y la nota no se podria cruzar con
 *    ningun veredicto, que es justo el cruce que la encuesta existe para
 *    permitir.
 *
 * 3. **Una vez y ya.** Enviada o descartada, no se vuelve a ofrecer nunca.
 *    Insistir es molestar, y ademas el backend responde `409` a la segunda
 *    respuesta de la misma instalacion sobre el mismo contexto.
 *
 * 4. **Con el modulo encendido.** Lo dice el propio instrumento; si esta
 *    apagado no se muestra nada.
 *
 * El criterio esta AQUI, puro y con nombre, en vez de repartido en condiciones
 * dentro de la UI: es una decision metodologica de la tesis y tiene que poder
 * leerse y cambiarse en un sitio. Queda escrito en docs/adr/0007.
 */

/** Consultas resueltas que tienen que haber ocurrido antes de preguntar. */
export const MINIMO_CONSULTAS = 3;

export type DesenlaceDeLaEncuesta = 'pendiente' | 'enviada' | 'descartada';

export interface EstadoDeLaEncuesta {
  /** Analisis con veredicto acumulados en esta instalacion. */
  readonly consultasResueltas: number;
  readonly desenlace: DesenlaceDeLaEncuesta;
}

export const ENCUESTA_INICIAL: EstadoDeLaEncuesta = {
  consultasResueltas: 0,
  desenlace: 'pendiente',
};

export const conConsultaResuelta = (e: EstadoDeLaEncuesta): EstadoDeLaEncuesta => ({
  ...e,
  consultasResueltas: e.consultasResueltas + 1,
});

export const cerrada = (
  e: EstadoDeLaEncuesta,
  desenlace: Exclude<DesenlaceDeLaEncuesta, 'pendiente'>,
): EstadoDeLaEncuesta => ({ ...e, desenlace });

export interface ContextoDeOferta {
  readonly estado: EstadoDeLaEncuesta;
  /** La consulta que se acaba de mostrar llego a veredicto. */
  readonly huboVeredicto: boolean;
  /** El instrumento dice que el modulo esta encendido. */
  readonly moduloEncendido: boolean;
}

export const debeOfrecerse = (c: ContextoDeOferta): boolean =>
  c.moduloEncendido &&
  c.huboVeredicto &&
  c.estado.desenlace === 'pendiente' &&
  c.estado.consultasResueltas >= MINIMO_CONSULTAS;
