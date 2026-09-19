import { browser } from 'wxt/browser';
import {
  COLA_VACIA,
  UMBRAL_DE_ENVIO,
  conFallo,
  conModuloApagado,
  encolar,
  puedeEnviar,
  quitar,
  reactivarSiToca,
  siguienteLote,
  type EstadoDeLaCola,
  type EventoEnCola,
} from '../domain/analitica/cola.js';
import type { EventoUso } from '../domain/analitica/eventos.js';
import { seudonimoVigente, versionDelCliente } from './identidad.js';
import { enviarLote } from './UsageAnalyticsClient.js';
import type { TokenProvider } from '../auth/TokenProvider.js';

/**
 * La cola de eventos de uso: acumula, persiste, envia por lotes y reintenta.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ LA ANALITICA JAMAS PUEDE ROMPER NI RETRASAR EL VEREDICTO.               │
 * │                                                                         │
 * │ Nada de aqui se espera con `await` desde el camino del veredicto, y     │
 * │ ningun fallo escapa: todo metodo publico traga sus errores. Si la       │
 * │ ingesta se cae, el comprador no se entera, que es exactamente lo que    │
 * │ tiene que pasar.                                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ── POR QUE EL ESTADO VIVE EN EL ALMACENAMIENTO ─────────────────────────────
 * El service worker de MV3 se apaga solo, y `chrome.runtime.onSuspend` no es de
 * fiar ahi. Una cola en memoria se pierde entera cada vez que el navegador
 * decide apagar el worker, que con una extension que solo actua a peticion del
 * comprador es casi siempre. Por eso cada evento se escribe en
 * `storage.local` en cuanto se encola, y el envio se reprograma con una alarma,
 * que es lo unico que vuelve a despertar al worker.
 */

const CLAVE = 'scamshield.analitica.cola';
const ALARMA = 'scamshield-analitica';

export class ColaAnalitica {
  /**
   * Cadena de promesas que serializa los accesos.
   *
   * Sin esto, dos eventos encolados a la vez leen el mismo estado del
   * almacenamiento y el segundo pisa al primero: se pierden eventos en silencio,
   * que es el peor fallo posible en una cola de medicion.
   */
  #turno: Promise<void> = Promise.resolve();

  constructor(private readonly tokens: TokenProvider) {}

  /**
   * Registra la alarma periodica. Se llama una vez, al arrancar el background.
   *
   * El listener va en el nivel superior del entrypoint por la misma razon que el
   * de cookies: en MV3 solo los eventos registrados ahi resucitan al worker.
   */
  async programar(): Promise<void> {
    try {
      await browser.alarms.create(ALARMA, { periodInMinutes: 1 });
    } catch {
      // Sin alarmas, la cola se sigue vaciando por umbral. Se pierde el tic
      // periodico, no la analitica.
    }
  }

  /** true si la alarma es la nuestra. */
  esNuestraAlarma(nombre: string): boolean {
    return nombre === ALARMA;
  }

  /** Acumula un evento. No espera a la red; no lanza. */
  encolar(sesionId: string, evento: EventoUso): void {
    this.#enCola(async () => {
      const estado = encolar(await this.#leer(), [{ sesionId, evento }], Date.now());
      await this.#guardar(estado);
      if (estado.pendientes.length >= UMBRAL_DE_ENVIO) await this.#vaciar();
    });
  }

  /** Tic periodico o arranque del worker. No lanza. */
  vaciar(): void {
    this.#enCola(() => this.#vaciar());
  }

  #enCola(tarea: () => Promise<void>): void {
    this.#turno = this.#turno.then(tarea).catch(() => {
      // La analitica se descarta en silencio. Nunca propaga.
    });
  }

  async #vaciar(): Promise<void> {
    let estado = reactivarSiToca(await this.#leer(), Date.now());
    if (!puedeEnviar(estado, Date.now())) {
      await this.#guardar(estado);
      return;
    }

    const token = await this.tokens.obtener();
    if (token === null) {
      // Sin credencial no se puede ingerir: se espera, no se descarta. El
      // comprador puede iniciar sesion mas tarde y el lote sigue siendo valido.
      await this.#guardar(conFallo(estado, Date.now()));
      return;
    }

    const pseudonym = await seudonimoVigente();
    const clientVersion = versionDelCliente();

    // Varios lotes por pasada, uno por sesion, mientras el servidor los acepte.
    // El tope evita que una cola muy larga sujete el worker indefinidamente.
    for (let vuelta = 0; vuelta < 5; vuelta += 1) {
      const lote = siguienteLote(estado);
      if (lote === null) break;

      const resultado = await enviarLote(
        { clientVersion, pseudonym, sessionId: lote.sesionId, events: lote.eventos },
        token,
      );

      if (resultado.tipo === 'apagado') {
        estado = conModuloApagado(Date.now());
        break;
      }
      if (resultado.tipo === 'reintentar') {
        estado = conFallo(estado, Date.now());
        break;
      }
      // 'procesado' y 'descartar' comparten destino: los eventos salen de la
      // cola. Lo rechazado se volveria a rechazar, y reintentarlo es un bucle.
      estado = quitar(estado, lote.eventos);
    }

    await this.#guardar(estado);
  }

  async #leer(): Promise<EstadoDeLaCola> {
    try {
      const guardado = await browser.storage.local.get(CLAVE);
      const v: unknown = guardado[CLAVE];
      return esEstado(v) ? v : COLA_VACIA;
    } catch {
      return COLA_VACIA;
    }
  }

  async #guardar(estado: EstadoDeLaCola): Promise<void> {
    try {
      await browser.storage.local.set({ [CLAVE]: estado });
    } catch {
      // Cuota llena o almacenamiento bloqueado. Se pierde el acumulado, no mas.
    }
  }
}

/**
 * Guarda de runtime sobre lo que se leyo del almacenamiento.
 *
 * Lo que sale de `storage.local` es `unknown`: puede venir de una version
 * anterior de la extension, o corrupto. Asumir su forma dejaria la cola en un
 * estado invalido para siempre, y una cola rota no se arregla sola.
 */
const esEstado = (v: unknown): v is EstadoDeLaCola =>
  typeof v === 'object' &&
  v !== null &&
  'pendientes' in v &&
  Array.isArray(v.pendientes) &&
  'intentos' in v &&
  typeof v.intentos === 'number' &&
  'noAntesDe' in v &&
  typeof v.noAntesDe === 'number' &&
  'apagado' in v &&
  typeof v.apagado === 'boolean' &&
  v.pendientes.every(esEventoEnCola);

const esEventoEnCola = (v: unknown): v is EventoEnCola =>
  typeof v === 'object' &&
  v !== null &&
  'sesionId' in v &&
  typeof v.sesionId === 'string' &&
  'evento' in v &&
  typeof v.evento === 'object' &&
  v.evento !== null &&
  'eventId' in v.evento &&
  typeof v.evento.eventId === 'string';
