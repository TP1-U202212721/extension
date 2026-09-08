# Adaptadores de marketplace

Cada adaptador implementa `MarketplaceAdapter` y solo lee el documento que el
navegador ya renderizo. Ningun adaptador emite peticiones hacia la plataforma
del vendedor, ni recorre paginas, ni abre iframes.

## Estado de verificacion

Es la distincion que mas importa al leer este codigo:

| Plataforma | Selectores | Fixture de HTML real | Datos estructurados |
|---|---|---|---|
| Mercado Libre | **verificados** contra HTML real | si, `tests/fixtures/mercadolibre/` | JSON-LD `Product` |
| Amazon | plausibles, **sin verificar** | no | no publica JSON-LD de producto |
| eBay | plausibles, **sin verificar** | no | JSON-LD `Product` |
| AliExpress | plausibles, **sin verificar** | no | JSON-LD `Product` |

"Sin verificar" significa que las cascadas se construyeron sobre los
identificadores documentados y estables de cada sitio, pero **nadie las ha
contrastado contra una ficha real capturada**. La experiencia con Mercado Libre
dice que ahi es donde aparecen los errores: el selector de ventas apuntaba a
`.ui-pdp-subtitle`, que en la ficha real solo dice "Nuevo", y por eso el volumen
de ventas caia siempre a `indeterminado` sin que nada fallara.

Para corregirlos hace falta lo mismo que se hizo con Mercado Libre: abrir una
ficha real en el navegador, copiar el HTML renderizado y guardarlo como fixture.
No se puede capturar desde el servidor: las cuatro plataformas responden con una
pagina de trafico sospechoso a `curl`.

Mientras tanto el comportamiento es correcto aunque no sea el deseable: lo que
no se puede leer queda `indeterminado`, y la politica se abstiene antes que
emitir un veredicto sin sustento.

## Como esta resuelto cada sitio

**Mercado Libre.** JSON-LD primero, CSS de respaldo. Las tarjetas de listado y
carrusel se localizan subiendo desde los enlaces a ficha, porque el patron de la
URL es estable y los nombres de clase no.

**Amazon.** El unico que no publica JSON-LD de producto, asi que todo sale de
selectores. Se prefieren los `id` (`#acrPopover`, `#acrCustomerReviewText`,
`#buybox`), que Amazon conserva porque los usa su propio codigo, sobre las clases
`a-*`. La puntuacion vive en el atributo `title`, no en el texto visible.

**eBay.** JSON-LD primero. De respaldo, las clases del sistema de diseno (`x-*`,
`ux-*`) y los `data-testid`.

**AliExpress.** El caso mas hostil: usa CSS Modules y sus clases llevan un hash
por build (`rating--wrap--DQRRgb`). Un selector exacto duraria un despliegue, asi
que se usa `[class*="prefijo--"]`. Es mas laxo y puede capturar de mas, por eso
todo valor se valida contra su escala antes de darlo por conocido: un `129.90`
capturado del precio se descarta en vez de convertirse en una puntuacion falsa.

## Regla que ningun adaptador puede romper

1. Solo lectura del documento ya renderizado.
2. Nunca lanza. Un selector que no matchea produce `indeterminado`, no una excepcion.
3. Nunca devuelve un valor por defecto que se confunda con una observacion. Que
   Amazon no muestre la prueba social no significa cero ventas.
