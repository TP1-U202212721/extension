# Épica: Ranking y reportes de la comunidad
# HU: US033 | Prioridad: Media | Sprint: 4 | Estado: Completado

@US033 @ranking-y-reportes-de-la-comunidad @prioridad-media @sprint-4
Feature: US033 - Reportar desde la extensión una publicación sospechosa
  Como comprador digital
  Quiero reportar desde la extensión una publicación sospechosa
  Para alertar a otros compradores y contribuir a mejorar la estimación de estafas

  @reporte-enviado-exitosamente
  Scenario: Reporte enviado exitosamente
    Given El comprador digital visualiza el resultado del análisis de una publicación con sesión iniciada
    When Selecciona "Reportar publicación", completa el motivo y envía el reporte
    Then La extensión envía el reporte con la plataforma y la publicación actuales y muestra el mensaje "Reporte enviado exitosamente"

  @campos-en-blanco
  Scenario: Campos en blanco
    Given El comprador digital visualiza el resultado del análisis de una publicación con sesión iniciada
    When Selecciona "Reportar publicación" y envía el reporte sin completar el motivo
    Then La extensión muestra el mensaje "Debe llenar los campos obligatorios"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
