/**
 * Traduce el veredicto que la extension acaba de emitir al bloque `analysis`
 * del contrato de ingesta.
 *
 * Es una funcion PURA: no toca red, DOM ni almacenamiento, y por eso se puede
 * fijar entera con tests de tabla. Vive en `src/analytics` y no en `src/domain`
 * porque lee las formas del transporte (`Detalles`, `Traza`), y el dominio no
 * conoce al transporte.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No vuelve a decidir nada. Todo lo que emite ya estaba calculado cuando se
 * mostro el veredicto: el nivel, el puntaje, las caracteristicas con su estado,
 * los detalles de cada analizador y la traza con las latencias. Recalcular aqui
 * abriria la puerta a que la analitica y la pantalla contaran cosas distintas.
 *
 * No emite la COBERTURA: el servidor la deriva de `features`, porque es la cifra
 * de la Fase 1 y tiene que salir siempre de la misma cuenta.
 *
 * No emite NADA de la ficha: ni titulo, ni vendedor, ni resenas, ni ruta. De las
 * caracteristicas viaja el nombre del campo y su estado, jamas el valor leido.
 */

import {
  FEATURE_IDS,
  resueltas,
  type CausaIndeterminada,
  type FeatureId,
  type FeatureSet,
  type FeatureValue,
} from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import {
  ABSTENCION,
  ANALIZADOR,
  DESENLACE_ANALIZADOR,
  DESENLACE_CARACTERISTICA,
  MOTIVO_INDETERMINADA,
  VEREDICTO,
  type BloqueAnalisis,
  type DesenlaceAnalizador,
  type EstadoCaracteristica,
  type LatenciaAnalizador,
  type MotivoAbstencion,
  type MotivoIndeterminada,
  type NivelOrdinal,
  type VeredictoAnalitica,
  type VeredictoAnalizador,
} from '../domain/analitica/eventos.js';
import { familiasDeSenales } from '../domain/analitica/familias.js';
import { topesAplicados } from '../domain/analitica/topes.js';
import type {
  DesenlaceLlamada,
  Detalles,
  PasoDeTraza,
  Traza,
} from '../transport/RiskEngineClient.js';

/**
 * Nombre del campo de cada caracteristica en la analitica.
 *
 * Se reutiliza el nombre que ya usa el analizador de documento
 * (`medios_pago_reconocidos`, `puntuacion_producto`...) donde la caracteristica
 * es la misma, para que la cobertura por caracteristica del reporte se pueda
 * cruzar con la que devuelve el propio analizador.
 *
 * Las tres que resuelven analizadores propios llevan nombre propio. En especial
 * `reputacion_vendedor` NO se emite como `vendedor_reconocido`: aquel era el
 * binario del documento, y esta es la escala ordinal de cinco niveles de
 * `/SellerReputation/Estimate`, donde el 3 significa "sin verificar". Usar el
 * nombre viejo mezclaria en la misma fila dos mediciones distintas.
 *
 * Todos van en ASCII: el backend guarda el nombre tal cual y una ñ en una clave
 * de agrupacion se acaba pagando al exportar.
 */
export const CODIGO_DE_CARACTERISTICA: Readonly<Record<FeatureId, string>> = {
  proteccionDePago: 'medios_pago_reconocidos',
  puntuacionDelProducto: 'puntuacion_producto',
  presenciaDeResenas: 'tiene_resenas',
  politicasDeGarantia: 'politicas_garantia',
  volumenDeVentas: 'productos_vendidos',
  veracidadDeDominio: 'veracidad_dominio',
  reputacionDelVendedor: 'reputacion_vendedor',
  autenticidadDeResenas: 'porcentaje_resenas_falsas',
};

/** `CausaIndeterminada` → `EUndeterminedReason`. Lo que no se sepa cae en 99. */
const MOTIVO_DE_CAUSA: Readonly<Record<CausaIndeterminada, MotivoIndeterminada>> = {
  'sin-selector': MOTIVO_INDETERMINADA.ningunSelector,
  'seccion-ausente': MOTIVO_INDETERMINADA.seccionAusente,
  'sin-extractor': MOTIVO_INDETERMINADA.sinExtractor,
  'valor-ilegible': MOTIVO_INDETERMINADA.valorIlegible,
  'tiempo-agotado': MOTIVO_INDETERMINADA.tiempoAgotado,
  'fuente-con-error': MOTIVO_INDETERMINADA.fuenteConError,
  'requiere-sesion': MOTIVO_INDETERMINADA.requiereSesion,
};

const DESENLACE_DE_LLAMADA: Readonly<Record<DesenlaceLlamada, DesenlaceAnalizador>> = {
  correcto: DESENLACE_ANALIZADOR.correcto,
  error: DESENLACE_ANALIZADOR.error,
  'tiempo-agotado': DESENLACE_ANALIZADOR.tiempoAgotado,
  omitido: DESENLACE_ANALIZADOR.omitido,
};

const estadoDe = (id: FeatureId, v: FeatureValue<unknown>): EstadoCaracteristica => {
  const code = CODIGO_DE_CARACTERISTICA[id];
  if (v.kind === 'conocido') return { code, outcome: DESENLACE_CARACTERISTICA.resuelta };
  if (v.kind === 'no-aplica') {
    // Una ausencia confirmada es un hecho, no un hueco: cuenta como resuelta en
    // la cobertura del servidor, y por eso tiene desenlace propio.
    return { code, outcome: DESENLACE_CARACTERISTICA.ausenciaConfirmada };
  }
  return {
    code,
    outcome: DESENLACE_CARACTERISTICA.indeterminada,
    reason: v.causa === undefined ? MOTIVO_INDETERMINADA.sinClasificar : MOTIVO_DE_CAUSA[v.causa],
  };
};

/**
 * Confianza 1 a 4 a partir de la proporcion de caracteristicas resueltas.
 *
 * Son los mismos cortes que usa el backend en `ConfidenceFrom(coverage)` de sus
 * dos scorers. No es casualidad ni copia perezosa: que la confianza global y la
 * de cada analizador se lean en la misma escala es lo que permite compararlas
 * en el capitulo de resultados.
 */
export const confianzaOrdinal = (proporcion: number): number => {
  if (proporcion >= 0.8) return 4;
  if (proporcion >= 0.6) return 3;
  if (proporcion >= 0.35) return 2;
  return 1;
};

const VEREDICTO_DE_NIVEL = {
  alto: VEREDICTO.riesgoAlto,
  moderado: VEREDICTO.riesgoModerado,
  bajo: VEREDICTO.riesgoBajo,
} as const;

export const veredictoAnalitico = (v: Verdict): VeredictoAnalitica =>
  v.kind === 'riesgo' ? VEREDICTO_DE_NIVEL[v.nivel] : VEREDICTO.evidenciaInsuficiente;

/**
 * Por que se abstuvo.
 *
 * Si algun analizador fallo o agoto su tiempo, esa es la causa proxima y se
 * reporta como tal: decir "cobertura insuficiente" cuando lo que hubo fue un
 * backend caido apuntaria el dato al sitio equivocado. Sin fallos, lo que falto
 * fue evidencia, que es lo que la politica de abstencion mide.
 */
const motivoDeAbstencion = (traza: Traza): MotivoAbstencion => {
  const pasos: readonly PasoDeTraza[] = [traza.documento, traza.dominio, traza.vendedor, traza.resenas];
  const fallo = pasos.some((p) => p.desenlace === 'error' || p.desenlace === 'tiempo-agotado');
  return fallo ? ABSTENCION.analizadorSinRespuesta : ABSTENCION.coberturaInsuficiente;
};

const esNivelOrdinal = (n: number): n is NivelOrdinal => Number.isInteger(n) && n >= 1 && n <= 5;

/** La confianza solo viaja si esta en su rango; un 0 en el backend es "sin dato". */
const confianzaValida = (n: number): number | undefined =>
  Number.isInteger(n) && n >= 1 && n <= 4 ? n : undefined;

const enRango = (n: number, min: number, max: number): number | undefined =>
  Number.isFinite(n) && n >= min && n <= max ? n : undefined;

/**
 * Una fila por analizador que SI devolvio un veredicto.
 *
 * Solo se emite cuando hay detalle: sin respuesta no hay nivel que reportar, y
 * rellenarlo con un 3 ("sin evidencia") inventaria una medicion que nadie hizo.
 * Por eso mismo `score` y `coverage` de estas filas siempre son cifras que el
 * analizador calculo, nunca un relleno.
 */
const veredictosDeAnalizadores = (d: Detalles): readonly VeredictoAnalizador[] => {
  const filas: VeredictoAnalizador[] = [];

  if (d.dominio !== null && esNivelOrdinal(d.dominio.veracity)) {
    filas.push({
      analyzer: ANALIZADOR.dominio,
      level: d.dominio.veracity,
      ...(confianzaValida(d.dominio.confidence) !== undefined && {
        confidence: d.dominio.confidence,
      }),
      ...(enRango(d.dominio.score, 0, 100) !== undefined && { score: d.dominio.score }),
      ...(enRango(d.dominio.coverage, 0, 1) !== undefined && { coverage: d.dominio.coverage }),
    });
  }

  if (d.vendedor !== null && esNivelOrdinal(d.vendedor.reputation)) {
    filas.push({
      analyzer: ANALIZADOR.vendedor,
      level: d.vendedor.reputation,
      ...(confianzaValida(d.vendedor.confidence) !== undefined && {
        confidence: d.vendedor.confidence,
      }),
      ...(enRango(d.vendedor.score, 0, 100) !== undefined && { score: d.vendedor.score }),
      ...(enRango(d.vendedor.coverage, 0, 1) !== undefined && { coverage: d.vendedor.coverage }),
    });
  }

  if (d.resenas !== null && esNivelOrdinal(d.resenas.authenticity)) {
    filas.push({
      analyzer: ANALIZADOR.resenas,
      level: d.resenas.authenticity,
      ...(confianzaValida(d.resenas.confidence) !== undefined && {
        confidence: d.resenas.confidence,
      }),
      ...(enRango(d.resenas.coverage, 0, 1) !== undefined && { coverage: d.resenas.coverage }),
      // null significa que NO hubo medicion. Un 0 se leeria como "ninguna resena
      // es falsa", que es lo contrario de lo que se sabe.
      ...(d.resenas.suspectRate !== null &&
        enRango(d.resenas.suspectRate, 0, 1) !== undefined && {
          suspectReviewRate: d.resenas.suspectRate,
        }),
    });
  }

  return filas;
};

/** Los topes que de verdad actuaron, de los cuatro analizadores juntos. */
const topesDe = (d: Detalles): readonly number[] =>
  topesAplicados([
    ...(d.dominio?.limitations ?? []),
    ...(d.vendedor?.limitations ?? []),
    ...(d.resenas?.limitations ?? []),
  ]);

export interface DesenlaceDeLaConsulta {
  readonly verdict: Verdict;
  readonly features: FeatureSet;
  readonly detalles: Detalles;
  readonly traza: Traza;
  /** De que el comprador pidio el analisis a que vio el veredicto. */
  readonly duracionMs: number;
}

export const bloqueDeAnalisis = (d: DesenlaceDeLaConsulta): BloqueAnalisis => {
  const proporcion = resueltas(d.features).length / FEATURE_IDS.length;

  const analyzers: readonly LatenciaAnalizador[] = [
    { analyzer: ANALIZADOR.documento, ...pasoA(d.traza.documento) },
    { analyzer: ANALIZADOR.dominio, ...pasoA(d.traza.dominio) },
    { analyzer: ANALIZADOR.vendedor, ...pasoA(d.traza.vendedor) },
    { analyzer: ANALIZADOR.resenas, ...pasoA(d.traza.resenas) },
  ];

  return {
    verdict: veredictoAnalitico(d.verdict),
    confidence: confianzaOrdinal(proporcion),
    // El puntaje solo existe cuando hubo un nivel de riesgo que puntuar. En una
    // abstencion se omite: mandar 0 diria "lo peor posible", que es una
    // afirmacion que nadie hizo.
    ...(d.verdict.kind === 'riesgo' && { score: d.verdict.puntaje }),
    ...(d.verdict.kind === 'evidencia-insuficiente' && {
      abstentionReason: motivoDeAbstencion(d.traza),
    }),
    durationMs: Math.max(0, Math.round(d.duracionMs)),
    features: FEATURE_IDS.map((id) => estadoDe(id, d.features[id])),
    analyzers,
    verdicts: veredictosDeAnalizadores(d.detalles),
    caps: topesDe(d.detalles),
    signalFamilies: [
      ...(d.detalles.dominio === null
        ? []
        : familiasDeSenales(ANALIZADOR.dominio, d.detalles.dominio)),
      ...(d.detalles.vendedor === null
        ? []
        : familiasDeSenales(ANALIZADOR.vendedor, d.detalles.vendedor)),
    ],
  };
};

const pasoA = (p: PasoDeTraza): { outcome: DesenlaceAnalizador; durationMs: number } => ({
  outcome: DESENLACE_DE_LLAMADA[p.desenlace],
  // Una llamada omitida no tiene latencia que reportar: no se intento.
  durationMs: p.desenlace === 'omitido' ? 0 : Math.max(0, Math.round(p.duracionMs)),
});
