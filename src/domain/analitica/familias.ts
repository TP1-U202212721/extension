/**
 * Conteo de senales por familia, que es el nivel al que razona la tesis.
 *
 * No se emiten los codigos exactos de cada senal: una lista de codigos por
 * consulta se acerca a una huella de la ficha, y la privacidad del modulo lo
 * descarta expresamente. Lo que se emite es cuantas senales de cada familia
 * restaron, sumaron o no se pudieron verificar. Una fila por familia acota el
 * crecimiento a menos de doce filas por consulta.
 *
 * La familia se deduce del PREFIJO del codigo (`morphology.typosquatting` →
 * morfologia del nombre) y no de `familyLabel`. El prefijo es parte del codigo
 * estable de la senal; la etiqueta es texto de presentacion en espanol, con
 * tildes, y pensada para el comprador: agrupar por ella se rompe con un cambio
 * de redaccion.
 */

import { ANALIZADOR, type AnalizadorAnalitica, type FamiliaDeSenales } from './eventos.js';

/** `ESignalFamily`, la escala del analizador de dominio. */
const FAMILIA_DOMINIO: Readonly<Record<string, number>> = {
  registration: 1,
  resolution: 2,
  tls: 3,
  morphology: 4,
  url: 5,
  reputation: 6,
};

/** `ESellerSignalFamily`, la escala del analizador de vendedor. */
const FAMILIA_VENDEDOR: Readonly<Record<string, number>> = {
  tenure: 1,
  volume: 2,
  standing: 3,
  ratings: 4,
  aftersales: 5,
};

/** Solo el dominio y el vendedor razonan por familias. */
type AnalizadorConFamilias = typeof ANALIZADOR.dominio | typeof ANALIZADOR.vendedor;

/** Una senal tal como la devuelven los dos analizadores que razonan por familias. */
export interface SenalConCodigo {
  readonly code: string;
}

export interface SenalesDelAnalizador {
  readonly riskSignals: readonly SenalConCodigo[];
  readonly trustSignals: readonly SenalConCodigo[];
  readonly unverifiedSignals: readonly SenalConCodigo[];
}

const familiaDe = (analizador: AnalizadorConFamilias, code: string): number | null => {
  const prefijo = code.split('.')[0];
  if (prefijo === undefined || prefijo === '') return null;
  const escala = analizador === ANALIZADOR.dominio ? FAMILIA_DOMINIO : FAMILIA_VENDEDOR;
  return escala[prefijo] ?? null;
};

/** Maximo de familias que el servidor guarda por consulta. */
const MAX_FAMILIAS = 16;

/**
 * Cuenta las senales de un analizador por familia.
 *
 * Una familia que no existe en la escala de su analizador se OMITE aqui, en vez
 * de mandarla para que el servidor la descarte y la cuente en `sanitized`: un
 * `sanitized` distinto de cero es, por contrato, un defecto de la extension.
 *
 * Una familia con `risk`, `trust` y `unverified` en cero no se emite: no aporta
 * nada y el servidor tampoco la guardaria.
 */
export const familiasDeSenales = (
  analizador: AnalizadorConFamilias,
  senales: SenalesDelAnalizador,
): readonly FamiliaDeSenales[] => {
  const acumulado = new Map<number, { risk: number; trust: number; unverified: number }>();

  const contar = (lista: readonly SenalConCodigo[], campo: 'risk' | 'trust' | 'unverified'): void => {
    for (const senal of lista) {
      const familia = familiaDe(analizador, senal.code);
      if (familia === null) continue;
      const fila = acumulado.get(familia) ?? { risk: 0, trust: 0, unverified: 0 };
      fila[campo] += 1;
      acumulado.set(familia, fila);
    }
  };

  contar(senales.riskSignals, 'risk');
  contar(senales.trustSignals, 'trust');
  contar(senales.unverifiedSignals, 'unverified');

  return [...acumulado.entries()]
    .filter(([, f]) => f.risk + f.trust + f.unverified > 0)
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_FAMILIAS)
    .map(([family, f]) => ({
      analyzer: analizador satisfies AnalizadorAnalitica,
      family,
      risk: f.risk,
      trust: f.trust,
      unverified: f.unverified,
    }));
};
