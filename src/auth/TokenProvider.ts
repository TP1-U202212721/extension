import { obtenerToken } from './sesion.js';

/**
 * De donde sale la credencial con la que se llama al backend.
 *
 * Existe como interfaz por una razon concreta y fechada: HOY los cuatro
 * endpoints del motor exigen autenticacion (`AuthMiddleware` deniega por
 * defecto y ninguno lleva `[AllowAnonymous]`), lo que choca con el requisito de
 * que la extension se pueda usar sin cuenta. El dia que se abran, el cambio es
 * sustituir la implementacion en src/config.ts y nada mas: ni los clientes ni el
 * motor conocen de donde viene el token.
 */
export interface TokenProvider {
  readonly id: string;
  /** null cuando no hay credencial disponible. */
  obtener(): Promise<string | null>;
}

/** Credencial de la sesion del comprador. Ver docs/adr/0003. */
export class SessionTokenProvider implements TokenProvider {
  readonly id = 'sesion';

  obtener(): Promise<string | null> {
    return obtenerToken();
  }
}

/**
 * Para el dia que los endpoints admitan consulta sin cuenta.
 *
 * No se usa todavia: con los endpoints como estan hoy, devolver null hace que
 * toda evaluacion termine en "sesion requerida". Esta aqui para que ese cambio
 * sea una linea en config.ts y no una reescritura.
 */
export class SinCuentaTokenProvider implements TokenProvider {
  readonly id = 'sin-cuenta';

  obtener(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
