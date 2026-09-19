# Épica: Historial de consultas
# HU: US028 | Prioridad: Alta | Sprint: 3 | Estado: Completado

@US028 @historial-de-consultas @prioridad-alta @sprint-3
Feature: US028 - Visualizar mis búsquedas recientes en la aplicación web
  Como comprador digital
  Quiero visualizar mis búsquedas recientes en la aplicación web
  Para acceder al nivel de riesgo de publicaciones ya analizadas sin volver a analizarlas

  @historial-con-consultas
  Scenario: Historial con consultas
    Given El comprador digital se encuentra autenticado en la aplicación web
    When Accede a la sección de historial de consultas
    Then La aplicación web muestra las consultas realizadas desde la extensión, ordenadas de la más reciente a la más antigua

  @historial-vacio
  Scenario: Historial vacío
    Given El comprador digital se encuentra autenticado en la aplicación web
    When Accede a la sección de historial de consultas
    Then La aplicación web muestra el mensaje "No existen consultas por mostrar" con la indicación de analizar publicaciones desde la extensión

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
