import { API_BASE_URL } from '../config.js';
import {
  conocido,
  indeterminado,
  type FeatureSet,
  type FeatureValue,
  type Ordinal,
  type ProteccionDePago,
} from '../domain/features.js';

/** Limite del backend: 8 MB en bytes UTF-8, no en caracteres. */
export const MAX_BYTES = 8 * 1024 * 1024;

/** Estados de extraccion del backend. */
const LEIDA = 1;
const AUSENCIA_CONFIRMADA = 2;
const NO_DETERMINADA = 3;
const DIFERIDA = 4;

export interface DetalleDocumento {
  readonly plataforma: string;
  readonly postTitle: string;
  readonly seller: string;
  /** Proporcion de caracteristicas determinadas, sin contar las diferidas. */
  readonly coverage: number;
  readonly reviewCount: number;
  readonly sinDeterminar: readonly string[];
}

export interface ResultadoDocumento {
  readonly features: FeatureSet;
  readonly detalle: DetalleDocumento | null;
}

/** El presupuesto del analizador mas el margen de subir un documento de varios MB. */
const TIMEOUT_MS = 20000;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const num = (o: Record<string, unknown>, k: string): number | null =>
  typeof o[k] === 'number' ? o[k] : null;

const txt = (o: Record<string, unknown>, k: string): string =>
  typeof o[k] === 'string' ? o[k] : '';

/** Bytes UTF-8 reales del documento. `length` cuenta caracteres y enganaria. */
export const bytesDe = (html: string): number => new Blob([html]).size;

const TODO_INDETERMINADO = (motivo: string): FeatureSet => ({
  proteccionDePago: indeterminado(motivo),
  puntuacionDelProducto: indeterminado(motivo),
  presenciaDeResenas: indeterminado(motivo),
  politicasDeGarantia: indeterminado(motivo),
  volumenDeVentas: indeterminado(motivo),
  reputacionDelVendedor: indeterminado(motivo),
  autenticidadDeResenas: indeterminado(motivo),
  veracidadDeDominio: indeterminado('La resuelve el analizador de dominio.'),
});

interface Estado {
  readonly status: number;
  readonly reason: string;
}

/**
 * Cruza el valor numerico con su estado.
 *
 * Es la regla que da sentido a todo el endpoint: el DTO del backend usa `int` y
 * `double` no nulables, asi que un 0 puede ser una medicion o un selector que
 * fallo. LEER EL VALOR SIN MIRAR EL ESTADO ES EL ERROR QUE ESTE CODIGO EXISTE
 * PARA IMPEDIR.
 *
 * - status 1 (leida): valor observado.
 * - status 2 (ausencia confirmada): TAMBIEN es un valor conocido. El documento
 *   llego, el contenedor estaba, y la caracteristica no aparecia. Eso es un
 *   hecho, no un hueco.
 * - status 3 (no determinada): el numero es relleno. Indeterminado.
 * - status 4 (diferida): provisional, la calcula otra etapa. Indeterminado.
 */
const cruzar = <T>(
  estado: Estado | undefined,
  valor: number | null,
  traducir: (n: number) => T,
  evidencia: (n: number) => string,
): FeatureValue<T> => {
  if (estado === undefined) {
    return indeterminado('El backend no informo el estado de esta caracteristica.');
  }
  if (estado.status === NO_DETERMINADA) {
    return indeterminado(
      estado.reason === '' ? 'El documento no permitio determinarla.' : estado.reason,
    );
  }
  if (estado.status === DIFERIDA) {
    return indeterminado(
      estado.reason === '' ? 'La calcula otra etapa del analisis.' : estado.reason,
    );
  }
  if (estado.status !== LEIDA && estado.status !== AUSENCIA_CONFIRMADA) {
    return indeterminado('El backend devolvio un estado no reconocido.');
  }
  if (valor === null) {
    return indeterminado('El backend no devolvio el valor de esta caracteristica.');
  }
  return conocido(traducir(valor), evidencia(valor));
};

const aOrdinal = (n: number): Ordinal => {
  const e = Math.max(0, Math.min(3, Math.round(n)));
  return e as Ordinal;
};

/**
 * Analiza la ficha contra el backend enviando el documento ya renderizado.
 *
 * No hay scraping: nadie visita nada. Es el mismo documento que el navegador del
 * comprador ya recibio, interpretado en el servidor en lugar de en el cliente.
 * La razon de que lo interprete el servidor esta en docs/adr/0004.
 */
export const analizarDocumento = async (
  url: string,
  html: string,
  token: string,
): Promise<ResultadoDocumento> => {
  const bytes = bytesDe(html);
  if (bytes > MAX_BYTES) {
    // Se comprueba antes de subir: mandar 12 MB para recibir un 400 gasta los
    // datos del comprador para nada.
    const mb = (bytes / 1024 / 1024).toFixed(1);
    return {
      features: TODO_INDETERMINADO(
        `La pagina pesa ${mb} MB y supera el limite de 8 MB del analizador.`,
      ),
      detalle: null,
    };
  }

  const abortar = new AbortController();
  const reloj = setTimeout(() => {
    abortar.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/DocumentAnalysis/Features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, html }),
      signal: abortar.signal,
    });

    const cuerpo: unknown = await res.json();
    const sobre = esObjeto(cuerpo) ? cuerpo : {};
    const item = sobre['item'];

    if (!res.ok || sobre['isSuccess'] !== true || !esObjeto(item)) {
      const mensaje = txt(sobre, 'message');
      return {
        features: TODO_INDETERMINADO(
          mensaje === '' ? 'El analizador de documento no respondio.' : mensaje,
        ),
        detalle: null,
      };
    }

    return { features: mapear(item), detalle: detalleDe(item) };
  } catch {
    // Timeout o red caida. Nunca favorable: todo queda sin resolver.
    return {
      features: TODO_INDETERMINADO('No se pudo analizar el documento a tiempo.'),
      detalle: null,
    };
  } finally {
    clearTimeout(reloj);
  }
};

const estadosDe = (item: Record<string, unknown>): ReadonlyMap<string, Estado> => {
  const mapa = new Map<string, Estado>();
  const crudo = item['featureStates'];
  if (!Array.isArray(crudo)) return mapa;
  for (const e of crudo) {
    if (!esObjeto(e)) continue;
    const nombre = txt(e, 'feature');
    const status = num(e, 'status');
    if (nombre === '' || status === null) continue;
    mapa.set(nombre, { status, reason: txt(e, 'reason') });
  }
  return mapa;
};

const mapear = (item: Record<string, unknown>): FeatureSet => {
  const f = esObjeto(item['features']) ? item['features'] : {};
  const s = estadosDe(item);

  return {
    proteccionDePago: cruzar<ProteccionDePago>(
      s.get('medios_pago_reconocidos'),
      num(f, 'medios_pago_reconocidos'),
      (n) => (n >= 1 ? 'declarada' : 'no-declarada'),
      (n) =>
        n >= 1
          ? 'La ficha declara medios de pago reconocidos o compra protegida.'
          : 'La ficha no declara medios de pago reconocidos ni compra protegida.',
    ),

    puntuacionDelProducto: cruzar<number>(
      s.get('puntuacion_producto'),
      num(f, 'puntuacion_producto'),
      (n) => n,
      (n) => `Puntuacion promedio de ${String(n)} sobre 5 segun la ficha.`,
    ),

    // OJO: el extractor nuevo usa 1 = tiene resenas. El paper de TP1 la tenia
    // codificada al reves (0 = Tiene reseñas); esa inversion quedo corregida.
    presenciaDeResenas: cruzar<boolean>(
      s.get('tiene_reseñas'),
      num(f, 'tiene_reseñas'),
      (n) => n >= 1,
      (n) => (n >= 1 ? 'La ficha publica opiniones.' : 'El bloque de opiniones no tiene resenas.'),
    ),

    politicasDeGarantia: cruzar<Ordinal>(
      s.get('politicas_garantia'),
      num(f, 'politicas_garantia'),
      aOrdinal,
      (n) => (n >= 1 ? 'La ficha declara garantia.' : 'La ficha no declara garantia.'),
    ),

    volumenDeVentas: cruzar<number>(
      s.get('productos_vendidos'),
      num(f, 'productos_vendidos'),
      (n) => n,
      (n) => `La ficha declara aproximadamente ${String(n)} ventas.`,
    ),

    reputacionDelVendedor: cruzar<Ordinal>(
      s.get('vendedor_reconocido'),
      num(f, 'vendedor_reconocido'),
      aOrdinal,
      (n) =>
        n >= 1
          ? 'La ficha del vendedor muestra el distintivo de lider.'
          : 'La ficha del vendedor no muestra el distintivo de lider.',
    ),

    // Siempre diferida (status 4): la calcula el modelo de resenas, que no existe.
    autenticidadDeResenas: cruzar<number>(
      s.get('porcentaje_reseñas_falsas'),
      num(f, 'porcentaje_reseñas_falsas'),
      (n) => n,
      (n) => `Se estima un ${String(Math.round(n * 100))}% de resenas artificiales.`,
    ),

    veracidadDeDominio: indeterminado('La resuelve el analizador de dominio.'),
  };
};

const detalleDe = (item: Record<string, unknown>): DetalleDocumento => ({
  plataforma: txt(item, 'platform'),
  postTitle: txt(item, 'postTitle'),
  seller: txt(item, 'seller'),
  coverage: num(item, 'coverage') ?? 0,
  reviewCount: num(item, 'reviewCount') ?? 0,
  sinDeterminar: Array.isArray(item['undeterminedFeatures'])
    ? item['undeterminedFeatures'].filter((x): x is string => typeof x === 'string')
    : [],
});
