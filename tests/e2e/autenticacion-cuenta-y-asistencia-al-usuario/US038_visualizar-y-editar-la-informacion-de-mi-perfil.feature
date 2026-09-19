# Épica: Autenticación, cuenta y asistencia al usuario
# HU: US038 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US038 @autenticacion-cuenta-y-asistencia-al-usuario @prioridad-baja @sprint-4
Feature: US038 - Visualizar y editar la información de mi perfil
  Como comprador digital
  Quiero visualizar y editar la información de mi perfil
  Para mantener mis datos personales actualizados

  @actualizacion-exitosa
  Scenario: Actualización exitosa
    Given El comprador digital se encuentra en la vista de perfil con sesión iniciada
    When Modifica sus datos y selecciona "Guardar cambios"
    Then La aplicación web actualiza la información y la muestra en su perfil

  @campos-en-blanco
  Scenario: Campos en blanco
    Given El comprador digital se encuentra en la vista de perfil con sesión iniciada
    When Deja campos obligatorios en blanco y selecciona "Guardar cambios"
    Then La aplicación web muestra el mensaje "Debe llenar los campos obligatorios"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
