# Épica: Historial de consultas
# HU: US030 | Prioridad: Media | Sprint: 3 | Estado: Completado

@US030 @historial-de-consultas @prioridad-media @sprint-3
Feature: US030 - Visualizar el detalle de una consulta de mi historial
  Como comprador digital
  Quiero visualizar el detalle de una consulta de mi historial
  Para revisar las características y el motivo del resultado obtenido

  @detalle-de-la-consulta
  Scenario: Detalle de la consulta
    Given El comprador digital se encuentra en su historial de consultas
    When Selecciona una consulta
    Then La aplicación web muestra el nivel de riesgo, las características evaluadas y un enlace para abrir la publicación y volver a analizarla con la extensión

  @error-al-cargar-el-detalle
  Scenario: Error al cargar el detalle
    Given El comprador digital se encuentra en su historial de consultas
    When Selecciona una consulta y ocurre un error al obtener su detalle
    Then La aplicación web muestra el mensaje "Ocurrió un error al cargar el detalle de la consulta"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
