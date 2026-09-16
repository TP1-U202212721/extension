import { FEATURE_IDS, resueltas, type FeatureSet } from '../features.js';
import type { Verdict } from '../verdict.js';
import { RIESGO_ESTIMADO, TIPO_DE_VEREDICTO } from './instrumento.js';

/**
 * El contexto que acompana a la nota.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ UNA NOTA SIN CONTEXTO NO SIRVE PARA NADA.                               │
 * │                                                                         │
 * │ Un 2 suelto no dice nada. Un 2 de alguien que estaba en Mercado Libre y │
 * │ acababa de recibir "Riesgo alto" si: eso es lo que permite cruzar la    │
 * │ satisfaccion con el resultado que vio la persona, que es exactamente lo │
 * │ que la tesis necesita medir.                                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Se manda el veredicto de RIESGO ESTIMADO y no el de un analizador suelto: es
 * el que el comprador de verdad vio en pantalla, y opinar sobre lo que uno vio
 * es lo unico que se le puede pedir.
 */
export interface ContextoDelVeredicto {
  /** `EFeedbackVerdictKind`. */
  readonly verdictKind: number;
  /** Ordinal 1 a 5 en la escala de ese tipo. null si no hubo veredicto. */
  readonly verdictValue: number | null;
  /** 1 a 4. */
  readonly verdictConfidence: number | null;
}

const ORDINAL_DE_NIVEL = {
  alto: RIESGO_ESTIMADO.alto,
  moderado: RIESGO_ESTIMADO.moderado,
  bajo: RIESGO_ESTIMADO.bajo,
} as const;

/** Mismos cortes que la confianza de la analitica y la de los scorers del backend. */
const confianza = (f: FeatureSet): number => {
  const proporcion = resueltas(f).length / FEATURE_IDS.length;
  if (proporcion >= 0.8) return 4;
  if (proporcion >= 0.6) return 3;
  if (proporcion >= 0.35) return 2;
  return 1;
};

export const contextoDelVeredicto = (v: Verdict, f: FeatureSet): ContextoDelVeredicto => {
  // Una abstencion no tiene valor en la escala de riesgo, y el validador del
  // backend rechaza con razon un valor ordinal sin decir de que veredicto es.
  if (v.kind !== 'riesgo') {
    return {
      verdictKind: TIPO_DE_VEREDICTO.ninguno,
      verdictValue: null,
      verdictConfidence: confianza(f),
    };
  }

  return {
    verdictKind: TIPO_DE_VEREDICTO.riesgoEstimado,
    verdictValue: ORDINAL_DE_NIVEL[v.nivel],
    verdictConfidence: confianza(f),
  };
};
