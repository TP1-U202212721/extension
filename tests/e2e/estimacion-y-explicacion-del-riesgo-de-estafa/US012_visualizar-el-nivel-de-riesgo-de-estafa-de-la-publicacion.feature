# Épica: Estimación y explicación del riesgo de estafa
# HU: US012 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US012 @estimacion-y-explicacion-del-riesgo-de-estafa @prioridad-alta @sprint-1
Feature: US012 - Visualizar el nivel de riesgo de estafa de la publicación
  Como comprador digital
  Quiero visualizar el nivel de riesgo de estafa de la publicación
  Para decidir de forma informada si continúo con la compra

  @nivel-de-riesgo-estimado
  Scenario: Nivel de riesgo estimado
    Given El análisis de la publicación cuenta con evidencia suficiente
    When La extensión muestra el resultado del análisis
    Then El panel muestra el nivel de riesgo (Alto, Moderado o Bajo) con su color e ícono correspondiente

  @estimacion-con-caracteristicas-sin-resolver
  Scenario: Estimación con características sin resolver
    Given El análisis resolvió solo una parte de las características evaluadas
    When La extensión muestra el resultado del análisis
    Then El panel muestra el nivel de riesgo junto con la confianza de la estimación y las características que lo sustentan

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
