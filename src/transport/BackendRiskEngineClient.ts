import { indeterminado, type FeatureSet } from '../domain/features.js';
import type { DecisionPolicy } from '../domain/policy/DecisionPolicy.js';
import type { TokenProvider } from '../auth/TokenProvider.js';
import { analizarDocumento } from './DocumentAnalysisClient.js';
import { consultarVeracidadDeDominio } from './DomainVeracityClient.js';
import { consultarReputacion, type DatosDelVendedor } from './SellerReputationClient.js';
import { consultarAutenticidad, type ResenaLeida } from './ReviewAnalysisClient.js';
import {
  SesionRequeridaError,
  type Detalles,
  type Evaluacion,
  type EvaluacionSolicitud,
  type RiskEngineClient,
} from './RiskEngineClient.js';

/**
 * Que analizadores estan disponibles.
 *
 * `vendedor` y `resenas` viven en el PR 10, sin mergear. Sus clientes estan
 * completos y tipados contra el contrato real; lo unico que falta para usarlos
 * es poner su bandera en true, y ademas resolver de donde salen sus insumos
 * (ver docs/adr/0005).
 */
export interface Analizadores {
  readonly documento: boolean;
  readonly dominio: boolean;
  readonly vendedor: boolean;
  readonly resenas: boolean;
}

/** Insumos que hoy nadie sabe reunir. Ver la nota de docs/adr/0005. */
export interface InsumosDelDocumento {
  readonly vendedor: DatosDelVendedor | null;
  readonly resenas: readonly ResenaLeida[];
  readonly categoria: string;
}

/**
 * Motor real: resuelve cada caracteristica contra su analizador del backend y
 * despues aplica la politica de decision, que sigue siendo local.
 *
 * Que la decision no viaje al servidor es deliberado: la regla de abstencion es
 * la contribucion de esta tesis y tiene que poder inspeccionarse y cambiarse sin
 * depender de un despliegue. El backend aporta evidencia; quien decide que hacer
 * con la falta de evidencia es la politica inyectada.
 *
 * REGLA QUE NINGUNA RAMA PUEDE ROMPER: un fallo, un timeout o una respuesta
 * ilegible dejan la caracteristica indeterminada. Nunca favorable. Un backend
 * caido no es senal de que la publicacion sea segura.
 */
export class BackendRiskEngineClient implements RiskEngineClient {
  readonly id = 'backend';

  constructor(
    private readonly policy: DecisionPolicy,
    private readonly tokens: TokenProvider,
    private readonly analizadores: Analizadores,
    private readonly insumos: (html: string) => InsumosDelDocumento,
  ) {}

  async evaluar(solicitud: EvaluacionSolicitud): Promise<Evaluacion> {
    const token = await this.tokens.obtener();
    // Los cuatro endpoints exigen autenticacion hoy. Sin credencial no se
    // evalua: la UI tiene que distinguir "no pude" de "necesitas cuenta".
    if (token === null) throw new SesionRequeridaError();

    const insumos = this.insumos(solicitud.html);

    // Los analizadores son independientes entre si, asi que van en paralelo.
    // Secuenciarlos solo sumaria sus latencias sobre la espera del comprador.
    const [doc, dominio, vendedor, resenas] = await Promise.all([
      this.analizadores.documento
        ? analizarDocumento(solicitud.url, solicitud.html, token)
        : null,
      this.analizadores.dominio ? consultarVeracidadDeDominio(solicitud.url, token) : null,
      this.analizadores.vendedor && insumos.vendedor !== null
        ? consultarReputacion(insumos.vendedor, this.tokens)
        : null,
      this.analizadores.resenas
        ? consultarAutenticidad(insumos.resenas, insumos.categoria, this.tokens)
        : null,
    ]);

    const features: FeatureSet = {
      ...(doc?.features ?? SIN_DOCUMENTO),
      veracidadDeDominio:
        dominio?.feature ?? indeterminado('El analizador de dominio esta desactivado.'),
      reputacionDelVendedor:
        vendedor?.feature ??
        indeterminado('El analizador de reputacion del vendedor todavia no esta disponible.'),
      autenticidadDeResenas:
        resenas?.feature ??
        indeterminado('El analizador de autenticidad de resenas todavia no esta disponible.'),
    };

    const detalles: Detalles = {
      documento: doc?.detalle ?? null,
      dominio: dominio?.detalle ?? null,
      vendedor: vendedor?.detalle ?? null,
      resenas: resenas?.detalle ?? null,
    };

    return { verdict: this.policy.decidir(features), features, detalles };
  }
}

const APAGADO = 'El analizador de documento esta desactivado.';

const SIN_DOCUMENTO: FeatureSet = {
  proteccionDePago: indeterminado(APAGADO),
  puntuacionDelProducto: indeterminado(APAGADO),
  presenciaDeResenas: indeterminado(APAGADO),
  politicasDeGarantia: indeterminado(APAGADO),
  volumenDeVentas: indeterminado(APAGADO),
  reputacionDelVendedor: indeterminado(APAGADO),
  autenticidadDeResenas: indeterminado(APAGADO),
  veracidadDeDominio: indeterminado(APAGADO),
};
