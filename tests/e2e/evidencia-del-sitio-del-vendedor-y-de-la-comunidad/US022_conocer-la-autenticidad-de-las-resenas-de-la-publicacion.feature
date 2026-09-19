# Épica: Evidencia del sitio, del vendedor y de la comunidad
# HU: US022 | Prioridad: Media | Sprint: 3 | Estado: Completado

@US022 @evidencia-del-sitio-del-vendedor-y-de-la-comunidad @prioridad-media @sprint-3
Feature: US022 - Conocer la autenticidad de las reseñas de la publicación
  Como comprador digital
  Quiero conocer la autenticidad de las reseñas de la publicación
  Para no dejarme influenciar por reseñas falsas

  @resenas-evaluadas
  Scenario: Reseñas evaluadas
    Given La publicación analizada cuenta con reseñas legibles
    When El comprador digital revisa la característica "Autenticidad de las reseñas"
    Then El panel muestra el nivel de autenticidad y la proporción de reseñas con indicios de ser artificiales, sin almacenar el texto de las reseñas

  @resenas-insuficientes
  Scenario: Reseñas insuficientes
    Given La publicación analizada no cuenta con reseñas suficientes para evaluar
    When El comprador digital revisa la característica "Autenticidad de las reseñas"
    Then El panel muestra el nivel "Sin evidencia suficiente" y presenta la característica como no verificada

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
