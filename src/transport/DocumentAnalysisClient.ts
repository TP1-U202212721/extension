import { API_BASE_URL } from '../api.js';
import { leerRespuesta, type Sobre } from './sobre.js';
import {
  conocido,
  indeterminado,
  type FeatureSet,
  type CausaIndeterminada,
  type FeatureValue,
  type Ordinal,
  type ProteccionDePago,
} from '../domain/features.js';
import type { DesenlaceLlamada } from './RiskEngineClient.js';

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
  /** Como termino la llamada. Lo consume la analitica de uso, no la presentacion. */
  readonly desenlace: DesenlaceLlamada;
}

/** El presupuesto del analizador mas el margen de subir un documento de varios MB. */
const TIMEOUT_MS = 20000;

/** Bytes UTF-8 reales del documento. `length` cuenta caracteres y enganaria. */
export const bytesDe = (html: string): number => new Blob([html]).size;

const TODO_INDETERMINADO = (motivo: string, causa?: CausaIndeterminada): FeatureSet => ({
  proteccionDePago: indeterminado(motivo, causa),
  puntuacionDelProducto: indeterminado(motivo, causa),
  presenciaDeResenas: indeterminado(motivo, causa),
  politicasDeGarantia: indeterminado(motivo, causa),
  volumenDeVentas: indeterminado(motivo, causa),
  reputacionDelVendedor: indeterminado('La resuelve el analizador de reputacion del vendedor.'),
  autenticidadDeResenas: indeterminado('La resuelve el analizador de autenticidad de resenas.'),
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
    // El extractor corrio y ningun selector suyo encontro la seccion.
    return indeterminado(
      estado.reason === '' ? 'El documento no permitio determinarla.' : estado.reason,
      'sin-selector',
    );
  }
  if (estado.status === DIFERIDA) {
    // Sin causa: no fallo nada, la resuelve otra etapa.
    return indeterminado(
      estado.reason === '' ? 'La calcula otra etapa del analisis.' : estado.reason,
    );
  }
  if (estado.status !== LEIDA && estado.status !== AUSENCIA_CONFIRMADA) {
    return indeterminado('El backend devolvio un estado no reconocido.', 'valor-ilegible');
  }
  if (valor === null) {
    return indeterminado(
      'El backend no devolvio el valor de esta caracteristica.',
      'valor-ilegible',
    );
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
      // No se intento la llamada: omitida, y fuera del denominador de errores.
      desenlace: 'omitido',
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

    const { ok, item, mensaje } = leerRespuesta(await res.json(), res.ok);
    if (!ok) {
      return {
        features: TODO_INDETERMINADO(
          mensaje === '' ? 'El analizador de documento no respondio.' : mensaje,
          'fuente-con-error',
        ),
        detalle: null,
        desenlace: 'error',
      };
    }

    return { features: mapear(item), detalle: detalleDe(item), desenlace: 'correcto' };
  } catch {
    // Timeout o red caida. Nunca favorable: todo queda sin resolver.
    return {
      features: TODO_INDETERMINADO('No se pudo analizar el documento a tiempo.', 'tiempo-agotado'),
      detalle: null,
      desenlace: abortar.signal.aborted ? 'tiempo-agotado' : 'error',
    };
  } finally {
    clearTimeout(reloj);
  }
};

const estadosDe = (item: Sobre): ReadonlyMap<string, Estado> => {
  const mapa = new Map<string, Estado>();
  for (const e of item.lista('featureStates')) {
    // `Feature`/`Status`/`Reason` son claves del sobre: tolerantes.
    const nombre = e.txt('feature');
    const status = e.num('status');
    // El VALOR de `feature` es un dato en snake_case y se usa tal cual.
    if (nombre === '' || status === null) continue;
    mapa.set(nombre, { status, reason: e.txt('reason') });
  }
  return mapa;
};

const mapear = (item: Sobre): FeatureSet => {
  // `features` es clave del sobre, pero lo que hay DENTRO son nombres de
  // caracteristica en snake_case: datos. Por eso se leen con `exacto`.
  const f = item.obj('features');
  const s = estadosDe(item);

  return {
    proteccionDePago: cruzar<ProteccionDePago>(
      s.get('medios_pago_reconocidos'),
      valorExacto(f, 'medios_pago_reconocidos'),
      (n) => (n >= 1 ? 'declarada' : 'no-declarada'),
      (n) =>
        n >= 1
          ? 'La ficha declara medios de pago reconocidos o compra protegida.'
          : 'La ficha no declara medios de pago reconocidos ni compra protegida.',
    ),

    puntuacionDelProducto: cruzar<number>(
      s.get('puntuacion_producto'),
      valorExacto(f, 'puntuacion_producto'),
      (n) => n,
      (n) => `Puntuacion promedio de ${String(n)} sobre 5 segun la ficha.`,
    ),

    // OJO: el extractor nuevo usa 1 = tiene resenas. El paper de TP1 la tenia
    // codificada al reves (0 = Tiene reseñas); esa inversion quedo corregida.
    presenciaDeResenas: cruzar<boolean>(
      s.get('tiene_reseñas'),
      valorExacto(f, 'tiene_reseñas'),
      (n) => n >= 1,
      (n) => (n >= 1 ? 'La ficha publica opiniones.' : 'El bloque de opiniones no tiene resenas.'),
    ),

    politicasDeGarantia: cruzar<Ordinal>(
      s.get('politicas_garantia'),
      valorExacto(f, 'politicas_garantia'),
      aOrdinal,
      (n) => (n >= 1 ? 'La ficha declara garantia.' : 'La ficha no declara garantia.'),
    ),

    volumenDeVentas: cruzar<number>(
      s.get('productos_vendidos'),
      valorExacto(f, 'productos_vendidos'),
      (n) => n,
      (n) => `La ficha declara aproximadamente ${String(n)} ventas.`,
    ),

    /**
     * NO se deriva del binario `vendedor_reconocido` del documento.
     *
     * La escala nueva tiene cinco niveles y el 3 significa "sin verificar". El
     * propio analizador del backend deja en 3 por cobertura baja a un vendedor
     * del que solo se conoce el distintivo, asi que traducir aqui ese 0/1 a un
     * nivel seria inventar evidencia que nadie midio. La resuelve
     * /SellerReputation/Estimate (PR 10, sin mergear).
     */
    reputacionDelVendedor: indeterminado(
      'La resuelve el analizador de reputacion del vendedor.',
    ),

    /** Siempre diferida en el documento: la resuelve /ReviewAnalysis/Authenticity. */
    autenticidadDeResenas: indeterminado('La resuelve el analizador de autenticidad de resenas.'),

    veracidadDeDominio: indeterminado('La resuelve el analizador de dominio.'),
  };
};

const detalleDe = (item: Sobre): DetalleDocumento => ({
  plataforma: item.txt('platform'),
  postTitle: item.txt('postTitle'),
  seller: item.txt('seller'),
  coverage: item.numOr('coverage', 0),
  reviewCount: item.numOr('reviewCount', 0),
  // Los valores de esta lista son nombres de caracteristica: se devuelven tal
  // cual para que sigan coincidiendo con las claves de `features`.
  sinDeterminar: item.cadenas('undeterminedFeatures'),
});

/**
 * Valor de una caracteristica. Lectura EXACTA a proposito: aqui la clave es un
 * dato (`vendedor_reconocido`, `porcentaje_reseñas_falsas`), no una clave del
 * sobre, y normalizarla romperia su correspondencia con `featureStates`.
 */
const valorExacto = (f: Sobre, nombre: string): number | null => {
  const v = f.exacto(nombre);
  return typeof v === 'number' ? v : null;
};
