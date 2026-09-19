# Épica: Ranking y reportes de la comunidad
# HU: US032 | Prioridad: Media | Sprint: 3 | Estado: Completado

@US032 @ranking-y-reportes-de-la-comunidad @prioridad-media @sprint-3
Feature: US032 - Visualizar un ranking de vendedores
  Como comprador digital
  Quiero visualizar un ranking de vendedores
  Para conocer a los vendedores con mayor riesgo de estafa

  @ranking-con-vendedores
  Scenario: Ranking con vendedores
    Given El comprador digital se encuentra en la aplicación web
    When Accede a la sección de ranking de vendedores
    Then La aplicación web muestra los vendedores ordenados de mayor a menor riesgo

  @ranking-vacio
  Scenario: Ranking vacío
    Given El comprador digital se encuentra en la aplicación web
    When Accede a la sección de ranking de vendedores
    Then La aplicación web muestra el mensaje "No existen vendedores registrados"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
