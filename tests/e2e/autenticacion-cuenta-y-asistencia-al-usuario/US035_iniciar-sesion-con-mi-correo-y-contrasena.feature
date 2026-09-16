# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US035 | Prioridad: Media | Sprint: 4 | Estado: Completado

@US035 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-media @sprint-4
Feature: US035 - Iniciar sesión con mi correo y contraseña
  Como comprador digital
  Quiero iniciar sesión con mi correo y contraseña
  Para acceder a mi historial y habilitar el análisis en la extensión

  @inicio-de-sesion-exitoso
  Scenario: Inicio de sesión exitoso
    Given El comprador digital se encuentra en la vista de inicio de sesión
    When Ingresa un correo y una contraseña válidos
    Then La aplicación web inicia la sesión, que queda disponible también para la extensión

  @usuario-o-contrasena-no-validos
  Scenario: Usuario o contraseña no válidos
    Given El comprador digital se encuentra en la vista de inicio de sesión
    When Ingresa un correo o una contraseña que no coinciden con los registros
    Then La aplicación web muestra el mensaje "Usuario o contraseña no válidos"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
