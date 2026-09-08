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
  | { readonly kind: 'indeterminado'; readonly motivo: string };

export const conocido = <T>(valor: T, evidencia: string): FeatureValue<T> => ({
  kind: 'conocido',
  valor,
  evidencia,
});

export const noAplica = <T>(motivo: string): FeatureValue<T> => ({ kind: 'no-aplica', motivo });

export const indeterminado = <T>(motivo: string): FeatureValue<T> => ({
  kind: 'indeterminado',
  motivo,
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

export interface FeatureSet {
  readonly proteccionDePago: FeatureValue<ProteccionDePago>;
  readonly veracidadDeDominio: FeatureValue<Ordinal>;
  readonly reputacionDelVendedor: FeatureValue<Ordinal>;
  /** Proporcion estimada de resenas artificiales, 0.0 - 1.0. */
  readonly autenticidadDeResenas: FeatureValue<number>;
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
