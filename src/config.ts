import { Analitica } from './analytics/Analitica.js';
import { ColaAnalitica } from './analytics/ColaAnalitica.js';
import { SessionTokenProvider } from './auth/TokenProvider.js';
import { ThresholdPolicy } from './domain/policy/ThresholdPolicy.js';
import { BackendRiskEngineClient, type Analizadores } from './transport/BackendRiskEngineClient.js';
import { MockRiskEngineClient } from './transport/MockRiskEngineClient.js';
import type { RiskEngineClient } from './transport/RiskEngineClient.js';


/**
 * Motor por defecto. `'mock'` sirve para desarrollar sin backend; NO es el
 * camino normal y no consulta nada.
 */
type Motor = 'backend' | 'mock';
const MOTOR = 'backend' as Motor;

/**
 * Los cuatro analizadores del backend, todos reales. Apagar uno lo degrada a
 * indeterminado; jamas a favorable.
 */
const ANALIZADORES: Analizadores = {
  documento: true,
  dominio: true,
  vendedor: true,
  resenas: true,
};

export const tokens = new SessionTokenProvider();

export const riskEngine: RiskEngineClient =
  MOTOR === 'backend'
    ? new BackendRiskEngineClient(new ThresholdPolicy(), tokens, ANALIZADORES)
    : new MockRiskEngineClient();

/**
 * La analitica de uso, en una sola instancia.
 *
 * Vive junto al motor y NO dentro de el: el motor produce veredictos, y medir
 * cuantos produce es otra responsabilidad. Que sean dos objetos es lo que hace
 * posible la garantia central —la analitica jamas retrasa ni rompe el
 * veredicto—, porque el motor no la conoce y no puede esperarla.
 */
export const cola = new ColaAnalitica(tokens);
export const analitica = new Analitica(cola);
