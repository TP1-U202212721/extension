# Épica: Sesión del comprador en la extensión
# HU: US006 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US006 @sesion-del-comprador-en-la-extension @prioridad-alta @sprint-1
Feature: US006 - Iniciar sesión en la extensión
  Como comprador digital
  Quiero iniciar sesión en la extensión
  Para analizar publicaciones de venta en el navegador donde realizo mis compras en línea

  @inicio-de-sesion-exitoso
  Scenario: Inicio de sesión exitoso
    Given El comprador digital se encuentra sin una sesión iniciada
    When Selecciona "Iniciar sesión" y se autentica en la aplicación web
    Then La extensión muestra los datos de la cuenta con sesión iniciada

  @inicio-de-sesion-no-completado
  Scenario: Inicio de sesión no completado
    Given El comprador digital se encuentra sin una sesión iniciada
    When Selecciona "Iniciar sesión" y cierra la pestaña de la aplicación web sin autenticarse
    Then La extensión mantiene el estado sin sesión

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
