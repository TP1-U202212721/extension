# Épica: Cobertura de marketplaces
# HU: US023 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US023 @cobertura-de-marketplaces @prioridad-alta @sprint-1
Feature: US023 - Analizar publicaciones de Mercado Libre
  Como comprador digital
  Quiero analizar publicaciones de Mercado Libre
  Para evaluar el riesgo en el marketplace que más utilizo en el Perú

  @publicacion-de-mercado-libre-peru
  Scenario: Publicación de Mercado Libre Perú
    Given El comprador digital visualiza una publicación de Mercado Libre Perú con sesión iniciada
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then La extensión muestra el resultado del análisis

  @publicacion-de-mercado-libre-de-otro-pais
  Scenario: Publicación de Mercado Libre de otro país
    Given El comprador digital visualiza una publicación de Mercado Libre de Argentina, México, Chile o Colombia
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then La extensión reconoce la publicación, inserta el badge y muestra el resultado del análisis

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
