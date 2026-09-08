import { browser } from 'wxt/browser';
import { API_BASE_URL } from '../config.js';

/** Cliente web de ScamShield, para registrarse o recuperar la contrasena. */
export const APP_WEB = 'https://scamshield.ryzeon.dev';
export const URL_REGISTRO = `${APP_WEB}/register`;
export const URL_RECUPERAR = `${APP_WEB}/forgot-password`;

const CLAVE = 'scamshield.sesion';

export interface Sesion {
  readonly token: string;
  readonly email: string;
}

/** Claim de email que emite el backend .NET en su JWT. */
const CLAIM_EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';

/**
 * Lee el email del JWT sin verificar la firma.
 *
 * Es deliberado: la extension no valida el token, solo lo muestra. Quien lo
 * valida es el backend en cada peticion. Aqui un token manipulado no da acceso
 * a nada, solo mostraria un email equivocado en el propio popup del usuario.
 */
const emailDelToken = (token: string): string => {
  try {
    const payload = token.split('.')[1];
    if (payload === undefined) return '';
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof json !== 'object' || json === null) return '';
    const valor = (json as Record<string, unknown>)[CLAIM_EMAIL];
    return typeof valor === 'string' ? valor : '';
  } catch {
    return '';
  }
};

/** Persiste el JWT emitido por el backend. Lo comparten los dos caminos de login. */
export const guardarSesion = async (token: string, emailPorDefecto = ''): Promise<Sesion> => {
  const sesion: Sesion = { token, email: emailDelToken(token) || emailPorDefecto };
  await browser.storage.local.set({ [CLAVE]: { token } });
  return sesion;
};

export const obtenerSesion = async (): Promise<Sesion | null> => {
  try {
    const guardado = await browser.storage.local.get(CLAVE);
    const s: unknown = guardado[CLAVE];
    if (typeof s !== 'object' || s === null) return null;
    if (!('token' in s) || typeof s.token !== 'string' || s.token === '') return null;
    return { token: s.token, email: emailDelToken(s.token) };
  } catch {
    return null;
  }
};

export const obtenerToken = async (): Promise<string | null> => (await obtenerSesion())?.token ?? null;

export const cerrarSesion = async (): Promise<void> => {
  await browser.storage.local.remove(CLAVE);
};

export type ResultadoLogin =
  | { readonly ok: true; readonly sesion: Sesion }
  | { readonly ok: false; readonly mensaje: string };

/**
 * Inicia sesion contra el backend real: POST /api/v1/Auth/sign-in.
 *
 * La respuesta es el sobre estandar del backend, `ItemResponse<string>`, donde
 * `item` es el JWT. Un 400 con isSuccess=false es la forma en que responde a
 * credenciales invalidas, asi que no se trata como error de red.
 */
export const iniciarSesion = async (email: string, password: string): Promise<ResultadoLogin> => {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/Auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con ScamShield. Revisa tu conexion.' };
  }

  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    return { ok: false, mensaje: 'La respuesta del servidor no se pudo interpretar.' };
  }

  const sobre = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
  const token = typeof sobre['item'] === 'string' ? sobre['item'] : '';

  if (sobre['isSuccess'] !== true || token === '') {
    const mensaje = typeof sobre['message'] === 'string' ? sobre['message'] : '';
    return { ok: false, mensaje: mensaje === '' ? 'No se pudo iniciar sesion.' : mensaje };
  }

  return { ok: true, sesion: await guardarSesion(token, email) };
};

export type ResultadoRegistro =
  | { readonly ok: true }
  | { readonly ok: false; readonly mensaje: string };

/**
 * Registra una cuenta contra el backend real: POST /api/v1/Auth/sign-up.
 * Los campos son los mismos que pide el formulario del cliente web.
 */
export const registrarse = async (
  fullName: string,
  email: string,
  password: string,
): Promise<ResultadoRegistro> => {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/Auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password }),
    });
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar con ScamShield. Revisa tu conexion.' };
  }

  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    return { ok: false, mensaje: 'La respuesta del servidor no se pudo interpretar.' };
  }

  const sobre =
    typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
  if (sobre['isSuccess'] === true) return { ok: true };

  const mensaje = typeof sobre['message'] === 'string' ? sobre['message'] : '';
  return { ok: false, mensaje: mensaje === '' ? 'No se pudo crear la cuenta.' : mensaje };
};

/** Reglas de contrasena del cliente web, replicadas para dar el mismo error. */
export const validarPassword = (p: string): string => {
  if (p.length < 8) return 'La contrasena debe tener al menos 8 caracteres';
  if (!/[a-z]/.test(p)) return 'Debe contener al menos una letra minuscula';
  if (!/[A-Z]/.test(p)) return 'Debe contener al menos una letra mayuscula';
  if (!/[0-9]/.test(p)) return 'Debe contener al menos un numero';
  if (!/[@$!%*?&]/.test(p)) return 'Debe contener al menos un caracter especial (@$!%*?&)';
  return '';
};
