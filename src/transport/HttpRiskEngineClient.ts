import type { Verdict } from '../domain/verdict.js';
import type { EvaluacionSolicitud, RiskEngineClient } from './RiskEngineClient.js';

/**
 * Esqueleto. NO se usa todavia: el endpoint no existe en el backend.
 * Ver docs/contrato-motor-riesgo.md para el contrato propuesto.
 *
 * Regla de seguridad que esta implementacion debe respetar siempre: ante fallo,
 * timeout o respuesta ilegible, el veredicto es `evidencia-insuficiente`.
 * Nunca `riesgo bajo`. Un backend caido no es una senal de que la publicacion
 * sea segura.
 */
export class HttpRiskEngineClient implements RiskEngineClient {
  readonly id = 'http';

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 8000,
  ) {}

  async evaluar(solicitud: EvaluacionSolicitud): Promise<Verdict> {
    const abort = new AbortController();
    const t = setTimeout(() => {
      abort.abort();
    }, this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/risk/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitud),
        signal: abort.signal,
      });
      if (!res.ok) return this.#abstener(`El servicio respondio ${String(res.status)}.`);
      // TODO(backend): validar el esquema de la respuesta antes de confiar en ella.
      return (await res.json()) as Verdict;
    } catch {
      return this.#abstener('No se pudo consultar el servicio de riesgo.');
    } finally {
      clearTimeout(t);
    }
  }

  #abstener(motivo: string): Verdict {
    return {
      kind: 'evidencia-insuficiente',
      resueltas: [],
      sinResolver: [],
      dimensionesVacias: [],
      motivo,
    };
  }
}
