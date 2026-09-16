import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { analitica, cola, riskEngine } from '../config.js';
import {
  esAnaliticaMensaje,
  esEncuestaDescartada,
  esEncuestaEnvio,
  esEncuestaOferta,
  esEvaluarMensaje,
  type AnaliticaMensaje,
  type EncuestaEnvioMensaje,
  type Respuesta,
} from '../messaging.js';
import { SesionRequeridaError, SIN_DETALLES } from '../transport/RiskEngineClient.js';
import { indeterminado, FEATURE_IDS, type FeatureSet } from '../domain/features.js';
import { COOKIE, HOST_APP, sincronizarConCookie } from '../auth/sesion.js';
import { bloqueDeAnalisis } from '../analytics/desenlace.js';
import type { ContextoDeUso } from '../analytics/Analitica.js';
import { debeOfrecerse, MINIMO_CONSULTAS } from '../domain/encuesta/criterio.js';
import { ALCANCE, plataformaDeEncuesta } from '../domain/encuesta/instrumento.js';
import type { Instrumento } from '../domain/encuesta/instrumento.js';
import { enviarRespuesta, obtenerInstrumento } from '../feedback/FeedbackClient.js';
import { cerrarEncuesta, registrarConsultaResuelta } from '../feedback/estado.js';
import { idDeInstalacion } from '../analytics/identidad.js';

const FALLO = 'No se pudo completar el analisis.';

/**
 * Un fallo del motor deja a la extension sin ninguna caracteristica: con el
 * analisis en el servidor ya no queda una extraccion de cliente de la que tirar.
 * Es lo correcto, y se muestra como tal.
 */
const SIN_EVIDENCIA: FeatureSet = Object.fromEntries(
  FEATURE_IDS.map((id) => [id, indeterminado(FALLO)]),
) as unknown as FeatureSet;

/**
 * El instrumento vigente, cacheado mientras viva el service worker.
 *
 * No se pide en cada veredicto: la encuesta se ofrece una sola vez por
 * instalacion, asi que consultarlo siempre seria una peticion por analisis para
 * casi siempre no mostrar nada.
 */
let instrumentoEnMemoria: Instrumento | null = null;

const instrumentoVigente = async (): Promise<Instrumento | null> => {
  instrumentoEnMemoria ??= await obtenerInstrumento();
  return instrumentoEnMemoria;
};

export default defineBackground(() => {
  // La cookie del cliente web es la fuente de verdad de la sesion. El listener
  // va en el nivel superior a proposito: en MV3 el service worker se apaga, y
  // solo los eventos registrados aqui vuelven a despertarlo.
  browser.cookies.onChanged.addListener(({ cookie }) => {
    if (cookie.name !== COOKIE) return;
    if (cookie.domain.replace(/^\./, '') !== HOST_APP) return;
    void sincronizarConCookie();
  });

  // Al arrancar puede haber una sesion abierta de antes de instalar la extension.
  void sincronizarConCookie();

  // La cola de analitica sobrevive al cierre del navegador en `storage.local`;
  // la alarma es lo unico que vuelve a despertar al worker para vaciarla.
  void cola.programar();
  browser.alarms.onAlarm.addListener((alarma) => {
    if (cola.esNuestraAlarma(alarma.name)) cola.vaciar();
  });
  // Al arrancar puede haber quedado un lote a medio enviar de la sesion anterior.
  cola.vaciar();

  browser.runtime.onMessage.addListener(
    (mensaje: unknown, _sender, sendResponse: (r: Respuesta) => void) => {
      if (esAnaliticaMensaje(mensaje)) {
        registrarEventoDeContenido(mensaje);
        sendResponse({ tipo: 'listo' });
        return false;
      }

      if (esEncuestaOferta(mensaje)) {
        void ofrecerEncuesta().then((instrumento) => {
          sendResponse({ tipo: 'encuesta', instrumento });
        });
        return true;
      }

      if (esEncuestaEnvio(mensaje)) {
        void responderEncuesta(mensaje).then((resultado) => {
          sendResponse({ tipo: 'encuesta-enviada', resultado });
        });
        return true;
      }

      if (esEncuestaDescartada(mensaje)) {
        void cerrarEncuesta('descartada');
        sendResponse({ tipo: 'listo' });
        return false;
      }

      if (!esEvaluarMensaje(mensaje)) return false;

      const ctx: ContextoDeUso = {
        sesionId: mensaje.sesionId,
        plataforma: mensaje.plataforma,
        url: mensaje.url,
        categoria: mensaje.categoria,
      };

      analitica.consultaEnviada(ctx);
      const inicio = Date.now();

      void riskEngine
        .evaluar({
          plataforma: mensaje.plataforma,
          publicacionId: mensaje.publicacionId,
          url: mensaje.url,
          html: mensaje.html,
          insumos: mensaje.insumos,
        })
        .then(({ verdict, features, detalles, traza }) => {
          // El veredicto sale PRIMERO. La analitica se encola despues y sin
          // esperar a nada: acumular en `storage.local` no puede meterse en el
          // camino de lo que el comprador esta esperando.
          sendResponse({ tipo: 'veredicto', verdict, features, detalles });

          analitica.consultaResuelta(
            ctx,
            bloqueDeAnalisis({ verdict, features, detalles, traza, duracionMs: Date.now() - inicio }),
          );
        })
        .catch((e: unknown) => {
          analitica.consultaFallida(ctx);

          if (e instanceof SesionRequeridaError) {
            sendResponse({ tipo: 'sesion-requerida' });
            return;
          }
          // Un fallo del motor jamas se presenta como seguridad.
          sendResponse({
            tipo: 'veredicto',
            features: SIN_EVIDENCIA,
            detalles: SIN_DETALLES,
            verdict: {
              kind: 'evidencia-insuficiente',
              resueltas: [],
              sinResolver: [],
              dimensionesVacias: [],
              motivo: FALLO,
            },
          });
        });

      // true mantiene el canal abierto para la respuesta asincrona.
      return true;
    },
  );
});

const registrarEventoDeContenido = (m: AnaliticaMensaje): void => {
  const ctx: ContextoDeUso = {
    sesionId: m.sesionId,
    plataforma: m.plataforma,
    url: m.url,
    categoria: m.categoria,
  };

  if (m.evento.clase === 'sesion-iniciada') analitica.sesionIniciada(ctx);
  else if (m.evento.clase === 'ficha-detectada') analitica.fichaDetectada(ctx);
  else analitica.interaccion(ctx, m.evento.interaccion);
};

/**
 * Decide si toca ofrecer la encuesta, y de paso cuenta la consulta.
 *
 * La cuenta se incrementa AQUI y no al emitir el veredicto para que no haya dos
 * caminos que la toquen: el content script pregunta exactamente una vez por
 * cada consulta que llego a veredicto, asi que una pregunta es una consulta.
 */
const ofrecerEncuesta = async (): Promise<Instrumento | null> => {
  try {
    const estado = await registrarConsultaResuelta();
    // Antes del minimo no se pide el instrumento siquiera: seria una peticion
    // por analisis para no mostrar nada.
    if (estado.desenlace !== 'pendiente' || estado.consultasResueltas < MINIMO_CONSULTAS) {
      return null;
    }

    const instrumento = await instrumentoVigente();
    if (instrumento === null) return null;

    return debeOfrecerse({
      estado,
      huboVeredicto: true,
      moduloEncendido: instrumento.moduleEnabled,
    })
      ? instrumento
      : null;
  } catch {
    // La encuesta jamas puede romper nada: ante la duda, no se ofrece.
    return null;
  }
};

const responderEncuesta = async (m: EncuestaEnvioMensaje) => {
  const resultado = await enviarRespuesta({
    respondentId: await idDeInstalacion(),
    rating: m.rating,
    comment: m.comment,
    consentGiven: m.consentGiven,
    consentVersion: m.consentVersion,
    instrumentCode: m.instrumentCode,
    // Se opina sobre una consulta concreta: es lo que permite cruzar la
    // satisfaccion con el veredicto que la persona vio.
    scope: ALCANCE.unaConsulta,
    platform: plataformaDeEncuesta(m.plataforma),
    consulta: m.url,
    verdictKind: m.verdictKind,
    verdictValue: m.verdictValue,
    verdictConfidence: m.verdictConfidence,
  });

  if (resultado.tipo !== 'fallo') {
    await cerrarEncuesta(resultado.tipo === 'registrada' ? 'enviada' : 'descartada');
  }
  return resultado;
};
