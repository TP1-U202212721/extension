# Épica: Historial de consultas
# HU: US027 | Prioridad: Alta | Sprint: 3 | Estado: Completado

@US027 @historial-de-consultas @prioridad-alta @sprint-3
Feature: US027 - Que los análisis realizados desde la extensión se guarden en mi historial
  Como comprador digital
  Quiero que los análisis realizados desde la extensión se guarden en mi historial
  Para revisarlos posteriormente desde la aplicación web

  @registro-exitoso
  Scenario: Registro exitoso
    Given El comprador digital con sesión iniciada completa el análisis de una publicación
    When La extensión recibe el resultado del análisis
    Then La aplicación registra en el historial la plataforma, la publicación, el nivel de riesgo y la fecha del análisis

  @error-al-guardar-el-analisis
  Scenario: Error al guardar el análisis
    Given El comprador digital con sesión iniciada completa el análisis de una publicación
    When Ocurre un error al registrar el análisis en el historial
    Then La extensión muestra igualmente el resultado y el mensaje "No se pudo guardar el análisis en tu historial"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
