# Épica: Integración de la extensión con el marketplace
# HU: US004 | Prioridad: Media | Sprint: 2 | Estado: Completado

@US004 @integracion-de-la-extension-con-el-marketplace @prioridad-media @sprint-2
Feature: US004 - Visualizar un acceso de ScamShield en las tarjetas de listados y carruseles de productos
  Como comprador digital
  Quiero visualizar un acceso de ScamShield en las tarjetas de listados y carruseles de productos
  Para identificar qué publicaciones puedo analizar antes de abrirlas

  @tarjetas-con-acceso-de-analisis
  Scenario: Tarjetas con acceso de análisis
    Given El comprador digital se encuentra en un listado de resultados de un marketplace compatible
    When La página muestra tarjetas de publicaciones
    Then La extensión agrega en cada tarjeta el enlace "ScamShield · abrir para analizar", que abre la publicación correspondiente

  @carrusel-cargado-posteriormente
  Scenario: Carrusel cargado posteriormente
    Given El comprador digital se encuentra en un listado de resultados de un marketplace compatible
    When Un carrusel carga nuevas tarjetas después de abierta la página
    Then La extensión agrega el acceso únicamente a las nuevas tarjetas, sin duplicarlo en las existentes

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
