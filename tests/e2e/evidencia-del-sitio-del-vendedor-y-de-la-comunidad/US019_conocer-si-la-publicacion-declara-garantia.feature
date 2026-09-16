# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US019 | Prioridad: Media | Sprint: 2 | Estado: Completado

@US019 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-media @sprint-2
Feature: US019 - Conocer si la publicación declara garantía
  Como comprador digital
  Quiero conocer si la publicación declara garantía
  Para saber si tengo respaldo ante un producto defectuoso

  @garantia-declarada
  Scenario: Garantía declarada
    Given La publicación analizada declara una garantía
    When El comprador digital revisa la característica "Políticas de garantía"
    Then El panel muestra la garantía como verificada

  @publicacion-sin-garantia
  Scenario: Publicación sin garantía
    Given La publicación analizada indica "Sin garantía"
    When El comprador digital revisa la característica "Políticas de garantía"
    Then El panel indica que la publicación no declara garantía y no la considera a favor del vendedor

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
