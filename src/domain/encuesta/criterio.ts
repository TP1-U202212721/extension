/**
 * Cuando se ofrece la encuesta de satisfaccion.
 *
 * ── EL CRITERIO, Y POR QUE ESTE ─────────────────────────────────────────────
 * Se ofrece EN CADA CONSULTA que dio veredicto, como una calificacion corta de
 * ese veredicto concreto, dentro del mismo panel y siempre opcional. Cada nota
 * queda pegada al resultado que la persona vio, que es el cruce que la tesis
 * necesita: si se confia mas en un riesgo alto que en una evidencia insuficiente.
 *
 * Se deja de ofrecer cuando:
 *
 * 1. **La consulta no llego a veredicto.** No hay resultado que calificar.
 *
 * 2. **El modulo esta apagado.** Lo dice el propio instrumento.
 *
 * 3. **Ya se enviaron `MAXIMO_POR_DIA` respuestas hoy.** Es el mismo tope que
 *    aplica el backend (`MaxResponsesPerRespondentPerDay`): pasado ese numero
 *    respondera 429, asi que se deja de mostrar en vez de ofrecer algo que va a
 *    fallar. Ademas frena el cansancio.
 *
 * 4. **Hace menos de `ESPERA_MINIMA_MS` del ultimo envio.** Tambien lo impone el
 *    backend (`MinSecondsBetweenResponses`).
 *
 * "Ahora no" oculta la encuesta solo en ESA consulta: no cierra nada para
 * siempre. Y el backend ya garantiza una sola respuesta por consulta (indice
 * unico por respondiente, instrumento y consulta).
 *
 * El consentimiento se pide la primera vez y se recuerda por version de texto:
 * pedir la casilla en cada consulta haria la calificacion inviable. Si el texto
 * del consentimiento cambia, cambia su version y se vuelve a pedir. La persona
 * puede retirarlo desde el propio panel.
 *
 * Sustituye al criterio anterior ("una sola vez, desde la tercera consulta"),
 * que media otra cosa: una impresion global, no el veredicto. El cuestionario
 * global de quince items del protocolo, cuando exista, va aparte y ese si se
 * ofrece una sola vez. Queda escrito en docs/adr/0007.
 */

/** Respuestas por dia. Igual que `Feedback:MaxResponsesPerRespondentPerDay`. */
export const MAXIMO_POR_DIA = 5;

/** Espera entre envios. Igual que `Feedback:MinSecondsBetweenResponses`. */
export const ESPERA_MINIMA_MS = 30_000;

export interface EstadoDeLaEncuesta {
  /** Dia UTC al que corresponde `enviadasHoy`, como `AAAA-MM-DD`. */
  readonly dia: string;
  readonly enviadasHoy: number;
  /** Instante del ultimo envio aceptado, en ms. */
  readonly ultimoEnvio: number | null;
  /** Version del texto de consentimiento que la persona acepto, si acepto alguno. */
  readonly consentimientoAceptado: string | null;
}

export const ENCUESTA_INICIAL: EstadoDeLaEncuesta = {
  dia: '',
  enviadasHoy: 0,
  ultimoEnvio: null,
  consentimientoAceptado: null,
};

/** Dia UTC: el mismo corte que usa el servidor para su tope diario. */
export const diaDe = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** El estado con la cuenta diaria reiniciada si ya cambio el dia. */
export const alDia = (e: EstadoDeLaEncuesta, ahora: number): EstadoDeLaEncuesta =>
  e.dia === diaDe(ahora) ? e : { ...e, dia: diaDe(ahora), enviadasHoy: 0 };

/** Registra un envio aceptado por el servidor y el consentimiento con el que se hizo. */
export const conEnvio = (
  e: EstadoDeLaEncuesta,
  ahora: number,
  consentVersion: string,
): EstadoDeLaEncuesta => {
  const hoy = alDia(e, ahora);
  return {
    ...hoy,
    enviadasHoy: hoy.enviadasHoy + 1,
    ultimoEnvio: ahora,
    consentimientoAceptado: consentVersion,
  };
};

/** La persona retira su consentimiento: se le volvera a pedir antes de enviar. */
export const sinConsentimiento = (e: EstadoDeLaEncuesta): EstadoDeLaEncuesta => ({
  ...e,
  consentimientoAceptado: null,
});

/** El consentimiento recordado vale solo para la misma version del texto. */
export const consentimientoVigente = (e: EstadoDeLaEncuesta, version: string): boolean =>
  e.consentimientoAceptado !== null && version !== '' && e.consentimientoAceptado === version;

export interface ContextoDeOferta {
  readonly estado: EstadoDeLaEncuesta;
  /** La consulta que se acaba de mostrar llego a veredicto. */
  readonly huboVeredicto: boolean;
  /** El instrumento dice que el modulo esta encendido. */
  readonly moduloEncendido: boolean;
  readonly ahora: number;
}

export const debeOfrecerse = (c: ContextoDeOferta): boolean => {
  const e = alDia(c.estado, c.ahora);
  return (
    c.moduloEncendido &&
    c.huboVeredicto &&
    e.enviadasHoy < MAXIMO_POR_DIA &&
    (e.ultimoEnvio === null || c.ahora - e.ultimoEnvio >= ESPERA_MINIMA_MS)
  );
};
