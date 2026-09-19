# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US016 | Prioridad: Alta | Sprint: 2 | Estado: Completado

@US016 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-alta @sprint-2
Feature: US016 - Visualizar la veracidad del dominio de la publicación
  Como comprador digital
  Quiero visualizar la veracidad del dominio de la publicación
  Para confirmar que la página pertenece a la plataforma que dice ser

  @veracidad-del-dominio-determinada
  Scenario: Veracidad del dominio determinada
    Given El comprador digital visualiza el resultado del análisis de una publicación
    When Revisa la característica "Veracidad del dominio"
    Then El panel muestra el nivel de veracidad del dominio en una escala de cinco niveles

  @dominio-sin-evidencia-suficiente
  Scenario: Dominio sin evidencia suficiente
    Given El comprador digital visualiza el resultado del análisis de una publicación
    When El servidor no obtuvo evidencia suficiente sobre el dominio
    Then El panel muestra el nivel "Sin evidencia suficiente" y presenta la característica como no verificada

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
