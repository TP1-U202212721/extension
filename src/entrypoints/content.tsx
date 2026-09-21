import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { adapterPara } from '../extraction/registry.js';
import type { Publicacion } from '../extraction/MarketplaceAdapter.js';
import { esperarElemento } from '../extraction/dom.js';
import { ScamShieldBadge } from '../ui/ScamShieldBadge.js';
import {
  esDameDocumento,
  esSesionCambiada,
  esSesionRespuesta,
  esEncuestaEnviada,
  esEncuestaRespuesta,
  esPerfilRespuesta,
  esSesionRequerida,
  esVeredictoRespuesta,
  type AbrirSesionMensaje,
  type PerfilRespuesta,
  type RevisarVendedorMensaje,
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
import type { Insumos } from '../domain/insumos.js';

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

/** La misma pila de Tailwind, fijada a mano porque el shadow root hereda la de la pagina. */
const TIPOGRAFIA =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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
    '*://*.facebook.com/*',
  ],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  main(ctx) {
    // En Facebook Marketplace los datos del vendedor no estan en la ficha sino
    // en su perfil. Cuando el comprador pide revisarlo, el background abre ese
    // perfil en segundo plano y le pide su documento a ESTE listener, que corre
    // en la pestana del perfil. Se registra antes de cualquier otra cosa porque
    // ahi no hay ficha que identificar y el resto de `main` se sale enseguida.
    /** Quien quiere enterarse de que la sesion acaba de iniciarse. */
    const alIniciarSesion = new Set<() => void>();

    browser.runtime.onMessage.addListener(
      (mensaje: unknown, _emisor, responder: (r: PerfilRespuesta) => void) => {
        if (esSesionCambiada(mensaje)) {
          if (mensaje.haySesion) for (const avisar of alIniciarSesion) avisar();
          return false;
        }
        if (!esDameDocumento(mensaje)) return false;
        const suyo = adapterPara(location.href);
        responder({
          tipo: 'perfil',
          html: suyo?.documentoParaAnalizar?.(document) ?? document.documentElement.outerHTML,
        });
        return false;
      },
    );

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

    /**
     * Monta el badge para UNA publicacion y devuelve como desmontarlo.
     *
     * Facebook cambia de publicacion sin recargar la pagina, asi que esto se
     * vuelve a ejecutar en cada cambio de URL: el content script solo corre una
     * vez, y sin esto el badge se quedaba en la primera ficha.
     */
    const montarFicha = async (publicacion: Publicacion): Promise<() => void> => {
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

    /**
     * El perfil del vendedor, cuando la plataforma lo necesita. Se lee al
     * analizar, no al cargar la pagina: hasta que el comprador no pulsa el badge,
     * la extension no abre nada.
     */
    let htmlVendedor: string | undefined;

    /**
     * Los insumos de la ficha, completados con lo que diga el perfil.
     *
     * En Facebook la ficha no publica al vendedor ni sus valoraciones: eso vive
     * en su perfil, y sin esto los analizadores de reputacion y de resenas se
     * quedarian sin nada que mirar.
     */
    const insumosConPerfil = (): Insumos => {
      const deLaFicha = adapter.insumos(document);
      if (htmlVendedor === undefined) return deLaFicha;

      const perfil = new DOMParser().parseFromString(htmlVendedor, 'text/html');
      const delPerfil = adapter.insumos(perfil);
      return {
        vendedor: delPerfil.vendedor ?? deLaFicha.vendedor,
        resenas: delPerfil.resenas.length > 0 ? delPerfil.resenas : deLaFicha.resenas,
        categoria: deLaFicha.categoria,
      };
    };

    /**
     * Pide el perfil del vendedor y lo guarda para la evaluacion.
     *
     * Devuelve false si no se pudo leer (sin sesion en Facebook, o la pestana no
     * cargo): entonces el veredicto sale sin los datos del vendedor y el panel
     * ofrece reintentarlo.
     */
    const traerPerfil = async (): Promise<boolean> => {
      const perfil = adapter.perfilDelVendedor?.(document) ?? null;
      if (perfil === null) return false;

      // Sin sesion el analisis no va a salir igual: no se abre nada.
      const sesion: unknown = await browser.runtime.sendMessage({ tipo: 'hay-sesion' });
      if (!esSesionRespuesta(sesion) || !sesion.haySesion) return false;

      const peticion: RevisarVendedorMensaje = { tipo: 'revisar-vendedor', url: perfil };
      const bruto: unknown = await browser.runtime.sendMessage(peticion);
      if (!esPerfilRespuesta(bruto) || bruto.html === null) return false;

      htmlVendedor = bruto.html;
      return true;
    };

    const evaluar = async (): Promise<Evaluado | null> => {
      // En Facebook los datos del vendedor viven en su perfil: se abre en segundo
      // plano ANTES de evaluar, se lee y se cierra, para no pedir un clic de mas.
      if (htmlVendedor === undefined) await traerPerfil();

      const mensaje: EvaluarMensaje = {
        tipo: 'evaluar',
        plataforma: publicacion.plataforma,
        publicacionId: publicacion.publicacionId,
        url: location.href,
        html: adapter.documentoParaAnalizar?.(document) ?? document.documentElement.outerHTML,
        insumos: insumosConPerfil(),
        sesionId: emisor.sesionId,
        categoria: adapter.categoriaGruesa(document),
        ...(htmlVendedor !== undefined && { htmlVendedor }),
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
     * Reintento manual de la lectura del perfil, para cuando la automatica fallo.
     * Es undefined en las plataformas que no necesitan perfil.
     */
    const revisarVendedor =
      adapter.perfilDelVendedor === undefined
        ? undefined
        : async (): Promise<Evaluado | null> => ((await traerPerfil()) ? evaluar() : null);

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

    // Capa de los paneles flotantes, colgada del <html> y no de la ficha: asi
    // ningun contenedor del marketplace (con transform, overflow o su propio
    // z-index) recorta ni tapa el reporte. Ver FLOTANTE en ScamShieldBadge.
    let capa: HTMLElement | null = null;
    const uiCapa = await createShadowRootUi(ctx, {
      name: 'scamshield-capa',
      position: 'inline',
      anchor: document.documentElement,
      append: 'last',
      onMount: (contenedor) => {
        // La fuente se fija aqui: dentro del shadow root se hereda la de la
        // pagina, y en Facebook o en un sitio con serif el panel salia en Times.
        contenedor.style.fontFamily = TIPOGRAFIA;
        capa = contenedor;
      },
    });
    uiCapa.mount();

    let root: Root | undefined;
    const ui = await createShadowRootUi(ctx, {
      name: 'scamshield-badge',
      position: ancla !== null ? 'inline' : 'overlay',
      // Sin ancla cuelga del <html>, no del <body>: Facebook pone `transform` en
      // sus contenedores, y ahi dentro la posicion fija del respaldo se mide
      // contra ellos, no contra la ventana, y el badge queda descolocado.
      anchor: ancla ?? document.documentElement,
      // Dentro de un contenedor va como primer hijo; junto a un control (el boton
      // de comprar), como hermano previo, para no taparlo.
      append: ancla !== null && adapter.insercionBadge?.(ancla) === 'antes' ? 'before' : 'first',
      onMount: (contenedor) => {
        // Un custom element no tiene display propio: sin esto el host queda
        // inline y el panel no ocupa lugar en el buybox.
        contenedor.style.display = 'block';
        contenedor.style.width = '100%';
        contenedor.style.fontFamily = TIPOGRAFIA;

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
            suscribirseASesion: (avisar: () => void) => {
              alIniciarSesion.add(avisar);
              return () => alIniciarSesion.delete(avisar);
            },
            abrirSesion: () => {
              const peticion: AbrirSesionMensaje = { tipo: 'abrir-sesion' };
              void browser.runtime.sendMessage(peticion).catch(() => undefined);
            },
            capa,
            ...(revisarVendedor !== undefined && {
              revisarVendedor,
              perfilLeido: () => htmlVendedor !== undefined,
            }),
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
     * No basta con mirar si sigue enganchado: Facebook deja copias OCULTAS de sus
     * botones (miden 0x0) y, al cambiar de publicacion sin recargar, el badge
     * quedaba colgado de una de ellas. Por eso se comprueba que ocupe sitio.
     *
     * El observador es barato: en la inmensa mayoria de mutaciones el nodo sigue
     * conectado y se sale en la primera linea. Las rafagas se agrupan en un solo
     * cuadro de animacion.
     */
    const host = ui.shadowHost;
    // Un custom element es `inline` por defecto: sin esto no ocupa su ancho.
    host.style.display = 'block';

    /** Esta en el arbol Y ocupa sitio. Lo segundo no es redundante: ver abajo. */
    const seVe = (): boolean => {
      if (!host.isConnected) return false;
      const caja = host.getBoundingClientRect();
      return caja.width > 0 && caja.height > 0;
    };

    const colgar = (): void => {
      if (seVe()) return;
      const nueva = adapter.anclaBadge(document);
      // Sin ancla visible todavia: la proxima mutacion lo reintenta.
      if (nueva === null) return;
      if (adapter.insercionBadge?.(nueva) === 'antes') nueva.before(host);
      else nueva.prepend(host);
    };

    let recolgarPendiente = false;
    const vigia = new MutationObserver(() => {
      if (recolgarPendiente) return;
      recolgarPendiente = true;
      requestAnimationFrame(() => {
        recolgarPendiente = false;
        colgar();
      });
    });
    vigia.observe(document.body, { childList: true, subtree: true });

      return () => {
        vigia.disconnect();
        ui.remove();
        uiCapa.remove();
      };
    };

    let desmontar: (() => void) | null = null;
    let fichaMontada: string | null = null;

    const sincronizarConLaUrl = (): void => {
      const publicacion = adapter.identificar(new URL(location.href));
      if (publicacion?.publicacionId === fichaMontada) return;

      desmontar?.();
      desmontar = null;
      fichaMontada = null;
      if (publicacion === null) return;

      fichaMontada = publicacion.publicacionId;
      void montarFicha(publicacion).then((quitar) => {
        // Si mientras se montaba la persona ya se fue a otra ficha, se descarta.
        if (fichaMontada === publicacion.publicacionId) desmontar = quitar;
        else quitar();
      });
    };

    sincronizarConLaUrl();

    // Facebook navega entre publicaciones sin recargar: WXT avisa del cambio.
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      sincronizarConLaUrl();
    });

    ctx.onInvalidated(() => {
      desmontar?.();
    });
  },
});
