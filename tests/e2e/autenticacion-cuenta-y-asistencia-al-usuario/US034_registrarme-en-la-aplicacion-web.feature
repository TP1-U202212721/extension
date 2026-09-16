# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US034 | Prioridad: Media | Sprint: 4 | Estado: Completado

@US034 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-media @sprint-4
Feature: US034 - Registrarme en la aplicación web
  Como comprador digital
  Quiero registrarme en la aplicación web
  Para hacer uso de la extensión y de las funcionalidades de la aplicación

  @registro-exitoso
  Scenario: Registro exitoso
    Given El comprador digital se encuentra en la vista de registro sin sesión iniciada
    When Completa el formulario y selecciona "Registrarse"
    Then La aplicación web crea la cuenta y redirige al comprador a la vista de inicio de sesión

  @correo-ya-registrado
  Scenario: Correo ya registrado
    Given El comprador digital se encuentra en la vista de registro sin sesión iniciada
    When Completa el formulario con un correo ya registrado y selecciona "Registrarse"
    Then La aplicación web muestra el mensaje "Correo duplicado"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
