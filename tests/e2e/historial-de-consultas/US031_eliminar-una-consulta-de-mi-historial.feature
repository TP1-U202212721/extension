# Épica: Historial de consultas
# HU: US031 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US031 @historial-de-consultas @prioridad-baja @sprint-4
Feature: US031 - Eliminar una consulta de mi historial
  Como comprador digital
  Quiero eliminar una consulta de mi historial
  Para mantener mi historial organizado y relevante

  @eliminacion-exitosa
  Scenario: Eliminación exitosa
    Given El comprador digital requiere eliminar un registro de su historial de consultas
    When Selecciona la opción eliminar y confirma la acción
    Then La aplicación web remueve el registro del historial y muestra el mensaje "Consulta eliminada exitosamente"

  @eliminacion-cancelada
  Scenario: Eliminación cancelada
    Given El comprador digital requiere eliminar un registro de su historial de consultas
    When Selecciona la opción eliminar y no confirma la acción
    Then La aplicación web mantiene el registro en el historial de consultas

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
