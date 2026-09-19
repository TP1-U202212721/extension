import { API_BASE_URL } from '../api.js';
import { leerRespuesta, type Sobre } from './sobre.js';
import { conocido, indeterminado, type FeatureValue, type Reputacion } from '../domain/features.js';
import { soloLoLeido, type DatosDelVendedor } from '../domain/insumos.js';
import type { TokenProvider } from '../auth/TokenProvider.js';
import type { DesenlaceLlamada } from './RiskEngineClient.js';

/**
 * Lo que la ficha publica sobre el vendedor.
 *
 * TODOS los campos son opcionales, y esa es la parte importante del contrato:
 * omitir un campo significa "la ficha no lo mostraba" y produce una senal no
 * verificable; mandarlo en 0 significa "la ficha lo mostraba y vale cero" y
 * produce una senal desfavorable. Mandar 0 por defecto en vez de omitir cambia
 * el veredicto, asi que aqui nunca se rellena nada.
 */
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
  /** Como termino la llamada. Lo consume la analitica de uso, no la presentacion. */
  readonly desenlace: DesenlaceLlamada;
}

const TIMEOUT_MS = 9000;

const senales = (item: Sobre, clave: string): readonly SenalVendedor[] =>
  item.lista(clave).map((s) => ({
    code: s.txt('code'),
    familyLabel: s.txt('familyLabel'),
    statusLabel: s.txt('statusLabel'),
    explanation: s.txt('explanation'),
  }));

const esNivel = (n: number): n is Reputacion => Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * Misma regla que en el analizador de dominio: el nivel 3 significa "sin
 * verificar" y con confianza baja es que no hubo con que evaluar, no una
 * observacion. Colapsar los dos casos inventaria evidencia o la tiraria.
 */
export const aFeature = (d: DetalleVendedor): FeatureValue<Reputacion> => {
  if (d.reputation === 3 && d.confidence < 2) {
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
    return {
      feature: indeterminado(
        'No hay credencial para consultar la reputacion.',
        'requiere-sesion',
      ),
      detalle: null,
      desenlace: 'error',
    };
  }

  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/SellerReputation/Estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      // soloLoLeido es la garantia de la regla: una clave que no se leyo NO
      // viaja. Un campo ausente produce senal no verificable; el mismo campo en
      // 0 produce senal desfavorable. Ver src/domain/insumos.ts.
      body: JSON.stringify(soloLoLeido(datos)),
      signal: abortar.signal,
    });
    const { ok, item, mensaje } = leerRespuesta(await res.json(), res.ok);
    if (!ok) {
      return {
        feature: indeterminado(
          mensaje === '' ? 'El analizador de reputacion no respondio.' : mensaje,
          'fuente-con-error',
        ),
        detalle: null,
        desenlace: 'error',
      };
    }

    const reputation = item.numOr('reputation', 0);
    if (!esNivel(reputation)) {
      return {
        feature: indeterminado('El analizador devolvio un nivel no reconocido.', 'valor-ilegible'),
        detalle: null,
        desenlace: 'error',
      };
    }

    const detalle: DetalleVendedor = {
      sellerName: item.txt('sellerName'),
      reputation,
      reputationLabel: item.txt('reputationLabel'),
      score: item.numOr('score', 0),
      confidence: item.numOr('confidence', 0),
      confidenceLabel: item.txt('confidenceLabel'),
      coverage: item.numOr('coverage', 0),
      summary: item.txt('summary'),
      riskSignals: senales(item, 'riskSignals'),
      trustSignals: senales(item, 'trustSignals'),
      unverifiedSignals: senales(item, 'unverifiedSignals'),
      limitations: item.cadenas('limitations'),
    };
    return { feature: aFeature(detalle), detalle, desenlace: 'correcto' };
  } catch {
    // Timeout o red caida. Nunca favorable.
    return {
      feature: indeterminado(
        'No se pudo consultar la reputacion del vendedor a tiempo.',
        'tiempo-agotado',
      ),
      detalle: null,
      desenlace: abortar.signal.aborted ? 'tiempo-agotado' : 'error',
    };
  } finally {
    clearTimeout(reloj);
  }
};
