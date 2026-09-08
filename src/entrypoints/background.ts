import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { riskEngine } from '../config.js';
import { esEvaluarMensaje, type VeredictoRespuesta } from '../messaging.js';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (mensaje: unknown, _sender, sendResponse: (r: VeredictoRespuesta) => void) => {
      if (!esEvaluarMensaje(mensaje)) return false;

      void riskEngine
        .evaluar({
          plataforma: mensaje.plataforma,
          publicacionId: mensaje.publicacionId,
          features: mensaje.features,
        })
        .then((verdict) => {
          sendResponse({ tipo: 'veredicto', verdict });
        })
        .catch(() => {
          // Un fallo del motor jamas se presenta como seguridad.
          sendResponse({
            tipo: 'veredicto',
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
