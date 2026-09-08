# ADR 0006 — Los insumos de reputacion y resenas se leen en el cliente

Estado: aceptado por decision del autor del backend. Revierte parcialmente
[ADR 0004](0004-analisis-de-documento-en-el-servidor.md).

## Decision

`POST /SellerReputation/Estimate` y `POST /ReviewAnalysis/Authenticity` **no reciben el
documento**: reciben datos ya estructurados. El backend se queda como esta y el ajuste lo
hace la extension. Los dos analizadores quedan encendidos.

## El costo asumido, dicho sin adornos

Se propuso que esos endpoints aceptaran `{ url, html }` como `DocumentAnalysis/Features`.
**El autor decidio que no.** El diagnostico que motivo la propuesta sigue en pie y se
registra aqui para que la consecuencia no sorprenda a nadie:

1. **Los selectores de Mercado Libre quedan en dos repositorios.** El backend lee del
   documento las siete caracteristicas; la extension lee del mismo documento el nombre del
   vendedor, su distintivo, sus ventas, su puntuacion, su antiguedad y el texto de las
   opiniones. Son dos lecturas de la misma maquetacion, mantenidas por separado.

2. **El dia que Mercado Libre remaquete habra que corregir en los dos sitios.** Y no
   cuestan lo mismo: el backend se corrige y se redespliega en minutos; la extension exige
   publicar version nueva en Chrome Web Store, AMO y App Store, con revision de por medio y
   todos los usuarios instalados rotos mientras tanto.

3. **Divergiran.** Ya paso una vez: el backend tenia `MercadoLibreWarrantyRule` para
   descartar "Sin garantia" y el adaptador de cliente no, asi que contaba una negacion como
   garantia declarada. No es una hipotesis.

**Mitigacion aplicada:** todos los selectores nuevos viven en
`src/extraction/adapters/mercadolibre/selectors.ts`, el mismo archivo aislado por
plataforma que ya existia, en las secciones `VENDEDOR` y `RESENAS`. Ninguno se repite fuera
de ahi. Una remaquetacion se corrige en un solo archivo del lado del cliente.

## La regla que protege este diseno: OMITIR NO ES MANDAR CERO

En el contrato del backend, un campo **ausente** produce una senal *no verificable*, y el
mismo campo presente en **0** produce una senal *desfavorable*. Rellenar por defecto lo que
no se pudo leer mueve el veredicto en contra del vendedor sin haber medido nada: es el
mismo error que el modelo de tres estados existe para impedir, apuntando al otro lado.

Como se garantiza, en tres capas:

1. **El compilador.** `exactOptionalPropertyTypes` esta activo, asi que asignar `undefined`
   a un campo opcional es un error de tipos. El extractor construye el objeto por spread
   condicional (`...(ventas !== undefined && { completedSales: ventas })`), lo que hace la
   omision explicita en el codigo y no una convencion.

2. **El transporte.** `soloLoLeido` (`src/domain/insumos.ts`) descarta `undefined`, `null` y
   los numeros no finitos antes de serializar. `JSON.stringify` ya descartaba `undefined`,
   pero no `null`, y un `null` llega al backend como campo presente.

3. **Los tests.** `tests/extraction/insumos.test.ts` captura el cuerpo que de verdad sale
   por la red y falla si aparece una clave que no se leyo. Se comprobo que muerden: al
   hacer que `soloLoLeido` acepte `null`, y al hacer que el extractor rellene las ventas con
   `0`, los tests fallan.

Distincion que los tests fijan: **un cero LEIDO si viaja**, porque es una observacion. Lo
que no viaja es un cero inventado.

**Efecto util:** un selector sin verificar que no matchea produce una clave ausente, o sea
"no se pudo comprobar", nunca una senal en contra. La disciplina de omision protege justo
donde la extraccion es mas fragil.

## Lo que se omite a proposito, no por fallo

`claimShare`, `cancellationShare` y `onTimeDeliveryShare` **no estan en la ficha del
producto**: viven en la pagina de reputacion del vendedor. Ir a buscarlas seria navegacion
automatizada, que es exactamente lo que la tesis prohibe. Se omiten siempre, y el
analizador lo refleja bajando su cobertura.

Lo mismo con las resenas: se mandan las que el navegador ya renderizo. Si la ficha muestra
tres, se mandan tres. Paginar para conseguir el resto seria scraping.

## Donde corre esta lectura

En el **content script**, no en el background: el service worker de MV3 no tiene
`DOMParser`, asi que el background no podria reconstruir el documento a partir del HTML.
Los insumos viajan en el mensaje junto al documento.

## Lo que no cambia

Las siete caracteristicas del documento las sigue resolviendo `DocumentAnalysis/Features`
en el servidor. Lo que se agrega aqui es solo lo que esos dos endpoints necesitan y el
documento no devuelve.
