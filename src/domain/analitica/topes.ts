/**
 * Traduccion de los topes duros aplicados, de frase a codigo (`EAppliedCap`).
 *
 * ── POR QUE ES UN MAPEO DE FRASES ───────────────────────────────────────────
 * Los cuatro analizadores devuelven los topes APLICADOS en `limitations`, que es
 * una lista de frases en espanol escritas por el backend (`AppliedCaps` en
 * `DomainVeracityScorer` y `SellerReputationScorer`, `Limitations` en
 * `ReviewAuthenticityScorer`). El codigo del tope no se expone todavia.
 *
 * No sirve mirar `riskSignals`: que la senal `morphology.typosquatting` este
 * presente NO significa que haya topeado. El backend solo aplica el techo si el
 * veredicto estaba por encima (`if (veracity <= cap.Cap) continue;`). La unica
 * evidencia de que un tope ACTUO es que su frase aparezca en `limitations`.
 *
 * El contrato lo dice tal cual: "la extension tiene que mapear frase a codigo; lo
 * razonable es que el dia que el backend exponga el codigo de tope directamente,
 * este mapeo desaparezca". Ese dia se borra este archivo entero.
 *
 * ── COMO SE COMPARA ─────────────────────────────────────────────────────────
 * Por fragmento distintivo, sin tildes y en minusculas, y no por igualdad: dos
 * de las frases llevan numeros interpolados ("solo evaluo 12 de las 40 resenas")
 * y una coma de mas no puede hacer que un tope deje de contarse. Lo que no
 * reconozca cae en 99, que es lo correcto: el total de consultas topeadas sigue
 * cuadrando aunque la extension vaya por detras del servidor.
 */

/** `EAppliedCap`. Los huecos son deliberados: anadir un tope no corre los demas. */
export const TOPE = {
  dominioEnListaDeBloqueo: 1,
  certificadoAnteriorAlDominio: 2,
  certificadoNoCorresponde: 3,
  caracteresEnganosos: 4,
  typosquatting: 5,
  marcaEnSubdominio: 6,
  marcaConSenuelo: 7,
  descargaDeEjecutable: 8,
  coberturaDeDominioInsuficiente: 9,
  valoracionesNegativas: 20,
  tasaDeReclamosAlta: 21,
  cuentaReciengAbierta: 22,
  coberturaDeVendedorInsuficiente: 23,
  resenasEvaluadasParcialmente: 40,
  muestraDeResenasInsuficiente: 41,
  sinClasificar: 99,
} as const;

export type CodigoDeTope = (typeof TOPE)[keyof typeof TOPE];

const sinTildes = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Fragmento distintivo de cada frase, en orden de comprobacion. El primero que
 * aparezca gana; por eso los fragmentos no se solapan entre si.
 */
const FRAGMENTOS: readonly (readonly [string, CodigoDeTope])[] = [
  // DomainVeracityScorer.HardCaps
  ['listas publicas de bloqueo', TOPE.dominioEnListaDeBloqueo],
  ['certificado es anterior a la creacion', TOPE.certificadoAnteriorAlDominio],
  ['certificado no corresponde', TOPE.certificadoNoCorresponde],
  ['caracteres enganosos', TOPE.caracteresEnganosos],
  ['imita por escasos caracteres', TOPE.typosquatting],
  ['subdominio imita una marca', TOPE.marcaEnSubdominio],
  ['marca ajena con un senuelo', TOPE.marcaConSenuelo],
  ['descarga de un ejecutable', TOPE.descargaDeEjecutable],
  ['suficiente informacion del dominio', TOPE.coberturaDeDominioInsuficiente],

  // SellerReputationScorer.HardCaps
  ['valoraciones del vendedor es negativa', TOPE.valoracionesNegativas],
  ['tasa de reclamos alta', TOPE.tasaDeReclamosAlta],
  ['se abrio hace menos de un mes', TOPE.cuentaReciengAbierta],
  ['suficiente informacion del vendedor', TOPE.coberturaDeVendedorInsuficiente],

  // ReviewAuthenticityScorer
  ['clasificador solo evaluo', TOPE.resenasEvaluadasParcialmente],
  ['muy pocas para afirmar', TOPE.muestraDeResenasInsuficiente],
];

/** Codigo del tope que describe una frase. Lo no reconocido cae en 99. */
export const topeDe = (frase: string): CodigoDeTope => {
  const normalizada = sinTildes(frase);
  for (const [fragmento, codigo] of FRAGMENTOS) {
    if (normalizada.includes(fragmento)) return codigo;
  }
  return TOPE.sinClasificar;
};

/** Maximo de topes que el servidor guarda por consulta. */
const MAX_TOPES = 16;

/**
 * Codigos de todos los topes aplicados, sin repetir y en orden estable.
 *
 * Se deduplica porque el mismo tope por cobertura lo puede aplicar mas de un
 * analizador y contarlo dos veces inflaria la cifra que va al capitulo de
 * resultados.
 */
export const topesAplicados = (frases: readonly string[]): readonly number[] => {
  const vistos = new Set<number>();
  for (const frase of frases) {
    if (frase.trim() === '') continue;
    vistos.add(topeDe(frase));
  }
  return [...vistos].slice(0, MAX_TOPES);
};
