# ScamShield · extension de navegador

Estima el riesgo de una publicacion de venta **leyendo la pagina que el comprador ya abrio**,
y se lo muestra antes de que pague.

## La restriccion que define el diseno

**Cero scraping.** La extension no navega, no recorre paginas, y no emite hacia la plataforma
del vendedor ninguna peticion que el usuario no hubiera cursado igual. Solo interpreta el
documento que el navegador ya recibio.

No es un detalle de implementacion: es lo que separa esta propuesta del estado del arte. Si
el diseno lo viola, invalida la tesis. La regla vive escrita en el contrato de
`MarketplaceAdapter` y se verifica en los tests.

De paso, es lo que la hace viable: un servidor pidiendo la misma ficha recibe el muro
anti-bot de la plataforma (comprobado: MercadoLibre responde `suspicious-traffic-frontend`),
mientras que el navegador del comprador ya tiene el DOM real delante.

## Estado

| Capa | Estado |
|---|---|
| Dominio: 8 caracteristicas, 3 estados, 4 desenlaces | real |
| Extraccion MercadoLibre (5 caracteristicas de cliente) | real |
| Extraccion Amazon y AliExpress | andamiada: degrada a `indeterminado` |
| Motor de riesgo | **simulado**. El endpoint no existe: ver `docs/contrato-motor-riesgo.md` |
| UI, los cuatro desenlaces | real, alimentada por el mock |

## Arranque

```bash
pnpm install
pnpm dev              # abre Chrome con la extension cargada y HMR
pnpm dev:firefox      # requiere Firefox instalado
pnpm test
pnpm typecheck && pnpm lint
```

### Que hace `pnpm dev`

Compila, queda en watch y **abre un Chrome nuevo** con la extension ya cargada, directo en
una ficha de MercadoLibre (configurable en `web-ext.config.ts`).

Ese Chrome usa un **perfil limpio que se crea en cada arranque**, para no tocar el tuyo: no
tiene tus marcadores, ni tus sesiones iniciadas, ni tus otras extensiones. Tu Chrome de
siempre no se ve afectado. Al guardar un archivo, la extension se recarga sola.

Para que abra el navegador hace falta `web-ext`, que ya esta en las dependencias de
desarrollo. Sin el, `pnpm dev` compilaria y quedaria en watch, pero habria que cargar
`.output/chrome-mv3-dev` a mano.

Con `o + enter` reabre el navegador. Para que no abra ninguno, `disabled: true` en
`web-ext.config.ts`.

## Builds

```bash
pnpm build:chrome     # .output/chrome-mv3
pnpm build:firefox    # .output/firefox-mv3
pnpm build:safari     # .output/safari-mv3  (ver docs/safari.md)
```

- **Chrome**: `chrome://extensions` > modo desarrollador > cargar descomprimida.
- **Firefox**: `about:debugging#/runtime/this-firefox` > cargar complemento temporal.
- **Safari**: `pnpm safari:convert` y abrir el proyecto Xcode. Ver `docs/safari.md`.

## Arquitectura

```
src/domain/       puro: caracteristicas, veredicto, politica. Sin DOM, sin red, sin navegador
src/extraction/   un adaptador por marketplace, con los selectores aislados
src/transport/    RiskEngineClient: mock (activo) y http (esqueleto)
src/ui/           panel del veredicto, compartido entre popup y content script
src/entrypoints/  background, content script y popup
```

El limite entre capas se hace cumplir con lint: `src/domain/**` tiene prohibido `document`,
`window`, `fetch` y `chrome`.

### Cambiar del motor simulado al real

Una linea en `src/config.ts`:

```ts
export const riskEngine: RiskEngineClient = new MockRiskEngineClient();
// export const riskEngine: RiskEngineClient = new HttpRiskEngineClient(API_BASE_URL);
```

## Documentacion

- `docs/adr/0001-wxt.md` — por que WXT, y las trampas de multinavegador que neutraliza
- `docs/adr/0002-modelo-tres-estados.md` — los tres estados y el analisis de la regla de abstencion
- `docs/adr/0003-autenticacion-delegada-al-cliente-web.md` — por que la extension no tiene formulario de login
- `docs/adr/0004-analisis-de-documento-en-el-servidor.md` — por que la extension entrega el documento en vez de interpretarlo
- `docs/adr/0005-motor-real-y-credenciales.md` — que quedo real, que sigue apagado y donde estan las credenciales
- `docs/adaptadores.md` — los cuatro adaptadores y que tan verificado esta cada uno
- `docs/contrato-motor-riesgo.md` — el endpoint propuesto al backend
- `docs/safari.md` — empaquetado con Xcode y limitaciones
- `tests/fixtures/README.md` — como capturar HTML real para los tests
