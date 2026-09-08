# Contrato propuesto: motor de riesgo

**Estado: propuesta. Este endpoint NO existe hoy en ScamShieldAPI.**
Mientras tanto, `MockRiskEngineClient` lo simula por completo.

## Por que hace falta uno nuevo

El endpoint actual es `POST /api/v1/InquiryResult/Estimate`, y su cuerpo es literalmente:

```json
{ "url": "https://www.mercadolibre.com.pe/..." }
```

El servidor recibe una URL y **visita la pagina el mismo** con Playwright. Ese es el flujo
de TP1 y es justo lo que la arquitectura nueva reemplaza: la extension no pide que nadie
visite nada, manda las caracteristicas que ya leyo del DOM que el navegador entrego al
comprador.

Tres razones por las que el contrato viejo no sirve:

1. **Manda una URL.** Obliga al servidor a navegar, que es la definicion de lo que el
   diseno prohibe.
2. **No admite el estado "indeterminado".** `EstimateRiskRequestDto` tiene siete campos
   `int`/`double` no nullables: un selector que falla produce `0`, indistinguible de una
   observacion negativa.
3. **Exige cuenta.** Verificado: `POST /InquiryResult/Estimate` sin token responde
   `401 {"Message":"Null or invalid token"}`, por el middleware deny-by-default de
   `Interface/Middlewares/AuthMiddleware.cs`. El comprador no deberia necesitar cuenta.

## Propuesta

```
POST /api/v1/risk/evaluate
```

Sin autenticacion: la consulta de riesgo es anonima. Guardar en historial sigue siendo un
endpoint distinto y ese si requiere cuenta.

### Request

```jsonc
{
  "plataforma": "Mercado Libre",
  "publicacionId": "MPEU3173976853",   // solo el id, nunca la URL ni el HTML
  "features": {
    "proteccionDePago":      { "kind": "conocido", "valor": "declarada", "evidencia": "..." },
    "puntuacionDelProducto": { "kind": "conocido", "valor": 4.8, "evidencia": "..." },
    "presenciaDeResenas":    { "kind": "conocido", "valor": true, "evidencia": "..." },
    "politicasDeGarantia":   { "kind": "conocido", "valor": 2, "evidencia": "..." },
    "volumenDeVentas":       { "kind": "conocido", "valor": 500, "evidencia": "..." },

    // Las tres que resuelve el servidor llegan sin resolver desde el cliente.
    "veracidadDeDominio":    { "kind": "indeterminado", "motivo": "La resuelve el motor." },
    "reputacionDelVendedor": { "kind": "indeterminado", "motivo": "La resuelve el motor." },
    "autenticidadDeResenas": { "kind": "indeterminado", "motivo": "La resuelve el motor." }
  }
}
```

Cada caracteristica es uno de tres estados: `conocido` (con `valor` y `evidencia`),
`no-aplica` (con `motivo`) o `indeterminado` (con `motivo`).

### Response

```jsonc
// Con evidencia suficiente
{
  "kind": "riesgo",
  "nivel": "bajo",                    // alto | moderado | bajo
  "confianza": 0.875,
  "sustentan":   ["proteccionDePago", "puntuacionDelProducto", "..."],
  "sinResolver": ["reputacionDelVendedor"]
}

// Sin evidencia suficiente
{
  "kind": "evidencia-insuficiente",
  "resueltas":   ["puntuacionDelProducto", "presenciaDeResenas"],
  "sinResolver": ["veracidadDeDominio", "..."],
  "dimensionesVacias": ["identidad-del-sitio"],
  "motivo": "Faltan datos de: identidad-del-sitio."
}
```

## Lo que el backend tendria que implementar

| Caracteristica | Estado hoy |
|---|---|
| `veracidadDeDominio` | **No existe nada.** Cero coincidencias de whois, dns, cname o veracidad en todo `ScamShieldAPI`. Es, ademas, la unica caracteristica de la dimension `identidad-del-sitio` (ver ADR 0002) |
| `reputacionDelVendedor` | Parcial: `GET /api/v1/Seller` devuelve un `riskLevel` ya calculado, no una reputacion |
| `autenticidadDeResenas` | Existe el servicio DistilBERT (`POST /predict`), pero cuelga del backend y no es accesible desde la extension |

## Reglas que el cliente respeta pase lo que pase

- **Ante fallo, timeout o respuesta ilegible, el veredicto es `evidencia-insuficiente`.**
  Nunca `riesgo bajo`. Un backend caido no es senal de que la publicacion sea segura.
  Cubierto por tests en `tests/transport/mock.test.ts`.
- **Solo viajan las ocho caracteristicas.** Nunca el HTML de la pagina, nunca la URL
  completa, nunca el texto crudo de las resenas mas alla de lo que la caracteristica 4
  necesite.


## Veracidad de dominio — endpoint real (ya no es mock)

La caracteristica 2 dejo de simularse. La resuelve el background contra la API real
antes de invocar al motor de riesgo:

```
POST /api/v1/DomainAnalysis/Veracity    body: { "url": "https://..." }
GET  /api/v1/DomainAnalysis/Veracity?url=...
```

Exige JWT, como el resto de la API. Encaja con el diseno actual: sin sesion no hay
reporte, asi que el token siempre esta disponible cuando se llama.

### Por que enviar la URL no contradice la restriccion de la tesis

Lo que el backend analiza es el **nombre de dominio** contra registro, DNS, TLS y
listas de reputacion. No visita la ficha del vendedor ni descarga su HTML. La unica
fuente de datos de la publicacion sigue siendo el documento que el navegador del
comprador ya recibio. La prohibicion de scraping se mantiene intacta.

### Traduccion de la escala a los tres estados

El backend devuelve `veracity` en 1..5, donde 3 es "sin evidencia suficiente". Ese 3
**no** se traduce automaticamente a `indeterminado`: dentro de la escala del backend
significa dos cosas distintas, y lo que las separa es `confidence` (1..4).

| veracity | confidence | Estado en el modelo |
|---|---|---|
| 3 | 1-2 (muy baja / baja) | `indeterminado` — no hubo con que evaluar |
| 3 | 3-4 (media / alta) | `conocido(3)` — se evaluo y no inclina a ningun lado |
| 1, 2, 4, 5 | cualquiera | `conocido(n)` |

`ThresholdPolicy` cuenta la caracteristica como favorable solo desde `>= 4`
("probablemente legitimo" y "legitimo"). El 3 es un valor conocido que no acredita nada.

### Presentacion

`unverifiedSignals` se muestra en el panel junto a las senales de riesgo y a favor,
con el mismo peso visual. No haber podido comprobar algo es informacion para el
comprador; ocultarlo lo presentaria como seguridad.

### Timeout

El presupuesto del analizador es de 5 s y degrada parcial. El cliente espera **9 s**
para no cortar un veredicto que el backend igual iba a entregar. Si expira, la
caracteristica queda `indeterminado`, nunca favorable.

## Lo que sigue simulado

`reputacionDelVendedor` y `autenticidadDeResenas`. `MockRiskEngineClient` no les inventa
valores: las deja como llegan (indeterminadas) y la politica se abstiene.
