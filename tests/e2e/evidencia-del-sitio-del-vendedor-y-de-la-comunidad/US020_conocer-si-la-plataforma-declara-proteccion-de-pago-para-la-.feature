# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US020 | Prioridad: Media | Sprint: 2 | Estado: Completado

@US020 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-media @sprint-2
Feature: US020 - Conocer si la plataforma declara protección de pago para la compra
  Como comprador digital
  Quiero conocer si la plataforma declara protección de pago para la compra
  Para saber si mi dinero está protegido en caso de estafa

  @proteccion-de-pago-declarada
  Scenario: Protección de pago declarada
    Given La plataforma declara protección de pago en la publicación analizada
    When El comprador digital revisa la característica "Protección de pago declarada"
    Then El panel muestra la protección de pago como declarada

  @proteccion-de-pago-no-declarada
  Scenario: Protección de pago no declarada
    Given La publicación analizada no declara protección de pago
    When El comprador digital revisa la característica "Protección de pago declarada"
    Then El panel indica que la compra no cuenta con protección de pago declarada

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
