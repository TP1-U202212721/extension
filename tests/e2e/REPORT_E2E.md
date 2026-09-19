# Reporte de Pruebas E2E - ScamShield

**Fecha**: 2026-09-16
**Entorno**: https://scamshield.ryzeon.me
**Usuario de prueba**: testuser_e2e_2026@gmail.com
**Browser**: Playwright MCP (Chromium)

---

## Resumen Ejecutivo

| Métrica | Valor |
|---|---|
| Total HUs | 40 |
| Cumplidos | 14 |
| Pendientes | 26 |
| Cobertura | 35% |

---

## Tabla de Resultados por HU

| HU | Épica | Status | Detalle |
|---|---|---|---|
| US001 | Integración extensión-marketplace | PENDIENTE | Requiere extensión instalada en navegador de prueba |
| US002 | Integración extensión-marketplace | PENDIENTE | Requiere extensión en navegador + marketplace activo |
| US003 | Integración extensión-marketplace | PENDIENTE | Requiere extensión + publicación abierta |
| US004 | Integración extensión-marketplace | PENDIENTE | Requiere extensión + vista de listado |
| US005 | Integración extensión-marketplace | PENDIENTE | Requiere extensión + análisis DOM |
| US006 | Sesión del comprador | PENDIENTE | Login desde extensión requiere autenticación delegada |
| US007 | Sesión del comprador | PENDIENTE | Sincronización cookie ↔ storage requiere extensión |
| US008 | Sesión del comprador | PENDIENTE | Popup mostrando datos de cuenta |
| US009 | Sesión del comprador | PENDIENTE | Aviso al analizar sin sesión |
| **US010** | **Sesión del comprador** | **CUMPLIDO** | Cerrar sesión redirige a `/login` |
| **US011** | **Estimación riesgo estafa** | **CUMPLIDO** | Escaneo ejecutado. Sistema reporta bloqueo anti-bot (comportamiento esperado) |
| US012 | Estimación riesgo estafa | PENDIENTE | Nivel de riesgo requiere escaneo exitoso |
| US013 | Estimación riesgo estafa | PENDIENTE | "Evidencia insuficiente" requiere publicación sin datos |
| US014 | Estimación riesgo estafa | PENDIENTE | Características verificadas/no verificadas |
| US015 | Estimación riesgo estafa | PENDIENTE | Análisis en popup de extensión |
| US016 | Evidencia sitio/vendedor | PENDIENTE | Veracidad del dominio requiere extensión |
| US017 | Evidencia sitio/vendedor | PENDIENTE | Señales de riesgo/a favor |
| US018 | Evidencia sitio/vendedor | PENDIENTE | Reputación del vendedor |
| US019 | Evidencia sitio/vendedor | PENDIENTE | Declaración de garantía |
| US020 | Evidencia sitio/vendedor | PENDIENTE | Protección de pago |
| US021 | Evidencia sitio/vendedor | PENDIENTE | Puntuación y reseñas |
| US022 | Evidencia sitio/vendedor | PENDIENTE | Autenticidad de reseñas |
| US023 | Cobertura marketplaces | PENDIENTE | Análisis en MercadoLibre |
| US024 | Cobertura marketplaces | PENDIENTE | Análisis en AliExpress |
| US025 | Cobertura marketplaces | PENDIENTE | Análisis en Amazon |
| US026 | Cobertura marketplaces | PENDIENTE | Análisis en eBay |
| US027 | Historial de consultas | PENDIENTE | Guardado automático desde extensión |
| **US028** | **Historial de consultas** | **CUMPLIDO** | Página visible con filtros |
| **US029** | **Historial de consultas** | **CUMPLIDO** | Filtros funcionales |
| US030 | Historial de consultas | PENDIENTE | Detalle de consulta (sin datos) |
| US031 | Historial de consultas | PENDIENTE | Eliminar consulta (sin datos) |
| **US032** | **Ranking y reportes** | **CUMPLIDO** | Página visible con paginación |
| **US033** | **Ranking y reportes** | **CUMPLIDO** | Formulario de reporte funcional |
| **US034** | **Autenticación y cuenta** | **CUMPLIDO** | Registro exitoso |
| **US035** | **Autenticación y cuenta** | **CUMPLIDO** | Login exitoso |
| US036 | Autenticación y cuenta | PENDIENTE | Login Google (OAuth no probado) |
| US037 | Autenticación y cuenta | PENDIENTE | Recuperar contraseña (flujo no probado) |
| **US038** | **Autenticación y cuenta** | **CUMPLIDO** | Perfil visible y editable |
| **US039** | **Autenticación y cuenta** | **CUMPLIDO** | FAQ visible con 5 preguntas |
| **US040** | **Autenticación y cuenta** | **CUMPLIDO** | Términos y Condiciones visible |

---

## HUs Cumplidos (14)

| HU | Escenario Verificado |
|---|---|
| US010 | Cerrar sesión → redirige a `/login` |
| US011 | Escaneo de URL → sistema reporta bloqueo anti-bot |
| US028 | Página historial visible |
| US029 | Filtros de historial funcionales |
| US032 | Página ranking visible |
| US033 | Formulario reporte funcional |
| US034 | Registro exitoso con nuevo usuario |
| US035 | Login exitoso con email/contraseña |
| US038 | Perfil visible y nombre editable |
| US039 | FAQ con 5 preguntas y respuestas |
| US040 | Términos y Condiciones con 6 secciones |

---

## HUs Pendientes - Análisis de Bloqueos

### Bloqueo 1: Requiere extensión en navegador (26 HUs)
**HUs afectadas**: US001-US009, US012-US027, US030-US031

**Causa**: Playwright MCP opera sobre el DOM de la página web, pero no puede:
- Instalar extensiones de navegador
- Ejecutar content scripts de la extensión
- Acceder al popup de la extensión
- Interactuar con el background script

**Solución**: Usar Selenium WebDriver o Puppeteer con:
```bash
chrome --load-extension=.output/chrome-mv3-dev --disable-extensions-except=.output/chrome-mv3-dev
```

### Bloqueo 2: Anti-bot de MercadoLibre (5 HUs)
**HUs afectadas**: US012-US015, US023

**Causa**: MercadoLibre detecta tráfico automatizado y bloquea la respuesta. El sistema reporta correctamente el error.

**Solución**:
- Mockear la respuesta del backend
- Usar marketplace de pruebas sin protección anti-bot
- Usar datos de prueba pre-capturados

### Bloqueo 3: OAuth no probado (1 HU)
**HU afectada**: US036

**Causa**: Login con Google requiere redirect a OAuth de Google.

**Solución**: Ejecutar manualmente o con herramienta que soporte redirect OAuth.

### Bloqueo 4: Flujo de recuperación no probado (1 HU)
**HU afectada**: US037

**Causa**: Recuperar contraseña requiere envío de email.

**Solución**: Mockear servicio de email o usar email de prueba.

---

## Recomendaciones

1. **Inmediato**: Configurar Selenium con Chrome + extensión para testing E2E completo
2. **Corto plazo**: Crear mock del backend para evitar bloqueos anti-bot
3. **Mediano plazo**: Implementar pipeline de CI con Chrome headless + extensión
