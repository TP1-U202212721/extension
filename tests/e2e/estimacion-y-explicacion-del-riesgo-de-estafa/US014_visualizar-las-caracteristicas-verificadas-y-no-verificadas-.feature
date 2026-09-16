# Épica: Estimación y explicación del riesgo de estafa
# HU: US014 | Prioridad: Alta | Sprint: 2 | Estado: Completado

@US014 @estimacion-y-explicacion-del-riesgo-de-estafa @prioridad-alta @sprint-2
Feature: US014 - Visualizar las características verificadas y no verificadas que sustentan el resultado
  Como comprador digital
  Quiero visualizar las características verificadas y no verificadas que sustentan el resultado
  Para comprender en qué se basa la estimación del riesgo

  @caracteristicas-verificadas
  Scenario: Características verificadas
    Given El comprador digital visualiza el resultado del análisis de una publicación
    When Revisa el detalle del resultado
    Then El panel muestra las características agrupadas en identidad del sitio, fiabilidad del vendedor y evidencia de la comunidad, marcando las verificadas

  @caracteristicas-no-verificadas
  Scenario: Características no verificadas
    Given El comprador digital visualiza el resultado del análisis de una publicación
    When Alguna característica no pudo resolverse
    Then El panel muestra la característica en la sección "No se pudo verificar" con el motivo correspondiente

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
