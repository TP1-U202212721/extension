import { API_BASE_URL } from '../api.js';
import { conocido, indeterminado, type FeatureValue, type Reputacion } from '../domain/features.js';
import type { TokenProvider } from '../auth/TokenProvider.js';

/**
 * Lo que la ficha publica sobre el vendedor.
 *
 * TODOS los campos son opcionales, y esa es la parte importante del contrato:
 * omitir un campo significa "la ficha no lo mostraba" y produce una senal no
 * verificable; mandarlo en 0 significa "la ficha lo mostraba y vale cero" y
 * produce una senal desfavorable. Mandar 0 por defecto en vez de omitir cambia
 * el veredicto, asi que aqui nunca se rellena nada.
 */
export interface DatosDelVendedor {
  readonly sellerName: string;
  readonly platform: string;
  readonly memberSince?: string;
  readonly memberSinceYear?: number;
  readonly completedSales?: number;
  /** 1 sin distintivo, 2 basico, 3 intermedio, 4 maximo. */
  readonly badgeTier?: number;
  readonly isRecognizedSeller?: boolean;
  readonly badgeLabel?: string;
  readonly ratingAverage?: number;
  readonly ratingCount?: number;
  readonly negativeRatingShare?: number;
  readonly claimShare?: number;
  readonly cancellationShare?: number;
  readonly onTimeDeliveryShare?: number;
}

export interface SenalVendedor {
  readonly code: string;
  readonly familyLabel: string;
  readonly statusLabel: string;
  readonly explanation: string;
}

export interface DetalleVendedor {
  readonly sellerName: string;
  readonly reputation: Reputacion;
  readonly reputationLabel: string;
  readonly score: number;
  readonly confidence: number;
  readonly confidenceLabel: string;
  readonly coverage: number;
  readonly summary: string;
  readonly riskSignals: readonly SenalVendedor[];
  readonly trustSignals: readonly SenalVendedor[];
  readonly unverifiedSignals: readonly SenalVendedor[];
  readonly limitations: readonly string[];
}

export interface ResultadoVendedor {
  readonly feature: FeatureValue<Reputacion>;
  readonly detalle: DetalleVendedor | null;
}

const TIMEOUT_MS = 9000;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const num = (o: Record<string, unknown>, k: string, d: number): number =>
  typeof o[k] === 'number' ? o[k] : d;
const txt = (o: Record<string, unknown>, k: string): string =>
  typeof o[k] === 'string' ? o[k] : '';
const senales = (v: unknown): readonly SenalVendedor[] =>
  Array.isArray(v)
    ? v.filter(esObjeto).map((s) => ({
        code: txt(s, 'code'),
        familyLabel: txt(s, 'familyLabel'),
        statusLabel: txt(s, 'statusLabel'),
        explanation: txt(s, 'explanation'),
      }))
    : [];

const esNivel = (n: number): n is Reputacion => Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * Misma regla que en el analizador de dominio: el nivel 3 significa "sin
 * verificar" y con confianza baja es que no hubo con que evaluar, no una
 * observacion. Colapsar los dos casos inventaria evidencia o la tiraria.
 */
export const aFeature = (d: DetalleVendedor): FeatureValue<Reputacion> => {
  if (d.reputation === 3 && d.confidence <= 2) {
    return indeterminado(
      `La ficha no publica evidencia suficiente sobre ${d.sellerName === '' ? 'el vendedor' : d.sellerName} (confianza ${d.confidenceLabel.toLowerCase()}).`,
    );
  }
  return conocido(d.reputation, d.summary);
};

/**
 * `POST /api/v1/SellerReputation/Estimate`.
 *
 * PENDIENTE DE BACKEND: vive en el PR 10, sin mergear. Este cliente esta
 * completo y tipado contra el contrato real, pero DESACTIVADO en src/config.ts.
 * Ver docs/adr/0005.
 */
export const consultarReputacion = async (
  datos: DatosDelVendedor,
  tokens: TokenProvider,
): Promise<ResultadoVendedor> => {
  const token = await tokens.obtener();
  if (token === null) {
    return { feature: indeterminado('No hay credencial para consultar la reputacion.'), detalle: null };
  }

  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/SellerReputation/Estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(datos),
      signal: abortar.signal,
    });
    const cuerpo: unknown = await res.json();
    const sobre = esObjeto(cuerpo) ? cuerpo : {};
    const item = sobre['item'];

    if (!res.ok || sobre['isSuccess'] !== true || !esObjeto(item)) {
      const mensaje = txt(sobre, 'message');
      return {
        feature: indeterminado(mensaje === '' ? 'El analizador de reputacion no respondio.' : mensaje),
        detalle: null,
      };
    }

    const reputation = num(item, 'reputation', 0);
    if (!esNivel(reputation)) {
      return { feature: indeterminado('El analizador devolvio un nivel no reconocido.'), detalle: null };
    }

    const detalle: DetalleVendedor = {
      sellerName: txt(item, 'sellerName'),
      reputation,
      reputationLabel: txt(item, 'reputationLabel'),
      score: num(item, 'score', 0),
      confidence: num(item, 'confidence', 0),
      confidenceLabel: txt(item, 'confidenceLabel'),
      coverage: num(item, 'coverage', 0),
      summary: txt(item, 'summary'),
      riskSignals: senales(item['riskSignals']),
      trustSignals: senales(item['trustSignals']),
      unverifiedSignals: senales(item['unverifiedSignals']),
      limitations: Array.isArray(item['limitations'])
        ? item['limitations'].filter((l): l is string => typeof l === 'string')
        : [],
    };
    return { feature: aFeature(detalle), detalle };
  } catch {
    // Timeout o red caida. Nunca favorable.
    return {
      feature: indeterminado('No se pudo consultar la reputacion del vendedor a tiempo.'),
      detalle: null,
    };
  } finally {
    clearTimeout(reloj);
  }
};
