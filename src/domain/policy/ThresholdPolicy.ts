import {
  DIMENSIONS,
  FEATURE_IDS,
  featuresDeDimension,
  esConocida,
  estaResuelta,
  resueltas,
  sinResolver,
  type Dimension,
  type FeatureSet,
} from '../features.js';
import type { DecisionPolicy } from './DecisionPolicy.js';
import type { NivelDeRiesgo, Verdict } from '../verdict.js';

const TODAS_LAS_DIMENSIONES: readonly Dimension[] = [
  DIMENSIONS.identidadDelSitio,
  DIMENSIONS.fiabilidadDelVendedor,
  DIMENSIONS.evidenciaDeLaComunidad,
];

/** Umbral minimo de caracteristicas resueltas para emitir veredicto. */
const R_MINIMO = 4;

/**
 * Compuerta de abstencion: devuelve `evidencia-insuficiente` si hay menos de
 * R_MINIMO caracteristicas resueltas o si alguna dimension no aporta ninguna.
 * Devuelve null cuando la evidencia alcanza para emitir un nivel de riesgo.
 *
 * Esta separada de la politica porque se aplica ANTES de cualquier clasificador:
 * el modelo del backend solo decide el nivel cuando esta compuerta deja pasar.
 */
export const evidenciaInsuficiente = (features: FeatureSet): Verdict | null => {
  const conocidas = resueltas(features);
  const faltantes = sinResolver(features);

  const dimensionesVacias = TODAS_LAS_DIMENSIONES.filter(
    (d) => !featuresDeDimension(d).some((id) => esConocida(features[id])),
  );

  if (conocidas.length >= R_MINIMO && dimensionesVacias.length === 0) return null;

  return {
    kind: 'evidencia-insuficiente',
    resueltas: conocidas,
    sinResolver: faltantes,
    dimensionesVacias,
    motivo:
      dimensionesVacias.length > 0
        ? `Faltan datos de: ${dimensionesVacias.join(', ')}.`
        : `Solo se pudieron verificar ${String(conocidas.length)} de ${String(FEATURE_IDS.length)} caracteristicas.`,
  };
};

/**
 * Regla vigente: se emite veredicto si hay al menos R_MINIMO caracteristicas
 * resueltas Y cada dimension aporta al menos una. En cualquier otro caso, la
 * respuesta es `evidencia-insuficiente`.
 *
 * EN REVISION. Ver docs/adr/0002-modelo-tres-estados.md: la conjuncion es
 * enganosa, porque en la practica se reduce a una sola condicion.
 */
export class ThresholdPolicy implements DecisionPolicy {
  readonly id = 'threshold-r4-una-por-dimension@en-revision';

  decidir(features: FeatureSet): Verdict {
    const abstencion = evidenciaInsuficiente(features);
    if (abstencion !== null) return abstencion;

    const conocidas = resueltas(features);
    const faltantes = sinResolver(features);

    const { nivel, puntaje } = this.#puntuar(features);

    return {
      kind: 'riesgo',
      nivel,
      puntaje,
      confianza: conocidas.length / FEATURE_IDS.length,
      sustentan: conocidas,
      sinResolver: faltantes,
    };
  }

  /**
   * Puntuacion provisional sobre las caracteristicas resueltas. Deliberadamente
   * simple: el clasificador real vive en el backend y esta politica solo existe
   * para que la maqueta produzca los cuatro desenlaces de forma determinista.
   *
   * Devuelve el nivel Y el puntaje del que sale, en la misma pasada. Recalcular
   * el puntaje despues, fuera de la politica, seria tener dos versiones de la
   * misma cifra y que una pudiera contradecir a la otra.
   */
  #puntuar(f: FeatureSet): { readonly nivel: NivelDeRiesgo; readonly puntaje: number } {
    let puntos = 0;
    let consideradas = 0;

    const sumar = (ok: boolean): void => {
      consideradas += 1;
      if (ok) puntos += 1;
    };

    if (estaResuelta(f.proteccionDePago)) sumar(f.proteccionDePago.valor === 'declarada');
    // 4 y 5 son "probablemente legitimo" y "legitimo". El 3 del backend es
    // "sin evidencia suficiente": es un valor conocido, pero no acredita nada.
    if (estaResuelta(f.veracidadDeDominio)) sumar(f.veracidadDeDominio.valor >= 4);
    // Las tres caracteristicas de backend comparten forma de escala ordinal de
    // cinco niveles, con el 3 reservado a "no se sabe". Por eso las tres tienen
    // el mismo corte: solo 4 y 5 acreditan algo.
    if (estaResuelta(f.reputacionDelVendedor)) sumar(f.reputacionDelVendedor.valor >= 4);
    if (estaResuelta(f.autenticidadDeResenas)) sumar(f.autenticidadDeResenas.valor >= 4);
    if (estaResuelta(f.puntuacionDelProducto)) sumar(f.puntuacionDelProducto.valor >= 4);
    if (estaResuelta(f.presenciaDeResenas)) sumar(f.presenciaDeResenas.valor);
    if (estaResuelta(f.politicasDeGarantia)) sumar(f.politicasDeGarantia.valor >= 1);
    if (estaResuelta(f.volumenDeVentas)) sumar(f.volumenDeVentas.valor >= 50);

    // Sin nada que considerar no hay con que sostener nada favorable. El puntaje
    // es 0 porque es lo que midio la politica, no un relleno.
    if (consideradas === 0) return { nivel: 'alto', puntaje: 0 };

    const razon = puntos / consideradas;
    const puntaje = Math.round(razon * 100);
    if (razon >= 0.7) return { nivel: 'bajo', puntaje };
    if (razon >= 0.4) return { nivel: 'moderado', puntaje };
    return { nivel: 'alto', puntaje };
  }
}
