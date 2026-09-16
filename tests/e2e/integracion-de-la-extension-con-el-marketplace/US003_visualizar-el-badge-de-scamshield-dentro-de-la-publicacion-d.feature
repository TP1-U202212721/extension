# Épica: Integración de la extensión con el marketplace
# HU: US003 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US003 @integracion-de-la-extension-con-el-marketplace @prioridad-alta @sprint-1
Feature: US003 - Visualizar el badge de ScamShield dentro de la publicación de venta
  Como comprador digital
  Quiero visualizar el badge de ScamShield dentro de la publicación de venta
  Para iniciar el análisis de riesgo desde la misma página del producto

  @badge-insertado-en-la-publicacion
  Scenario: Badge insertado en la publicación
    Given El comprador digital abre una publicación de un marketplace compatible
    When La página termina de cargar
    Then La extensión inserta el badge de ScamShield junto a la información de compra de la publicación

  @ubicacion-del-badge-no-encontrada
  Scenario: Ubicación del badge no encontrada
    Given El marketplace modificó la estructura de la página de la publicación
    When La extensión no encuentra la ubicación habitual del badge
    Then La extensión muestra el badge en una posición fija de la página, sin afectar el análisis

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
