# Épica: Estimación y explicación del riesgo de estafa
# HU: US015 | Prioridad: Media | Sprint: 2 | Estado: Completado

@US015 @estimacion-y-explicacion-del-riesgo-de-estafa @prioridad-media @sprint-2
Feature: US015 - Visualizar en el popup el análisis de la publicación que tengo abierta
  Como comprador digital
  Quiero visualizar en el popup el análisis de la publicación que tengo abierta
  Para revisar el resultado sin tener que volver a analizarla

  @publicacion-con-analisis-disponible
  Scenario: Publicación con análisis disponible
    Given El comprador digital visualiza una publicación de venta con sesión iniciada
    When Selecciona el ícono de la extensión
    Then La extensión muestra la plataforma, el panel con el resultado y la fecha y hora del análisis

  @publicacion-sin-analisis
  Scenario: Publicación sin análisis
    Given El comprador digital no realiza el análisis de la publicación seleccionada
    When Selecciona el ícono de la extensión
    Then La extensión muestra el mensaje "Sin análisis para esta página"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
