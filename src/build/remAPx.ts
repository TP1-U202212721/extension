/**
 * Pasa los `rem` del CSS compilado a `px` (1rem = 16px).
 *
 * El shadow root aisla los estilos, pero `rem` sigue refiriendose a la fuente del
 * `<html>` de la PAGINA. Temu la pone en 100px, y el badge salia seis veces mas
 * grande. En px mide lo mismo en cualquier sitio.
 *
 * SOLO se tocan los valores de las declaraciones y las consultas `@media`. Los
 * SELECTORES quedan intactos: Tailwind nombra sus clases con el valor dentro
 * (`.max-h-\[calc\(100vh-2rem\)\]`), y convertirlos dejaba el CSS sin aplicar
 * porque el elemento sigue llevando la clase con `rem` en su atributo. Asi se
 * perdio el alto maximo del panel, y con el, su scroll.
 */

const REM = /(-?\d*\.?\d+)rem\b/g;

/** Cada `rem` a px. Se usa sobre valores, nunca sobre un selector. */
export const remAPx = (css: string): string =>
  css.replace(REM, (_, n: string) => `${String(Number.parseFloat(n) * 16)}px`);

/** Declaracion: lo que va tras `prop:` hasta el `;` o el cierre del bloque. */
const DECLARACION = /([{;]\s*[-\w]+\s*:)([^;{}]*)/g;

/** Prelucio de una consulta `@media`, donde `rem` se mide contra la fuente inicial. */
const MEDIA = /@media[^{]+/g;

export const cssSinRem = (css: string): string =>
  css
    .replace(DECLARACION, (_, propiedad: string, valor: string) => propiedad + remAPx(valor))
    .replace(MEDIA, remAPx);
