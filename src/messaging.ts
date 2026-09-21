import type { FeatureSet } from './domain/features.js';
import type { Verdict } from './domain/verdict.js';
import type { Detalles } from './transport/RiskEngineClient.js';
import type { Insumos } from './domain/insumos.js';
import type { BloqueInteraccion } from './domain/analitica/eventos.js';
import type { Instrumento } from './domain/encuesta/instrumento.js';
import type { ResultadoDeEnvio } from './feedback/FeedbackClient.js';

/**
 * Contrato entre el content script y el background.
 *
 * El content script extrae, el background evalua. La red se hace desde el
 * background a proposito: asi la peticion no depende del CSP de la pagina del
 * marketplace, y la pagina del vendedor nunca ve una peticion nuestra. Eso vale
 * para el motor de riesgo, para la analitica y para la encuesta.
 */
export interface EvaluarMensaje {
  readonly tipo: 'evaluar';
  readonly plataforma: string;
  readonly publicacionId: string;
  /** URL que el comprador ya tiene abierta. Decide que plataforma la interpreta. */
  readonly url: string;
  /**
   * El documento que el navegador YA renderizo, sin recortar. Lo interpreta el
   * backend: ver docs/adr/0004. No se pide nada a la plataforma para obtenerlo.
   */
  readonly html: string;
  /** Insumos de reputacion y resenas, leidos del DOM vivo por el content script. */
  readonly insumos: Insumos;
  /**
   * El perfil del vendedor, cuando la plataforma no publica sus datos en la
   * ficha y el comprador pidio revisarlo (Facebook Marketplace). Solo viaja si
   * el comprador lo pidio: nunca se abre nada por iniciativa de la extension.
   */
  readonly htmlVendedor?: string;
  /** Sesion de navegacion de esta pestana, para la analitica de uso. */
  readonly sesionId: string;
  /**
   * Migas de pan crudas, para la categoria gruesa de la analitica. Se recortan
   * en `src/analytics/Analitica.ts`; de aqui no sale nada al servidor.
   */
  readonly categoria: string;
}

/**
 * Pide abrir el perfil del vendedor y devolver su documento.
 *
 * Lo abre el background en una pestana en segundo plano, lo lee y la cierra.
 * Solo se manda cuando el comprador pulsa "Revisar al vendedor".
 */
export interface RevisarVendedorMensaje {
  readonly tipo: 'revisar-vendedor';
  /** URL del perfil, que el adaptador saco de la ficha abierta. */
  readonly url: string;
}

/**
 * Abre la sesion de ScamShield desde el badge.
 *
 * Lo atiende el background porque el popup y las pestanas solo se abren desde
 * ahi. Asi el comprador no tiene que ir a buscar el icono en la barra.
 */
export interface AbrirSesionMensaje {
  readonly tipo: 'abrir-sesion';
}

/**
 * El background le pide su documento al content script de la pestana del
 * perfil. Es el unico mensaje que va en esa direccion.
 */
export interface DameDocumentoMensaje {
  readonly tipo: 'dame-documento';
}

/** Un evento de analitica que solo el content script puede observar. */
export interface AnaliticaMensaje {
  readonly tipo: 'analitica';
  readonly sesionId: string;
  readonly plataforma: string;
  /** Se reduce a dominio registrable en el background. Nunca viaja entera. */
  readonly url: string;
  readonly categoria: string;
  readonly evento: EventoDeContenido;
}

export type EventoDeContenido =
  | { readonly clase: 'sesion-iniciada' }
  | { readonly clase: 'ficha-detectada' }
  | { readonly clase: 'interaccion'; readonly interaccion: BloqueInteraccion };

/** Pregunta si toca ofrecer la encuesta tras una consulta que dio veredicto. */
export interface EncuestaOfertaMensaje {
  readonly tipo: 'encuesta-oferta';
}

export interface EncuestaEnvioMensaje {
  readonly tipo: 'encuesta-envio';
  readonly rating: number;
  readonly comment: string;
  /** La persona acepto participar. Sin esto no se envia nada. */
  readonly consentGiven: boolean;
  readonly consentVersion: string;
  readonly instrumentCode: string;
  readonly plataforma: string;
  /** URL de la ficha calificada. Se convierte en huella; no sale del navegador. */
  readonly url: string;
  readonly verdictKind: number;
  readonly verdictValue: number | null;
  readonly verdictConfidence: number | null;
}

/** La persona cerro la encuesta de ESTA consulta sin responder. No cierra nada mas. */
export interface EncuestaDescartadaMensaje {
  readonly tipo: 'encuesta-descartada';
}

/** La persona retira su consentimiento: se le volvera a pedir la casilla. */
export interface EncuestaRetirarConsentimientoMensaje {
  readonly tipo: 'encuesta-retirar-consentimiento';
}

export interface VeredictoRespuesta {
  readonly tipo: 'veredicto';
  readonly verdict: Verdict;
  /** Caracteristicas sobre las que se calculo el veredicto. */
  readonly features: FeatureSet;
  /** Evidencia de cada analizador, para la presentacion explicativa. */
  readonly detalles: Detalles;
}

/** El motor exige sesion y no hay ninguna activa. */
export interface SesionRequeridaRespuesta {
  readonly tipo: 'sesion-requerida';
}

/** `instrumento` en null significa que no toca preguntar. */
export interface EncuestaRespuesta {
  readonly tipo: 'encuesta';
  readonly instrumento: Instrumento | null;
  /** La persona ya acepto esta misma version del consentimiento. */
  readonly consentimientoVigente: boolean;
}

export interface EncuestaEnviadaRespuesta {
  readonly tipo: 'encuesta-enviada';
  readonly resultado: ResultadoDeEnvio;
}

/**
 * El documento del perfil del vendedor. `html` en null significa que no se pudo
 * leer: sin sesion en Facebook, o la pestana no llego a cargar. Entonces los
 * datos del vendedor quedan sin medir, que es lo correcto: no se rellenan.
 */
export interface PerfilRespuesta {
  readonly tipo: 'perfil';
  readonly html: string | null;
}

/** Acuse de recibo de lo que no devuelve nada. */
export interface ListoRespuesta {
  readonly tipo: 'listo';
}

export type Respuesta =
  | VeredictoRespuesta
  | PerfilRespuesta
  | SesionRequeridaRespuesta
  | EncuestaRespuesta
  | EncuestaEnviadaRespuesta
  | ListoRespuesta;

export type Mensaje =
  | EvaluarMensaje
  | AbrirSesionMensaje
  | RevisarVendedorMensaje
  | DameDocumentoMensaje
  | AnaliticaMensaje
  | EncuestaOfertaMensaje
  | EncuestaEnvioMensaje
  | EncuestaDescartadaMensaje
  | EncuestaRetirarConsentimientoMensaje;

/**
 * Guardas de runtime. Un mensaje que cruza el limite entre content script y
 * background llega como `unknown`: asumir su forma es exactamente el tipo de
 * atajo que este proyecto no se permite.
 */
const esTipo = (m: unknown, tipo: string): boolean =>
  typeof m === 'object' && m !== null && 'tipo' in m && m.tipo === tipo;

export const esEvaluarMensaje = (m: unknown): m is EvaluarMensaje => esTipo(m, 'evaluar');

export const esAnaliticaMensaje = (m: unknown): m is AnaliticaMensaje => esTipo(m, 'analitica');

export const esRevisarVendedor = (m: unknown): m is RevisarVendedorMensaje =>
  esTipo(m, 'revisar-vendedor');

export const esDameDocumento = (m: unknown): m is DameDocumentoMensaje =>
  esTipo(m, 'dame-documento');

export const esAbrirSesion = (m: unknown): m is AbrirSesionMensaje => esTipo(m, 'abrir-sesion');

export const esEncuestaOferta = (m: unknown): m is EncuestaOfertaMensaje =>
  esTipo(m, 'encuesta-oferta');

export const esEncuestaEnvio = (m: unknown): m is EncuestaEnvioMensaje =>
  esTipo(m, 'encuesta-envio');

export const esEncuestaDescartada = (m: unknown): m is EncuestaDescartadaMensaje =>
  esTipo(m, 'encuesta-descartada');

export const esEncuestaRetirarConsentimiento = (
  m: unknown,
): m is EncuestaRetirarConsentimientoMensaje => esTipo(m, 'encuesta-retirar-consentimiento');

export const esVeredictoRespuesta = (r: unknown): r is VeredictoRespuesta =>
  esTipo(r, 'veredicto');

export const esSesionRequerida = (r: unknown): r is SesionRequeridaRespuesta =>
  esTipo(r, 'sesion-requerida');

export const esEncuestaRespuesta = (r: unknown): r is EncuestaRespuesta => esTipo(r, 'encuesta');

export const esEncuestaEnviada = (r: unknown): r is EncuestaEnviadaRespuesta =>
  esTipo(r, 'encuesta-enviada');

export const esPerfilRespuesta = (r: unknown): r is PerfilRespuesta => esTipo(r, 'perfil');
