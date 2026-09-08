import type { NivelDeRiesgo } from '../domain/verdict.js';

/**
 * Escala visual tomada tal cual del frontend Next.js (HomeView, HistoryView,
 * RankingView) para que la extension y el cliente web hablen el mismo idioma.
 *
 * El gris de `evidencia-insuficiente` ya existia alli como rama `default` de
 * los tres `getRiskColor()`, pero ninguna ruta de codigo la alcanzaba: el
 * vocabulario visual estaba reservado y solo faltaba el desenlace que lo usara.
 */
export const COLOR_DESENLACE = {
  bajo: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  moderado: 'text-amber-600 bg-amber-50 border-amber-200',
  alto: 'text-rose-600 bg-rose-50 border-rose-200',
  'evidencia-insuficiente': 'text-slate-600 bg-slate-50 border-slate-200',
} as const satisfies Record<NivelDeRiesgo | 'evidencia-insuficiente', string>;

export const ETIQUETA_DESENLACE = {
  bajo: 'Riesgo bajo',
  moderado: 'Riesgo moderado',
  alto: 'Riesgo alto',
  'evidencia-insuficiente': 'Evidencia insuficiente',
} as const satisfies Record<NivelDeRiesgo | 'evidencia-insuficiente', string>;

/** Aviso legal, alineado con los terminos del frontend. */
export const AVISO =
  'La estimacion puede cometer errores y no constituye una garantia. Considera verificar los resultados con tu propio juicio.';
