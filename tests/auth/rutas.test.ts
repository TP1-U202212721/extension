import { describe, expect, it, vi } from 'vitest';

// sesion.ts importa el navegador; para comprobar las rutas no hace falta.
vi.mock('wxt/browser', () => ({ browser: {} }));

const { APP_WEB, HOST_APP, URL_LOGIN, URL_REGISTRO } = await import('../../src/auth/sesion.js');

/**
 * Regresion: APP_WEB llevaba la ruta /login pegada y el boton de iniciar sesion
 * abria /login/login. Ademas HOST_APP apuntaba a un dominio viejo, asi que la
 * extension ignoraba la cookie del cliente web y nunca veia la sesion.
 */
describe('rutas del cliente web', () => {
  it('APP_WEB es un origen, sin ruta', () => {
    expect(new URL(APP_WEB).pathname).toBe('/');
    expect(APP_WEB.endsWith('/')).toBe(false);
  });

  it('el login y el registro cuelgan de la raiz, una sola vez', () => {
    expect(URL_LOGIN).toBe('https://scamshield.ryzeon.me/login');
    expect(URL_REGISTRO).toBe('https://scamshield.ryzeon.me/register');
  });

  it('la cookie se escucha en el mismo dominio que abre el login', () => {
    expect(HOST_APP).toBe(new URL(URL_LOGIN).hostname);
  });
});
