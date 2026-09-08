# ADR 0004 — La extension entrega el documento; el backend lo interpreta

Estado: aceptado. Sustituye a la extraccion en el cliente descrita en el plan original.

## Contexto

Habia dos caminos para obtener las caracteristicas de una ficha, y los dos existian:

- **A. Extraccion en el cliente.** Adaptadores por marketplace dentro de la extension,
  con sus `selectors.ts`. Implementado y funcionando para Mercado Libre.
- **B. Extraccion en el servidor.** `POST /api/v1/DocumentAnalysis/Features` recibe
  `{ url, html }` con el documento que el navegador ya renderizo y devuelve las siete
  caracteristicas con su estado de extraccion.

Mantener los dos significaba mantener dos copias de los mismos selectores.

## Decision

**B.** La extension manda `document.documentElement.outerHTML` sin recortar y el backend
lo interpreta. Los selectores de caracteristicas se eliminan del cliente.

Lo que **no** se va al servidor, porque no es interpretacion sino presentacion:
`identificar()` (que publicacion es), `anclaBadge()` (donde insertar el badge) y
`tarjetas()` (que tarjetas del carrusel enlazar). El puerto `MarketplaceAdapter` sigue
existiendo con esas tres operaciones; perdio `extraer()`.

## Por que

**1. Las dos copias ya habian divergido.** El backend tiene `MercadoLibreWarrantyRule`,
que descarta las menciones que niegan la garantia: Mercado Libre escribe "Sin garantia" en
el mismo nodo y con las mismas clases que una garantia real. El adaptador de cliente solo
comprobaba que el nodo existiera, asi que **contaba "Sin garantia" como garantia
declarada**. Un falso positivo a favor del vendedor, que es la direccion en la que este
sistema no se puede equivocar. No es un argumento hipotetico sobre duplicacion: ya habia
pasado.

**2. El servidor resuelve mas caracteristicas.** Lee `vendedor_reconocido` del distintivo
de lider (`.ui-seller-data-status__lider-seller`), que el cliente no leia en absoluto.

| | Resueltas de las ocho |
|---|---|
| A + veracidad de dominio | 6 |
| B + veracidad de dominio | **7** — solo falta autenticidad de resenas |

**3. La velocidad de correccion, que es lo decisivo.** Cuando una remaquetacion rompe un
selector: con A hay que publicar version nueva y esperar la revision de Chrome Web Store,
AMO y App Store —esta ultima puede tardar mas de una semana— con **todos** los usuarios
instalados rotos mientras tanto. Con B se corrige y se redespliega en minutos, sin que
nadie actualice nada.

**4. "Funciona sin red" valia poco.** Era la ventaja de A, pero sin backend no hay
veredicto de todos modos: la politica se abstiene y el reporte ya exige sesion. Un
extractor que resuelve cinco caracteristicas y no puede emitir veredicto no le sirve al
comprador.

Por eso A **no** se conserva como respaldo: daria veredictos distintos segun el estado de
la red, que es lo ultimo que se quiere en un artefacto de tesis.

## Consecuencias

**Sobre la restriccion de la tesis: no se toca.** La prohibicion es sobre lo que se le
hace al marketplace —nada de navegacion automatizada, ni recorrido de paginas, ni
peticiones al vendedor que el usuario no hubiera cursado igual— y sigue cumpliendose: es
el mismo documento que el navegador ya recibio, interpretado en otro sitio. El backend
ademas marco obsoleto su scraper por URL, asi que ahora cumplen los dos lados.

**Sobre la privacidad: aqui SI cambia algo, y hay que decirlo en el paper.** Antes solo
salian las ocho caracteristicas. Ahora sale el documento entero de la pagina en la que
esta el comprador, que puede incluir contenido personalizado de su sesion: su nombre en la
cabecera, su carrito, recomendaciones derivadas de su historial. El backend documenta que
no lo persiste, no lo registra, descarta el mensaje de las excepciones por si arrastra un
fragmento, tiene tests que lo comprueban, y no devuelve el texto ni la autoria de las
resenas. Todo eso es serio, pero **no persistir no es no enviar**. Un revisor puede leer
"la extension manda el HTML a un servidor" y concluir que el scraping se movio de sitio;
hay que anticipar esa lectura, no esperar la pregunta.

**Regresion en amplitud.** El backend implementa Mercado Libre; AliExpress y Facebook
Marketplace estan andamiados y responden cobertura 0. Amazon y eBay no existen ahi. Los
adaptadores de cliente de Amazon y eBay se descartaron: eran selectores plausibles sin
ningun fixture real detras, y amplitud sin verificar vale poco.

**Coste de red.** Cada analisis sube varios MB. El limite es 8 MB en bytes UTF-8, medidos
con `Blob`, no con `length`. La extension lo comprueba antes de subir, porque mandar 12 MB
para recibir un 400 gasta los datos del comprador para nada. El contrato del endpoint ya
esta disenado para que el recorte se mueva al cliente sin cambiarlo; ese es el papel que
le queda al conocimiento de contenedores por plataforma que conservan los adaptadores.

**Los fixtures de HTML real se fueron con la extraccion.** Ahora pertenecen a las pruebas
del backend.

## Regla que sustituye a la de los selectores

El DTO del backend usa `int` y `double` no nulables, asi que un 0 puede ser una medicion o
un selector que fallo. **Nunca se lee un valor sin su estado.**

| `status` | Estado en el modelo |
|---|---|
| 1 leida del documento | `conocido` |
| 2 ausencia confirmada | `conocido` — el documento llego, el contenedor estaba, la caracteristica no aparecia. Es un hecho |
| 3 no se pudo determinar | `indeterminado` — el numero es relleno |
| 4 la calcula otra etapa | `indeterminado` — provisional |

## Pendientes de backend, no resueltos aqui

1. El endpoint **exige autenticacion**, igual que el resto de la API. Choca con el
   requisito de usar la extension sin cuenta.
2. `porcentaje_reseñas_falsas` llega siempre diferida: el modelo de resenas no existe.
3. Reputacion del vendedor se resuelve hoy como binaria (distintivo de lider). Cuando
   exista el historial agregado habra que revisar el corte de `ThresholdPolicy`, que se
   bajo a `>= 1` porque con `>= 2` esa caracteristica **jamas** podia resultar favorable.
