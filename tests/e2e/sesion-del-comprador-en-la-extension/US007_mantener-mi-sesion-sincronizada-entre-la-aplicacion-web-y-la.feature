# Épica: Sesión del comprador en la extensión
# HU: US007 | Prioridad: Media | Sprint: 2 | Estado: Completado

@US007 @sesion-del-comprador-en-la-extension @prioridad-media @sprint-2
Feature: US007 - Mantener mi sesión sincronizada entre la aplicación web y la extensión
  Como comprador digital
  Quiero mantener mi sesión sincronizada entre la aplicación web y la extensión
  Para no tener que iniciar sesión dos veces

  @sesion-iniciada-previamente
  Scenario: Sesión iniciada previamente
    Given El comprador digital tiene una sesión activa en la aplicación web
    When Inicia sesión por medio de la aplicación web
    Then La extensión muestra el estado de “Sesión activa”

  @sesion-no-iniciada
  Scenario: Sesión no iniciada
    Given El comprador digital no tiene una sesión activa en la aplicación web
    When Ingresa a la extensión por primera vez o cuenta con una sesión expirada
    Then La extensión muestra la opción de “Iniciar sesión”

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
