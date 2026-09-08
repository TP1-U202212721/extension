# Safari

Safari no es un target de build mas: la extension se distribuye envuelta en una aplicacion
de macOS o iOS, generada con Xcode. Se documenta desde el principio a proposito, porque es
donde se rompen los proyectos que asumieron Chrome.

## Requisitos

- Xcode con `safari-web-extension-converter`. Verificar con
  `xcrun --find safari-web-extension-converter`.
- Safari >= 15.4, primera version con soporte de Manifest V3.

## Flujo

```bash
pnpm build:safari      # genera .output/safari-mv3
pnpm safari:convert    # lo envuelve en un proyecto Xcode
```

Despues, en Xcode: seleccionar el target, ejecutar, y habilitar la extension en
**Safari > Ajustes > Extensiones**. Para desarrollo hace falta activar
**Desarrollo > Permitir extensiones sin firmar**, y hay que rehacerlo en cada reinicio de
Safari.

## Limitaciones conocidas

- **El converter avisa pero no bloquea.** Lee el manifiesto, reporta cada clave y permiso
  que no puede mapear, y genera el proyecto igualmente. Las advertencias son informativas y
  no aparecen como error, asi que hay que leerlas explicitamente.
- **La conversion rara vez falla por una API que no existe; falla por APIs que existen y se
  comportan distinto.** Es el modo de fallo que hay que vigilar al probar.
- **Safari no soporta `webRequest` en MV3.** No nos afecta: la extension no intercepta red.
- **Distribuir exige cuenta de Apple Developer** y pasar revision de la App Store, incluso
  para una extension gratuita. Para la tesis alcanza con ejecutarla sin firmar en local.

## Que verificar en Safari, especificamente

1. Que el content script se inyecta en las URLs de `matches`.
2. Que `browser.runtime.sendMessage` responde: el paso entre content script y background es
   donde mas divergencias aparecen.
3. Que el shadow DOM del panel se renderiza con sus estilos.
