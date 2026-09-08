import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { adapterPara } from '../extraction/registry.js';
import { VerdictPanel } from '../ui/VerdictPanel.js';
import type { Verdict } from '../domain/verdict.js';
import { esVeredictoRespuesta, type EvaluarMensaje } from '../messaging.js';
import '../ui/tailwind.css';

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

    const publicacion = adapter.identificar(new URL(location.href));
    if (publicacion === null) return;

    // Unica lectura de la pagina: el documento que el navegador ya renderizo.
    // No se navega, no se pagina, no se emite ninguna peticion a la plataforma.
    const features = adapter.extraer(document);

    const mensaje: EvaluarMensaje = {
      tipo: 'evaluar',
      plataforma: publicacion.plataforma,
      publicacionId: publicacion.publicacionId,
      features,
    };
    const bruto: unknown = await browser.runtime.sendMessage(mensaje);
    // Una respuesta ilegible se trata como falta de evidencia, nunca como seguridad.
    const verdict: Verdict = esVeredictoRespuesta(bruto)
      ? bruto.verdict
      : {
          kind: 'evidencia-insuficiente',
          resueltas: [],
          sinResolver: [],
          dimensionesVacias: [],
          motivo: 'No se recibio una respuesta valida del motor de riesgo.',
        };

    let root: Root | undefined;
    const ui = await createShadowRootUi(ctx, {
      name: 'scamshield-panel',
      position: 'overlay',
      anchor: 'body',
      onMount: (contenedor) => {
        contenedor.style.position = 'fixed';
        contenedor.style.top = '16px';
        contenedor.style.right = '16px';
        contenedor.style.zIndex = '2147483647';
        root = createRoot(contenedor);
        root.render(
          createElement(VerdictPanel, {
            verdict,
            features,
            plataforma: publicacion.plataforma,
            onCerrar: () => {
              ui.remove();
            },
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
