/**
 * Base de la API. Vive aparte de src/config.ts a proposito: config construye el
 * motor, el motor construye los clientes y los clientes necesitan esta
 * constante. Tenerla en config creaba un ciclo de importacion que rompia la
 * inicializacion del modulo en tiempo de ejecucion.
 */
export const API_BASE_URL = 'https://scamshield-api.ryzeon.me/api/v1';
