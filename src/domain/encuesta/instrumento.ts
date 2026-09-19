/**
 * El instrumento de la encuesta de satisfaccion, tal como lo publica
 * `GET /api/v1/Feedback/Instrument`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ LAS PREGUNTAS NO ESTAN ESCRITAS EN LA EXTENSION.                        │
 * │                                                                         │
 * │ Se piden al backend y se dibuja lo que llegue, ordenando por            │
 * │ `position` y respetando `minValue`/`maxValue`. Ese es el detalle que    │
 * │ hace que pasar de un item a los quince del protocolo no sea una version │
 * │ nueva de la extension en tres tiendas con revision de por medio: el     │
 * │ endpoint devolvera quince y esta UI ya los muestra.                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/** `EFeedbackDimension`. */
export const DIMENSION = {
  satisfaccionGlobal: 1,
  usabilidad: 2,
  confianzaPercibida: 3,
  riesgoPercibido: 4,
  intencionDeUso: 5,
  influenciaEnLaCompra: 6,
} as const;

/** `EFeedbackScale`. */
export const ESCALA = {
  estrellas5: 1,
  likert5: 2,
  textoLibre: 3,
} as const;

export interface ItemDelInstrumento {
  /** Codigo estable del item. Es lo que se manda de vuelta en `answers`. */
  readonly code: string;
  readonly prompt: string;
  readonly dimension: number;
  readonly dimensionLabel: string;
  readonly scale: number;
  readonly scaleLabel: string;
  readonly minValue: number;
  readonly maxValue: number;
  readonly position: number;
  readonly optional: boolean;
  /** Afirmacion redactada en negativo. La recodificacion la hace el servidor. */
  readonly reverseScored: boolean;
}

export interface Instrumento {
  /** `false` apaga la encuesta entera: no se muestra nada. */
  readonly moduleEnabled: boolean;
  readonly code: string;
  readonly version: number;
  readonly title: string;
  /** Version del texto de consentimiento. Viaja con la respuesta. */
  readonly consentVersion: string;
  /** Hay que MOSTRARLO antes de preguntar. No es decorativo. */
  readonly consentText: string;
  readonly allowsComment: boolean;
  readonly maxCommentLength: number;
  readonly items: readonly ItemDelInstrumento[];
}

/** Items en el orden en que se dibujan. */
export const itemsOrdenados = (i: Instrumento): readonly ItemDelInstrumento[] =>
  [...i.items].sort((a, b) => a.position - b.position);

/**
 * `EFeedbackVerdictKind`. La extension solo opina sobre el riesgo estimado, que
 * es el veredicto que el comprador de verdad vio en pantalla.
 */
export const TIPO_DE_VEREDICTO = {
  ninguno: 0,
  veracidadDeDominio: 1,
  reputacionDelVendedor: 2,
  autenticidadDeResenas: 3,
  riesgoEstimado: 4,
} as const;

/** `EFeedbackScope`. */
export const ALCANCE = {
  laExtension: 1,
  unaConsulta: 2,
} as const;

/**
 * `EFeedbackPlatform`.
 *
 * OJO: NO es el mismo enumerado que el de la analitica de uso. Aqui el 2 es
 * Facebook Marketplace y no Amazon, y ni Amazon ni eBay tienen valor propio:
 * caen en 99. Reutilizar el otro mapa mandaria las respuestas de Amazon a la
 * fila de Facebook Marketplace, que es un error que no se ve hasta que se
 * exporta la tabla.
 */
const PLATAFORMA_ENCUESTA: Readonly<Record<string, number>> = {
  'Mercado Libre': 1,
  'Facebook Marketplace': 2,
  AliExpress: 3,
};

export const plataformaDeEncuesta = (nombre: string): number =>
  nombre === '' ? 0 : (PLATAFORMA_ENCUESTA[nombre] ?? 99);

/** `ERiskTypes`, que es la escala de `verdictKind = 4`. */
export const RIESGO_ESTIMADO = {
  alto: 1,
  moderado: 2,
  bajo: 3,
} as const;
