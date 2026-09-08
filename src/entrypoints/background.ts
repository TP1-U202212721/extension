import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { riskEngine } from '../config.js';
import { esEvaluarMensaje, type Respuesta } from '../messaging.js';
import { SesionRequeridaError } from '../transport/HttpRiskEngineClient.js';
import { COOKIE, HOST_APP, obtenerToken, sincronizarConCookie } from '../auth/sesion.js';
import {
  consultarVeracidadDeDominio,
  type DetalleDominio,
} from '../transport/DomainVeracityClient.js';

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

      // El reporte exige sesion, sea cual sea el motor detras. El badge se
      // inyecta igual en la publicacion: lo que se retiene es el veredicto.
      let dominio: DetalleDominio | null = null;

      void obtenerToken()
        .then(async (token) => {
          if (token === null) throw new SesionRequeridaError();

          // Caracteristica 2: ya tiene endpoint real. Se resuelve antes de
          // decidir para que la politica vea el valor observado, no el hueco.
          const veracidad = await consultarVeracidadDeDominio(mensaje.url, token);
          dominio = veracidad.detalle;

          return riskEngine.evaluar({
            plataforma: mensaje.plataforma,
            publicacionId: mensaje.publicacionId,
            features: { ...mensaje.features, veracidadDeDominio: veracidad.feature },
          });
        })
        .then(({ verdict, features }) => {
          sendResponse({ tipo: 'veredicto', verdict, features, dominio });
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
            dominio,
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
