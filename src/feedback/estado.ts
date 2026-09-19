import { browser } from 'wxt/browser';
import {
  ENCUESTA_INICIAL,
  conEnvio,
  sinConsentimiento,
  type EstadoDeLaEncuesta,
} from '../domain/encuesta/criterio.js';

/**
 * Donde vive el estado de la encuesta: cuantas respuestas van hoy, cuando fue la
 * ultima y que version del consentimiento acepto la persona.
 *
 * Es `storage.local` y no memoria porque el tope diario y el consentimiento
 * tienen que sobrevivir al cierre del navegador. La clave es nueva (`v2`): el
 * estado del criterio anterior no se reutiliza.
 */

const CLAVE = 'scamshield.encuesta.estado.v2';

const esEstado = (v: unknown): v is EstadoDeLaEncuesta =>
  typeof v === 'object' &&
  v !== null &&
  'dia' in v &&
  typeof v.dia === 'string' &&
  'enviadasHoy' in v &&
  typeof v.enviadasHoy === 'number' &&
  'ultimoEnvio' in v &&
  (v.ultimoEnvio === null || typeof v.ultimoEnvio === 'number') &&
  'consentimientoAceptado' in v &&
  (v.consentimientoAceptado === null || typeof v.consentimientoAceptado === 'string');

export const leerEstadoDeEncuesta = async (): Promise<EstadoDeLaEncuesta> => {
  try {
    const guardado = await browser.storage.local.get(CLAVE);
    const v: unknown = guardado[CLAVE];
    return esEstado(v) ? v : ENCUESTA_INICIAL;
  } catch {
    return ENCUESTA_INICIAL;
  }
};

const guardar = async (estado: EstadoDeLaEncuesta): Promise<void> => {
  try {
    await browser.storage.local.set({ [CLAVE]: estado });
  } catch {
    // Sin almacenamiento la encuesta se sigue ofreciendo; solo se pierde el tope
    // local, y el del servidor sigue vigente. Nunca rompe.
  }
};

/** Anota un envio que el servidor acepto, con la version de consentimiento usada. */
export const registrarEnvio = async (consentVersion: string): Promise<void> => {
  await guardar(conEnvio(await leerEstadoDeEncuesta(), Date.now(), consentVersion));
};

/** Olvida el consentimiento: la proxima vez se volvera a pedir la casilla. */
export const retirarConsentimiento = async (): Promise<void> => {
  await guardar(sinConsentimiento(await leerEstadoDeEncuesta()));
};
