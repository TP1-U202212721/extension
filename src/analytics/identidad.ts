import { browser } from 'wxt/browser';

/**
 * Los identificadores que la extension emite, y de donde NO salen.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 * Ninguno se deriva del correo, del id de cuenta, del token de sesion, del id
 * de instalacion del navegador ni de nada que sobreviva a una reinstalacion.
 * Son valores aleatorios. El seudonimo ademas ROTA cada 24 horas, para que ni
 * siquiera el valor en transito sea estable entre dias.
 *
 * El servidor no confia en esa rotacion: vuelve a derivar el valor con su propia
 * sal y con la epoca dentro del mensaje, de modo que dos epocas producen hashes
 * sin relacion aunque el cliente se olvide de rotar. La rotacion de aqui es la
 * primera de las dos barreras, no la unica.
 *
 * Un seudonimo con `@` tumba el lote entero con un 400. Es una barrera burda a
 * proposito, del lado del servidor: un correo colado como seudonimo no puede
 * acabar en la base. Aqui nunca puede pasar porque esto solo genera hexadecimal.
 */

const CLAVE_SEUDONIMO = 'scamshield.analitica.seudonimo';
const CLAVE_RESPONDIENTE = 'scamshield.encuesta.respondiente';

/** 128 bits en hexadecimal. Sin guiones: el contrato admite 128 caracteres y sobra. */
const aleatorio128 = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** Dia UTC, que es la epoca de rotacion que el servidor sella. */
const hoy = (): string => new Date().toISOString().slice(0, 10);

interface SeudonimoGuardado {
  readonly valor: string;
  readonly dia: string;
}

/**
 * Seudonimo del dia. Se regenera cuando cambia el dia UTC.
 *
 * Si el almacenamiento falla se devuelve uno nuevo sin guardar: la analitica
 * jamas puede romper nada, y un seudonimo que no se persiste solo significa que
 * ese lote no se podra agrupar con el siguiente.
 */
export const seudonimoVigente = async (): Promise<string> => {
  const dia = hoy();
  try {
    const guardado = await browser.storage.local.get(CLAVE_SEUDONIMO);
    const s: unknown = guardado[CLAVE_SEUDONIMO];
    if (
      typeof s === 'object' &&
      s !== null &&
      'valor' in s &&
      'dia' in s &&
      typeof s.valor === 'string' &&
      s.valor !== '' &&
      s.dia === dia
    ) {
      return s.valor;
    }

    const fresco: SeudonimoGuardado = { valor: aleatorio128(), dia };
    await browser.storage.local.set({ [CLAVE_SEUDONIMO]: fresco });
    return fresco.valor;
  } catch {
    return aleatorio128();
  }
};

/**
 * Identificador de sesion de navegacion: uno por pestana con una ficha abierta,
 * que muere con ella. No se guarda en ningun sitio, justamente para que muera.
 */
export const nuevoIdDeSesion = (): string => aleatorio128();

/**
 * Identificador de instalacion para la encuesta. Se genera UNA vez y vive en el
 * almacenamiento local.
 *
 * Es un UUID v4 sin relacion con ninguna cuenta. El backend no lo guarda: guarda
 * `sha256(pimienta | "respondent:" | id)`. Sirve para una sola cosa, que es que
 * la misma instalacion no pueda responder dos veces lo mismo.
 *
 * Deliberadamente NO es el mismo valor que el seudonimo de la analitica: son dos
 * modulos que no se deben poder cruzar, y compartir el identificador seria
 * regalarles la unica pieza que hoy les falta para conseguirlo.
 */
export const idDeInstalacion = async (): Promise<string> => {
  try {
    const guardado = await browser.storage.local.get(CLAVE_RESPONDIENTE);
    const v: unknown = guardado[CLAVE_RESPONDIENTE];
    if (typeof v === 'string' && v !== '') return v;

    const fresco = crypto.randomUUID();
    await browser.storage.local.set({ [CLAVE_RESPONDIENTE]: fresco });
    return fresco;
  } catch {
    return crypto.randomUUID();
  }
};

/** Identificador unico de un evento dentro del cliente. Es la clave de la deduplicacion. */
export const nuevoIdDeEvento = (): string => crypto.randomUUID();

/** Version de la extension, tal como la declara el manifiesto. Maximo 32 caracteres. */
export const versionDelCliente = (): string => {
  try {
    return browser.runtime.getManifest().version.slice(0, 32);
  } catch {
    return '';
  }
};
