import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { adapterPara } from '../extraction/registry.js';
import { ScamShieldBadge } from '../ui/ScamShieldBadge.js';
import { esSesionRequerida, esVeredictoRespuesta, type EvaluarMensaje } from '../messaging.js';
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
  ],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    const adapter = adapterPara(location.href);
    if (adapter === null) return;

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

    // Al cargar la pagina NO se lee el DOM ni se consulta nada: solo se inserta
    // el badge. La extraccion ocurre cuando el comprador hace clic.
    const ancla = adapter.anclaBadge(document);

    const evaluar = async (): Promise<Evaluado | null> => {
      // Se entrega el documento tal como el navegador lo renderizo, sin
      // recortar: el backend acota al subarbol relevante. No se pide nada a la
      // plataforma para obtenerlo, y el badge vive en shadow DOM, asi que su
      // contenido no entra aqui.
      const mensaje: EvaluarMensaje = {
        tipo: 'evaluar',
        plataforma: publicacion.plataforma,
        publicacionId: publicacion.publicacionId,
        url: location.href,
        html: document.documentElement.outerHTML,
        // Se leen del DOM vivo porque el service worker de MV3 no tiene
        // DOMParser: el background no podria reconstruir el documento.
        insumos: adapter.insumos(document),
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

    let root: Root | undefined;
    const ui = await createShadowRootUi(ctx, {
      name: 'scamshield-badge',
      position: ancla !== null ? 'inline' : 'overlay',
      anchor: ancla ?? 'body',
      append: 'first',
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
          }),
        );
      },
      onRemove: () => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
