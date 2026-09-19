# Épica: Integración de la extensión con el marketplace
# HU: US005 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US005 @integracion-de-la-extension-con-el-marketplace @prioridad-alta @sprint-1
Feature: US005 - Que la extensión analice únicamente la página que ya abrí
  Como comprador digital
  Quiero que la extensión analice únicamente la página que ya abrí
  Para tener la seguridad de que no navega ni realiza peticiones al marketplace en mi nombre

  @analisis-sobre-la-pagina-cargada
  Scenario: Análisis sobre la página cargada
    Given El comprador digital visualiza una publicación con sesión iniciada en la extensión
    When Selecciona el badge de ScamShield
    Then La extensión envía la información del documento renderizado por el navegador al servidor

  @publicacion-abierta-sin-solicitar-analisis
  Scenario: Publicación abierta sin solicitar análisis
    Given El comprador digital abre una publicación de un marketplace compatible
    When No selecciona el badge de ScamShield
    Then La extensión no lee el contenido de la página ni envía información al servidor

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
