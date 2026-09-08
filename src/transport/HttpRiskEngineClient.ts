import type { Evaluacion, EvaluacionSolicitud, RiskEngineClient } from './RiskEngineClient.js';

/** Se lanza cuando el motor exige sesion y no hay una activa. */
export class SesionRequeridaError extends Error {
  constructor() {
    super('El motor de riesgo requiere una sesion iniciada.');
    this.name = 'SesionRequeridaError';
  }
}

/**
 * Esqueleto. NO se usa todavia: el endpoint no existe en el backend.
 * Ver docs/contrato-motor-riesgo.md para el contrato propuesto.
 *
 * Regla de seguridad que esta implementacion debe respetar siempre: ante fallo,
 * timeout o respuesta ilegible, el veredicto es `evidencia-insuficiente`.
 * Nunca `riesgo bajo`. Un backend caido no es senal de que la publicacion sea
 * segura.
 *
 * El 401 es la excepcion y se propaga como SesionRequeridaError, porque la UI
 * tiene que poder distinguir "no pude evaluar" de "necesitas iniciar sesion".
 */
export class HttpRiskEngineClient implements RiskEngineClient {
  readonly id = 'http';

  constructor(
    private readonly baseUrl: string,
    private readonly obtenerToken: () => Promise<string | null>,
    private readonly timeoutMs = 8000,
  ) {}

  async evaluar(solicitud: EvaluacionSolicitud): Promise<Evaluacion> {
    const token = await this.obtenerToken();
    if (token === null) throw new SesionRequeridaError();

    const abort = new AbortController();
    const t = setTimeout(() => {
      abort.abort();
    }, this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/risk/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(solicitud),
        signal: abort.signal,
      });
      if (res.status === 401) throw new SesionRequeridaError();
      if (!res.ok) return this.#abstener(solicitud, `El servicio respondio ${String(res.status)}.`);
      // TODO(backend): validar el esquema de la respuesta antes de confiar en ella.
      return (await res.json()) as Evaluacion;
    } catch (e) {
      if (e instanceof SesionRequeridaError) throw e;
      return this.#abstener(solicitud, 'No se pudo consultar el servicio de riesgo.');
    } finally {
      clearTimeout(t);
    }
  }

  #abstener(solicitud: EvaluacionSolicitud, motivo: string): Evaluacion {
    return {
      verdict: {
        kind: 'evidencia-insuficiente',
        resueltas: [],
        sinResolver: [],
        dimensionesVacias: [],
        motivo,
      },
      features: solicitud.features,
    };
  }
}
