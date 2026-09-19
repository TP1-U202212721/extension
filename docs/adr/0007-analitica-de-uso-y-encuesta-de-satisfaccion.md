# ADR 0007 — Analitica de uso y encuesta de satisfaccion

Estado: aceptado e implementado.

Contratos del backend que este ADR implementa:

- `docs/analytics/contrato-ingesta.md`, `metricas.md` y `privacidad.md`
- `docs/feedback/contrato-endpoint.md` y `privacidad-y-retencion.md`

## Decision

La extension emite **analitica de uso por lotes** a `POST /api/v1/UsageAnalytics/Events` y
**ofrece una vez** la encuesta de satisfaccion, con el instrumento que publica
`GET /api/v1/Feedback/Instrument` y el envio a `POST /api/v1/Feedback/Responses`.

Las dos cosas comparten una regla que gobierna todo lo demas: **ni la analitica ni la
encuesta pueden romper ni retrasar el veredicto que el comprador esta esperando**, y **ni
la analitica ni la encuesta transmiten la URL, la ruta, el titulo, el vendedor ni el texto
de las resenas**.

---

## 1. La barrera de privacidad, y como se hace cumplir

El paper afirma por escrito que el sistema no recolecta ni retransmite contenido de la
plataforma mas alla de lo que el veredicto requiere. La ruta de una ficha revela **que
producto concreto mira una persona**, asi que no sale del navegador. Tampoco el titulo, ni
el nombre del vendedor, ni el texto de ninguna resena.

Esto no se sostiene con disciplina, se sostiene con tres barreras:

1. **Un tipo que no se puede fabricar.** `DominioRegistrable`
   (`src/domain/analitica/sitio.ts`) es una cadena marcada que solo produce
   `dominioRegistrable()`, y es el unico tipo que el campo `site` de un evento acepta.
   **Pasar una URL entera no compila.**

2. **Un solo embudo.** Todo evento nace en `src/analytics/Analitica.ts`, y ahi es donde la
   URL se reduce a dominio y la categoria a su forma gruesa. Para auditar la regla basta
   con leer dos archivos.

3. **Tests que muerden.** `tests/analitica/sitio.test.ts` fija la reduccion caso a caso;
   `tests/analitica/eventos.test.ts` y `tests/analitica/ingesta.test.ts` serializan un
   lote realista y fallan si aparece la ruta, el `@` de un correo o un `http`;
   `tests/analitica/desenlace.test.ts` comprueba que de una caracteristica viaja su
   nombre y **nunca su valor** (`4.6`, `5000` y la palabra "ficha" no aparecen).

### Lo que si se emite, y por que no es una contradiccion

Viaja el **juicio derivado del propio sistema**: el nivel ordinal de cada analizador, su
confianza, los topes que actuaron y el conteo de senales por familia. Nada de eso existia
antes de que ScamShield lo computara: no es un dato de la plataforma ni del comprador, es
**la salida del artefacto que la tesis evalua**. Guardar la salida del sistema que se esta
midiendo es tomar la medicion, no vigilar. El razonamiento largo esta en la seccion 1 bis
de `privacidad.md` del backend.

### Lo que se decidio NO emitir

| No se emite | Por que |
|---|---|
| La URL o la ruta de la ficha | Revela que producto mira la persona. La regla del paper |
| El titulo, el vendedor, el texto de resenas | Contenido de la plataforma |
| El valor de una caracteristica | Solo viaja su nombre y su estado |
| La **cobertura** del analisis | El contrato dice que la calcula el servidor a partir de `features`. Mandarla seria una segunda version de la cifra de la Fase 1 |
| El **puntaje** de una abstencion | Un 0 se leeria como "lo peor posible", y nadie afirmo eso. Se omite |
| La **confianza** de un analizador que devolvio 0 | La escala es 1 a 4: un 0 es "sin dato", no una medicion |
| La **proporcion de resenas sospechosas** cuando no hubo medicion | Un 0 diria "ninguna resena es falsa", lo contrario de lo que se sabe |
| Los **codigos exactos** de cada senal | Una lista de codigos por consulta se acerca a una huella de la ficha. Se emite el conteo por familia, que es el nivel al que razona la tesis |

Es la misma regla de `docs/adr/0006`, apuntando al mismo sitio: **omitir no es mandar
cero**. `serializarLote` descarta `undefined`, `null`, las cadenas y las listas vacias, y
**conserva los ceros**, porque una latencia de 0 ms o un puntaje de 0 son observaciones.

### La categoria

Es lo unico que se emite sobre *que* mira el comprador, y el contrato la admite recortada.
La extension manda los **dos primeros** escalones de las migas de pan, no el ultimo: el
ultimo describe el producto concreto. Se recorta en el cliente —maximo dos segmentos,
cinco palabras por segmento, fuera lo que lleve cuatro digitos seguidos— porque la
respuesta de la ingesta trae `sanitized`, y por contrato un valor distinto de cero **es un
defecto de la extension**, no una tolerancia del servidor.

Solo Mercado Libre la lee hoy. Los otros tres adaptadores devuelven vacio, igual que con
`insumos`: inventarla seria peor que no tenerla.

---

## 2. La cola: por lotes, persistente y con retroceso

`src/domain/analitica/cola.ts` tiene las reglas, puras y con tests.
`src/analytics/ColaAnalitica.ts` les pone el almacenamiento, la alarma y la red.

- **Por lotes.** Se envia al llegar a 20 eventos o con el tic de un minuto, lo que ocurra
  antes. Nunca una peticion por clic.
- **Sobrevive al cierre del navegador.** El estado vive en `storage.local` y se escribe en
  cuanto se encola. En MV3 el service worker se apaga solo y `chrome.runtime.onSuspend` no
  es de fiar; una cola en memoria se perderia casi siempre. Por eso se anadio el permiso
  **`alarms`**: una alarma es lo unico que vuelve a despertar al worker.
- **Un lote, una sesion.** El sobre lleva un solo `sessionId`, asi que la cola guarda la
  sesion con cada evento y agrupa al enviar. Sin esto, los eventos de una pestana se
  atribuirian a otra.
- **Retroceso exponencial** de 1 a 30 minutos. Un 400 **no** se reintenta: volveria a
  fallar. Un 401 o un 5xx si. Con `moduleEnabled: false` se tira lo acumulado y se calla
  un dia, y pasado el plazo se vuelve a preguntar, porque el modulo pudo encenderse.
- **Tope de 500 eventos**, descartando los mas viejos: son los que mas cerca estan de
  caducar por el limite de 7 dias del contrato.
- **Todo fallo se traga.** Ningun metodo de la cola propaga una excepcion y el veredicto
  se responde **antes** de encolar nada.

---

## 3. Lo que hubo que anadir al motor para poder medir

Tres cosas que no existian y que no se pueden reconstruir despues sin inventarlas:

1. **`Traza`** en `Evaluacion` (`src/transport/RiskEngineClient.ts`): como termino y
   cuanto tardo cada analizador. Un timeout y un 500 llegan los dos a la presentacion como
   "indeterminado", y para la tesis no son lo mismo. La latencia se mide alrededor de la
   llamada, no dentro del cliente: lo que interesa es lo que espero el comprador.

2. **`causa`** en el estado `indeterminado` (`src/domain/features.ts`): un simbolo estable
   junto al `motivo`, que es una frase para el comprador. La analitica reporta el motivo
   como `EUndeterminedReason`, y deducirlo del texto seria adivinar. Es **opcional**: donde
   no se sabe, se omite y viaja como "motivo no clasificado" (99).

3. **`puntaje`** en el veredicto de riesgo (`src/domain/verdict.ts`): la cifra continua
   detras del nivel. La devuelve la politica que decidio, en la misma pasada que el nivel,
   para que no haya dos versiones de la misma cifra.

Ninguna de las tres cambia lo que el comprador ve.

### Un mapeo que deberia desaparecer

Los topes aplicados llegan como **frases en espanol** en `limitations`, y el contrato pide
su codigo. `src/domain/analitica/topes.ts` traduce frase a codigo por fragmento
distintivo. No sirve mirar `riskSignals`: que una senal este presente no significa que haya
topeado —el backend solo aplica el techo si el veredicto estaba por encima—, y la unica
evidencia de que un tope **actuo** es su frase en `limitations`. El dia que el backend
exponga el codigo, este archivo se borra. `tests/analitica/topes.test.ts` fija las quince
frases reales del backend.

### Nombres de caracteristica

Se reutiliza el nombre del analizador de documento donde la caracteristica es la misma
(`puntuacion_producto`, `politicas_garantia`, `productos_vendidos`,
`medios_pago_reconocidos`), para que la cobertura del reporte se pueda cruzar con la del
propio analizador. Las tres que resuelven analizadores propios llevan nombre propio, y
`reputacion_vendedor` **no** se emite como `vendedor_reconocido`: aquel era el binario del
documento y esta es la escala ordinal de cinco niveles donde el 3 es "sin verificar".
Mezclarlos pondria dos mediciones distintas en la misma fila. Todos van en ASCII.

---

## 4. Los desenlaces 6 y 7, dichos con su limitacion

"Hizo caso a la advertencia" y "Continuo pese a la advertencia" son la pregunta que la
tesis quiere responder, y hay que decir con que precision se miden:

- **Continuo (7) es una observacion.** Se emite cuando el comprador pulsa un control de
  compra de la propia ficha. El clic ocurrio. Los selectores viven aislados por plataforma
  (`selectoresDeCompra()` en cada adaptador) y **solo se leen**: no se pulsa nada, no se
  cancela el evento y no se toca el flujo de compra del marketplace.

- **Hizo caso (6) es una aproximacion.** Se emite al dejar la ficha tras una advertencia
  de riesgo alto o moderado sin haber tocado ningun control de compra. Irse de una pagina
  no prueba haber hecho caso: se pudo ir por cualquier motivo. **La cifra hay que citarla
  como "abandono sin intencion de compra observada"**, no como acatamiento. Lo que si es
  solido es lo contrario: quien pulso comprar no hizo caso, y eso lo cubre el 7.

Los dos son excluyentes y se emiten una sola vez por advertencia. El evento de abandono
viaja en `pagehide`/`visibilitychange`, y puede perderse si el navegador cierra la pestana
antes de entregar el mensaje: **la tasa de 6 es una cota inferior**.

---

## 5. La encuesta

### Cuando se ofrece, y por que ese criterio

> **Revisado el 2026-09-19.** La primera version ofrecia la encuesta **una sola vez por
> instalacion, desde la tercera consulta**. Se cambio a **una calificacion por consulta**,
> que es ademas lo que el backend ya soportaba: su indice antiduplicado es por
> respondiente, instrumento **y consulta**. El criterio anterior media una impresion
> global; el nuevo mide cada veredicto, que es el dato que la tesis necesita.

El criterio esta en `src/domain/encuesta/criterio.ts`, puro y con nombre, porque es una
decision metodologica y no un detalle de la pantalla. Se ofrece **en cada consulta que dio
veredicto**, salvo que:

1. **La consulta no llego a veredicto.** No hay resultado que calificar ni con que cruzar
   la nota.
2. **El modulo esta apagado**, segun el propio instrumento.
3. **Ya van cinco respuestas hoy** (`MAXIMO_POR_DIA`, dia UTC). Es el mismo tope del
   backend (`Feedback:MaxResponsesPerRespondentPerDay`): pasado ese numero responderia
   `429`, asi que se deja de mostrar en vez de ofrecer algo que va a fallar. Es tambien el
   freno contra el cansancio.
4. **Pasaron menos de 30 segundos del ultimo envio** (`ESPERA_MINIMA_MS`), igual que
   `Feedback:MinSecondsBetweenResponses`.

**"Ahora no" oculta la encuesta solo en esa consulta**; no la cierra para siempre.

Se muestra **dentro del panel del veredicto**, no como ventana emergente: es donde la
persona tiene delante lo que se le pide calificar, y un popup en cada consulta se cierra
sin leer a la tercera vez, lo que llenaria los datos de clics apurados.

**El consentimiento se pide la primera vez y se recuerda por version de texto.** Pedir la
casilla en cada consulta haria la calificacion inviable. Si la persona ya acepto *esa*
version, el panel no vuelve a mostrar la casilla, pero si una linea que indica que esta
participando y un boton para retirarlo. Si el texto del consentimiento cambia, cambia su
version y la casilla vuelve. La version viaja con cada respuesta.

La cuenta diaria, el ultimo envio y el consentimiento viven en `storage.local` (clave
`scamshield.encuesta.estado.v2`), para sobrevivir al cierre del navegador. Solo se anota lo
que el servidor acepto: un `409`, `429` o `503` no cuenta, porque el servidor lleva su
propia cuenta.

**El cuestionario global de quince items del protocolo es otro instrumento** y, cuando se
cargue en el catalogo del backend, se ofrecera aparte y una sola vez: mide la experiencia
entera, no una consulta.

### Las preguntas no estan en la extension

Se piden a `GET /Feedback/Instrument` y se dibuja lo que llegue, ordenando por `position`
y respetando `minValue`/`maxValue`. El dia que el instrumento pase de un item a los quince
del protocolo, esta pantalla los dibuja **sin publicar version nueva** en tres tiendas con
revision de por medio. Si el instrumento no llega, no se dibuja nada: cablear preguntas de
repuesto seria justo lo que ese endpoint existe para evitar.

### El consentimiento

La casilla arranca **desmarcada** y el boton de enviar esta deshabilitado hasta que se
marca. El texto que se muestra es el que vino con el instrumento y **su version viaja con
la respuesta**: si manana el texto cambia, se puede decir a que dijo que si cada persona.
La comprobacion esta en tres capas —la pantalla, el cliente de transporte y el servidor—,
para que un cambio en una no empiece a registrar respuestas sin aceptacion.

### La huella de la consulta, en vez de la URL

El contrato admite mandar la URL de la ficha y promete guardar solo su hash. Eso resuelve
**que se guarda**, no **que se transmite**, y la regla de esta extension es sobre lo
segundo. Asi que `inquiryReference` viaja como **`sha256` en hexadecimal de la URL
normalizada**, calculado en el navegador.

No rompe nada del backend:

- Su `Normalize` deja intacta una cadena que no es una URL —la recorta y la pasa a
  minusculas— y un digest hexadecimal ya esta en minusculas.
- La regla antiduplicado sigue funcionando: la misma ficha da la misma huella, luego la
  misma clave en el indice unico. La normalizacion replica la suya (host + ruta, sin
  esquema, sin query, sin fragmento), asi que dos visitas con distinto `?ref=` colapsan en
  una.
- Para agrupar basta con distinguir, no con poder leer. Esa es la razon que el propio
  modulo da para hashear.

### El contexto

Se manda `scope = 2` (una consulta concreta), la plataforma, y el veredicto de **riesgo
estimado** con su valor ordinal y su confianza: es el que la persona vio en pantalla. Una
nota sin eso no sirve para nada. En una abstencion se manda `verdictKind = 0` y **ningun**
valor ordinal, porque no hay escala de riesgo en la que colocarla.

**El enumerado de plataforma de la encuesta no es el de la analitica.** Ahi el 2 es Amazon;
aqui el 2 es Facebook Marketplace, y ni Amazon ni eBay tienen valor propio: caen en 99.
Reutilizar el otro mapa contaria las respuestas de Amazon como de Facebook al exportar, y
eso no se ve hasta que se mira la tabla. Hay un test que lo fija.

### Dos identificadores distintos a proposito

El seudonimo de la analitica (aleatorio, rotativo cada 24 h) y el identificador de
instalacion de la encuesta (UUID v4 estable) **no son el mismo valor**. Son dos modulos que
no se deben poder cruzar, y compartir el identificador les regalaria la unica pieza que hoy
les falta para conseguirlo. Ninguno se deriva del correo, de la cuenta ni del token.

---

## 6. Lo que quedo fuera

- **`type: 6, kind: 8` ("Reporto la ficha")**: no hay ninguna accion de reporte en la
  interfaz. Emitirlo exigiria inventar la interaccion primero.
- **`EAnalyzerKind = 5` (clasificacion de riesgo)** en `analyzers[]`: la politica de
  decision corre en el cliente y es instantanea. Reportar su latencia junto a la de cuatro
  llamadas de red ensuciaria la muestra que interesa.
- **`EFeatureOutcome = 4` (diferida)**: en el `FeatureSet` final no sobrevive ninguna
  caracteristica diferida —las tres que el documento difiere las resuelven despues sus
  analizadores—, asi que nunca hay una que emitir como tal.
- **Las respuestas de quince items** (`answers`): el instrumento vigente trae uno. La
  pantalla ya recorre la lista; el envio por `answers` se activa cuando el backend publique
  el cuestionario largo.
