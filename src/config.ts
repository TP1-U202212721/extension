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
 * Que analizadores del backend estan disponibles.
 *
 * `documento` y `dominio` estan en dev y son reales. `vendedor` y `resenas`
 * viven en el PR 10, sin mergear: sus clientes estan escritos y tipados contra
 * el contrato real, pero hasta que ese PR entre, activarlos solo produciria
 * errores de red que degradan a indeterminado. Ver docs/adr/0005.
 */
const ANALIZADORES: Analizadores = {
  documento: true,
  dominio: true,
  vendedor: false,
  resenas: false,
};

/**
 * De donde salen los insumos de los dos analizadores del PR 10.
 *
 * Sin resolver, y es el punto abierto de este diseno: esos endpoints no reciben
 * el documento sino datos ya estructurados (fecha de alta, ventas, distintivo,
 * y el texto de las resenas), asi que alguien tiene que leerlos del DOM. Que lo
 * haga la extension reintroduce la duplicacion de selectores que docs/adr/0004
 * elimino. La alternativa esta propuesta en docs/adr/0005.
 */
const insumosPendientes = (_html: string) => ({
  vendedor: null,
  resenas: [],
  categoria: '',
});

export const riskEngine: RiskEngineClient =
  MOTOR === 'backend'
    ? new BackendRiskEngineClient(
        new ThresholdPolicy(),
        new SessionTokenProvider(),
        ANALIZADORES,
        insumosPendientes,
      )
    : new MockRiskEngineClient();
