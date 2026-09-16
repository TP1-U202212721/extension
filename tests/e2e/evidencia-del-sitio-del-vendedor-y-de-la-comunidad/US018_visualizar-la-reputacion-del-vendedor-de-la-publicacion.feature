# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US018 | Prioridad: Alta | Sprint: 2 | Estado: Completado

@US018 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-alta @sprint-2
Feature: US018 - Visualizar la reputación del vendedor de la publicación
  Como comprador digital
  Quiero visualizar la reputación del vendedor de la publicación
  Para saber si el vendedor tiene una trayectoria confiable dentro de la plataforma

  @reputacion-del-vendedor-determinada
  Scenario: Reputación del vendedor determinada
    Given El comprador digital visualiza el resultado del análisis de una publicación
    When Revisa la característica "Reputación del vendedor"
    Then El panel muestra el nivel de reputación (Mala reputación, Reputación débil, Sin verificar, Reputación sólida o Trayectoria establecida) con su distintivo, volumen de ventas y antigüedad

  @datos-del-vendedor-no-disponibles
  Scenario: Datos del vendedor no disponibles
    Given El comprador digital visualiza el resultado del análisis de una publicación
    When La extensión no puede corroborar los datos del vendedor
    Then El panel muestra el nivel "Sin verificar" sin considerarlo una señal en contra del vendedor

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
