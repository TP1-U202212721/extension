import { indeterminado, type FeatureSet } from '../domain/features.js';
import type { DecisionPolicy } from '../domain/policy/DecisionPolicy.js';
import type { TokenProvider } from '../auth/TokenProvider.js';
import { analizarDocumento } from './DocumentAnalysisClient.js';
import { veredictoDelModelo } from '../domain/policy/modeloDePlataforma.js';
import { consultarVeracidadDeDominio } from './DomainVeracityClient.js';
import { consultarReputacion } from './SellerReputationClient.js';
import { consultarAutenticidad } from './ReviewAnalysisClient.js';
import {
  OMITIDO,
  SesionRequeridaError,
  type Detalles,
  type Evaluacion,
  type EvaluacionSolicitud,
  type PasoDeTraza,
  type RiskEngineClient,
  type Traza,
} from './RiskEngineClient.js';
import type { DatosDelVendedor } from '../domain/insumos.js';

/** Que analizadores del backend se consultan. */
export interface Analizadores {
  readonly documento: boolean;
  readonly dominio: boolean;
  readonly vendedor: boolean;
  readonly resenas: boolean;
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
  ) {}

  async evaluar(solicitud: EvaluacionSolicitud): Promise<Evaluacion> {
    const token = await this.tokens.obtener();
    if (token === null) throw new SesionRequeridaError();

    const esFacebook = solicitud.url.includes('facebook.com/marketplace');

    const datosVendedor: DatosDelVendedor | null =
      solicitud.insumos.vendedor ?? { sellerName: '', platform: 'Mercado Libre' };

    const [doc, dominio, vendedor, resenas] = await Promise.all([
      cronometrar(
        this.analizadores.documento,
        () => analizarDocumento(solicitud.url, solicitud.html, token, solicitud.htmlVendedor),
      ),
      cronometrar(
        this.analizadores.dominio && !esFacebook,
        () => consultarVeracidadDeDominio(solicitud.url, token),
      ),
      cronometrar(this.analizadores.vendedor, () =>
        consultarReputacion(datosVendedor, this.tokens),
      ),
      cronometrar(this.analizadores.resenas && !esFacebook, () =>
        consultarAutenticidad(
          solicitud.insumos.resenas,
          solicitud.insumos.categoria,
          this.tokens,
        ),
      ),
    ]);

    const features: FeatureSet = {
      ...(doc?.valor.features ?? SIN_DOCUMENTO),
      veracidadDeDominio:
        dominio?.valor.feature ?? indeterminado('El analizador de dominio esta desactivado.'),
      reputacionDelVendedor:
        vendedor?.valor.feature ??
        indeterminado('El analizador de reputacion del vendedor esta desactivado.'),
      autenticidadDeResenas:
        resenas?.valor.feature ?? indeterminado('El analizador de resenas esta desactivado.'),
    };

    const detalles: Detalles = {
      documento: doc?.valor.detalle ?? null,
      dominio: dominio?.valor.detalle ?? null,
      vendedor: vendedor?.valor.detalle ?? null,
      resenas: resenas?.valor.detalle ?? null,
    };

    const traza: Traza = {
      documento: paso(doc),
      dominio: paso(dominio),
      vendedor: paso(vendedor),
      resenas: paso(resenas),
    };

    // En las plataformas con modelo propio (Facebook Marketplace) el nivel de
    // riesgo lo decide ESE modelo, no la politica de aqui. El backend solo lo
    // consulta cuando el comprador pidio revisar al vendedor y se pudo leer su
    // perfil; si no, no viene nada y decide la politica, como siempre.
    const delModelo =
      doc?.valor.modelo === undefined ? null : veredictoDelModelo(doc.valor.modelo, features);

    return { verdict: delModelo ?? this.policy.decidir(features), features, detalles, traza };
  }
}

/** Lo que devuelve un analizador, junto a lo que tardo en devolverlo. */
interface Medido<T> {
  readonly valor: T;
  readonly duracionMs: number;
}

/**
 * Corre un analizador midiendo cuanto tarda, o devuelve null si esta apagado.
 *
 * La latencia se mide AQUI, alrededor de la llamada, y no dentro del cliente:
 * lo que le interesa a la tesis es lo que espero el comprador, que incluye
 * serializar el documento y leer la respuesta, no solo el tiempo del servidor.
 */
const cronometrar = async <T>(
  encendido: boolean,
  llamar: () => Promise<T>,
): Promise<Medido<T> | null> => {
  if (!encendido) return null;
  const inicio = Date.now();
  const valor = await llamar();
  return { valor, duracionMs: Date.now() - inicio };
};

const paso = (m: Medido<{ readonly desenlace: PasoDeTraza['desenlace'] }> | null): PasoDeTraza =>
  m === null ? OMITIDO : { desenlace: m.valor.desenlace, duracionMs: m.duracionMs };

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
