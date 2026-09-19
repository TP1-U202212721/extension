# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US037 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US037 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-baja @sprint-4
Feature: US037 - Recuperar mi contraseña olvidada
  Como comprador digital
  Quiero recuperar mi contraseña olvidada
  Para poder autenticarme nuevamente en la aplicación

  @restablecimiento-exitoso
  Scenario: Restablecimiento exitoso
    Given El comprador digital se encuentra en la vista de restablecimiento de contraseña
    When Ingresa su correo electrónico registrado y selecciona "Recuperar contraseña"
    Then La aplicación web envía un enlace de restablecimiento al correo y muestra un mensaje de confirmación del envío

  @correo-no-registrado
  Scenario: Correo no registrado
    Given El comprador digital se encuentra en la vista de restablecimiento de contraseña
    When Ingresa un correo no asociado a ninguna cuenta y selecciona "Recuperar contraseña"
    Then La aplicación web muestra el mensaje "Correo no registrado"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
