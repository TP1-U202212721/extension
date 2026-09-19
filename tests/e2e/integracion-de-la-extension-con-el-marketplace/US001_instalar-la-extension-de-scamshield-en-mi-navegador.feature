# Épica: Integración de la extensión con el marketplace
# HU: US001 | Prioridad: Alta | Sprint: 1 | Estado: Completado

@US001 @integracion-de-la-extension-con-el-marketplace @prioridad-alta @sprint-1
Feature: US001 - Instalar la extensión de ScamShield en mi navegador
  Como comprador digital
  Quiero instalar la extensión de ScamShield en mi navegador
  Para usarla en el mismo navegador con el que realizo mis compras en línea

  @instalacion-exitosa
  Scenario: Instalación exitosa
    Given El comprador digital utiliza Chrome, Firefox o Safari en una versión compatible
    When Instala la extensión de ScamShield desde la tienda de extensiones de su navegador
    Then El navegador agrega la extensión y muestra el ícono de ScamShield en la barra de herramientas

  @navegador-no-compatible
  Scenario: Navegador no compatible
    Given El comprador digital utiliza una versión de navegador anterior a la mínima soportada
    When Instala la extensión de ScamShield
    Then El navegador impide la instalación e indica que la extensión no es compatible con su versión

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
