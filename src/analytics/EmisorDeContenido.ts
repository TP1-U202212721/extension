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

  fichaDetectada(): void {
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
   * Solo se emite tras una advertencia de riesgo alto o moderado: irse de una
   * ficha que salio en riesgo bajo no dice nada sobre la advertencia.
   */
  abandonoTrasLaAdvertencia(): void {
    if (this.#desenlaceEmitido || this.#continuo) return;
    const v = this.#veredictoEnPantalla;
    if (v !== 1 && v !== 2) return;
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
