import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { analitica, cola, riskEngine, tokens } from '../config.js';
import {
  esAnaliticaMensaje,
  esEncuestaDescartada,
  esEncuestaEnvio,
  esEncuestaRetirarConsentimiento,
  esAbrirSesion,
  esHaySesion,
  esEncuestaOferta,
  esEvaluarMensaje,
  esPerfilRespuesta,
  esRevisarVendedor,
  type AnaliticaMensaje,
  type EncuestaEnvioMensaje,
  type Respuesta,
  type SesionCambiadaMensaje,
} from '../messaging.js';
import { SesionRequeridaError, SIN_DETALLES } from '../transport/RiskEngineClient.js';
import { indeterminado, FEATURE_IDS, type FeatureSet } from '../domain/features.js';
import { COOKIE, HOST_APP, abrirLogin, obtenerToken, sincronizarConCookie } from '../auth/sesion.js';
import { bloqueDeAnalisis } from '../analytics/desenlace.js';
import type { ContextoDeUso } from '../analytics/Analitica.js';
import { consentimientoVigente, debeOfrecerse } from '../domain/encuesta/criterio.js';
import { ALCANCE, plataformaDeEncuesta } from '../domain/encuesta/instrumento.js';
import type { Instrumento } from '../domain/encuesta/instrumento.js';
import { enviarRespuesta, obtenerInstrumento } from '../feedback/FeedbackClient.js';
import {
  leerEstadoDeEncuesta,
  registrarEnvio,
  retirarConsentimiento,
} from '../feedback/estado.js';
import { idDeInstalacion } from '../analytics/identidad.js';
import { guardarConsulta } from '../transport/HistoryClient.js';

const FALLO = 'No se pudo completar el analisis.';

/**
 * Cuanto se espera a que cargue el perfil del vendedor antes de rendirse.
 *
 * Facebook Marketplace no publica los datos del vendedor en la ficha: viven en
 * su perfil. La extension NO lo abre por su cuenta; lo abre aqui solo cuando el
 * comprador pulsa "Revisar al vendedor", en una pestana en segundo plano que se
 * cierra sola. Si no se pudo leer (sin sesion en Facebook, o no cargo), se
 * devuelve null y esos datos quedan sin medir: no se rellenan con ceros.
 */
const ESPERA_PERFIL_MS = 20_000;

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

/**
 * Avisa a las pestanas abiertas de que la sesion cambio, para que el badge deje
 * de pedir sesion sin que haya que recargar la pagina.
 *
 * Se manda a todas y se ignoran los fallos: en las pestanas donde no corre el
 * content script no hay quien lo reciba, y eso es normal.
 */
const avisarDeLaSesion = async (haySesion: boolean): Promise<void> => {
  const aviso: SesionCambiadaMensaje = { tipo: 'sesion-cambiada', haySesion };
  const pestanas = await browser.tabs.query({});
  await Promise.all(
    pestanas.map(async (pestana) => {
      if (pestana.id === undefined) return;
      try {
        await browser.tabs.sendMessage(pestana.id, aviso);
      } catch {
        // Ahi no corre el content script: no hay nada que avisar.
      }
    }),
  );
};

/**
 * Abre la sesion: el popup de la extension si el navegador lo permite, y si no,
 * la pagina de inicio de sesion en una pestana.
 *
 * `action.openPopup` solo existe en Chrome reciente y solo se puede llamar desde
 * el background; en Firefox y en Chrome viejo lanza, y entonces vale la pestana.
 */
const abrirSesion = async (): Promise<void> => {
  try {
    await browser.action.openPopup();
  } catch {
    await abrirLogin();
  }
};

/** Resuelve cuando la pestana termina de cargar, o al agotarse la espera. */
const cargada = (tabId: number, ms: number): Promise<void> =>
  new Promise((resolver) => {
    const terminar = (): void => {
      browser.tabs.onUpdated.removeListener(alCambiar);
      clearTimeout(reloj);
      resolver();
    };
    const alCambiar = (id: number, cambio: { status?: string }): void => {
      if (id === tabId && cambio.status === 'complete') terminar();
    };
    const reloj = setTimeout(terminar, ms);
    browser.tabs.onUpdated.addListener(alCambiar);
  });

/**
 * Abre el perfil del vendedor en segundo plano, le pide su documento al content
 * script que corre ahi, y cierra la pestana. Nunca se queda abierta: el cierre
 * va en `finally`, tambien cuando algo falla.
 */
const leerPerfilDelVendedor = async (url: string): Promise<string | null> => {
  let pestana: number | undefined;
  try {
    const abierta = await browser.tabs.create({ url, active: false });
    pestana = abierta.id;
    if (pestana === undefined) return null;
    await cargada(pestana, ESPERA_PERFIL_MS);
    const respuesta: unknown = await browser.tabs.sendMessage(pestana, { tipo: 'dame-documento' });
    return esPerfilRespuesta(respuesta) ? respuesta.html : null;
  } catch {
    // Sin sesion en Facebook, pestana cerrada a mano o content script ausente.
    return null;
  } finally {
    if (pestana !== undefined) {
      try {
        await browser.tabs.remove(pestana);
      } catch {
        // Ya no existe: la persona la cerro antes.
      }
    }
  }
};

export default defineBackground(() => {
  // La cookie del cliente web es la fuente de verdad de la sesion. El listener
  // va en el nivel superior a proposito: en MV3 el service worker se apaga, y
  // solo los eventos registrados aqui vuelven a despertarlo.
  browser.cookies.onChanged.addListener(({ cookie, removed }) => {
    if (cookie.name !== COOKIE) return;
    if (cookie.domain.replace(/^\./, '') !== HOST_APP) return;
    void sincronizarConCookie().then(() => avisarDeLaSesion(!removed));
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
        void ofrecerEncuesta().then((oferta) => {
          sendResponse({ tipo: 'encuesta', ...oferta });
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
        // "Ahora no" solo oculta la encuesta de esa consulta; no hay nada que guardar.
        sendResponse({ tipo: 'listo' });
        return false;
      }

      if (esHaySesion(mensaje)) {
        void obtenerToken().then((token) => {
          sendResponse({ tipo: 'sesion', haySesion: token !== null });
        });
        return true;
      }

      if (esAbrirSesion(mensaje)) {
        void abrirSesion();
        sendResponse({ tipo: 'listo' });
        return false;
      }

      if (esRevisarVendedor(mensaje)) {
        void leerPerfilDelVendedor(mensaje.url).then((html) => {
          sendResponse({ tipo: 'perfil', html });
        });
        return true;
      }

      if (esEncuestaRetirarConsentimiento(mensaje)) {
        void retirarConsentimiento();
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
          ...(mensaje.htmlVendedor !== undefined && { htmlVendedor: mensaje.htmlVendedor }),
        })
        .then(({ verdict, features, detalles, entradasModelo, traza }) => {
          // El veredicto sale PRIMERO. La analitica se encola despues y sin
          // esperar a nada: acumular en `storage.local` no puede meterse en el
          // camino de lo que el comprador esta esperando.
          sendResponse({ tipo: 'veredicto', verdict, features, detalles, entradasModelo });

          analitica.consultaResuelta(
            ctx,
            bloqueDeAnalisis({ verdict, features, detalles, traza, duracionMs: Date.now() - inicio }),
          );

          // Guardar la consulta en el historial y el vendedor en el ranking.
          // Se hace de forma asincrona sin bloquear la respuesta al usuario.
          const sellerName = mensaje.insumos.vendedor?.sellerName ?? '';
          void guardarConsulta(
            sellerName,
            mensaje.plataforma,
            mensaje.url,
            mensaje.publicacionId,
            verdict,
            features,
            tokens,
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
 * Decide si toca ofrecer la encuesta en esta consulta. El criterio vive en
 * `src/domain/encuesta/criterio.ts`; aqui solo se reunen sus datos.
 */
const ofrecerEncuesta = async (): Promise<{
  instrumento: Instrumento | null;
  consentimientoVigente: boolean;
}> => {
  const nada = { instrumento: null, consentimientoVigente: false };
  try {
    const estado = await leerEstadoDeEncuesta();
    const ahora = Date.now();
    // Antes de pedir el instrumento: si el tope local ya se alcanzo, no se hace
    // una peticion por analisis para no mostrar nada.
    if (!debeOfrecerse({ estado, huboVeredicto: true, moduloEncendido: true, ahora })) {
      return nada;
    }

    const instrumento = await instrumentoVigente();
    if (instrumento === null || !instrumento.moduleEnabled) return nada;

    return {
      instrumento,
      consentimientoVigente: consentimientoVigente(estado, instrumento.consentVersion),
    };
  } catch {
    // La encuesta jamas puede romper nada: ante la duda, no se ofrece.
    return nada;
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

  // Solo cuenta para el tope diario lo que el servidor acepto. Un 409 (ya
  // calificada), 429 o 503 no se anota: el servidor ya lleva su propia cuenta.
  if (resultado.tipo === 'registrada') await registrarEnvio(m.consentVersion);
  return resultado;
};
