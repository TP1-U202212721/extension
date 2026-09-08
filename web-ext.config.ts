import { defineWebExtConfig } from 'wxt';

/**
 * Arranque del navegador en desarrollo.
 *
 * web-ext crea un perfil limpio en cada `pnpm dev`, para no tocar el perfil real
 * del navegador. Eso significa que no hay sesiones iniciadas ni otras
 * extensiones: es un Chrome vacio con esta extension cargada.
 */
export default defineWebExtConfig({
  // Abre directo en una ficha real de MercadoLibre, que es donde la extension
  // se activa. Sin esto arranca en una pestana en blanco y hay que navegar.
  startUrls: [
    'https://www.mercadolibre.com.pe/hidrolavadora-inalambrica-20v-tpwli20362-total/up/MPEU3173976853',
  ],
});
