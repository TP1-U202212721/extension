# Épica: Integración de la extensión con el marketplace
# HU: US002 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US002 @integracion-de-la-extension-con-el-marketplace @prioridad-alta @sprint-1
Feature: US002 - Que la extensión reconozca automáticamente cuando me encuentro en una publicación de un marketplace compatible
  Como comprador digital
  Quiero que la extensión reconozca automáticamente cuando me encuentro en una publicación de un marketplace compatible
  Para no tener que activarla manualmente cada vez que evalúo una compra

  @publicacion-compatible-reconocida
  Scenario: Publicación compatible reconocida
    Given El comprador digital tiene la extensión instalada y navega en un marketplace compatible
    When Abre la ficha de un producto
    Then La extensión reconoce la publicación a partir de su URL y se activa sin leer todavía el contenido de la página

  @sitio-no-compatible
  Scenario: Sitio no compatible
    Given El comprador digital tiene la extensión instalada
    When Abre una página que no pertenece a un marketplace compatible
    Then La extensión no se activa ni inserta ningún elemento en la página

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
