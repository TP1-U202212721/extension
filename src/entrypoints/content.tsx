import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { adapterPara } from '../extraction/registry.js';
import { ScamShieldBadge } from '../ui/ScamShieldBadge.js';
import { esSesionRequerida, esVeredictoRespuesta, type EvaluarMensaje } from '../messaging.js';
import { insertarBadgeTarjeta, limpiarBadgesTarjeta } from '../ui/badgeTarjeta.js';
import type { FeatureSet } from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import '../ui/tailwind.css';

const SIN_RESPUESTA: Verdict = {
  kind: 'evidencia-insuficiente',
  resueltas: [],
  sinResolver: [],
  dimensionesVacias: [],
  motivo: 'No se recibio una respuesta valida del motor de riesgo.',
};

export default defineContentScript({
  matches: [
    '*://*.mercadolibre.com.pe/*',
    '*://*.mercadolibre.com/*',
    '*://*.amazon.com/*',
    '*://*.aliexpress.com/*',
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

    const evaluar = async (
      features: FeatureSet,
    ): Promise<{ verdict: Verdict; features: FeatureSet } | null> => {
      const mensaje: EvaluarMensaje = {
        tipo: 'evaluar',
        plataforma: publicacion.plataforma,
        publicacionId: publicacion.publicacionId,
        features,
      };
      const bruto: unknown = await browser.runtime.sendMessage(mensaje);
      if (esSesionRequerida(bruto)) return null;
      if (esVeredictoRespuesta(bruto)) return { verdict: bruto.verdict, features: bruto.features };
      // Una respuesta ilegible se trata como falta de evidencia, nunca como seguridad.
      return { verdict: SIN_RESPUESTA, features };
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
            extraer: () => adapter.extraer(document),
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
