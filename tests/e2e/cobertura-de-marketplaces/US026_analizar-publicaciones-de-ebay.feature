# Épica: Cobertura de marketplaces
# HU: US026 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US026 @cobertura-de-marketplaces @prioridad-baja @sprint-4
Feature: US026 - Analizar publicaciones de eBay
  Como comprador digital
  Quiero analizar publicaciones de eBay
  Para evaluar el riesgo de las compras que realizo en eBay

  @analisis-de-publicacion-de-ebay
  Scenario: Análisis de publicación de eBay
    Given El comprador digital visualiza una publicación de eBay con sesión iniciada
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then La extensión muestra el resultado del análisis con las características disponibles en la publicación

  @caracteristica-no-disponible
  Scenario: Característica no disponible
    Given El comprador digital visualiza una publicación de eBay con sesión iniciada
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then El panel muestra el resultado del análisis incluyendo el listado de características no disponibles

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
