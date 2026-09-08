# ADR 0002 — Tres estados por caracteristica y regla de abstencion

Fecha: 2026-09-07 · Estado: aceptado (la politica de decision, en revision)

## Contexto

El sistema debe poder responder "no lo se". El backend de TP1 no puede: sus siete
caracteristicas son `int`/`double` no nullables
(`Application/DTOs/Classification/Request/EstimateRiskRequestDto.cs`), asi que un selector
que no matchea produce `0`, y `0` es indistinguible de una observacion negativa. El unico
vestigio de tri-estado esta en `FacebookHelper.cs`, que devuelve `2` para dos
caracteristicas; el resto colapsa.

Esa perdida de informacion es exactamente lo que la regla de abstencion necesita para
funcionar, y es la razon de este ADR.

## Decision

1. Cada caracteristica es un tipo suma de tres estados: `conocido`, `no-aplica`,
   `indeterminado`. Nunca `null`, nunca un booleano, nunca un centinela numerico.
2. Solo `conocido` cuenta como resuelta.
3. El veredicto tiene cuatro desenlaces, y `evidencia-insuficiente` es uno de pleno
   derecho, no un error.
4. La regla de decision vive detras de `DecisionPolicy`, inyectable.

## Las tres dimensiones

| Dimension | Caracteristicas | Origen |
|---|---|---|
| Identidad del sitio | Veracidad de dominio | backend |
| Fiabilidad del vendedor | Reputacion, volumen de ventas, politicas de garantia, proteccion de pago declarada | backend + 3 de cliente |
| Evidencia de la comunidad | Puntuacion, presencia de resenas, autenticidad de resenas | 2 de cliente + backend |

## Observacion sobre la regla vigente (r>=4 y una caracteristica por dimension)

La regla se enuncia como una conjuncion de dos condiciones, pero en la practica solo una
manda. Dos consecuencias, en este orden:

1. **`r>=4` es efectivamente redundante.** Las cinco caracteristicas de cliente se
   resuelven casi siempre, porque dependen del DOM que el navegador ya renderizo. Si esas
   cinco resuelven, el umbral se cumple **por construccion**, y solo deja de cumplirse
   cuando la extraccion falla por completo, que es justamente el caso en que la segunda
   condicion ya habria abstenido.

2. **La condicion que de verdad manda es la dimension 1**, que tiene UNA sola
   caracteristica y ademas es de backend. En la practica la regla se reduce a *"veracidad
   de dominio resuelta, o no hay veredicto"*. Y hoy el backend ni siquiera la implementa:
   no hay una sola coincidencia de whois, dns, cname ni veracidad en todo `ScamShieldAPI`.

O sea que, tal como esta enunciada y con el backend actual, el sistema **se abstendria
siempre**. El desbalance 1-4-3 de las dimensiones no es un detalle de presentacion: es lo
que determina el comportamiento de la regla.

Esta observacion se deja escrita aqui porque alimenta el rediseno de la regla en el paper
vigente. `ThresholdPolicy` implementa la regla tal cual esta, marcada en revision, para que
el cambio sea una sustitucion de politica y no una refactorizacion.

## Consecuencias

- La UI debe distinguir visualmente los tres estados, no solo el veredicto.
- El contrato con el backend tiene que transportar los tres estados; el DTO de TP1 no puede.
- Cuando la regla cambie, se sustituye la implementacion de `DecisionPolicy` y nada mas.
