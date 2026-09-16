import { describe, expect, it } from 'vitest';
import {
  ANALIZADOR,
  DESENLACE_ANALIZADOR,
  DESENLACE_CARACTERISTICA,
  INTERACCION,
  MOTIVO_INDETERMINADA,
  PLATAFORMA,
  TIPO,
  VEREDICTO,
  serializarLote,
  type EventoUso,
  type Lote,
} from '../../src/domain/analitica/eventos.js';
import { dominioRegistrable } from '../../src/domain/analitica/sitio.js';

const sitio = dominioRegistrable('https://articulo.mercadolibre.com.pe/MPE-1-x-_JM');
if (sitio === null) throw new Error('el fixture tiene que producir un dominio');

const evento = (extra: Partial<EventoUso> = {}): EventoUso => ({
  eventId: 'e1',
  type: TIPO.fichaDetectada,
  platform: PLATAFORMA.mercadoLibre,
  site: sitio,
  occurredAt: '2026-09-15T12:00:00.000Z',
  ...extra,
});

const lote = (eventos: readonly EventoUso[]): Lote => ({
  clientVersion: '0.1.0',
  pseudonym: '8f14e45fceea167a5a36dedd4bea2543',
  sessionId: 'c9f0f895fb98ab9159f51fd0297e236d',
  events: eventos,
});

describe('serializacion del lote', () => {
  it('omite lo que no se sabe', () => {
    const salida = serializarLote(lote([evento()]));
    const primero = (salida['events'] as readonly Record<string, unknown>[])[0];

    expect(primero).toBeDefined();
    expect(primero).not.toHaveProperty('category');
    expect(primero).not.toHaveProperty('analysis');
    expect(primero).not.toHaveProperty('interaction');
  });

  /**
   * Es la misma regla que `soloLoLeido` en los insumos, mirando al otro lado:
   * omitir no es mandar cero, pero tirar un cero medido tampoco es omitir. Una
   * latencia de 0 ms y un puntaje de 0 son observaciones.
   */
  it('conserva los ceros, que son mediciones', () => {
    const salida = serializarLote(
      lote([
        evento({
          type: TIPO.consultaResuelta,
          analysis: {
            verdict: VEREDICTO.riesgoAlto,
            confidence: 1,
            score: 0,
            durationMs: 0,
            features: [
              { code: 'puntuacion_producto', outcome: DESENLACE_CARACTERISTICA.resuelta },
            ],
            analyzers: [
              {
                analyzer: ANALIZADOR.documento,
                outcome: DESENLACE_ANALIZADOR.omitido,
                durationMs: 0,
              },
            ],
            verdicts: [],
            caps: [],
            signalFamilies: [],
          },
        }),
      ]),
    );

    const primero = (salida['events'] as readonly Record<string, unknown>[])[0];
    const analysis = primero?.['analysis'] as Record<string, unknown>;
    expect(analysis['score']).toBe(0);
    expect(analysis['durationMs']).toBe(0);

    const analyzers = analysis['analyzers'] as readonly Record<string, unknown>[];
    expect(analyzers[0]?.['durationMs']).toBe(0);
    // Las listas vacias si se omiten: no hay nada que contar en ellas.
    expect(analysis).not.toHaveProperty('caps');
    expect(analysis).not.toHaveProperty('verdicts');
  });

  it('conserva el motivo de una caracteristica indeterminada', () => {
    const salida = serializarLote(
      lote([
        evento({
          type: TIPO.consultaResuelta,
          analysis: {
            verdict: VEREDICTO.evidenciaInsuficiente,
            confidence: 1,
            durationMs: 10,
            features: [
              {
                code: 'politicas_garantia',
                outcome: DESENLACE_CARACTERISTICA.indeterminada,
                reason: MOTIVO_INDETERMINADA.ningunSelector,
              },
            ],
            analyzers: [],
            verdicts: [],
            caps: [],
            signalFamilies: [],
          },
        }),
      ]),
    );

    const primero = (salida['events'] as readonly Record<string, unknown>[])[0];
    const analysis = primero?.['analysis'] as Record<string, unknown>;
    const features = analysis['features'] as readonly Record<string, unknown>[];
    expect(features[0]).toEqual({
      code: 'politicas_garantia',
      outcome: 3,
      reason: 1,
    });
    // Un veredicto de riesgo no tiene puntaje aqui, y no se rellena con 0.
    expect(analysis).not.toHaveProperty('score');
  });

  it('en el kind 1 no viaja el reloj de la decision', () => {
    const salida = serializarLote(
      lote([
        evento({
          type: TIPO.interaccion,
          interaction: { kind: INTERACCION.advertenciaMostrada, verdict: VEREDICTO.riesgoAlto },
        }),
      ]),
    );
    const primero = (salida['events'] as readonly Record<string, unknown>[])[0];
    const interaction = primero?.['interaction'] as Record<string, unknown>;
    expect(interaction).toEqual({ kind: 1, verdict: 1 });
  });

  /**
   * La prueba que se lee sola: el lote serializado entero no puede contener una
   * ruta, un titulo, un nombre de vendedor ni un correo.
   */
  it('no lleva ruta, titulo, vendedor ni correo', () => {
    const json = JSON.stringify(
      serializarLote(
        lote([
          evento(),
          evento({ eventId: 'e2', type: TIPO.consultaEnviada, category: 'tecnologia/audio' }),
        ]),
      ),
    );

    expect(json).not.toContain('MPE-1');
    expect(json).not.toContain('@');
    expect(json).not.toContain('http');

    // La unica barra que puede aparecer es la que separa los dos segmentos de
    // la categoria gruesa. En `site` no cabe ninguna.
    const eventos = JSON.parse(json) as { events: readonly Record<string, unknown>[] };
    for (const e of eventos.events) {
      expect(String(e['site'])).not.toContain('/');
    }
  });
});
