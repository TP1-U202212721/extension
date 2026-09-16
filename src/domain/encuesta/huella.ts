/**
 * Normalizacion de la consulta calificada, antes de convertirla en huella.
 *
 * ── POR QUE LA EXTENSION NO MANDA LA URL, AUNQUE EL CONTRATO LA ADMITA ──────
 * El contrato de `POST /Feedback/Responses` dice que `inquiryReference` es "la
 * URL de la ficha calificada" y que el servidor no la guarda: guarda
 * `sha256(pimienta | "inquiry:" | normalizada)`. El hash del servidor resuelve
 * QUE SE GUARDA, pero no QUE SE TRANSMITE, y la regla de esta extension es que
 * la ruta de la ficha no sale del navegador: la ruta revela que producto
 * concreto mira una persona, y eso es lo que el paper afirma que no se hace.
 *
 * Asi que la huella se calcula AQUI y lo que viaja es el hexadecimal.
 *
 * Que el servidor vuelva a hashear un hash no rompe nada de lo suyo:
 *
 * - Su `Normalize` deja intacta una cadena que no es una URL —la recorta y la
 *   pasa a minusculas—, y un sha256 en hexadecimal ya esta en minusculas.
 * - La regla antiduplicado sigue funcionando: la misma ficha da la misma
 *   entrada, luego la misma huella, luego la misma clave en el indice unico.
 * - Agrupar solo exige distinguir, no poder leer. Esa es la razon que el propio
 *   modulo da para hashear.
 *
 * La normalizacion replica la del servidor (host + ruta, sin esquema, sin query,
 * sin fragmento, sin barra final) para que dos visitas a la misma ficha con
 * distinto `?ref=` sigan colapsando en una.
 */

export const normalizarConsulta = (href: string): string => {
  const recortado = href.trim();
  if (recortado === '') return '';

  let url: URL;
  try {
    url = new URL(recortado);
  } catch {
    return recortado.toLowerCase();
  }

  const host = url.hostname.toLowerCase();
  const ruta = url.pathname.replace(/\/+$/, '').toLowerCase();
  return ruta === '' ? host : `${host}${ruta}`;
};
