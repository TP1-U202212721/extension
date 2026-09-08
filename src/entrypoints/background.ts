import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { riskEngine } from '../config.js';
import { esEvaluarMensaje, type Respuesta } from '../messaging.js';
import { SesionRequeridaError } from '../transport/HttpRiskEngineClient.js';
import { obtenerToken } from '../auth/sesion.js';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (mensaje: unknown, _sender, sendResponse: (r: Respuesta) => void) => {
      if (!esEvaluarMensaje(mensaje)) return false;

      // El reporte exige sesion, sea cual sea el motor detras. El badge se
      // inyecta igual en la publicacion: lo que se retiene es el veredicto.
      void obtenerToken()
        .then((token) => {
          if (token === null) throw new SesionRequeridaError();
          return riskEngine.evaluar({
            plataforma: mensaje.plataforma,
            publicacionId: mensaje.publicacionId,
            features: mensaje.features,
          });
        })
        .then(({ verdict, features }) => {
          sendResponse({ tipo: 'veredicto', verdict, features });
        })
        .catch((e: unknown) => {
          if (e instanceof SesionRequeridaError) {
            sendResponse({ tipo: 'sesion-requerida' });
            return;
          }
          // Un fallo del motor jamas se presenta como seguridad.
          sendResponse({
            tipo: 'veredicto',
            features: mensaje.features,
            verdict: {
              kind: 'evidencia-insuficiente',
              resueltas: [],
              sinResolver: [],
              dimensionesVacias: [],
              motivo: 'No se pudo completar la evaluacion.',
            },
          });
        });

      // true mantiene el canal abierto para la respuesta asincrona.
      return true;
    },
  );
});
