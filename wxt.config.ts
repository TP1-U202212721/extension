import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

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
] as const;

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
    plugins: [tailwindcss()],
  }),

  manifest: ({ browser }) => ({
    name: 'ScamShield',
    description:
      'Estima el riesgo de una publicacion de venta leyendo la pagina que ya abriste, antes de que pagues.',
    default_locale: undefined,

    // Solo storage, para guardar la sesion del comprador. No hace falta
    // `cookies` porque la extension inicia sesion por su cuenta contra la API,
    // ni host_permissions porque el backend responde con CORS abierto. Y no hay
    // ni un permiso sobre los marketplaces: no se les pide nada.
    // `cookies` + host_permissions SOLO sobre el dominio propio de ScamShield:
    // ahi el cliente web deja el token tras iniciar sesion, y leerlo evita
    // duplicar el login dentro de la extension. Sigue sin haber ni un permiso
    // sobre los marketplaces: a ellos no se les pide absolutamente nada.
    permissions: ['storage', 'cookies'],
    host_permissions: ['https://scamshield.ryzeon.dev/*'],

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
