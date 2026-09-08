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
    const conocidas = resueltas(features);
    const faltantes = sinResolver(features);

    const dimensionesVacias = TODAS_LAS_DIMENSIONES.filter(
      (d) => !featuresDeDimension(d).some((id) => esConocida(features[id])),
    );

    if (conocidas.length < R_MINIMO || dimensionesVacias.length > 0) {
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
    }

    return {
      kind: 'riesgo',
      nivel: this.#nivel(features),
      confianza: conocidas.length / FEATURE_IDS.length,
      sustentan: conocidas,
      sinResolver: faltantes,
    };
  }

  /**
   * Puntuacion provisional sobre las caracteristicas resueltas. Deliberadamente
   * simple: el clasificador real vive en el backend y esta politica solo existe
   * para que la maqueta produzca los cuatro desenlaces de forma determinista.
   */
  #nivel(f: FeatureSet): NivelDeRiesgo {
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
    // El backend la lee del documento como binaria: 1 = distintivo de lider,
    // 0 = sin distintivo. Con el umbral en 2 esta caracteristica JAMAS podia
    // resultar favorable, que es un fallo silencioso del tipo que este diseno
    // persigue. Cuando exista el historial agregado del vendedor habra que
    // revisar el corte junto con el resto de la escala.
    if (estaResuelta(f.reputacionDelVendedor)) sumar(f.reputacionDelVendedor.valor >= 1);
    if (estaResuelta(f.autenticidadDeResenas)) sumar(f.autenticidadDeResenas.valor <= 0.3);
    if (estaResuelta(f.puntuacionDelProducto)) sumar(f.puntuacionDelProducto.valor >= 4);
    if (estaResuelta(f.presenciaDeResenas)) sumar(f.presenciaDeResenas.valor);
    if (estaResuelta(f.politicasDeGarantia)) sumar(f.politicasDeGarantia.valor >= 1);
    if (estaResuelta(f.volumenDeVentas)) sumar(f.volumenDeVentas.valor >= 50);

    if (consideradas === 0) return 'alto';
    const razon = puntos / consideradas;
    if (razon >= 0.7) return 'bajo';
    if (razon >= 0.4) return 'moderado';
    return 'alto';
  }
}
