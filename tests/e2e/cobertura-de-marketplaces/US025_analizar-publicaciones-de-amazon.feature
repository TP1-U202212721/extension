# Épica: Cobertura de marketplaces
# HU: US025 | Prioridad: Baja | Sprint: 4 | Estado: Completado

@US025 @cobertura-de-marketplaces @prioridad-baja @sprint-4
Feature: US025 - Analizar publicaciones de Amazon
  Como comprador digital
  Quiero analizar publicaciones de Amazon
  Para evaluar el riesgo de las compras que realizo en Amazon

  @analisis-de-publicacion-de-amazon
  Scenario: Análisis de publicación de Amazon
    Given El comprador digital visualiza una publicación de Amazon con sesión iniciada
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then La extensión muestra el resultado del análisis con las características disponibles en la publicación

  @pagina-de-amazon-que-no-es-una-publicacion
  Scenario: Página de Amazon que no es una publicación
    Given El comprador digital navega en una página de Amazon que no corresponde a la ficha de un producto
    When Selecciona la opción de “Estimar nivel de riesgo”
    Then La extensión no inserta el badge de análisis en la página

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
