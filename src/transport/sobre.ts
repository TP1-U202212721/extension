/**
 * Lectura tolerante a la grafia de las claves de respuesta.
 *
 * ── POR QUE EXISTE ──────────────────────────────────────────────────────────
 * El backend no es consistente. Su contrato documentado dice camelCase, ASP.NET
 * serializa camelCase por defecto, y en produccion devuelve PascalCase:
 *
 *     {"Item":{...},"IsSuccess":true,"Message":null}
 *
 * Leer `sobre['isSuccess']` sobre eso da `undefined`, la guarda de error se
 * cumple y se descarta una respuesta correcta entera. Eso hacia que una ficha
 * con `vendedor_reconocido = 1` saliera en la UI como vendedor no reconocido.
 *
 * Ademas los dos middlewares del backend (AuthMiddleware y
 * GlobalErrorHandlingMiddleware) serializan a mano con opciones por defecto, asi
 * que las respuestas de ERROR pueden traer otra grafia que las de exito. Por eso
 * la tolerancia va en los DOS sentidos y no solo hacia PascalCase: asi funciona
 * con cualquiera de las dos y no se vuelve a romper si el backend cambia.
 *
 * ── DONDE **NO** APLICA ─────────────────────────────────────────────────────
 * Los nombres de las caracteristicas dentro de `Features` y los valores de
 * `UndeterminedFeatures` (`vendedor_reconocido`, `puntuacion_producto`,
 * `porcentaje_reseñas_falsas`...) son DATOS, no claves del sobre. Van en
 * snake_case y se leen EXACTO. Normalizarlos rompería la correspondencia entre
 * un valor y su estado, que es la garantia central de este cliente.
 *
 * Por eso `Sobre.exacto()` existe y esta separado: marca en el codigo donde
 * termina la tolerancia.
 */

export const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Busca una clave ignorando mayusculas. Prefiere la coincidencia exacta: si un
 * objeto trajera `item` e `Item`, gana la que se pidio.
 */
const buscar = (o: Record<string, unknown>, clave: string): unknown => {
  if (Object.hasOwn(o, clave)) return o[clave];
  const objetivo = clave.toLowerCase();
  for (const k of Object.keys(o)) {
    if (k.toLowerCase() === objetivo) return o[k];
  }
  return undefined;
};

/**
 * Envoltorio de lectura. Cada cliente crea UNO y lee todo a traves de el, en
 * vez de repetir cada clave en dos grafias por todo el codigo.
 */
export class Sobre {
  private readonly datos: Record<string, unknown>;

  constructor(crudo: unknown) {
    this.datos = esObjeto(crudo) ? crudo : {};
  }

  /** El objeto crudo, para leer de el claves que son DATOS y no del sobre. */
  get crudo(): Record<string, unknown> {
    return this.datos;
  }

  /** Lectura EXACTA, sin tolerancia. Para nombres de caracteristicas. */
  exacto(clave: string): unknown {
    return this.datos[clave];
  }

  obj(clave: string): Sobre {
    return new Sobre(buscar(this.datos, clave));
  }

  txt(clave: string): string {
    const v = buscar(this.datos, clave);
    return typeof v === 'string' ? v : '';
  }

  /** null cuando la clave no trae un numero. Distingue ausencia de cero. */
  num(clave: string): number | null {
    const v = buscar(this.datos, clave);
    return typeof v === 'number' ? v : null;
  }

  numOr(clave: string, pordefecto: number): number {
    return this.num(clave) ?? pordefecto;
  }

  /** true solo ante el booleano; nunca por coercion de una cadena o un numero. */
  bool(clave: string): boolean {
    return buscar(this.datos, clave) === true;
  }

  /** Elementos de un arreglo, ya envueltos. Vacio si la clave no es un arreglo. */
  lista(clave: string): readonly Sobre[] {
    const v = buscar(this.datos, clave);
    return Array.isArray(v) ? v.map((e) => new Sobre(e)) : [];
  }

  /** Cadenas de un arreglo. Se devuelven TAL CUAL: son datos, no claves. */
  cadenas(clave: string): readonly string[] {
    const v = buscar(this.datos, clave);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  }
}

/** Lo comun a las cuatro respuestas: `{ isSuccess, item, message }`. */
export interface Respuesta {
  readonly ok: boolean;
  readonly item: Sobre;
  readonly mensaje: string;
}

/**
 * Interpreta el sobre de una respuesta del backend. Es el UNICO sitio por
 * cliente donde se decide si una respuesta es utilizable.
 */
export const leerRespuesta = (crudo: unknown, httpOk: boolean): Respuesta => {
  const sobre = new Sobre(crudo);
  const item = sobre.obj('item');
  return {
    ok: httpOk && sobre.bool('isSuccess') && Object.keys(item.crudo).length > 0,
    item,
    mensaje: sobre.txt('message'),
  };
};
