# Épica: Estimación y explicación del riesgo de estafa
# HU: US011 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US011 @estimacion-y-explicacion-del-riesgo-de-estafa @prioridad-alta @sprint-1
Feature: US011 - Analizar una publicación seleccionando el badge de ScamShield
  Como comprador digital
  Quiero analizar una publicación seleccionando el badge de ScamShield
  Para conocer el riesgo de estafa antes de realizar el pago

  @analisis-exitoso
  Scenario: Análisis exitoso
    Given El comprador digital visualiza una publicación con sesión iniciada en la extensión
    When Selecciona el ícono de la extensión
    Then La extensión muestra el resultado del análisis

  @error-al-realizar-el-analisis
  Scenario: Error al realizar el análisis
    Given El comprador digital visualiza una publicación con sesión iniciada en la extensión
    When El servidor no responde o devuelve un error durante el análisis
    Then La extensión muestra el mensaje "No se pudo completar el análisis" con el resultado "Evidencia insuficiente", nunca un riesgo bajo

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
