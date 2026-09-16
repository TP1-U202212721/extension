/**
 * Lo unico que la analitica puede decir sobre DONDE estaba el comprador.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ REGLA QUE NO SE NEGOCIA: NI LA URL NI LA RUTA SALEN DEL NAVEGADOR.      │
 * │                                                                         │
 * │ La ruta revela QUE PRODUCTO CONCRETO mira una persona, y el paper       │
 * │ afirma por escrito que eso no se hace. Lo mismo el titulo, el nombre    │
 * │ del vendedor y el texto de las resenas. Nada de eso tiene columna en    │
 * │ el backend (docs/analytics/privacidad.md) y nada de eso se emite.       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * La regla se hace cumplir POR TIPOS, no por disciplina: `DominioRegistrable`
 * es una marca de nacimiento que solo produce `dominioRegistrable()`, y es el
 * unico tipo que el evento acepta en su campo `site`. Pasar una URL entera no
 * compila. Un comentario se ignora; un tipo, no.
 */

/** Cadena que YA paso por `dominioRegistrable`. No se puede fabricar de otro modo. */
export type DominioRegistrable = string & {
  readonly __esDominioRegistrable: unique symbol;
};

/**
 * Sufijos publicos de dos etiquetas presentes en los marketplaces soportados y
 * sus vecinos regionales.
 *
 * No es la lista publica de sufijos entera a proposito: arrastrar la PSL a una
 * extension son cientos de kilobytes para reducir cuatro dominios conocidos. Lo
 * que queda fuera degrada a un dominio de dos etiquetas, que sigue sin revelar
 * la ruta.
 */
const SUFIJOS_COMPUESTOS: ReadonlySet<string> = new Set([
  'com.pe', 'com.ar', 'com.mx', 'com.co', 'com.br', 'com.uy', 'com.ec', 'com.bo',
  'com.py', 'com.ve', 'com.pa', 'com.do', 'com.gt', 'com.sv', 'com.ni', 'com.cr',
  'com.hn', 'co.uk', 'com.au', 'co.nz', 'co.jp', 'co.kr', 'com.cn', 'com.hk',
  'com.tw', 'com.sg', 'com.my', 'com.ph', 'com.tr', 'com.sa', 'com.eg', 'co.za',
]);

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Reduce una URL a su dominio registrable. Es la UNICA puerta por la que una
 * direccion puede entrar a un evento, y por ella no pasa ni la ruta ni la
 * query ni el subdominio.
 *
 * Devuelve null cuando no hay dominio que reportar: una URL ilegible, un host
 * por IP (el backend los descarta, y una IP es un dato personal) o `localhost`.
 */
export const dominioRegistrable = (href: string): DominioRegistrable | null => {
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }

  if (host === '' || host === 'localhost') return null;
  // Un host entre corchetes es IPv6; con dos puntos, tambien.
  if (host.startsWith('[') || host.includes(':')) return null;
  if (IPV4.test(host)) return null;

  const etiquetas = host.split('.').filter((e) => e !== '');
  if (etiquetas.length < 2) return null;

  const dos = etiquetas.slice(-2).join('.');
  if (etiquetas.length >= 3 && SUFIJOS_COMPUESTOS.has(dos)) {
    return etiquetas.slice(-3).join('.') as DominioRegistrable;
  }
  return dos as DominioRegistrable;
};

/** Palabras por segmento que el backend acepta antes de tomarlo por un titulo. */
const MAX_PALABRAS = 5;
/** Segmentos que el backend conserva (`UsageAnalytics:CategorySegments`). */
const MAX_SEGMENTOS = 2;
const CUATRO_DIGITOS = /\d{4}/;

const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Deja la categoria en la forma gruesa que el backend guarda, o vacia.
 *
 * Se recorta AQUI y no alla por una razon operativa: la respuesta de la ingesta
 * devuelve `sanitized`, y un valor distinto de cero es, por contrato, un defecto
 * de la extension. Que el servidor sepa recortar no autoriza a mandarle de mas.
 *
 * Un segmento con mas de cinco palabras o con cuatro digitos seguidos se
 * descarta entero: eso ya no es una categoria, es un titulo o un identificador.
 */
export const categoriaGruesa = (texto: string): string => {
  const segmentos = texto
    .split(/[/>›|»]/)
    .map((s) =>
      sinTildes(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((s) => s !== '' && !CUATRO_DIGITOS.test(s) && s.split(' ').length <= MAX_PALABRAS)
    .slice(0, MAX_SEGMENTOS);

  return segmentos.join('/');
};
