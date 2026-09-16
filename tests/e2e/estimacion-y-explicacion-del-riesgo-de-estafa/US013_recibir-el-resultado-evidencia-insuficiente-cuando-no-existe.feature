# Épica: Estimación y explicación del riesgo de estafa
# HU: US013 | Prioridad: Alta | Sprint: 2 | Estado: Completado

@US013 @estimacion-y-explicacion-del-riesgo-de-estafa @prioridad-alta @sprint-2
Feature: US013 - Recibir el resultado "Evidencia insuficiente" cuando no existen datos suficientes para estimar el riesgo
  Como comprador digital
  Quiero recibir el resultado "Evidencia insuficiente" cuando no existen datos suficientes para estimar el riesgo
  Para no confiar en una publicación que no pudo ser evaluada

  @dimension-sin-evidencia
  Scenario: Dimensión sin evidencia
    Given El análisis no resolvió ninguna característica de una de las dimensiones evaluadas
    When La extensión muestra el resultado del análisis
    Then El panel muestra "Evidencia insuficiente", el motivo y las dimensiones que quedaron sin evidencia

  @plataforma-sin-cobertura-de-analisis
  Scenario: Plataforma sin cobertura de análisis
    Given El comprador digital analiza una publicación de una plataforma sin análisis disponible en el servidor
    When La extensión recibe todas las características como no determinadas
    Then El panel muestra "Evidencia insuficiente" y no presenta la publicación como segura

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
