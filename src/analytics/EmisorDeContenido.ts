import { browser } from 'wxt/browser';
import {
  INTERACCION,
  type BloqueInteraccion,
  type TipoInteraccion,
  type VeredictoAnalitica,
} from '../domain/analitica/eventos.js';
import type { AnaliticaMensaje, EventoDeContenido } from '../messaging.js';

/**
 * Lo que solo el content script puede observar: que la advertencia aparecio en
 * pantalla, que el comprador la expandio, y que hizo despues.
 *
 * No manda nada por la red: empuja el evento al background, que es quien tiene
 * la cola. Asi la analitica no depende del CSP del marketplace y un cambio de
 * pagina no se lleva por delante lo acumulado.
 *
 * ── EL RELOJ DE LA DECISION ─────────────────────────────────────────────────
 * `millisecondsToDecision` se mide desde el `kind: 1` de ESTA advertencia, que
 * es la unica referencia que el contrato acepta. Por eso el instante vive aqui
 * dentro y no en cada llamador: si cada sitio midiera por su cuenta, dos
 * interacciones de la misma advertencia podrian reportar origenes distintos.
 */
export class EmisorDeContenido {
  #mostradaEn: number | null = null;
  #veredictoEnPantalla: VeredictoAnalitica | null = null;
  /** El comprador ya mostro intencion de compra sobre esta advertencia. */
  #continuo = false;
  /** El desenlace 6 y el 7 son excluyentes y se emiten una sola vez. */
  #desenlaceEmitido = false;

  constructor(
    /** Publico: el mensaje de evaluacion lo lleva para que el background emita en la misma sesion. */
    readonly sesionId: string,
    private readonly plataforma: string,
    /** Se lee al emitir: en una SPA la ficha cambia sin recargar. */
    private readonly urlActual: () => string,
    private readonly categoria: () => string,
  ) {}

  sesionIniciada(): void {
    this.#mandar({ clase: 'sesion-iniciada' });
  }

  /**
   * En una SPA (Facebook) se pasa de una ficha a otra sin `pagehide`: detectar
   * una ficha nueva es la unica senal de que la anterior se dejo. Se cierra su
   * desenlace antes de olvidarla; si no, esas advertencias quedaban sin ninguno.
   */
  fichaDetectada(): void {
    this.abandonoTrasLaAdvertencia();
    this.#veredictoEnPantalla = null;
    this.#mostradaEn = null;
    this.#mandar({ clase: 'ficha-detectada' });
  }

  /**
   * La advertencia aparecio. Es el denominador de todas las tasas de
   * interaccion: sin esto, no hay contra que medir si el comprador hizo caso.
   */
  advertenciaMostrada(veredicto: VeredictoAnalitica): void {
    this.#mostradaEn = Date.now();
    this.#veredictoEnPantalla = veredicto;
    this.#continuo = false;
    this.#desenlaceEmitido = false;
    this.#interaccion(INTERACCION.advertenciaMostrada, { conReloj: false });
  }

  advertenciaExpandida(): void {
    this.#interaccion(INTERACCION.advertenciaExpandida);
  }

  advertenciaContraida(): void {
    this.#interaccion(INTERACCION.advertenciaContraida);
  }

  advertenciaCerrada(): void {
    this.#interaccion(INTERACCION.advertenciaCerrada);
  }

  detalleAbierto(): void {
    this.#interaccion(INTERACCION.detalleAbierto);
  }

  /**
   * El comprador fue hacia la compra pese a la advertencia.
   *
   * Se dispara con un clic sobre un control de compra de la propia ficha. Es una
   * observacion, no una inferencia: el clic ocurrio.
   */
  continuoPeseALaAdvertencia(): void {
    if (this.#veredictoEnPantalla === null || this.#desenlaceEmitido) return;
    this.#continuo = true;
    this.#desenlaceEmitido = true;
    this.#interaccion(INTERACCION.continuoIgual);
  }

  /**
   * El comprador dejo la ficha tras una advertencia de riesgo sin tocar ningun
   * control de compra.
   *
   * ES UNA APROXIMACION, y conviene que este dicho donde se emite: irse de una
   * pagina no prueba que uno haya hecho caso; puede haberse ido por cualquier
   * otro motivo. Lo que si es cierto es lo contrario, que quien pulso comprar no
   * hizo caso, y eso ya lo cubre el desenlace 7. La cifra hay que leerla como
   * "abandono sin intencion de compra observada", y asi queda anotado en
   * docs/adr/0007.
   *
   * Se emite tras CUALQUIER veredicto, incluidos riesgo bajo y evidencia
   * insuficiente. Solos no dicen nada sobre la advertencia, pero son la linea
   * base: sin ellos no se sabe si el abandono tras riesgo alto supera al que
   * ocurre de todos modos (docs/adr/0007, seccion 4).
   *
   * Solo se llama al salir de verdad de la ficha (`pagehide` o ficha nueva en
   * una SPA), nunca al ocultar la pestana: cambiar de pestana no es abandonar,
   * y marcarlo como desenlace impedia registrar un clic de compra posterior.
   */
  abandonoTrasLaAdvertencia(): void {
    if (this.#desenlaceEmitido || this.#continuo) return;
    if (this.#veredictoEnPantalla === null) return;
    this.#desenlaceEmitido = true;
    this.#interaccion(INTERACCION.hizoCaso);
  }

  #interaccion(kind: TipoInteraccion, opciones?: { readonly conReloj: boolean }): void {
    const veredicto = this.#veredictoEnPantalla;
    const desde = this.#mostradaEn;
    const conReloj = opciones?.conReloj ?? true;

    const interaccion: BloqueInteraccion = {
      kind,
      ...(veredicto !== null && { verdict: veredicto }),
      ...(conReloj && desde !== null && { millisecondsToDecision: Date.now() - desde }),
    };

    this.#mandar({ clase: 'interaccion', interaccion });
  }

  #mandar(evento: EventoDeContenido): void {
    const mensaje: AnaliticaMensaje = {
      tipo: 'analitica',
      sesionId: this.sesionId,
      plataforma: this.plataforma,
      url: this.urlActual(),
      categoria: this.categoria(),
      evento,
    };
    // Sin `await` y tragando el fallo: si el background esta dormido o la
    // pestana se esta cerrando, se pierde el evento y no pasa nada mas. La
    // analitica nunca puede tirar una excepcion en la pagina del comprador.
    void browser.runtime.sendMessage(mensaje).catch(() => undefined);
  }
}
