import { API_BASE_URL } from '../api.js';
import { leerRespuesta } from '../transport/sobre.js';
import { serializarLote, type Lote } from '../domain/analitica/eventos.js';

/**
 * `POST /api/v1/UsageAnalytics/Events`.
 *
 * Manda lotes, nunca eventos sueltos. Una peticion por clic no es un contrato,
 * es una fuga de bateria.
 *
 * Este cliente NO decide nada sobre la cola: solo traduce la respuesta a lo que
 * la cola tiene que hacer con el lote que acaba de mandar. La diferencia entre
 * "borralo" y "vuelve a intentarlo" es la que impide los dos fallos clasicos de
 * una cola de telemetria: perder eventos buenos, o reintentar para siempre un
 * lote que el servidor nunca va a aceptar.
 */

export type ResultadoIngesta =
  /** El servidor lo proceso. Los eventos salen de la cola, aceptados o no. */
  | {
      readonly tipo: 'procesado';
      readonly aceptados: number;
      readonly duplicados: number;
      readonly rechazados: number;
      /** Distinto de cero es un DEFECTO DE LA EXTENSION, no una tolerancia. */
      readonly recortados: number;
      readonly motivos: readonly string[];
    }
  /** La analitica esta apagada en el servidor. No es un error: dejar de mandar. */
  | { readonly tipo: 'apagado' }
  /** El lote esta mal formado. Reintentarlo daria lo mismo: se descarta. */
  | { readonly tipo: 'descartar' }
  /** Red caida, 5xx o sin credencial. El mismo lote se reintenta mas tarde. */
  | { readonly tipo: 'reintentar' };

/**
 * Tiempo maximo de una ingesta. Corto a proposito: la analitica es lo ultimo en
 * la cola de prioridades y no puede quedarse sujetando un service worker que el
 * navegador quiere apagar. Lo que no salga ahora sale en el siguiente intento.
 */
const TIMEOUT_MS = 8000;

export const enviarLote = async (lote: Lote, token: string): Promise<ResultadoIngesta> => {
  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/UsageAnalytics/Events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(serializarLote(lote)),
      signal: abortar.signal,
    });

    // Un 400 es culpa del lote y no del momento: reintentarlo es un bucle.
    if (res.status === 400) return { tipo: 'descartar' };
    // 401/403 es sesion caducada y 5xx es el servidor: los dos pasan.
    if (!res.ok) return { tipo: 'reintentar' };

    const { ok, item } = leerRespuesta(await res.json(), res.ok);
    if (!ok) return { tipo: 'reintentar' };

    if (!item.bool('moduleEnabled')) return { tipo: 'apagado' };

    return {
      tipo: 'procesado',
      aceptados: item.numOr('accepted', 0),
      duplicados: item.numOr('duplicates', 0),
      rechazados: item.numOr('rejected', 0),
      recortados: item.numOr('sanitized', 0),
      motivos: item.cadenas('rejectionReasons'),
    };
  } catch {
    return { tipo: 'reintentar' };
  } finally {
    clearTimeout(reloj);
  }
};
