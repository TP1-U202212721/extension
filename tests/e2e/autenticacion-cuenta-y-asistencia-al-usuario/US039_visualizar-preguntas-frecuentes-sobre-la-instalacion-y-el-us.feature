# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US039 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US039 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-baja @sprint-4
Feature: US039 - Visualizar preguntas frecuentes sobre la instalación y el uso de la extensión
  Como comprador digital
  Quiero visualizar preguntas frecuentes sobre la instalación y el uso de la extensión
  Para resolver mis dudas sin necesidad de soporte

  @preguntas-frecuentes-disponibles
  Scenario: Preguntas frecuentes disponibles
    Given El comprador digital se encuentra en la aplicación web
    When Accede a la sección de preguntas frecuentes
    Then La aplicación web muestra las preguntas frecuentes con sus respuestas, incluida la instalación de la extensión en cada navegador

  @preguntas-frecuentes-no-disponibles
  Scenario: Preguntas frecuentes no disponibles
    Given El comprador digital se encuentra en la aplicación web
    When Accede a la sección de preguntas frecuentes
    Then La aplicación web muestra el mensaje "No existen preguntas frecuentes por mostrar"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
