/**
 * Modelo de caracteristicas de ScamShield.
 *
 * Regla central: una caracteristica NUNCA es `null` ni un booleano. Es un tipo
 * suma de tres estados, porque la ausencia de informacion no puede colapsar en
 * el mismo valor que una observacion negativa. El backend de TP1 hace justo eso
 * (todos sus campos son `int`/`double` no nullables, y un selector que falla
 * produce `0`, indistinguible de "confirmado malo"); este modelo existe para
 * impedirlo por construccion.
 */

/** Las tres dimensiones sobre las que se reparten las ocho caracteristicas. */
export const DIMENSIONS = {
  identidadDelSitio: 'identidad-del-sitio',
  fiabilidadDelVendedor: 'fiabilidad-del-vendedor',
  evidenciaDeLaComunidad: 'evidencia-de-la-comunidad',
} as const;

export type Dimension = (typeof DIMENSIONS)[keyof typeof DIMENSIONS];

/** Quien resuelve la caracteristica. */
export type Origen = 'cliente' | 'backend';

export const FEATURE_IDS = [
  'proteccionDePago',
  'veracidadDeDominio',
  'reputacionDelVendedor',
  'autenticidadDeResenas',
  'puntuacionDelProducto',
  'presenciaDeResenas',
  'politicasDeGarantia',
  'volumenDeVentas',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

/**
 * Los tres estados posibles de una caracteristica.
 *
 * - `conocido`: se observo un valor. Es el UNICO estado que cuenta como resuelto.
 * - `no-aplica`: la caracteristica no tiene sentido en este contexto.
 * - `indeterminado`: falta evidencia para decidir. Jamas se presenta como seguridad.
 */
export type FeatureValue<T> =
  | { readonly kind: 'conocido'; readonly valor: T; readonly evidencia: string }
  | { readonly kind: 'no-aplica'; readonly motivo: string }
  | {
      readonly kind: 'indeterminado';
      readonly motivo: string;
      readonly causa?: CausaIndeterminada;
    };

/**
 * Por que quedo sin resolver, en forma legible por una maquina.
 *
 * `motivo` es una frase para el comprador y cambia con la redaccion; la causa es
 * un simbolo estable. Existe porque la analitica de uso tiene que reportar el
 * motivo de cada caracteristica indeterminada como un codigo
 * (`EUndeterminedReason`), y deducirlo del texto del motivo seria adivinar.
 *
 * Es OPCIONAL a proposito: donde no se sepa, se omite y el evento viaja con
 * "motivo no clasificado". Inventar una causa es peor que no tenerla.
 */
export type CausaIndeterminada =
  | 'sin-selector'
  | 'seccion-ausente'
  | 'sin-extractor'
  | 'valor-ilegible'
  | 'tiempo-agotado'
  | 'fuente-con-error'
  | 'requiere-sesion';

export const conocido = <T>(valor: T, evidencia: string): FeatureValue<T> => ({
  kind: 'conocido',
  valor,
  evidencia,
});

export const noAplica = <T>(motivo: string): FeatureValue<T> => ({ kind: 'no-aplica', motivo });

export const indeterminado = <T>(motivo: string, causa?: CausaIndeterminada): FeatureValue<T> => ({
  kind: 'indeterminado',
  motivo,
  ...(causa !== undefined && { causa }),
});

/**
 * Estrecha el tipo. Se usa donde se conoce el tipo concreto del valor y se va a
 * leer `.valor` a continuacion.
 */
export const estaResuelta = <T>(
  v: FeatureValue<T>,
): v is { kind: 'conocido'; valor: T; evidencia: string } => v.kind === 'conocido';

/**
 * Version sin estrechamiento, para recorrer un FeatureSet por id: ahi el valor
 * es una union de tipos distintos y el generico no puede unificarlos.
 */
export const esConocida = (v: FeatureValue<unknown>): boolean => v.kind === 'conocido';

/** Tipos de valor de cada caracteristica. */
export type ProteccionDePago = 'declarada' | 'no-declarada';
/** Escala ordinal 0-3, de menor a mayor confianza. */
export type Ordinal = 0 | 1 | 2 | 3;

/**
 * Escala del analizador de dominio del backend (`GET/POST /DomainAnalysis/Veracity`).
 * No se normaliza a `Ordinal` a proposito: 3 no es "la mitad", es un nivel con
 * significado propio ("sin evidencia suficiente") y perderlo al reescalar
 * borraria justamente la distincion que este modelo existe para preservar.
 */
export type Veracidad = 1 | 2 | 3 | 4 | 5;

/**
 * Escala del analizador de reputacion del backend
 * (`POST /SellerReputation/Estimate`). Sustituye al antiguo binario
 * `vendedor_reconocido`, que colapsaba en un mismo 0 al vendedor verificado sin
 * distintivo y al vendedor del que no se pudo verificar nada.
 *
 * 1 mala, 2 debil, 3 SIN VERIFICAR, 4 solida, 5 trayectoria establecida.
 */
export type Reputacion = 1 | 2 | 3 | 4 | 5;

/**
 * Escala del analizador de autenticidad de resenas
 * (`POST /ReviewAnalysis/Authenticity`). No es una proporcion: la proporcion es
 * el insumo, y el nivel 3 no es alcanzable desde una medicion, esta reservado
 * para "no hay evidencia".
 *
 * 1 no autenticas, 2 muchas senales, 3 SIN EVIDENCIA, 4 probablemente
 * autenticas, 5 autenticas.
 */
export type Autenticidad = 1 | 2 | 3 | 4 | 5;

export interface FeatureSet {
  readonly proteccionDePago: FeatureValue<ProteccionDePago>;
  readonly veracidadDeDominio: FeatureValue<Veracidad>;
  readonly reputacionDelVendedor: FeatureValue<Reputacion>;
  readonly autenticidadDeResenas: FeatureValue<Autenticidad>;
  /** Puntuacion continua 0.0 - 5.0. */
  readonly puntuacionDelProducto: FeatureValue<number>;
  readonly presenciaDeResenas: FeatureValue<boolean>;
  readonly politicasDeGarantia: FeatureValue<Ordinal>;
  /** Entero >= 0. */
  readonly volumenDeVentas: FeatureValue<number>;
}

interface FeatureMeta {
  readonly id: FeatureId;
  readonly dimension: Dimension;
  readonly origen: Origen;
  /** Etiqueta en espanol de Peru, para la UI. */
  readonly etiqueta: string;
  /** Que acredita la caracteristica cuando se resuelve. */
  readonly acredita: string;
}

/**
 * Reparto de las ocho caracteristicas en las tres dimensiones.
 *
 * Notese el desbalance deliberado, que es el hallazgo que documenta
 * docs/adr/0002: `identidad-del-sitio` tiene UNA sola caracteristica, y es de
 * backend.
 */
export const FEATURE_META: Readonly<Record<FeatureId, FeatureMeta>> = {
  veracidadDeDominio: {
    id: 'veracidadDeDominio',
    dimension: DIMENSIONS.identidadDelSitio,
    origen: 'backend',
    etiqueta: 'Veracidad del dominio',
    acredita: 'Que el dominio de la publicacion corresponde a la plataforma que dice ser.',
  },
  reputacionDelVendedor: {
    id: 'reputacionDelVendedor',
    dimension: DIMENSIONS.fiabilidadDelVendedor,
    origen: 'backend',
    etiqueta: 'Reputacion del vendedor',
    acredita: 'El historial del vendedor dentro de la plataforma.',
  },
  volumenDeVentas: {
    id: 'volumenDeVentas',
    dimension: DIMENSIONS.fiabilidadDelVendedor,
    origen: 'cliente',
    etiqueta: 'Volumen de ventas',
    acredita: 'Cuantas ventas acumula el vendedor, como senal de experiencia.',
  },
  politicasDeGarantia: {
    id: 'politicasDeGarantia',
    dimension: DIMENSIONS.fiabilidadDelVendedor,
    origen: 'cliente',
    etiqueta: 'Politicas de garantia',
    acredita: 'Que la publicacion declara garantia ante inconvenientes.',
  },
  proteccionDePago: {
    id: 'proteccionDePago',
    dimension: DIMENSIONS.fiabilidadDelVendedor,
    origen: 'cliente',
    etiqueta: 'Proteccion de pago declarada',
    acredita: 'Que la plataforma declara proteger el pago de esta compra.',
  },
  puntuacionDelProducto: {
    id: 'puntuacionDelProducto',
    dimension: DIMENSIONS.evidenciaDeLaComunidad,
    origen: 'cliente',
    etiqueta: 'Puntuacion del producto',
    acredita: 'La calificacion promedio que le dieron otros compradores.',
  },
  presenciaDeResenas: {
    id: 'presenciaDeResenas',
    dimension: DIMENSIONS.evidenciaDeLaComunidad,
    origen: 'cliente',
    etiqueta: 'Presencia de resenas',
    acredita: 'Que existen resenas de compradores anteriores.',
  },
  autenticidadDeResenas: {
    id: 'autenticidadDeResenas',
    dimension: DIMENSIONS.evidenciaDeLaComunidad,
    origen: 'backend',
    etiqueta: 'Autenticidad de las resenas',
    acredita: 'Que proporcion de las resenas presenta indicios de ser artificial.',
  },
};

export const featuresDeDimension = (d: Dimension): readonly FeatureId[] =>
  FEATURE_IDS.filter((id) => FEATURE_META[id].dimension === d);

/** Ids de las caracteristicas resueltas (kind === 'conocido'). */
export const resueltas = (fs: FeatureSet): readonly FeatureId[] =>
  FEATURE_IDS.filter((id) => esConocida(fs[id]));

/** Ids de las caracteristicas sin resolver: no-aplica e indeterminado. */
export const sinResolver = (fs: FeatureSet): readonly FeatureId[] =>
  FEATURE_IDS.filter((id) => !esConocida(fs[id]));
