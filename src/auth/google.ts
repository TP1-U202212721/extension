import { browser } from 'wxt/browser';
import { API_BASE_URL } from '../config.js';
import { guardarSesion, type ResultadoLogin } from './sesion.js';

/**
 * Cliente OAuth **web** del proyecto. No es secreto: el cliente web lo publica
 * en su HTML. Tiene que ser exactamente este porque el backend valida el `aud`
 * del id_token contra `GoogleAuth:ClientId` (GoogleTokenValidator), asi que un
 * cliente propio de la extension haria fallar la verificacion.
 */
const CLIENT_ID = '354786923645-4vbcg93qqdmbrsap3sg8dkf5pdr4956l.apps.googleusercontent.com';

/**
 * URI de redireccion que hay que dar de alta en Google Cloud Console para este
 * cliente. Cambia por navegador y por instalacion, por eso se expone: el panel
 * la muestra cuando Google la rechaza, para poder copiarla y registrarla.
 */
export const uriDeRedireccion = (): string => {
  try {
    return browser.identity.getRedirectURL();
  } catch {
    return '';
  }
};

/**
 * Safari no siempre expone `identity`; sin ella el boton no se ofrece. Los tipos
 * la declaran siempre presente, de ahi la comprobacion sobre el objeto crudo:
 * lo que se mira es el navegador real, no lo que promete el .d.ts.
 */
export const googleDisponible = (): boolean => {
  try {
    const identity: unknown = (browser as unknown as Record<string, unknown>)['identity'];
    if (typeof identity !== 'object' || identity === null) return false;
    return typeof (identity as Record<string, unknown>)['launchWebAuthFlow'] === 'function';
  } catch {
    return false;
  }
};

const leerFragmento = (redirigido: string, clave: string): string | null => {
  try {
    const url = new URL(redirigido);
    // El flujo implicito responde en el fragmento; algunos errores, en la query.
    const enHash = new URLSearchParams(url.hash.replace(/^#/, '')).get(clave);
    return enHash ?? url.searchParams.get(clave);
  } catch {
    return null;
  }
};

/**
 * Inicio de sesion con Google mediante `identity.launchWebAuthFlow`.
 *
 * No se reutiliza el enfoque del cliente web (Google Identity Services) porque
 * ese boton se dibuja desde `https://accounts.google.com/gsi/client`, y la CSP
 * de MV3 prohibe cargar scripts remotos en las paginas de la extension. El
 * flujo implicito en una ventana de autorizacion consigue el mismo id_token sin
 * ejecutar codigo de terceros dentro de la extension.
 */
export const iniciarSesionConGoogle = async (): Promise<ResultadoLogin> => {
  if (!googleDisponible()) {
    return { ok: false, mensaje: 'Este navegador no admite el inicio de sesion con Google.' };
  }

  const redirectUri = uriDeRedireccion();
  const nonce = crypto.randomUUID();

  const autorizacion = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  autorizacion.searchParams.set('client_id', CLIENT_ID);
  autorizacion.searchParams.set('response_type', 'id_token');
  autorizacion.searchParams.set('redirect_uri', redirectUri);
  autorizacion.searchParams.set('scope', 'openid email profile');
  autorizacion.searchParams.set('nonce', nonce);
  autorizacion.searchParams.set('prompt', 'select_account');

  let redirigido: string | undefined;
  try {
    redirigido = await browser.identity.launchWebAuthFlow({
      url: autorizacion.href,
      interactive: true,
    });
  } catch {
    // Cancelar la ventana tambien llega por aqui; no se distingue del fallo.
    return { ok: false, mensaje: 'No se completo el inicio de sesion con Google.' };
  }
  if (redirigido === undefined) {
    return { ok: false, mensaje: 'No se completo el inicio de sesion con Google.' };
  }

  const error = leerFragmento(redirigido, 'error');
  if (error !== null) {
    return {
      ok: false,
      mensaje:
        error === 'redirect_uri_mismatch'
          ? `Google rechazo la redireccion. Registra esta URI en el cliente OAuth: ${redirectUri}`
          : `Google devolvio un error: ${error}`,
    };
  }

  const idToken = leerFragmento(redirigido, 'id_token');
  if (idToken === null || idToken === '') {
    return { ok: false, mensaje: 'Google no devolvio un token de identidad.' };
  }
  if (!nonceCoincide(idToken, nonce)) {
    return { ok: false, mensaje: 'La respuesta de Google no corresponde a esta solicitud.' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/Auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    return { ok: false, mensaje: 'No se pudo contactar con el servidor de ScamShield.' };
  }

  let cuerpo: unknown = null;
  try {
    cuerpo = await res.json();
  } catch {
    /* respuesta ilegible: se trata igual que un fallo */
  }
  const sobre = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
  const token = typeof sobre['item'] === 'string' ? sobre['item'] : '';

  if (sobre['isSuccess'] !== true || token === '') {
    const mensaje = typeof sobre['message'] === 'string' ? sobre['message'] : '';
    return { ok: false, mensaje: mensaje === '' ? 'No se pudo iniciar sesion con Google.' : mensaje };
  }

  return { ok: true, sesion: await guardarSesion(token, correoDelIdToken(idToken)) };
};

/**
 * El `nonce` ata la respuesta a esta peticion. La firma no se comprueba aqui a
 * proposito: de eso se encarga el backend contra el JWKS de Google. Esta lectura
 * solo descarta que se reinyecte un id_token capturado de otro intento.
 */
const carga = (idToken: string): Record<string, unknown> => {
  try {
    const parte = idToken.split('.')[1];
    if (parte === undefined) return {};
    const json: unknown = JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const nonceCoincide = (idToken: string, nonce: string): boolean => carga(idToken)['nonce'] === nonce;

const correoDelIdToken = (idToken: string): string => {
  const email = carga(idToken)['email'];
  return typeof email === 'string' ? email : '';
};
