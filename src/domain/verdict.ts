import type { Dimension, FeatureId } from './features.js';

export type NivelDeRiesgo = 'alto' | 'moderado' | 'bajo';

/**
 * Los cuatro desenlaces. `evidencia-insuficiente` es un desenlace de pleno
 * derecho, no un error ni un caso borde: la ausencia de informacion jamas se
 * presenta como seguridad.
 */
export type Verdict =
  | {
      readonly kind: 'riesgo';
      readonly nivel: NivelDeRiesgo;
      /** 0.0 - 1.0. Proporcion de caracteristicas que sustentan el veredicto. */
      readonly confianza: number;
      /**
       * 0 - 100, de peor a mejor, en la misma orientacion que los puntajes de
       * los analizadores del backend. Es la cifra continua detras del nivel:
       * `nivel` la agrupa en tres tramos y pierde la distancia al corte, que es
       * justo lo que la analitica necesita para decir cuan al filo quedo una
       * consulta. La reporta la politica que decidio, no se recalcula despues.
       */
      readonly puntaje: number;
      readonly sustentan: readonly FeatureId[];
      readonly sinResolver: readonly FeatureId[];
    }
  | {
      readonly kind: 'evidencia-insuficiente';
      readonly resueltas: readonly FeatureId[];
      readonly sinResolver: readonly FeatureId[];
      /** Dimensiones que quedaron sin una sola caracteristica resuelta. */
      readonly dimensionesVacias: readonly Dimension[];
      readonly motivo: string;
    };

export const esAbstencion = (
  v: Verdict,
): v is Extract<Verdict, { kind: 'evidencia-insuficiente' }> =>
  v.kind === 'evidencia-insuficiente';
