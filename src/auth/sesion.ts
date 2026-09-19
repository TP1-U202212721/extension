import { browser } from 'wxt/browser';
import { API_BASE_URL } from '../api.js';

/** Cliente web de ScamShield. Es quien autentica; la extension solo lee el resultado. */
export const APP_WEB = 'https://scamshield.ryzeon.me';
export const HOST_APP = 'scamshield.ryzeon.me';
export const URL_LOGIN = `${APP_WEB}/login`;
export const URL_REGISTRO = `${APP_WEB}/register`;

/** Nombre de la cookie que el cliente web escribe tras iniciar sesion. */
export const COOKIE = 'token';
/** Copia local del token, para sobrevivir al cierre del navegador. */
const CLAVE = 'scamshield.sesion';

const CLAIM_EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';

export interface Sesion {
  readonly token: string;
  readonly email: string;
}

/**
 * Lee el payload del JWT sin verificar la firma.
 *
 * Es deliberado: la extension no valida el token, solo lo muestra. Quien lo
 * valida es el backend en cada peticion. Aqui un token manipulado no da acceso
 * a nada, solo mostraria un email equivocado en el propio popup del usuario.
 */
const parsearPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (payload === undefined) return null;
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof json !== 'object' || json === null) return null;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
};

const emailDelToken = (token: string): string => {
  const payload = parsearPayload(token);
  if (payload === null) return '';
  const valor = payload[CLAIM_EMAIL];
  return typeof valor === 'string' ? valor : '';
};

/** Verifica si el token JWT está expirado según el claim `exp`. */
const tokenExpirado = (token: string): boolean => {
  const payload = parsearPayload(token);
  if (payload === null) return true;
  const exp = payload['exp'];
  if (typeof exp !== 'number') return false;
  const ahora = Math.floor(Date.now() / 1000);
  return exp < ahora;
};

/** Token vigente en la cookie del cliente web, si la hay. */
const tokenEnCookie = async (): Promise<string | null> => {
  try {
    const cookie = await browser.cookies.get({ url: APP_WEB, name: COOKIE });
    return cookie === null || cookie.value === '' ? null : cookie.value;
  } catch {
    // Sin permiso concedido todavia (en Safari se concede por sitio).
    return null;
  }
};

const tokenEnAlmacen = async (): Promise<string | null> => {
  try {
    const guardado = await browser.storage.local.get(CLAVE);
    const s: unknown = guardado[CLAVE];
    if (typeof s !== 'object' || s === null) return null;
    if (!('token' in s) || typeof s.token !== 'string' || s.token === '') return null;
    return s.token;
  } catch {
    return null;
  }
};

/**
 * La cookie manda; la copia local es el respaldo.
 *
 * El cliente web escribe una cookie de SESION (js-cookie sin `expires`), asi que
 * desaparece al cerrar el navegador aunque el JWT siga vigente. Sin la copia, el
 * comprador tendria que volver a entrar cada vez que abre Chrome.
 */
export const obtenerSesion = async (): Promise<Sesion | null> => {
  const token = (await tokenEnCookie()) ?? (await tokenEnAlmacen());
  if (token === null) return null;

  if (tokenExpirado(token)) {
    await cerrarSesion();
    return null;
  }

  return { token, email: emailDelToken(token) };
};

export const obtenerToken = async (): Promise<string | null> => (await obtenerSesion())?.token ?? null;

/** Mantiene la copia local a la par de la cookie. La invoca el background. */
export const sincronizarConCookie = async (): Promise<void> => {
  const token = await tokenEnCookie();
  if (token === null) await browser.storage.local.remove(CLAVE);
  else await browser.storage.local.set({ [CLAVE]: { token } });
};

/**
 * Abre el inicio de sesion del cliente web.
 *
 * La extension NUNCA pide la contrasena: la pide el sitio de ScamShield, en su
 * propio dominio y con su candado en la barra de direcciones. Es el mismo
 * comportamiento que la extension le predica al comprador cuando le advierte que
 * jamas le pedira credenciales dentro de la pagina de un marketplace. De paso,
 * hereda sin duplicar nada el inicio con Google, el registro y la recuperacion
 * de contrasena que el cliente web ya implementa.
 */
export const abrirLogin = async (): Promise<void> => {
  await browser.tabs.create({ url: URL_LOGIN });
};

/** Cierra la sesion en los dos lados: la web y la extension son una sola sesion. */
export const cerrarSesion = async (): Promise<void> => {
  try {
    await browser.cookies.remove({ url: APP_WEB, name: COOKIE });
  } catch {
    /* sin permiso concedido; la copia local igual se borra */
  }
  await browser.storage.local.remove(CLAVE);
};

export interface Perfil {
  readonly id: number;
  readonly username: string;
  readonly fullName: string;
  readonly email: string;
}

/**
 * Perfil del comprador: GET /api/v1/Profile/{email}, el mismo que consume la
 * pantalla "Mi perfil" del cliente web. Devuelve null ante cualquier fallo; el
 * popup cae entonces al correo del token, que siempre esta disponible.
 */
export const obtenerPerfil = async (email: string, token: string): Promise<Perfil | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/Profile/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const cuerpo: unknown = await res.json();
    const sobre = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
    const item = sobre['item'];
    if (!res.ok || typeof item !== 'object' || item === null) return null;

    const p = item as Record<string, unknown>;
    return {
      id: typeof p['id'] === 'number' ? p['id'] : 0,
      username: typeof p['username'] === 'string' ? p['username'] : '',
      fullName: typeof p['fullName'] === 'string' ? p['fullName'] : '',
      email: typeof p['email'] === 'string' ? p['email'] : email,
    };
  } catch {
    return null;
  }
};
