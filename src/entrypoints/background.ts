import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { indeterminado, type FeatureSet } from '../domain/features.js';
import { riskEngine } from '../config.js';

const FALLO = 'No se pudo completar el analisis.';
import { esEvaluarMensaje, type Respuesta } from '../messaging.js';
import { SesionRequeridaError } from '../transport/HttpRiskEngineClient.js';
import { COOKIE, HOST_APP, obtenerToken, sincronizarConCookie } from '../auth/sesion.js';
import {
  consultarVeracidadDeDominio,
  type DetalleDominio,
} from '../transport/DomainVeracityClient.js';
import { analizarDocumento, type DetalleDocumento } from '../transport/DocumentAnalysisClient.js';

/**
 * Con el analisis en el servidor, un fallo del motor deja a la extension sin
 * ninguna caracteristica: ya no queda una extraccion de cliente de la que tirar.
 * Es lo correcto, y se muestra como tal.
 */
const SIN_EVIDENCIA: FeatureSet = {
  proteccionDePago: indeterminado(FALLO),
  puntuacionDelProducto: indeterminado(FALLO),
  presenciaDeResenas: indeterminado(FALLO),
  politicasDeGarantia: indeterminado(FALLO),
  volumenDeVentas: indeterminado(FALLO),
  reputacionDelVendedor: indeterminado(FALLO),
  autenticidadDeResenas: indeterminado(FALLO),
  veracidadDeDominio: indeterminado(FALLO),
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

  browser.runtime.onMessage.addListener(
    (mensaje: unknown, _sender, sendResponse: (r: Respuesta) => void) => {
      if (!esEvaluarMensaje(mensaje)) return false;

      // El reporte exige sesion, sea cual sea el motor detras. El badge se
      // inyecta igual en la publicacion: lo que se retiene es el veredicto.
      let dominio: DetalleDominio | null = null;
      let documento: DetalleDocumento | null = null;

      void obtenerToken()
        .then(async (token) => {
          if (token === null) throw new SesionRequeridaError();

          // Los dos analisis son independientes, asi que van en paralelo: uno
          // lee el documento y el otro consulta el dominio. Secuenciarlos solo
          // sumaria sus latencias.
          const [doc, veracidad] = await Promise.all([
            analizarDocumento(mensaje.url, mensaje.html, token),
            consultarVeracidadDeDominio(mensaje.url, token),
          ]);
          documento = doc.detalle;
          dominio = veracidad.detalle;

          return riskEngine.evaluar({
            plataforma: mensaje.plataforma,
            publicacionId: mensaje.publicacionId,
            features: { ...doc.features, veracidadDeDominio: veracidad.feature },
          });
        })
        .then(({ verdict, features }) => {
          sendResponse({ tipo: 'veredicto', verdict, features, dominio, documento });
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
            dominio,
            documento,
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
