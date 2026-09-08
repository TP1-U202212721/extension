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

export const riskEngine: RiskEngineClient =
  MOTOR === 'backend'
    ? new BackendRiskEngineClient(
        new ThresholdPolicy(),
        new SessionTokenProvider(),
        ANALIZADORES,
      )
    : new MockRiskEngineClient();
