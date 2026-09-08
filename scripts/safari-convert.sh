#!/usr/bin/env bash
set -euo pipefail

# Envuelve el build de Safari en un proyecto Xcode. Ver docs/safari.md.

SALIDA=".output/safari-mv3"
PROYECTO=".output/safari-xcode"

if [ ! -d "$SALIDA" ]; then
  echo "No existe $SALIDA. Corre antes: pnpm build:safari" >&2
  exit 1
fi

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "Falta safari-web-extension-converter. Instala Xcode." >&2
  exit 1
fi

xcrun safari-web-extension-converter "$SALIDA" \
  --project-location "$PROYECTO" \
  --app-name ScamShield \
  --bundle-identifier pe.edu.upc.scamshield \
  --macos-only --no-open --force

echo "Proyecto Xcode generado en $PROYECTO"
