import { browser } from 'wxt/browser';

/** Origen del cliente web donde el comprador inicia sesion. */
export const APP_WEB = 'https://scamshield.ryzeon.dev';
export const URL_LOGIN = `${APP_WEB}/login`;
export const URL_REGISTRO = `${APP_WEB}/register`;

/**
 * Lee el JWT de la sesion del cliente web.
 *
 * La extension no pide credenciales ni las guarda: reutiliza la sesion que el
 * comprador ya inicio en la aplicacion. Si no hay ninguna, devuelve null y la
 * interfaz ofrece iniciar sesion o registrarse.
 */
export const obtenerToken = async (): Promise<string | null> => {
  try {
    const cookie = await browser.cookies.get({ url: APP_WEB, name: 'token' });
    const valor = cookie?.value ?? '';
    return valor === '' ? null : valor;
  } catch {
    return null;
  }
};
