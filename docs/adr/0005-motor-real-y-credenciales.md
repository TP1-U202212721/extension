# ADR 0005 — Motor real, credenciales aisladas, y de donde salen los insumos

Estado: aceptado, con un punto abierto que necesita decision del backend.

## Que quedo real

El motor por defecto es `BackendRiskEngineClient`. El simulado sigue disponible
cambiando una linea en `src/config.ts` (`MOTOR = 'mock'`), pero ya no es el camino normal
y no consulta nada.

| Caracteristica | Origen | Estado |
|---|---|---|
| Proteccion de pago | `POST /DocumentAnalysis/Features` | **real** |
| Puntuacion del producto | idem | **real** |
| Presencia de resenas | idem | **real** |
| Politicas de garantia | idem | **real** |
| Volumen de ventas | idem | **real** |
| Veracidad de dominio | `POST /DomainAnalysis/Veracity` | **real** |
| Reputacion del vendedor | `POST /SellerReputation/Estimate` | cliente escrito, **desactivado** (PR 10) |
| Autenticidad de resenas | `POST /ReviewAnalysis/Authenticity` | cliente escrito, **desactivado** (PR 10) |

Seis de ocho resueltas hoy contra endpoints reales.

## Por que la reputacion NO se deriva del documento

`DocumentAnalysis/Features` devuelve `vendedor_reconocido` como 0/1. Seria facil mapearlo
a la escala nueva, y estaria mal: el propio catalogo de senales dice que ese distintivo
pesa 2.5 sobre 20.2 y que **un vendedor del que solo se conoce el distintivo sale como
"Sin verificar" por cobertura baja**. Traducir aqui ese binario a un nivel inventaria
evidencia que nadie midio. Queda `indeterminado` hasta que el PR 10 entre.

## Las escalas de las tres caracteristicas de backend

Las tres comparten forma: ordinal de cinco niveles con el **3 reservado a "no se sabe"**.
Por eso `ThresholdPolicy` usa el mismo corte para las tres: solo 4 y 5 acreditan algo. El
3 es un valor conocido que no inclina a ningun lado.

En dominio y reputacion, el 3 con confianza 1-2 se traduce a `indeterminado`: ahi el 3
significa "no hubo con que evaluar". En autenticidad de resenas el 3 **no es alcanzable
desde una medicion**, asi que siempre es `indeterminado`, igual que `status` 2 y 3 y que
un `suspectRate` nulo.

`suspectRate` nulo nunca se lee como 0: un cero diria "ninguna resena es falsa", que es lo
contrario de lo que se sabe.

## Credenciales aisladas

`TokenProvider` (`src/auth/TokenProvider.ts`) es la unica puerta por la que entra una
credencial. Hoy `SessionTokenProvider` la toma de la sesion del cliente web
([ADR 0003](0003-autenticacion-delegada-al-cliente-web.md)).

Existe porque **los cuatro endpoints exigen autenticacion**: ninguno lleva
`[AllowAnonymous]` y `AuthMiddleware` deniega por defecto. Eso choca de frente con el
requisito de usar la extension sin cuenta. **Pendiente de backend, no resuelto aqui.** El
dia que se abran, el cambio es sustituir la implementacion en `src/config.ts`
(`SinCuentaTokenProvider` ya esta escrito) y nada mas: ni el motor ni los clientes saben de
donde viene el token.

Sin credencial, `evaluar` lanza `SesionRequeridaError` y la UI ofrece iniciar sesion.
Nunca emite un veredicto.

## Degradacion: siempre hacia arriba en cautela

Regla que ninguna rama puede romper, y hay tests que la fijan:

- Fallo, timeout o respuesta ilegible de un analizador -> esa caracteristica queda
  `indeterminado`. **Jamas favorable.**
- Un analizador desactivado -> `indeterminado`, con el motivo dicho.
- Todo caido -> `evidencia-insuficiente`. Un backend caido no es senal de que la
  publicacion sea segura.

Timeouts: dominio 9 s (presupuesto del analizador 5 s, mas margen para no cortar un
veredicto que igual iba a llegar), documento 20 s (sube varios MB), reputacion 9 s,
resenas 15 s (el clasificador de resenas es el mas lento).

## El punto abierto: los insumos del PR 10

Los dos endpoints nuevos **no reciben el documento**. Reciben datos ya estructurados:

- `SellerReputation/Estimate`: fecha de alta, ventas completadas, nivel de distintivo,
  puntuacion agregada, proporcion de reclamos, cancelaciones, entregas a tiempo.
- `ReviewAnalysis/Authenticity`: el texto de cada resena y su puntuacion.

Alguien tiene que leer todo eso del DOM. Que lo haga la extension **reintroduce
exactamente la duplicacion de selectores que [ADR 0004](0004-analisis-de-documento-en-el-servidor.md)
elimino**, y con el mismo desenlace previsible: dos copias que divergen, y una de ellas
solo corregible publicando en tres tiendas.

Ademas hay un detalle del contrato que lo empeora: **todos los campos son opcionales y
omitir no es lo mismo que mandar 0**. Omitir produce una senal no verificable; mandar 0
produce una senal desfavorable. Un extractor de cliente que rellene por defecto cambia el
veredicto en contra del vendedor sin haber medido nada.

**Propuesta al backend:** que estos dos endpoints acepten `{ url, html }` como
`DocumentAnalysis/Features`, o que `DocumentAnalysis` devuelva los insumos ya extraidos.
El backend ya tiene el extractor de Mercado Libre y ya sabe distinguir "no aparecia" de
"vale cero". Mientras tanto, `src/config.ts` inyecta `insumosPendientes`, que no lee nada
y deja las dos caracteristicas sin resolver.

## Lo que bloquea hoy

1. **Los cuatro endpoints exigen cuenta.** Es el requisito de "sin cuenta" que sigue sin
   resolverse. Aislado tras `TokenProvider`, no reescrito.
2. **El PR 10 no esta mergeado.** Los clientes estan escritos y tipados contra el contrato
   real, pero apagados en `ANALIZADORES`.
3. **De donde salen los insumos del PR 10.** La seccion anterior.
