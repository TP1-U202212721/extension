import { API_BASE_URL } from '../api.js';
import { leerRespuesta } from './sobre.js';
import {
  conocido,
  indeterminado,
  type Autenticidad,
  type FeatureValue,
} from '../domain/features.js';
import type { TokenProvider } from '../auth/TokenProvider.js';
import type { DesenlaceLlamada } from './RiskEngineClient.js';
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
  /** Como termino la llamada. Lo consume la analitica de uso, no la presentacion. */
  readonly desenlace: DesenlaceLlamada;
}

const TIMEOUT_MS = 15000;


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
    return {
      feature: indeterminado('No hay credencial para analizar las resenas.', 'requiere-sesion'),
      detalle: null,
      desenlace: 'error',
    };
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
    const { ok, item, mensaje } = leerRespuesta(await res.json(), res.ok);
    if (!ok) {
      return {
        feature: indeterminado(
          mensaje === '' ? 'El analizador de resenas no respondio.' : mensaje,
          'fuente-con-error',
        ),
        detalle: null,
        desenlace: 'error',
      };
    }

    const authenticity = item.numOr('authenticity', 0);
    if (!esNivel(authenticity)) {
      return {
        feature: indeterminado('El analizador devolvio un nivel no reconocido.', 'valor-ilegible'),
        detalle: null,
        desenlace: 'error',
      };
    }

    const detalle: DetalleResenas = {
      authenticity,
      authenticityLabel: item.txt('authenticityLabel'),
      status: item.numOr('status', 0),
      statusLabel: item.txt('statusLabel'),
      confidence: item.numOr('confidence', 0),
      confidenceLabel: item.txt('confidenceLabel'),
      // Nullable a proposito: un 0 se leeria como "ninguna resena es falsa",
      // que es lo contrario de lo que se sabe. `num` devuelve null si no hay
      // numero, asi que la distincion se conserva.
      suspectRate: item.num('suspectRate'),
      submittedCount: item.numOr('submittedCount', 0),
      evaluatedCount: item.numOr('evaluatedCount', 0),
      suspectCount: item.numOr('suspectCount', 0),
      coverage: item.numOr('coverage', 0),
      summary: item.txt('summary'),
      limitations: item.cadenas('limitations'),
    };
    return { feature: aFeature(detalle), detalle, desenlace: 'correcto' };
  } catch {
    return {
      feature: indeterminado(
        'No se pudo analizar la autenticidad de las resenas a tiempo.',
        'tiempo-agotado',
      ),
      detalle: null,
      desenlace: abortar.signal.aborted ? 'tiempo-agotado' : 'error',
    };
  } finally {
    clearTimeout(reloj);
  }
};
