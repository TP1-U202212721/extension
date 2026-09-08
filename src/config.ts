import { MockRiskEngineClient } from './transport/MockRiskEngineClient.js';
import type { RiskEngineClient } from './transport/RiskEngineClient.js';

/**
 * Punto unico de cambio entre el motor simulado y el real.
 *
 * Cuando exista el endpoint del backend, esta linea pasa a:
 *   export const riskEngine: RiskEngineClient = new HttpRiskEngineClient(API_BASE_URL);
 */
export const riskEngine: RiskEngineClient = new MockRiskEngineClient();

export const API_BASE_URL = 'https://scamshield-api.ryzeon.dev/api/v1';
