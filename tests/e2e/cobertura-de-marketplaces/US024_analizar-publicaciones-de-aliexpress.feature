# Épica: Cobertura de marketplaces
# HU: US024 | Prioridad: Media | Sprint: 3 | Estado: Completado

@US024 @cobertura-de-marketplaces @prioridad-media @sprint-3
Feature: US024 - Analizar publicaciones de AliExpress
  Como comprador digital
  Quiero analizar publicaciones de AliExpress
  Para evaluar el riesgo de mis compras internacionales

  @analisis-de-publicacion-de-aliexpress
  Scenario: Análisis de publicación de AliExpress
    Given El comprador digital visualiza una publicación de AliExpress con sesión iniciada
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then La extensión muestra el resultado del análisis con las características disponibles en la publicación

  @caracteristicas-no-disponibles
  Scenario: Características no disponibles
    Given El comprador digital visualiza una publicación de AliExpress con sesión iniciada
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then El panel muestra el resultado del análisis incluyendo el listado de características no disponibles

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
