/**
 * Insumos que los analizadores de reputacion y de resenas necesitan y que
 * `DocumentAnalysis/Features` no devuelve.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ REGLA CENTRAL: OMITIR NO ES MANDAR CERO.                                │
 * │                                                                         │
 * │ En el contrato del backend, un campo AUSENTE produce una senal NO       │
 * │ VERIFICABLE, y un campo presente en 0 produce una senal DESFAVORABLE.   │
 * │ Rellenar por defecto lo que no se pudo leer mueve el veredicto en       │
 * │ contra del vendedor sin haber medido nada: es el mismo error que el     │
 * │ modelo de tres estados existe para impedir, apuntando al otro lado.     │
 * │                                                                         │
 * │ Por eso todos los campos medibles son opcionales y NUNCA se rellenan.   │
 * │ Si un selector falla, la clave no viaja.                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Efecto util de la regla: un selector sin verificar que no matchea degrada a
 * "no se pudo comprobar", no a una senal en contra. La disciplina de omision
 * protege justo donde la extraccion es mas fragil.
 */
export interface DatosDelVendedor {
  /** Lo unico que no es opcional: sin nombre no se consulta al analizador. */
  readonly sellerName: string;
  readonly platform: string;
  /** ISO 8601, solo si la ficha publica la fecha completa. */
  readonly memberSince?: string;
  readonly memberSinceYear?: number;
  readonly completedSales?: number;
  /** 1 sin distintivo, 2 basico, 3 intermedio, 4 maximo. */
  readonly badgeTier?: number;
  readonly isRecognizedSeller?: boolean;
  readonly badgeLabel?: string;
  /** Escala 0 a 5. */
  readonly ratingAverage?: number;
  readonly ratingCount?: number;
  /** Proporcion en [0, 1]. */
  readonly negativeRatingShare?: number;
  readonly claimShare?: number;
  readonly cancellationShare?: number;
  readonly onTimeDeliveryShare?: number;
}

/** Una resena tal como el navegador la renderizo. La autoria no se lee ni se manda. */
export interface ResenaLeida {
  readonly text: string;
  /** Estrellas 0-5. Se omite si la ficha no las mostraba. */
  readonly rating?: number;
}

export interface Insumos {
  /** null cuando la ficha no identifica al vendedor: entonces no se consulta. */
  readonly vendedor: DatosDelVendedor | null;
  readonly resenas: readonly ResenaLeida[];
  /** Categoria del producto, contexto para el clasificador. Vacia si no se leyo. */
  readonly categoria: string;
}

export const SIN_INSUMOS: Insumos = { vendedor: null, resenas: [], categoria: '' };

/**
 * Quita las claves que no se pudieron leer.
 *
 * `JSON.stringify` ya descarta `undefined`, pero no `null`, y un `null` que
 * llegue al backend se deserializa como campo presente. Esta funcion es la
 * garantia de que eso no pasa, y hay tests que fallan si una clave no leida
 * aparece en el cuerpo serializado.
 */
export const soloLoLeido = <T extends object>(o: T): Partial<T> => {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(o)) {
    if (valor === undefined || valor === null) continue;
    if (typeof valor === 'number' && !Number.isFinite(valor)) continue;
    salida[clave] = valor;
  }
  return salida as Partial<T>;
};
