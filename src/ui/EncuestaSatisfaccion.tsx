import { useState } from 'react';
import { Star } from 'lucide-react';
import { itemsOrdenados, type Instrumento } from '../domain/encuesta/instrumento.js';

/**
 * La encuesta de satisfaccion, dibujada a partir del instrumento que publica el
 * backend.
 *
 * ── NADA DE ESTO ESTA CABLEADO ──────────────────────────────────────────────
 * El titulo, la pregunta, la escala y el texto de consentimiento vienen de
 * `GET /Feedback/Instrument`. El dia que el instrumento pase de un item a los
 * quince del protocolo, esta pantalla los dibuja sin cambiar: por eso recorre
 * `itemsOrdenados` y respeta `minValue`/`maxValue` en vez de pintar cinco
 * estrellas a mano.
 *
 * ── EL CONSENTIMIENTO ───────────────────────────────────────────────────────
 * La primera vez, la casilla arranca DESMARCADA y el boton de enviar esta
 * deshabilitado hasta que la persona la marca. No hay forma de enviar sin
 * aceptar, ni aqui, ni en el cliente de transporte, ni en el servidor.
 *
 * Como la encuesta se ofrece en cada consulta, la aceptacion se recuerda por
 * version del texto: si la persona ya acepto ESTA version, no se le vuelve a
 * pedir la casilla, pero se le muestra que esta participando y puede retirarlo
 * con un clic. Si el texto cambia, cambia su version y la casilla vuelve.
 * La version viaja con cada respuesta.
 */

interface Props {
  readonly instrumento: Instrumento;
  readonly onEnviar: (r: {
    readonly rating: number;
    readonly comment: string;
    readonly consentGiven: boolean;
  }) => void;
  readonly onDescartar: () => void;
  /** Mientras viaja la respuesta. */
  readonly enviando: boolean;
  /** El envio fallo por red. Se puede reintentar. */
  readonly fallo: boolean;
  /** La persona ya acepto esta version del consentimiento en una consulta anterior. */
  readonly consentimientoVigente: boolean;
  readonly onRetirarConsentimiento: () => void;
}

export function EncuestaSatisfaccion({
  instrumento,
  onEnviar,
  onDescartar,
  enviando,
  fallo,
  consentimientoVigente,
  onRetirarConsentimiento,
}: Props) {
  const [valor, setValor] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [acepta, setAcepta] = useState(false);

  const items = itemsOrdenados(instrumento);
  const principal = items[0];
  if (principal === undefined) return null;

  const consiente = consentimientoVigente || acepta;
  const puedeEnviar = consiente && valor !== null && !enviando;

  return (
    <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <h2 className="text-sm font-bold text-slate-800">{instrumento.title}</h2>

      {items.map((item) => (
        <div key={item.code} className="mt-3">
          <p className="text-sm text-slate-700">{item.prompt}</p>
          <div className="mt-2 flex items-center gap-1">
            {escalaDe(item.minValue, item.maxValue).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${String(n)} de ${String(item.maxValue)}`}
                aria-pressed={valor === n}
                onClick={() => {
                  setValor(n);
                }}
                className="rounded-full p-1 transition-colors hover:bg-amber-100"
              >
                <Star
                  size={22}
                  aria-hidden
                  className={
                    valor !== null && n <= valor
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-300'
                  }
                />
              </button>
            ))}
          </div>
        </div>
      ))}

      {instrumento.allowsComment && (
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-600">
            Comentario (opcional)
          </span>
          <textarea
            value={comentario}
            maxLength={instrumento.maxCommentLength}
            rows={2}
            onChange={(e) => {
              setComentario(e.target.value);
            }}
            className="mt-1 w-full resize-none rounded-xl border border-slate-200 p-2 text-sm text-slate-800"
          />
        </label>
      )}

      {consentimientoVigente ? (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          Participas en el estudio con tu consentimiento.{' '}
          <button
            type="button"
            onClick={() => {
              setAcepta(false);
              onRetirarConsentimiento();
            }}
            className="font-semibold underline"
          >
            Retirarlo
          </button>
        </p>
      ) : (
        <label className="mt-3 flex items-start gap-2">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => {
              setAcepta(e.target.checked);
            }}
            className="mt-0.5 shrink-0"
          />
          <span className="text-[11px] leading-snug text-slate-600">{instrumento.consentText}</span>
        </label>
      )}

      {fallo && (
        <p className="mt-2 text-xs text-rose-600">
          No se pudo enviar la respuesta. Puedes intentarlo otra vez.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!puedeEnviar}
          onClick={() => {
            if (valor === null) return;
            onEnviar({ rating: valor, comment: comentario, consentGiven: consiente });
          }}
          className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className="text-xs font-semibold text-slate-500 underline"
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}

/** Los valores de la escala que declara el item, no un 1..5 escrito a mano. */
const escalaDe = (min: number, max: number): readonly number[] => {
  const desde = Number.isFinite(min) ? Math.round(min) : 1;
  const hasta = Number.isFinite(max) ? Math.round(max) : 5;
  if (hasta < desde) return [];
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
};
