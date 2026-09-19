import { API_BASE_URL } from '../api.js';
import { leerRespuesta } from './sobre.js';
import type { Verdict } from '../domain/verdict.js';
import type { FeatureSet } from '../domain/features.js';
import { FEATURE_META } from '../domain/features.js';
import type { TokenProvider } from '../auth/TokenProvider.js';

const TIMEOUT_MS = 10000;

interface SaveExtensionInquiryRequest {
  readonly sellerName: string;
  readonly platform: string;
  readonly url: string;
  readonly postId: string;
  readonly riskTypeId: number;
  readonly reasons: readonly string[];
  readonly score: number;
}

interface SaveExtensionInquiryResponse {
  readonly inquiryResultId: number;
  readonly sellerId: number;
  readonly sellerName: string;
  readonly riskTypeId: number;
  readonly createdAt: string;
}

const nivelARiskTypeId = (verdict: Verdict): number => {
  if (verdict.kind === 'evidencia-insuficiente') return 2;
  switch (verdict.nivel) {
    case 'alto': return 1;
    case 'moderado': return 2;
    case 'bajo': return 3;
    default: return 2;
  }
};

const extraerReasons = (verdict: Verdict, features: FeatureSet): string[] => {
  if (verdict.kind === 'evidencia-insuficiente') {
    const razones: string[] = [];
    if (verdict.motivo) razones.push(verdict.motivo);
    for (const dim of verdict.dimensionesVacias) {
      razones.push(`Dimension vacia: ${dim}`);
    }
    return razones.length > 0 ? razones : ['Evidencia insuficiente para determinar el riesgo.'];
  }

  const razones: string[] = [];
  for (const featureId of verdict.sinResolver) {
    const meta = FEATURE_META[featureId];
    const value = features[featureId];
    if (value.kind === 'indeterminado') {
      razones.push(`${meta.etiqueta}: ${value.motivo}`);
    } else if (value.kind === 'no-aplica') {
      razones.push(`${meta.etiqueta}: ${value.motivo}`);
    }
  }
  return razones.length > 0 ? razones : ['Todas las caracteristicas relevantes fueron determinadas.'];
};

const extraerPuntaje = (verdict: Verdict): number => {
  if (verdict.kind === 'evidencia-insuficiente') return 50;
  return verdict.puntaje;
};

/**
 * Guarda la consulta y los resultados del vendedor en el backend.
 *
 * Se llama de forma asincrona despues de recibir el veredicto, sin bloquear
 * la respuesta al usuario. Si falla, solo se registra en consola: el usuario
 * ya vio su veredicto y no puede hacer nada al respecto.
 */
export const guardarConsulta = async (
  sellerName: string,
  platform: string,
  url: string,
  publicacionId: string,
  verdict: Verdict,
  features: FeatureSet,
  tokens: TokenProvider,
): Promise<SaveExtensionInquiryResponse | null> => {
  const token = await tokens.obtener();
  if (token === null) {
    console.warn('[ScamShield] No hay token para guardar la consulta.');
    return null;
  }

  const riskTypeId = nivelARiskTypeId(verdict);
  const reasons = extraerReasons(verdict, features);
  const score = extraerPuntaje(verdict);

  const body: SaveExtensionInquiryRequest = {
    sellerName,
    platform,
    url,
    postId: publicacionId,
    riskTypeId,
    reasons,
    score,
  };

  const abortar = new AbortController();
  const reloj = setTimeout(() => abortar.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/InquiryResult/SaveFromExtension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: abortar.signal,
    });

    const { ok, item, mensaje } = leerRespuesta(await res.json(), res.ok);
    if (!ok) {
      console.warn('[ScamShield] Error al guardar consulta:', mensaje || 'Respuesta no exitosa.');
      return null;
    }

    return {
      inquiryResultId: item.numOr('inquiryResultId', 0),
      sellerId: item.numOr('sellerId', 0),
      sellerName: item.txt('sellerName'),
      riskTypeId: item.numOr('riskTypeId', 0),
      createdAt: item.txt('createdAt'),
    };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn('[ScamShield] Timeout al guardar la consulta.');
    } else {
      console.warn('[ScamShield] Error de red al guardar la consulta:', e);
    }
    return null;
  } finally {
    clearTimeout(reloj);
  }
};
