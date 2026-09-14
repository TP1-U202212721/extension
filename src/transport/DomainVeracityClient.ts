import { API_BASE_URL } from '../api.js';
import { leerRespuesta, type Sobre } from './sobre.js';
import { conocido, indeterminado, type FeatureValue, type Veracidad } from '../domain/features.js';

/** Una senal del analizador, tal como la devuelve el backend. */
export interface SenalDominio {
  readonly code: string;
  readonly familyLabel: string;
  readonly statusLabel: string;
  readonly explanation: string;
}

/**
 * Lo que el analizador aporta ademas del valor de la caracteristica. Se conserva
 * entero porque la presentacion es explicativa: el comprador ve por que.
 */
export interface DetalleDominio {
  readonly host: string;
  readonly registrableDomain: string;
  readonly veracity: Veracidad;
  readonly veracityLabel: string;
  readonly score: number;
  readonly confidence: number;
  readonly confidenceLabel: string;
  readonly coverage: number;
  readonly summary: string;
  readonly riskSignals: readonly SenalDominio[];
  readonly trustSignals: readonly SenalDominio[];
  /** Lo que no se pudo comprobar. Se muestra: no comprobarlo no lo vuelve seguro. */
  readonly unverifiedSignals: readonly SenalDominio[];
  readonly limitations: readonly string[];
}

export interface ResultadoDominio {
  readonly feature: FeatureValue<Veracidad>;
  readonly detalle: DetalleDominio | null;
}

/**
 * El presupuesto del analizador es de 5 s y degrada parcial: si se corta antes,
 * se pierde un veredicto que el backend igual iba a entregar. De ahi el margen.
 */
const TIMEOUT_MS = 9000;

const senales = (item: Sobre, clave: string): readonly SenalDominio[] =>
  item.lista(clave).map((s) => ({
    code: s.txt('code'),
    familyLabel: s.txt('familyLabel'),
    statusLabel: s.txt('statusLabel'),
    explanation: s.txt('explanation'),
  }));

const esVeracidad = (n: number): n is Veracidad => Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * Traduce el veredicto del analizador a los tres estados del modelo.
 *
 * El punto delicado es el nivel 3, "sin evidencia suficiente": dentro de la
 * escala del backend significa dos cosas distintas segun la confianza. Con
 * confianza baja (1-2) es que no hubo con que evaluar, y eso es exactamente
 * `indeterminado`. Con confianza media o alta (3-4) es un valor observado que
 * dice "ni una cosa ni la otra", y eso SI es conocido. Colapsar los dos casos
 * inventaria evidencia en un sentido o la tiraria en el otro.
 *
 * Sin esta distincion, un dominio del que no se pudo verificar NADA cuenta como
 * caracteristica resuelta, satisface por si solo la dimension "identidad del
 * sitio" y desbloquea un veredicto que no tiene con que sostenerse.
 */
export const aFeature = (d: DetalleDominio): FeatureValue<Veracidad> => {
  if (d.veracity === 3 && d.confidence <= 2) {
    return indeterminado(
      `No se pudo reunir evidencia suficiente sobre ${d.registrableDomain} (confianza ${d.confidenceLabel.toLowerCase()}).`,
    );
  }
  return conocido(d.veracity, d.summary);
};

/**
 * Consulta la veracidad del dominio contra el backend real.
 *
 * Aqui la URL SI se envia, y no contradice la restriccion de la tesis: lo que
 * se analiza es el NOMBRE DE DOMINIO contra registro, DNS, TLS y listas de
 * reputacion. No se visita la ficha del vendedor ni se descarga su HTML; esa
 * sigue siendo la unica fuente permitida, y sigue siendo el documento que el
 * navegador ya recibio.
 */
export const consultarVeracidadDeDominio = async (
  url: string,
  token: string,
): Promise<ResultadoDominio> => {
  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/DomainAnalysis/Veracity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
      signal: abortar.signal,
    });

    const { ok, item, mensaje } = leerRespuesta(await res.json(), res.ok);
    if (!ok) {
      return {
        feature: indeterminado(
          mensaje === '' ? 'El analizador de dominio no respondio.' : mensaje,
        ),
        detalle: null,
      };
    }

    const veracity = item.numOr('veracity', 0);
    if (!esVeracidad(veracity)) {
      return {
        feature: indeterminado('El analizador de dominio devolvio un nivel no reconocido.'),
        detalle: null,
      };
    }

    const detalle: DetalleDominio = {
      host: item.txt('host'),
      registrableDomain: item.txt('registrableDomain'),
      veracity,
      veracityLabel: item.txt('veracityLabel'),
      score: item.numOr('score', 0),
      confidence: item.numOr('confidence', 0),
      confidenceLabel: item.txt('confidenceLabel'),
      coverage: item.numOr('coverage', 0),
      summary: item.txt('summary'),
      riskSignals: senales(item, 'riskSignals'),
      trustSignals: senales(item, 'trustSignals'),
      unverifiedSignals: senales(item, 'unverifiedSignals'),
      limitations: item.cadenas('limitations'),
    };

    return { feature: aFeature(detalle), detalle };
  } catch {
    // Timeout o red caida. Nunca favorable: la caracteristica queda sin resolver.
    return {
      feature: indeterminado('No se pudo consultar la veracidad del dominio a tiempo.'),
      detalle: null,
    };
  } finally {
    clearTimeout(reloj);
  }
};
