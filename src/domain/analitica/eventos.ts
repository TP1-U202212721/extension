/**
 * Modelo de los eventos de analitica de uso.
 *
 * Contrato: `docs/analytics/contrato-ingesta.md` del backend,
 * `POST /api/v1/UsageAnalytics/Events`. Los enteros de aqui son los suyos; no se
 * inventa ninguno. Un valor que el servidor no conozca cae en su cajon
 * correspondiente (99 en plataforma y en tope), nunca se pierde el evento.
 *
 * Esta capa es PURA: no toca red, ni DOM, ni almacenamiento. Solo describe que
 * es un evento y como se serializa. Quien lo acumula y lo envia es
 * `src/analytics/ColaAnalitica.ts`.
 */

import type { DominioRegistrable } from './sitio.js';

/** `EUsageEventType`. */
export const TIPO = {
  sesionIniciada: 1,
  fichaDetectada: 2,
  consultaEnviada: 3,
  consultaResuelta: 4,
  consultaFallida: 5,
  interaccion: 6,
} as const;
export type TipoEvento = (typeof TIPO)[keyof typeof TIPO];

/** `EUsagePlatform`. 99 es "otra plataforma": un valor nuevo no pierde el evento. */
export const PLATAFORMA = {
  mercadoLibre: 1,
  amazon: 2,
  aliExpress: 3,
  ebay: 4,
  facebookMarketplace: 5,
  temu: 6,
  otra: 99,
} as const;
export type PlataformaAnalitica = (typeof PLATAFORMA)[keyof typeof PLATAFORMA];

/** `EUsageVerdict`. */
export const VEREDICTO = {
  riesgoAlto: 1,
  riesgoModerado: 2,
  riesgoBajo: 3,
  evidenciaInsuficiente: 4,
} as const;
export type VeredictoAnalitica = (typeof VEREDICTO)[keyof typeof VEREDICTO];

/** `EAbstentionReason`. Solo viaja con `veredicto = 4`. */
export const ABSTENCION = {
  coberturaInsuficiente: 1,
  plataformaSinSoporte: 2,
  noEsFicha: 3,
  analizadorSinRespuesta: 4,
  senalesEnConflicto: 5,
  confianzaBajoUmbral: 6,
} as const;
export type MotivoAbstencion = (typeof ABSTENCION)[keyof typeof ABSTENCION];

/** `EFeatureOutcome`. */
export const DESENLACE_CARACTERISTICA = {
  resuelta: 1,
  ausenciaConfirmada: 2,
  indeterminada: 3,
  diferida: 4,
} as const;
export type DesenlaceCaracteristica =
  (typeof DESENLACE_CARACTERISTICA)[keyof typeof DESENLACE_CARACTERISTICA];

/** `EUndeterminedReason`. Solo con `outcome = 3`. */
export const MOTIVO_INDETERMINADA = {
  ningunSelector: 1,
  seccionAusente: 2,
  sinExtractor: 3,
  valorIlegible: 4,
  tiempoAgotado: 5,
  fuenteConError: 6,
  requiereSesion: 7,
  sinClasificar: 99,
} as const;
export type MotivoIndeterminada =
  (typeof MOTIVO_INDETERMINADA)[keyof typeof MOTIVO_INDETERMINADA];

/** `EAnalyzerKind`. */
export const ANALIZADOR = {
  documento: 1,
  dominio: 2,
  vendedor: 3,
  resenas: 4,
  riesgo: 5,
} as const;
export type AnalizadorAnalitica = (typeof ANALIZADOR)[keyof typeof ANALIZADOR];

/** `EAnalyzerOutcome`. Las omitidas quedan fuera del denominador de la tasa de error. */
export const DESENLACE_ANALIZADOR = {
  correcto: 1,
  error: 2,
  tiempoAgotado: 3,
  omitido: 4,
} as const;
export type DesenlaceAnalizador =
  (typeof DESENLACE_ANALIZADOR)[keyof typeof DESENLACE_ANALIZADOR];

/** `EInteractionKind`. El 1 es el denominador de todas las tasas de interaccion. */
export const INTERACCION = {
  advertenciaMostrada: 1,
  advertenciaExpandida: 2,
  advertenciaContraida: 3,
  advertenciaCerrada: 4,
  detalleAbierto: 5,
  hizoCaso: 6,
  continuoIgual: 7,
  reportoLaFicha: 8,
} as const;
export type TipoInteraccion = (typeof INTERACCION)[keyof typeof INTERACCION];

/** Nivel ordinal 1 a 5 en la escala de un analizador. Fuera de rango, la fila se descarta. */
export type NivelOrdinal = 1 | 2 | 3 | 4 | 5;

export interface EstadoCaracteristica {
  /** Nombre del campo, jamas su valor. */
  readonly code: string;
  readonly outcome: DesenlaceCaracteristica;
  /** Solo con `outcome = 3`. Si falta, el servidor pone 99. */
  readonly reason?: MotivoIndeterminada;
}

export interface LatenciaAnalizador {
  readonly analyzer: AnalizadorAnalitica;
  readonly outcome: DesenlaceAnalizador;
  readonly durationMs: number;
}

/**
 * Lo que concluyo cada analizador. Es el bloque que permite decir cuantas veces
 * la veracidad de dominio dio "no confiable" y no solo cuantas veces se computo.
 */
export interface VeredictoAnalizador {
  readonly analyzer: AnalizadorAnalitica;
  readonly level: NivelOrdinal;
  /** 1 a 4. Se omite cuando el analizador no lo informo: un 0 es "sin dato". */
  readonly confidence?: number;
  readonly score?: number;
  readonly coverage?: number;
  /** 0 a 1. Solo en el analizador de resenas; en los demas se descarta. */
  readonly suspectReviewRate?: number;
}

export interface FamiliaDeSenales {
  readonly analyzer: AnalizadorAnalitica;
  readonly family: number;
  readonly risk: number;
  readonly trust: number;
  readonly unverified: number;
}

/**
 * El desenlace de una consulta resuelta.
 *
 * La COBERTURA NO VA: el servidor la calcula a partir de `features`, porque es
 * la cifra de la Fase 1 del protocolo y tiene que salir siempre de la misma
 * cuenta. Mandarla seria ofrecer una segunda version de un numero que ya existe.
 */
export interface BloqueAnalisis {
  readonly verdict: VeredictoAnalitica;
  /** 1 a 4. */
  readonly confidence: number;
  /** 0 a 100. Se omite cuando no hubo veredicto de riesgo que puntuar. */
  readonly score?: number;
  readonly abstentionReason?: MotivoAbstencion;
  readonly durationMs: number;
  readonly features: readonly EstadoCaracteristica[];
  readonly analyzers: readonly LatenciaAnalizador[];
  readonly verdicts: readonly VeredictoAnalizador[];
  readonly caps: readonly number[];
  readonly signalFamilies: readonly FamiliaDeSenales[];
}

export interface BloqueInteraccion {
  readonly kind: TipoInteraccion;
  /** El veredicto que estaba en pantalla. */
  readonly verdict?: VeredictoAnalitica;
  /** Desde el `kind: 1` de esa misma advertencia. En el propio `kind: 1` se omite. */
  readonly millisecondsToDecision?: number;
}

/**
 * Un evento de uso.
 *
 * `site` es del tipo marcado a proposito: no hay forma de colar una URL aqui.
 * Ver `src/domain/analitica/sitio.ts`.
 */
export interface EventoUso {
  readonly eventId: string;
  readonly type: TipoEvento;
  readonly platform: PlataformaAnalitica;
  readonly site?: DominioRegistrable;
  readonly category?: string;
  /** UTC ISO 8601. Se acepta entre 7 dias atras y 10 minutos adelante. */
  readonly occurredAt: string;
  readonly analysis?: BloqueAnalisis;
  readonly interaction?: BloqueInteraccion;
}

/** Tope de eventos por lote (`UsageAnalytics:MaxEventsPerBatch`). */
export const MAX_EVENTOS_POR_LOTE = 200;

export interface Lote {
  readonly clientVersion: string;
  readonly pseudonym: string;
  readonly sessionId: string;
  readonly events: readonly EventoUso[];
}

/**
 * Serializa omitiendo lo que no se sabe.
 *
 * Misma regla que `soloLoLeido` en `src/domain/insumos.ts`: OMITIR NO ES MANDAR
 * CERO. Se descartan `undefined`, `null`, las cadenas vacias y las listas
 * vacias; **los ceros se conservan**, porque un cero medido es una observacion
 * (una latencia de 0 ms, un puntaje de 0) y borrarlo falsearia el dato.
 */
const limpiar = (valor: unknown): unknown => {
  if (Array.isArray(valor)) {
    const lista = valor.map(limpiar).filter((v) => v !== undefined);
    return lista.length === 0 ? undefined : lista;
  }
  if (typeof valor === 'object' && valor !== null) {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      const limpio = limpiar(v);
      if (limpio !== undefined) salida[clave] = limpio;
    }
    return Object.keys(salida).length === 0 ? undefined : salida;
  }
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor === 'string' && valor === '') return undefined;
  if (typeof valor === 'number' && !Number.isFinite(valor)) return undefined;
  return valor;
};

export const serializarLote = (lote: Lote): Record<string, unknown> =>
  (limpiar(lote) as Record<string, unknown> | undefined) ?? {};
