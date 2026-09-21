import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { cssSinRem } from './src/build/remAPx.js';

// Identificador permanente en AMO. Cambiarlo crea un add-on distinto y abandona
// la configuracion de todos los usuarios: no se toca.
const GECKO_ID = 'scamshield@upc.edu.pe';

/**
 * Dominios donde la extension se activa. Es la unica superficie donde la
 * extension lee nada, y solo lee: no navega, no pagina, no emite peticiones
 * hacia la plataforma del vendedor.
 */
export const MARKETPLACE_MATCHES = [
  '*://*.mercadolibre.com.pe/*',
  '*://*.mercadolibre.com/*',
  '*://*.amazon.com/*',
  '*://*.aliexpress.com/*',
  '*://*.temu.com/*',
  '*://*.facebook.com/*',
] as const;

/** Lo minimo del bundle de Rollup que toca el plugin; `vite` no es dependencia directa. */
interface ArchivoDelBundle {
  type: string;
  fileName: string;
  source?: unknown;
}

/**
 * Pasa los `rem` del CSS compilado a `px`: ver `src/build/remAPx.ts`, donde esta
 * la conversion y por que solo toca valores y no selectores.
 */
const pluginCssSinRem = () => ({
  name: 'scamshield-css-sin-rem',
  enforce: 'post' as const,
  generateBundle(_opciones: unknown, bundle: Record<string, ArchivoDelBundle>) {
    for (const archivo of Object.values(bundle)) {
      if (archivo.type === 'asset' && archivo.fileName.endsWith('.css') && typeof archivo.source === 'string') {
        archivo.source = cssSinRem(archivo.source);
      }
    }
  },
});

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],

  // WXT compila MV2 por defecto para Firefox y Safari. Aqui se fuerza MV3 en
  // los tres targets: es un requisito del proyecto, no un default heredado.
  manifestVersion: 3,

  // Sin auto-imports: los imports explicitos hacen el grafo de dependencias
  // legible y evitan que la capa de dominio arrastre APIs de navegador sin querer.
  imports: false,

  vite: () => ({
    plugins: [tailwindcss(), pluginCssSinRem()],
  }),

  manifest: ({ browser }) => ({
    name: 'ScamShield',
    description:
      'Estima el riesgo de una publicacion de venta leyendo la pagina que ya abriste, antes de que pagues.',
    default_locale: undefined,

    // `cookies` + host_permissions sobre el dominio del cliente web de ScamShield:
    // ahi el cliente web deja el token tras iniciar sesion, y leerlo evita
    // duplicar el login dentro de la extension. Sigue sin haber ni un permiso
    // sobre los marketplaces: a ellos no se les pide absolutamente nada.
    // `alarms` es lo que permite vaciar la cola de analitica: en MV3 el service
    // worker se apaga solo, y una alarma es lo unico que vuelve a despertarlo.
    // Sin ella la cola solo se vaciaria por umbral y lo acumulado podria
    // quedarse esperando indefinidamente.
    permissions: ['storage', 'cookies', 'alarms'],
    host_permissions: [
      'https://scamshield-api.ryzeon.me/*',
      'https://scamshield.ryzeon.me/*',
      'http://localhost:8081/*',
    ],

    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: GECKO_ID,
              strict_min_version: '121.0',
            },
          },
        }
      : {}),
  }),
});
