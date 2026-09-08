# Adaptadores de marketplace

Desde [ADR 0004](adr/0004-analisis-de-documento-en-el-servidor.md) los adaptadores **ya no
extraen caracteristicas**. Eso lo hace el backend sobre el documento que la extension le
entrega. Lo que queda aqui es lo irreduciblemente del cliente.

## Que hace cada adaptador

| Operacion | Para que |
|---|---|
| `esPlataforma(url)` | Si la URL pertenece al marketplace, sea ficha o listado |
| `reconoce(url)` | Si ademas es una ficha de producto analizable |
| `identificar(url)` | Que publicacion es, a partir del patron de URL |
| `anclaBadge(doc)` | Donde insertar el badge dentro de la ficha |
| `tarjetas(doc)` | Que tarjetas de listado y carrusel enlazar |

Ninguna interpreta el contenido. Si una remaquetacion invalida `anclaBadge`, el badge cae
a una posicion fija en la esquina; el veredicto no depende de ella.

## Por que el identificador va por URL y no por CSS

El patron de una ficha (`/MPE-449861158-titulo-_JM`, `/dp/B0CHX1W1XY`, `/itm/166234567890`,
`/item/1005006123456789.html`) es parte del esquema publico de cada plataforma y sobrevive
a las remaquetaciones. Los nombres de clase no. En Mercado Libre las tarjetas se localizan
subiendo desde los enlaces a ficha por esa misma razon.

## Cobertura real

Lo que la extension puede analizar depende del backend, no de esta capa:

| Plataforma | Badge e identificacion | Analisis del documento |
|---|---|---|
| Mercado Libre | si | **implementado**, selectores reales |
| AliExpress | si | andamiado: cobertura 0 |
| Amazon | si | **no existe en el backend** |
| eBay | si | **no existe en el backend** |

En Amazon y eBay el badge aparece y el analisis devolvera todo indeterminado, con lo que la
politica se abstiene. Es el comportamiento correcto, no el deseable: completarlas es
escribir sus selectores en el backend.

## AliExpress: el caso del hash

Sus clases llevan un hash generado en cada build (`buy-now--Vqjyx`), asi que los selectores
de anclaje usan `[class*="prefijo--"]`, que sobrevive al hash porque el prefijo semantico
se conserva.
