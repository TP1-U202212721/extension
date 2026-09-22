import { FEATURE_IDS, esConocida, type FeatureId, type FeatureSet } from '../features.js';
import type { NivelDeRiesgo, Verdict } from '../verdict.js';

/**
 * El veredicto que emite el modelo propio de una plataforma.
 *
 * El backend consulta un modelo por plataforma: el de Facebook Marketplace y el
 * de e-commerce para el resto. Fuera de Facebook el modelo solo decide cuando la
 * compuerta de abstencion deja pasar (ver BackendRiskEngineClient).
 *
 * El modelo solo se consulta cuando el comprador pidio revisar al vendedor y se
 * pudo leer lo esencial de su perfil; si no, el backend no lo llama y aqui no
 * llega nada.
 */

/**
 * Las clases del modelo de Facebook Marketplace.
 *
 * ESTA CORRESPONDENCIA ES LO PRIMERO QUE HAY QUE REVISAR si el equipo cambia el
 * modelo: es la unica traduccion entre su salida y lo que ve el comprador.
 * La clase 3 es el vendedor bueno (en el dataset: 4.96 de promedio, 66
 * calificaciones, 77 743 seguidores), y la 4 es un vendedor sin historial, que
 * no es un nivel de riesgo sino la ausencia de evidencia.
 */
export const CLASES: Readonly<Record<number, NivelDeRiesgo | 'sin-verificar'>> = {
  1: 'alto',
  2: 'moderado',
  3: 'bajo',
  4: 'sin-verificar',
};

/**
 * Puntaje que acompaña a cada nivel.
 *
 * El modelo devuelve una clase, no un puntaje, asi que esta cifra se DERIVA de
 * la clase: es el punto medio de cada tramo, y existe solo porque la analitica
 * necesita un numero continuo. No es una medida del modelo.
 */
const PUNTAJE: Readonly<Record<NivelDeRiesgo, number>> = { alto: 15, moderado: 50, bajo: 85 };

export interface VeredictoDelModelo {
  /** Clase que devolvio el modelo. */
  readonly clase: number;
  /** Columnas que el modelo recibio en cero porque no se pudieron leer. */
  readonly rellenadas: readonly string[];
}

/**
 * Traduce la clase del modelo a un veredicto.
 *
 * Devuelve null cuando la clase no se reconoce: una clase nueva no se presenta
 * como seguridad ni como riesgo, se ignora y decide la politica.
 *
 * `excluir` permite quitar features que la plataforma no usa (ej: veracidadDeDominio
 * en Facebook, que siempre es indeterminada porque el analizador de dominio esta
 * desactivado). Sin ellas, la confianza se calcula sobre las features relevantes.
 */
export const veredictoDelModelo = (
  modelo: VeredictoDelModelo,
  features: FeatureSet,
  excluir: readonly FeatureId[] = [],
): Verdict | null => {
  const nivel = CLASES[modelo.clase];
  if (nivel === undefined) return null;

  const relevantes = FEATURE_IDS.filter((id) => !excluir.includes(id));
  const conocidas = relevantes.filter((id) => esConocida(features[id]));
  const faltantes = relevantes.filter((id) => !esConocida(features[id]));

  if (nivel === 'sin-verificar') {
    return {
      kind: 'evidencia-insuficiente',
      resueltas: conocidas,
      sinResolver: faltantes,
      dimensionesVacias: [],
      motivo: 'El vendedor no tiene historial suficiente para estimar su riesgo.',
    };
  }

  return {
    kind: 'riesgo',
    nivel,
    // Cuanto de lo que el modelo pide se pudo leer de verdad, sin contar rellenos.
    confianza: Math.round((conocidas.length / FEATURE_IDS.length) * 100) / 100,
    puntaje: PUNTAJE[nivel],
    sustentan: conocidas,
    sinResolver: faltantes,
  };
};
