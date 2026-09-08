import { API_BASE_URL } from '../api.js';
import {
  conocido,
  indeterminado,
  type Autenticidad,
  type FeatureValue,
} from '../domain/features.js';
import type { TokenProvider } from '../auth/TokenProvider.js';
import { soloLoLeido, type ResenaLeida } from '../domain/insumos.js';

/** Limites del backend (`ReviewAnalysis:MaxReviews` / `MaxReviewLength`). */
export const MAX_RESENAS = 200;
export const MAX_LARGO_RESENA = 4000;

export interface DetalleResenas {
  readonly authenticity: Autenticidad;
  readonly authenticityLabel: string;
  /** 1 evaluadas, 2 sin resenas que evaluar, 3 no verificable. */
  readonly status: number;
  readonly statusLabel: string;
  readonly confidence: number;
  readonly confidenceLabel: string;
  /** null cuando NO hubo medicion. Nunca 0. */
  readonly suspectRate: number | null;
  readonly submittedCount: number;
  readonly evaluatedCount: number;
  readonly suspectCount: number;
  readonly coverage: number;
  readonly summary: string;
  readonly limitations: readonly string[];
}

export interface ResultadoResenas {
  readonly feature: FeatureValue<Autenticidad>;
  readonly detalle: DetalleResenas | null;
}

const TIMEOUT_MS = 15000;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const num = (o: Record<string, unknown>, k: string, d: number): number =>
  typeof o[k] === 'number' ? o[k] : d;
const txt = (o: Record<string, unknown>, k: string): string =>
  typeof o[k] === 'string' ? o[k] : '';

const esNivel = (n: number): n is Autenticidad => Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * El nivel 3 no es alcanzable desde una medicion: esta reservado a "no hay
 * evidencia". Y `status` 2 y 3 significan que no hubo nada que evaluar o que el
 * clasificador no respondio. En los tres casos la caracteristica queda sin
 * resolver, jamas favorable.
 */
export const aFeature = (d: DetalleResenas): FeatureValue<Autenticidad> => {
  if (d.status !== 1 || d.suspectRate === null || d.authenticity === 3) {
    return indeterminado(
      d.summary === '' ? 'No se pudo verificar la autenticidad de las resenas.' : d.summary,
    );
  }
  return conocido(d.authenticity, d.summary);
};

/**
 * `POST /api/v1/ReviewAnalysis/Authenticity`.
 *
 * PENDIENTE DE BACKEND: vive en el PR 10, sin mergear. Cliente completo y
 * tipado contra el contrato real, pero DESACTIVADO en src/config.ts.
 * Ver docs/adr/0005.
 */
export const consultarAutenticidad = async (
  resenas: readonly ResenaLeida[],
  categoria: string,
  tokens: TokenProvider,
): Promise<ResultadoResenas> => {
  const token = await tokens.obtener();
  if (token === null) {
    return { feature: indeterminado('No hay credencial para analizar las resenas.'), detalle: null };
  }

  // Se recortan aqui para no gastar la subida en un 400 previsible.
  // El rating se OMITE cuando la ficha no lo mostraba. Mandarlo en 0 lo
  // convertiria en una resena de una estrella, que es una observacion que nadie
  // hizo. Ver src/domain/insumos.ts.
  const cuerpoResenas = resenas
    .slice(0, MAX_RESENAS)
    .map((r) => soloLoLeido({ text: r.text.slice(0, MAX_LARGO_RESENA), rating: r.rating }));

  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/ReviewAnalysis/Authenticity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category: categoria.slice(0, 200), reviews: cuerpoResenas }),
      signal: abortar.signal,
    });
    const cuerpo: unknown = await res.json();
    const sobre = esObjeto(cuerpo) ? cuerpo : {};
    const item = sobre['item'];

    if (!res.ok || sobre['isSuccess'] !== true || !esObjeto(item)) {
      const mensaje = txt(sobre, 'message');
      return {
        feature: indeterminado(mensaje === '' ? 'El analizador de resenas no respondio.' : mensaje),
        detalle: null,
      };
    }

    const authenticity = num(item, 'authenticity', 0);
    if (!esNivel(authenticity)) {
      return { feature: indeterminado('El analizador devolvio un nivel no reconocido.'), detalle: null };
    }

    const detalle: DetalleResenas = {
      authenticity,
      authenticityLabel: txt(item, 'authenticityLabel'),
      status: num(item, 'status', 0),
      statusLabel: txt(item, 'statusLabel'),
      confidence: num(item, 'confidence', 0),
      confidenceLabel: txt(item, 'confidenceLabel'),
      // Nullable a proposito: un 0 se leeria como "ninguna resena es falsa",
      // que es lo contrario de lo que se sabe.
      suspectRate: typeof item['suspectRate'] === 'number' ? item['suspectRate'] : null,
      submittedCount: num(item, 'submittedCount', 0),
      evaluatedCount: num(item, 'evaluatedCount', 0),
      suspectCount: num(item, 'suspectCount', 0),
      coverage: num(item, 'coverage', 0),
      summary: txt(item, 'summary'),
      limitations: Array.isArray(item['limitations'])
        ? item['limitations'].filter((l): l is string => typeof l === 'string')
        : [],
    };
    return { feature: aFeature(detalle), detalle };
  } catch {
    return {
      feature: indeterminado('No se pudo analizar la autenticidad de las resenas a tiempo.'),
      detalle: null,
    };
  } finally {
    clearTimeout(reloj);
  }
};
