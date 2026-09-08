# Fixtures

Cada adaptador se prueba contra HTML guardado, no contra la red. Un test nunca
visita un marketplace.

## Como capturar una ficha real

Los fixtures que hay hoy son **representativos**, construidos sobre las clases
reales de cada plataforma. No se pudieron capturar automaticamente: MercadoLibre
responde con su muro anti-bot (`suspicious-traffic-frontend`) a toda peticion que
no venga de un navegador con sesion.

Eso no es un obstaculo, es el argumento del proyecto: el DOM que el comprador ya
tiene delante es inalcanzable desde el servidor. Capturarlo desde el navegador es
tambien lo unico coherente con la restriccion de no hacer scraping, porque no se
emite ninguna peticion que el usuario no hubiera cursado igual.

1. Abrir la ficha del producto en el navegador, como cualquier comprador.
2. Abrir DevTools y ejecutar en la consola:

   ```js
   copy(document.documentElement.outerHTML)
   ```

3. Pegar el resultado en `tests/fixtures/<plataforma>/<nombre>.html`.
4. Anonimizar antes de commitear: quitar nombres de usuario, direcciones,
   identificadores de sesion y cualquier dato personal que traiga la pagina.

## Que fixture hace falta por adaptador

| Fixture | Para que |
|---|---|
| `ficha-completa.html` | Todas las caracteristicas de cliente resueltas |
| `ficha-degradada.html` | Remaquetacion: todo debe degradar a `indeterminado` |
| `ficha-sin-resenas.html` | Publicacion nueva, sin opiniones (pendiente) |
