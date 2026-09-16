# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US036 | Prioridad: Media | Sprint: 4 | Estado: Completado

@US036 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-media @sprint-4
Feature: US036 - Iniciar sesión con mi cuenta de Google
  Como comprador digital
  Quiero iniciar sesión con mi cuenta de Google
  Para acceder sin crear una contraseña adicional

  @inicio-de-sesion-con-google-exitoso
  Scenario: Inicio de sesión con Google exitoso
    Given El comprador digital se encuentra en la vista de inicio de sesión
    When Selecciona "Continuar con Google" y autoriza el acceso
    Then La aplicación web inicia la sesión y, si es su primer ingreso, crea la cuenta con los datos de Google

  @autorizacion-cancelada
  Scenario: Autorización cancelada
    Given El comprador digital se encuentra en la vista de inicio de sesión
    When Selecciona "Continuar con Google" y cancela la autorización
    Then La aplicación web mantiene la vista de inicio de sesión sin iniciar la sesión

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
