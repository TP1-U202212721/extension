import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { adapterPara } from '../extraction/registry.js';
import { esperarElemento } from '../extraction/dom.js';
import { ScamShieldBadge } from '../ui/ScamShieldBadge.js';
import {
  esEncuestaEnviada,
  esEncuestaRespuesta,
  esSesionRequerida,
  esVeredictoRespuesta,
  type EncuestaDescartadaMensaje,
  type EncuestaRetirarConsentimientoMensaje,
  type EncuestaEnvioMensaje,
  type EncuestaOfertaMensaje,
  type EvaluarMensaje,
} from '../messaging.js';
import { EmisorDeContenido } from '../analytics/EmisorDeContenido.js';
import { nuevoIdDeSesion } from '../analytics/identidad.js';
import type { CanalDeEncuesta } from '../ui/ScamShieldBadge.js';
import { insertarBadgeTarjeta, limpiarBadgesTarjeta } from '../ui/badgeTarjeta.js';
import { indeterminado, FEATURE_IDS, type FeatureSet } from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import { SIN_DETALLES, type Detalles } from '../transport/RiskEngineClient.js';

interface Evaluado {
  readonly verdict: Verdict;
  readonly features: FeatureSet;
  readonly detalles: Detalles;
}
import '../ui/tailwind.css';

/**
 * Cuanto esperar a que aparezca el bloque de compra antes de fijar el badge en
 * una esquina. Temu lo pinta tarde, y a veces detras de una verificacion.
 */
const ESPERA_ANCLA_MS = 10_000;

const SIN_RESPUESTA: Verdict = {
  kind: 'evidencia-insuficiente',
  resueltas: [],
  sinResolver: [],
  dimensionesVacias: [],
  motivo: 'No se recibio una respuesta valida del motor de riesgo.',
};

const SIN_FEATURES: FeatureSet = Object.fromEntries(
  FEATURE_IDS.map((id) => [id, indeterminado('No se recibio una respuesta valida.')]),
) as unknown as FeatureSet;

export default defineContentScript({
  // Los dominios por pais son distintos sitios para el navegador, asi que hay
  // que enumerarlos: `*.amazon.*` no es un patron valido en un manifiesto.
  matches: [
    '*://*.mercadolibre.com.pe/*',
    '*://*.mercadolibre.com.ar/*',
    '*://*.mercadolibre.com.mx/*',
    '*://*.mercadolibre.cl/*',
    '*://*.mercadolibre.com.co/*',
    '*://*.mercadolibre.com/*',
    '*://*.amazon.com/*',
    '*://*.amazon.es/*',
    '*://*.amazon.com.mx/*',
    '*://*.amazon.com.br/*',
    '*://*.aliexpress.com/*',
    '*://*.aliexpress.us/*',
    '*://*.ebay.com/*',
    '*://*.ebay.es/*',
    '*://*.temu.com/*',
  ],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    const adapter = adapterPara(location.href);
    if (adapter === null) return;

    // Una sesion de uso por pestana con una ficha abierta. Vive en memoria y
    // muere con la pestana: es lo que el contrato pide, y no se guarda en
    // ningun sitio justamente para que muera.
    const emisor = new EmisorDeContenido(
      nuevoIdDeSesion(),
      adapter.plataforma,
      () => location.href,
      () => adapter.categoriaGruesa(document),
    );
    emisor.sesionIniciada();

    // Tarjetas de listado y carruseles: un enlace por tarjeta, sin veredicto.
    // Los carruseles se pueblan tarde, asi que se vuelve a recorrer cuando el
    // DOM cambia. Solo se lee el documento ya renderizado; no se pide nada.
    const marcarTarjetas = (): void => {
      for (const t of adapter.tarjetas(document)) insertarBadgeTarjeta(t);
    };
    marcarTarjetas();

    let pendiente = 0;
    const observador = new MutationObserver(() => {
      clearTimeout(pendiente);
      pendiente = window.setTimeout(marcarTarjetas, 300);
    });
    observador.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      observador.disconnect();
      clearTimeout(pendiente);
      limpiarBadgesTarjeta(document);
    });

    const publicacion = adapter.identificar(new URL(location.href));
    if (publicacion === null) return;

    emisor.fichaDetectada();

    // Al cargar la pagina NO se lee el DOM ni se consulta nada: solo se inserta
    // el badge. La extraccion ocurre cuando el comprador hace clic. Si el bloque
    // de compra todavia no esta pintado, se espera un poco antes de caer en la
    // posicion fija de respaldo.
    const ancla = await esperarElemento(
      document.body,
      () => adapter.anclaBadge(document),
      ESPERA_ANCLA_MS,
    );

    const evaluar = async (): Promise<Evaluado | null> => {
      const mensaje: EvaluarMensaje = {
        tipo: 'evaluar',
        plataforma: publicacion.plataforma,
        publicacionId: publicacion.publicacionId,
        url: location.href,
        html: document.documentElement.outerHTML,
        insumos: adapter.insumos(document),
        sesionId: emisor.sesionId,
        categoria: adapter.categoriaGruesa(document),
      };
      const bruto: unknown = await browser.runtime.sendMessage(mensaje);
      if (esSesionRequerida(bruto)) return null;
      if (esVeredictoRespuesta(bruto)) {
        const resultado: Evaluado = {
          verdict: bruto.verdict,
          features: bruto.features,
          detalles: bruto.detalles,
        };
        // Almacenar resultado en storage para que el popup pueda mostrarlo.
        await browser.storage.local.set({
          [`analisis:${location.href}`]: {
            ...resultado,
            plataforma: publicacion.plataforma,
            publicacionId: publicacion.publicacionId,
            timestamp: Date.now(),
          },
        });
        return resultado;
      }
      // Una respuesta ilegible se trata como falta de evidencia, nunca como seguridad.
      return { verdict: SIN_RESPUESTA, features: SIN_FEATURES, detalles: SIN_DETALLES };
    };

    /**
     * Que hizo el comprador DESPUES de ver la advertencia, que es la pregunta
     * que la tesis quiere responder.
     *
     * Un clic en un control de compra de la ficha es una observacion: ocurrio.
     * Irse de la pagina sin haberlo tocado es una aproximacion, y como tal esta
     * documentada en `EmisorDeContenido.abandonoTrasLaAdvertencia` y en el ADR.
     *
     * El listener va en captura y solo LEE el evento: no lo cancela, no lo
     * simula y no toca el flujo de compra del marketplace.
     */
    const selectoresDeCompra = adapter.selectoresDeCompra();
    if (selectoresDeCompra.length > 0) {
      const alClic = (e: Event): void => {
        const objetivo = e.target;
        if (!(objetivo instanceof Element)) return;
        try {
          if (objetivo.closest(selectoresDeCompra.join(',')) === null) return;
        } catch {
          return; // selector invalido: no se emite nada
        }
        emisor.continuoPeseALaAdvertencia();
      };
      document.addEventListener('click', alClic, { capture: true, passive: true });
      ctx.onInvalidated(() => {
        document.removeEventListener('click', alClic, { capture: true });
      });
    }

    const alSalir = (): void => {
      emisor.abandonoTrasLaAdvertencia();
    };
    // Los dos: `pagehide` cubre la navegacion y `visibilitychange` el cierre de
    // pestana, donde `pagehide` a veces llega tarde para mandar un mensaje. El
    // emisor se encarga de que solo se emita una vez.
    window.addEventListener('pagehide', alSalir);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') alSalir();
    });
    ctx.onInvalidated(() => {
      window.removeEventListener('pagehide', alSalir);
    });

    /**
     * La encuesta pasa por el background como todo lo demas: el content script
     * no habla con la red. El criterio de cuando ofrecerla no esta aqui sino en
     * `src/domain/encuesta/criterio.ts`; aqui solo se pregunta.
     */
    const encuesta: CanalDeEncuesta = {
      ofrecer: async () => {
        const peticion: EncuestaOfertaMensaje = { tipo: 'encuesta-oferta' };
        try {
          const r: unknown = await browser.runtime.sendMessage(peticion);
          return esEncuestaRespuesta(r) && r.instrumento !== null
            ? { instrumento: r.instrumento, consentimientoVigente: r.consentimientoVigente }
            : null;
        } catch {
          return null;
        }
      },
      enviar: async (respuesta) => {
        const peticion: EncuestaEnvioMensaje = {
          tipo: 'encuesta-envio',
          ...respuesta,
          plataforma: publicacion.plataforma,
          url: location.href,
        };
        try {
          const r: unknown = await browser.runtime.sendMessage(peticion);
          return esEncuestaEnviada(r) ? r.resultado.tipo : 'fallo';
        } catch {
          return 'fallo';
        }
      },
      descartar: () => {
        const peticion: EncuestaDescartadaMensaje = { tipo: 'encuesta-descartada' };
        void browser.runtime.sendMessage(peticion).catch(() => undefined);
      },
      retirarConsentimiento: () => {
        const peticion: EncuestaRetirarConsentimientoMensaje = {
          tipo: 'encuesta-retirar-consentimiento',
        };
        void browser.runtime.sendMessage(peticion).catch(() => undefined);
      },
    };

    let root: Root | undefined;
    const ui = await createShadowRootUi(ctx, {
      name: 'scamshield-badge',
      position: ancla !== null ? 'inline' : 'overlay',
      anchor: ancla ?? 'body',
      // Dentro de un contenedor va como primer hijo; junto a un control (el boton
      // de comprar), como hermano previo, para no taparlo.
      append: ancla !== null && adapter.insercionBadge?.(ancla) === 'antes' ? 'before' : 'first',
      onMount: (contenedor) => {
        // Un custom element no tiene display propio: sin esto el host queda
        // inline y el panel no ocupa lugar en el buybox.
        contenedor.style.display = 'block';
        contenedor.style.width = '100%';

        if (ancla === null) {
          // Sin anclaje reconocible, el badge no desaparece: se fija en una
          // esquina. Una remaquetacion degrada la ubicacion, no la funcion.
          contenedor.style.position = 'fixed';
          contenedor.style.top = '16px';
          contenedor.style.right = '16px';
          contenedor.style.width = '320px';
          contenedor.style.zIndex = '2147483647';
        }
        root = createRoot(contenedor);
        root.render(
          createElement(ScamShieldBadge, {
            plataforma: publicacion.plataforma,
            evaluar,
            interacciones: emisor,
            encuesta,
          }),
        );
      },
      onRemove: () => {
        root?.unmount();
      },
    });

    ui.mount();

    /**
     * Las fichas de AliExpress (y cualquier pagina hecha en React) vuelven a
     * pintar el bloque de compra un momento despues de cargar, y al hacerlo se
     * llevan el badge por delante: aparecia y desaparecia al segundo.
     *
     * En vez de crear un badge nuevo, se vuelve a colgar EL MISMO nodo. El arbol
     * de React sigue vivo mientras el nodo esta desenganchado, asi que no se
     * pierde nada: ni el veredicto ya calculado, ni el panel abierto, ni lo que
     * la persona estuviera escribiendo en la encuesta.
     *
     * El observador es barato: en la inmensa mayoria de mutaciones el nodo sigue
     * conectado y se sale en la primera linea. Las rafagas se agrupan en un solo
     * cuadro de animacion.
     */
    const host = ui.shadowHost;
    const colgar = (): void => {
      if (host.isConnected) return;
      const nueva = adapter.anclaBadge(document);
      // Sin ancla todavia: la proxima mutacion lo reintenta cuando aparezca.
      if (nueva === null) return;
      if (adapter.insercionBadge?.(nueva) === 'antes') nueva.before(host);
      else nueva.prepend(host);
    };

    let recolgarPendiente = false;
    const vigia = new MutationObserver(() => {
      if (recolgarPendiente || host.isConnected) return;
      recolgarPendiente = true;
      requestAnimationFrame(() => {
        recolgarPendiente = false;
        colgar();
      });
    });
    vigia.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      vigia.disconnect();
    });
  },
});
