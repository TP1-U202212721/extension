import { API_BASE_URL } from '../api.js';
import { leerRespuesta, type Sobre } from '../transport/sobre.js';
import { normalizarConsulta } from '../domain/encuesta/huella.js';
import type { Instrumento, ItemDelInstrumento } from '../domain/encuesta/instrumento.js';

/**
 * Los dos endpoints de la encuesta. Ni uno mas.
 *
 * Los dos son ANONIMOS: `GET /Feedback/Instrument` y `POST /Feedback/Responses`
 * llevan `[AllowAnonymous]`. Quien responde es un comprador con la extension
 * instalada, no un usuario con cuenta, y exigirle registro para opinar sesgaria
 * la muestra hasta dejarla inservible. Por eso aqui no hay `TokenProvider`.
 *
 * Corren en el background y no en el content script, como el resto de la red de
 * esta extension: asi la peticion no depende del CSP de la pagina del
 * marketplace y la pagina del vendedor nunca ve una peticion nuestra.
 */

const TIMEOUT_MS = 8000;

const item = (s: Sobre): ItemDelInstrumento => ({
  code: s.txt('code'),
  prompt: s.txt('prompt'),
  dimension: s.numOr('dimension', 0),
  dimensionLabel: s.txt('dimensionLabel'),
  scale: s.numOr('scale', 0),
  scaleLabel: s.txt('scaleLabel'),
  minValue: s.numOr('minValue', 1),
  maxValue: s.numOr('maxValue', 5),
  position: s.numOr('position', 0),
  optional: s.bool('optional'),
  reverseScored: s.bool('reverseScored'),
});

/**
 * Trae el instrumento vigente. Devuelve null ante cualquier fallo: sin
 * instrumento no se dibuja nada, que es lo correcto —cablear las preguntas de
 * repuesto seria justo lo que este endpoint existe para evitar.
 */
export const obtenerInstrumento = async (): Promise<Instrumento | null> => {
  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/Feedback/Instrument`, { signal: abortar.signal });
    const { ok, item: cuerpo } = leerRespuesta(await res.json(), res.ok);
    if (!ok) return null;

    const items = cuerpo.lista('items').map(item).filter((i) => i.code !== '');

    return {
      moduleEnabled: cuerpo.bool('moduleEnabled'),
      code: cuerpo.txt('code'),
      version: cuerpo.numOr('version', 0),
      title: cuerpo.txt('title'),
      consentVersion: cuerpo.txt('consentVersion'),
      consentText: cuerpo.txt('consentText'),
      allowsComment: cuerpo.bool('allowsComment'),
      maxCommentLength: cuerpo.numOr('maxCommentLength', 1000),
      items,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
};

/**
 * Lo que la extension manda al responder.
 *
 * `consentGiven` no tiene valor por defecto a proposito: quien construya esta
 * peticion tiene que decir explicitamente que la persona acepto, y el backend
 * rechaza con 400 cualquier cosa que no sea `true`.
 */
export interface RespuestaDeEncuesta {
  readonly respondentId: string;
  readonly rating: number;
  readonly comment: string;
  readonly consentGiven: boolean;
  readonly consentVersion: string;
  readonly instrumentCode: string;
  readonly scope: number;
  readonly platform: number;
  /** URL de la ficha. NO viaja: se manda su huella. Ver huella.ts. */
  readonly consulta: string;
  readonly verdictKind: number;
  readonly verdictValue: number | null;
  readonly verdictConfidence: number | null;
}

/** Como termino el envio, desde el punto de vista de la UI. */
export type ResultadoDeEnvio =
  /** Registrada. Agradecer y no volver a preguntar. */
  | { readonly tipo: 'registrada' }
  /** `409`, `429` o `503`: no son fallos, son respuestas normales del flujo. */
  | { readonly tipo: 'cerrada' }
  /** Red caida o `400`. Se puede reintentar; no se cierra la encuesta. */
  | { readonly tipo: 'fallo' };

/** `sha256` en hexadecimal de la consulta normalizada. */
export const huellaDeConsulta = async (href: string): Promise<string> => {
  const normalizada = normalizarConsulta(href);
  if (normalizada === '') return '';
  const datos = new TextEncoder().encode(normalizada);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const enviarRespuesta = async (r: RespuestaDeEncuesta): Promise<ResultadoDeEnvio> => {
  // Barrera de ultima hora. El consentimiento se comprueba en la UI, se
  // comprueba aqui y se comprueba en el servidor: sin las tres, un cambio en la
  // pantalla podria empezar a registrar respuestas sin que nadie haya aceptado.
  if (!r.consentGiven) return { tipo: 'fallo' };

  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const cuerpo: Record<string, unknown> = {
      respondentId: r.respondentId,
      rating: r.rating,
      consentGiven: true,
      consentVersion: r.consentVersion,
      instrumentCode: r.instrumentCode,
      scope: r.scope,
      platform: r.platform,
      verdictKind: r.verdictKind,
    };

    // Omitir no es mandar vacio, igual que en los insumos de los analizadores.
    const comentario = r.comment.trim();
    if (comentario !== '') cuerpo['comment'] = comentario;

    const huella = await huellaDeConsulta(r.consulta);
    if (huella !== '') cuerpo['inquiryReference'] = huella;

    // Sin veredicto no se manda ningun valor: el validador rechaza un valor
    // ordinal sin decir de que veredicto es, y con razon.
    if (r.verdictValue !== null) cuerpo['verdictValue'] = r.verdictValue;
    if (r.verdictConfidence !== null) cuerpo['verdictConfidence'] = r.verdictConfidence;

    const res = await fetch(`${API_BASE_URL}/Feedback/Responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: abortar.signal,
    });

    if (res.ok) return { tipo: 'registrada' };
    // 409 ya respondio, 429 demasiado seguido, 503 modulo apagado. En los tres
    // la encuesta se cierra sin insistir.
    if (res.status === 409 || res.status === 429 || res.status === 503) {
      return { tipo: 'cerrada' };
    }
    return { tipo: 'fallo' };
  } catch {
    return { tipo: 'fallo' };
  } finally {
    clearTimeout(reloj);
  }
};
