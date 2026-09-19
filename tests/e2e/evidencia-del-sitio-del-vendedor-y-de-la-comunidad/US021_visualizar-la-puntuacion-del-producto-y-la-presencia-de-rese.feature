# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US021 | Prioridad: Media | Sprint: 2 | Estado: Completado

@US021 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-media @sprint-2
Feature: US021 - Visualizar la puntuación del producto y la presencia de reseñas
  Como comprador digital
  Quiero visualizar la puntuación del producto y la presencia de reseñas
  Para considerar la experiencia de otros compradores antes de comprar

  @publicacion-con-resenas
  Scenario: Publicación con reseñas
    Given La publicación analizada cuenta con reseñas de compradores
    When El comprador digital revisa la evidencia de la comunidad
    Then El panel muestra la puntuación promedio del producto en una escala de 0.0 a 5.0 y confirma la presencia de reseñas

  @publicacion-sin-resenas
  Scenario: Publicación sin reseñas
    Given La publicación analizada no cuenta con reseñas de compradores
    When El comprador digital revisa la evidencia de la comunidad
    Then El panel indica que la publicación no tiene reseñas y no muestra una puntuación

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
