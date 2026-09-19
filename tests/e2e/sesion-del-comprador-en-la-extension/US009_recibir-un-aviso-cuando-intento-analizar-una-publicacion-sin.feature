# Épica: Sesión del comprador en la extensión
# HU: US009 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US009 @sesion-del-comprador-en-la-extension @prioridad-alta @sprint-1
Feature: US009 - Recibir un aviso cuando intento analizar una publicación sin haber iniciado sesión
  Como comprador digital
  Quiero recibir un aviso cuando intento analizar una publicación sin haber iniciado sesión
  Para conocer el paso previo antes de realizar un análisis

  @analisis-sin-sesion-iniciada
  Scenario: Análisis sin sesión iniciada
    Given El comprador digital visualiza una publicación sin sesión iniciada en la extensión
    When Selecciona el ícono de la extensión y no cuenta con una sesión iniciada
    Then La extensión muestra la opción de "Inicia sesión"

  @analisis-con-sesion-expirada
  Scenario: Análisis con sesión expirada
    Given El comprador digital visualiza una publicación teniendo una sesión expirada en la extensión
    When Selecciona el ícono de la extensión y la sesión actual expiró
    Then La extensión muestra la opción de "Inicia sesión"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
