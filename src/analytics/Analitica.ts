import {
  PLATAFORMA,
  TIPO,
  type BloqueAnalisis,
  type BloqueInteraccion,
  type EventoUso,
  type PlataformaAnalitica,
} from '../domain/analitica/eventos.js';
import { categoriaGruesa, dominioRegistrable } from '../domain/analitica/sitio.js';
import { nuevoIdDeEvento } from './identidad.js';
import type { ColaAnalitica } from './ColaAnalitica.js';

/**
 * La unica puerta por la que se emite un evento de analitica.
 *
 * Todo lo que va a salir del navegador pasa por aqui, y aqui es donde la URL se
 * reduce a su dominio registrable y la categoria a su forma gruesa. Concentrarlo
 * en un solo sitio es lo que hace la regla verificable: para saber que la ruta
 * de una ficha nunca se emite basta con leer este archivo y
 * `src/domain/analitica/sitio.ts`.
 *
 * El contexto entra con la URL entera porque el background ya la tiene —se la
 * manda al analizador de dominio—, pero NO SALE con ella: `site` es de un tipo
 * que solo `dominioRegistrable()` sabe fabricar.
 */

/** Nombre de plataforma de los adaptadores → `EUsagePlatform`. */
const PLATAFORMA_POR_NOMBRE: Readonly<Record<string, PlataformaAnalitica>> = {
  'Mercado Libre': PLATAFORMA.mercadoLibre,
  Amazon: PLATAFORMA.amazon,
  AliExpress: PLATAFORMA.aliExpress,
  eBay: PLATAFORMA.ebay,
  Temu: PLATAFORMA.temu,
};

/** Lo desconocido cae en 99: el evento no se pierde por una plataforma nueva. */
export const plataformaAnalitica = (nombre: string): PlataformaAnalitica =>
  PLATAFORMA_POR_NOMBRE[nombre] ?? PLATAFORMA.otra;

export interface ContextoDeUso {
  /** Uno por pestana con una ficha abierta. Muere con ella. */
  readonly sesionId: string;
  /** Nombre del adaptador, p. ej. "Mercado Libre". */
  readonly plataforma: string;
  /** La URL abierta. Se reduce a dominio aqui dentro y nunca sale entera. */
  readonly url: string;
  /** Migas de pan crudas. Se recortan aqui dentro. Vacio si no se leyeron. */
  readonly categoria: string;
}

export class Analitica {
  constructor(private readonly cola: ColaAnalitica) {}

  sesionIniciada(ctx: ContextoDeUso): void {
    this.#emitir(ctx, TIPO.sesionIniciada);
  }

  fichaDetectada(ctx: ContextoDeUso): void {
    this.#emitir(ctx, TIPO.fichaDetectada);
  }

  consultaEnviada(ctx: ContextoDeUso): void {
    this.#emitir(ctx, TIPO.consultaEnviada);
  }

  consultaResuelta(ctx: ContextoDeUso, analysis: BloqueAnalisis): void {
    this.#emitir(ctx, TIPO.consultaResuelta, { analysis });
  }

  /**
   * La consulta no llego a veredicto: el motor exigio sesion, se cayo o se
   * agoto el tiempo. No lleva bloque `analysis` porque no hubo desenlace que
   * describir, y fabricar uno contaria una abstencion que nunca se mostro.
   */
  consultaFallida(ctx: ContextoDeUso): void {
    this.#emitir(ctx, TIPO.consultaFallida);
  }

  interaccion(ctx: ContextoDeUso, interaction: BloqueInteraccion): void {
    this.#emitir(ctx, TIPO.interaccion, { interaction });
  }

  #emitir(
    ctx: ContextoDeUso,
    type: EventoUso['type'],
    extra?: { readonly analysis?: BloqueAnalisis; readonly interaction?: BloqueInteraccion },
  ): void {
    const site = dominioRegistrable(ctx.url);
    const category = categoriaGruesa(ctx.categoria);

    const evento: EventoUso = {
      eventId: nuevoIdDeEvento(),
      type,
      platform: plataformaAnalitica(ctx.plataforma),
      ...(site !== null && { site }),
      ...(category !== '' && { category }),
      occurredAt: new Date().toISOString(),
      ...(extra?.analysis !== undefined && { analysis: extra.analysis }),
      ...(extra?.interaction !== undefined && { interaction: extra.interaction }),
    };

    this.cola.encolar(ctx.sesionId, evento);
  }
}
