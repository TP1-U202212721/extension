# Épica: Sesión del comprador en la extensión
# HU: US008 | Prioridad: Baja | Sprint: 2 | Estado: Completado

@US008 @sesion-del-comprador-en-la-extension @prioridad-baja @sprint-2
Feature: US008 - Visualizar los datos de mi cuenta dentro de la extensión
  Como comprador digital
  Quiero visualizar los datos de mi cuenta dentro de la extensión
  Para confirmar la cuenta con la que estoy analizando mis publicaciones de venta

  @datos-del-perfil-cargados-con-exito
  Scenario: Datos del perfil cargados con éxito
    Given El comprador digital tiene una sesión activa en la extensión
    When Inicia sesión por medio de la aplicación web
    Then La extensión muestra el nombre de usuario, nombre completo y correo electrónico del perfil

  @error-al-cargar-los-datos-del-perfil
  Scenario: Error al cargar los datos del perfil
    Given El comprador digital tiene una sesión activa en la extensión
    When Inicia sesión por medio de la aplicación web
    Then La extensión muestra el mensaje "No se pudieron cargar los datos del perfil"

  # Notas de ejecución (agente + Playwright MCP)
  # - Entorno objetivo: <PENDIENTE: URL base del entorno de pruebas>
  # - Precondiciones de infraestructura no cubiertas por Playwright MCP puro
  #   (ej. instalación de extensión de navegador, cuentas de prueba) deben
  #   resolverse antes de invocar al agente sobre este feature.
