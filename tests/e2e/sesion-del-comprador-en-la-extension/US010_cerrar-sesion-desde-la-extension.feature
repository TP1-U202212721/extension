# Épica: Sesión del comprador en la extensión
# HU: US010 | Prioridad: Baja | Sprint: 3 | Estado: Completado

@US010 @sesion-del-comprador-en-la-extension @prioridad-baja @sprint-3
Feature: US010 - Cerrar sesión desde la extensión
  Como comprador digital
  Quiero cerrar sesión desde la extensión
  Para proteger el acceso a mi cuenta en dispositivos compartidos

  @sesion-finalizada-exitosamente
  Scenario: Sesión finalizada exitosamente
    Given El comprador digital tiene una sesión activa en la extensión
    When Cierra la sesión activa en la extensión
    Then La extensión muestra la opción de "Iniciar sesión"

  @sin-sesion-activa
  Scenario: Sin sesión activa
    Given El comprador digital no tiene una sesión activa en la extensión
    When Ingresa a la extensión por primera vez o cuenta con una sesión expirada
    Then La extensión muestra la opción de "Iniciar sesión"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
