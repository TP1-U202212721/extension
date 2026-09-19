# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US017 | Prioridad: Media | Sprint: 3 | Estado: Completado

@US017 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-media @sprint-3
Feature: US017 - Visualizar las señales de riesgo y a favor encontradas en el dominio
  Como comprador digital
  Quiero visualizar las señales de riesgo y a favor encontradas en el dominio
  Para entender por qué el dominio es considerado confiable o no

  @detalle-con-senales-del-dominio
  Scenario: Detalle con señales del dominio
    Given El comprador digital visualiza la veracidad del dominio de una publicación
    When Despliega el detalle del dominio
    Then El panel muestra un resumen y las secciones "Señales de riesgo", "Señales a favor" y "No se pudo comprobar"

  @detalle-del-dominio-no-disponible
  Scenario: Detalle del dominio no disponible
    Given El comprador digital visualiza la veracidad del dominio de una publicación
    When Despliega el detalle del dominio sin señales registradas
    Then El panel muestra el mensaje "No hay detalle disponible para este dominio"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
