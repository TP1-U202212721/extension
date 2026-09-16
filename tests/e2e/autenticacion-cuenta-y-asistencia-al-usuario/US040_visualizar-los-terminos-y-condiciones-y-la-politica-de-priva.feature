# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US040 | Prioridad: Baja | Sprint: 3 | Estado: Completado

@US040 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-baja @sprint-3
Feature: US040 - Visualizar los términos y condiciones y la política de privacidad
  Como comprador digital
  Quiero visualizar los términos y condiciones y la política de privacidad
  Para conocer qué información de la página se envía al servidor y cómo se trata

  @terminos-y-condiciones-disponibles
  Scenario: Términos y condiciones disponibles
    Given El comprador digital se encuentra en la aplicación web
    When Selecciona "Términos y condiciones"
    Then La aplicación web muestra los términos y condiciones y la política de privacidad, incluido el tratamiento del documento de la publicación analizada

  @terminos-y-condiciones-no-disponibles
  Scenario: Términos y condiciones no disponibles
    Given El comprador digital se encuentra en la aplicación web
    When Selecciona "Términos y condiciones"
    Then La aplicación web muestra el mensaje "No existen términos y condiciones por mostrar"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
