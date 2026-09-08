/**
 * Lectura de los datos estructurados schema.org que MercadoLibre embebe en la
 * propia ficha.
 *
 * Se prefieren a los selectores CSS por una razon concreta: el JSON-LD es un
 * contrato publico que la plataforma mantiene para los buscadores, mientras que
 * las clases CSS cambian sin aviso en cada remaquetacion. Sigue siendo lectura
 * del documento que el navegador ya renderizo: no se pide nada.
 */

export interface ProductoLd {
  readonly ratingValue: number | undefined;
  readonly ratingCount: number | undefined;
  readonly reviewCount: number | undefined;
  readonly price: number | undefined;
  readonly nombre: string | undefined;
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

/** Aplana el JSON-LD, que puede venir como objeto, arreglo o @graph. */
const candidatos = (raiz: unknown): readonly Record<string, unknown>[] => {
  if (Array.isArray(raiz)) return raiz.filter(esObjeto);
  if (!esObjeto(raiz)) return [];
  const grafo = raiz['@graph'];
  if (Array.isArray(grafo)) return grafo.filter(esObjeto);
  return [raiz];
};

/**
 * Busca el nodo de tipo Product entre los bloques JSON-LD de la pagina.
 * Devuelve null si no hay ninguno o si el JSON esta corrupto: nunca lanza.
 */
export const leerProducto = (doc: Document): ProductoLd | null => {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let datos: unknown;
    try {
      datos = JSON.parse(script.textContent);
    } catch {
      continue;
    }

    for (const nodo of candidatos(datos)) {
      if (nodo['@type'] !== 'Product') continue;

      const rating = esObjeto(nodo['aggregateRating']) ? nodo['aggregateRating'] : {};
      const offers = esObjeto(nodo['offers']) ? nodo['offers'] : {};

      return {
        ratingValue: num(rating['ratingValue']),
        ratingCount: num(rating['ratingCount']),
        reviewCount: num(rating['reviewCount']),
        price: num(offers['price']),
        nombre: typeof nodo['name'] === 'string' ? nodo['name'] : undefined,
      };
    }
  }
  return null;
};
