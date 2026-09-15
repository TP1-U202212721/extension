import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { riskEngine } from '../config.js';
import { esEvaluarMensaje, type Respuesta } from '../messaging.js';
import { SesionRequeridaError, SIN_DETALLES } from '../transport/RiskEngineClient.js';
import { indeterminado, FEATURE_IDS, type FeatureSet } from '../domain/features.js';
import { COOKIE, HOST_APP, sincronizarConCookie } from '../auth/sesion.js';

const FALLO = 'No se pudo completar el analisis.';

/**
 * Un fallo del motor deja a la extension sin ninguna caracteristica: con el
 * analisis en el servidor ya no queda una extraccion de cliente de la que tirar.
 * Es lo correcto, y se muestra como tal.
 */
const SIN_EVIDENCIA: FeatureSet = Object.fromEntries(
  FEATURE_IDS.map((id) => [id, indeterminado(FALLO)]),
) as unknown as FeatureSet;

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

  browser.runtime.onMessage.addListener(
    (mensaje: unknown, _sender, sendResponse: (r: Respuesta) => void) => {
      if (!esEvaluarMensaje(mensaje)) return false;

      void riskEngine
        .evaluar({
          plataforma: mensaje.plataforma,
          publicacionId: mensaje.publicacionId,
          url: mensaje.url,
          html: mensaje.html,
          insumos: mensaje.insumos,
        })
        .then(({ verdict, features, detalles }) => {
          sendResponse({ tipo: 'veredicto', verdict, features, detalles });
        })
        .catch((e: unknown) => {
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
