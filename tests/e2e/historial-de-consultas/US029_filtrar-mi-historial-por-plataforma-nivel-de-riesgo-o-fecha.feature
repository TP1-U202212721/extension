# Épica: Historial de consultas
# HU: US029 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US029 @historial-de-consultas @prioridad-baja @sprint-4
Feature: US029 - Filtrar mi historial por plataforma, nivel de riesgo o fecha
  Como comprador digital
  Quiero filtrar mi historial por plataforma, nivel de riesgo o fecha
  Para encontrar rápidamente una consulta realizada con anterioridad

  @busqueda-con-coincidencias
  Scenario: Búsqueda con coincidencias
    Given El comprador digital se encuentra en su historial de consultas
    When Aplica filtros por plataforma, nivel de riesgo o fecha
    Then La aplicación web muestra las consultas que cumplen con los filtros aplicados

  @busqueda-sin-coincidencias
  Scenario: Búsqueda sin coincidencias
    Given El comprador digital se encuentra en su historial de consultas
    When Aplica filtros por plataforma, nivel de riesgo o fecha
    Then La aplicación web muestra el mensaje "No existen coincidencias con los filtros de búsqueda seleccionados"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
