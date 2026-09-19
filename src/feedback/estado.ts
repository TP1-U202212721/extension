import { browser } from 'wxt/browser';
import {
  ENCUESTA_INICIAL,
  cerrada,
  conConsultaResuelta,
  type DesenlaceDeLaEncuesta,
  type EstadoDeLaEncuesta,
} from '../domain/encuesta/criterio.js';

/**
 * Donde vive el estado de la encuesta: cuantas consultas lleva esta instalacion
 * y si ya se ofrecio.
 *
 * Es `storage.local` y no memoria porque el criterio es "una vez por
 * instalacion", y una cuenta que se reinicia con el navegador convertiria eso en
 * "una vez por sesion", que es exactamente lo que se quiere evitar.
 */

const CLAVE = 'scamshield.encuesta.estado';

const esEstado = (v: unknown): v is EstadoDeLaEncuesta =>
  typeof v === 'object' &&
  v !== null &&
  'consultasResueltas' in v &&
  typeof v.consultasResueltas === 'number' &&
  'desenlace' in v &&
  (v.desenlace === 'pendiente' || v.desenlace === 'enviada' || v.desenlace === 'descartada');

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
    // Sin almacenamiento la encuesta simplemente no se ofrece. Nunca rompe.
  }
};

/** Suma una consulta con veredicto y devuelve el estado ya actualizado. */
export const registrarConsultaResuelta = async (): Promise<EstadoDeLaEncuesta> => {
  const estado = conConsultaResuelta(await leerEstadoDeEncuesta());
  await guardar(estado);
  return estado;
};

/** Cierra la encuesta para siempre: respondida o descartada, no se repite. */
export const cerrarEncuesta = async (
  desenlace: Exclude<DesenlaceDeLaEncuesta, 'pendiente'>,
): Promise<void> => {
  await guardar(cerrada(await leerEstadoDeEncuesta(), desenlace));
};
