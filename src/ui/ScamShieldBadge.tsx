import { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, LogIn } from 'lucide-react';
import { URL_REGISTRO } from '../auth/sesion.js';
import type { FeatureSet } from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import type { Detalles } from '../transport/RiskEngineClient.js';
import type { VeredictoAnalitica } from '../domain/analitica/eventos.js';
import { veredictoAnalitico } from '../analytics/desenlace.js';
import type { Instrumento } from '../domain/encuesta/instrumento.js';
import { contextoDelVeredicto } from '../domain/encuesta/contexto.js';
import { COLOR_DESENLACE, ETIQUETA_DESENLACE } from './estilos.js';
import { EncuestaSatisfaccion } from './EncuestaSatisfaccion.js';
import { VerdictPanel } from './VerdictPanel.js';

type Estado =
  | { readonly fase: 'inactivo' }
  | { readonly fase: 'analizando' }
  | { readonly fase: 'requiere-sesion' }
  | {
      readonly fase: 'listo';
      readonly verdict: Verdict;
      readonly features: FeatureSet;
      readonly detalles: Detalles;
    };

/**
 * Lo que el badge reporta a la analitica de uso.
 *
 * Es una interfaz estrecha y no la clase emisora entera: la presentacion no
 * tiene por que saber que hay una cola, un background ni un contrato de
 * ingesta. Ademas la hace opcional, asi que el badge se puede montar en un test
 * o en el popup sin arrastrar nada.
 */
export interface InteraccionesDelBadge {
  readonly advertenciaMostrada: (v: VeredictoAnalitica) => void;
  readonly advertenciaExpandida: () => void;
  readonly advertenciaContraida: () => void;
  readonly advertenciaCerrada: () => void;
  readonly detalleAbierto: () => void;
}

/** Como se envia la encuesta. La decide el content script; el badge solo dibuja. */
export interface CanalDeEncuesta {
  /** Devuelve el instrumento vigente, o null si no toca preguntar. */
  readonly ofrecer: () => Promise<Instrumento | null>;
  readonly enviar: (r: {
    readonly rating: number;
    readonly comment: string;
    readonly consentGiven: boolean;
    readonly consentVersion: string;
    readonly instrumentCode: string;
    readonly verdictKind: number;
    readonly verdictValue: number | null;
    readonly verdictConfidence: number | null;
  }) => Promise<'registrada' | 'cerrada' | 'fallo'>;
  readonly descartar: () => void;
}

interface Props {
  readonly plataforma: string;
  /** Devuelve null cuando el motor exige una sesion que no hay. */
  readonly evaluar: () => Promise<{
    verdict: Verdict;
    features: FeatureSet;
    detalles: Detalles;
  } | null>;
  readonly interacciones?: InteraccionesDelBadge;
  readonly encuesta?: CanalDeEncuesta;
}

type FaseEncuesta = 'oculta' | 'visible' | 'enviando' | 'fallo' | 'gracias';

/**
 * Badge insertado en la propia ficha del producto.
 *
 * El analisis es deliberadamente diferido: al cargar la pagina no se lee nada ni
 * se consulta nada. Recien al hacer clic se extrae el DOM y se pide el veredicto.
 * Asi el comprador decide cuando analizar, y la extension no hace trabajo ni
 * emite peticiones que el usuario no pidio.
 */
export function ScamShieldBadge({ plataforma, evaluar, interacciones, encuesta }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' });
  const [abierto, setAbierto] = useState(false);
  const [instrumento, setInstrumento] = useState<Instrumento | null>(null);
  const [faseEncuesta, setFaseEncuesta] = useState<FaseEncuesta>('oculta');

  /**
   * El evento se emite FUERA del actualizador de estado a proposito: React
   * puede volver a invocar un actualizador, y eso duplicaria la interaccion en
   * la analitica. Aqui el efecto ocurre una vez por clic, que es lo que mide.
   */
  const alternarPanel = (): void => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente) interacciones?.advertenciaExpandida();
    else interacciones?.advertenciaContraida();
  };

  const analizar = (): void => {
    if (estado.fase === 'analizando') return;
    if (estado.fase === 'listo') {
      alternarPanel();
      return;
    }
    setEstado({ fase: 'analizando' });
    void evaluar().then((r) => {
      if (r === null) {
        setEstado({ fase: 'requiere-sesion' });
        setAbierto(true);
        return;
      }
      setEstado({ fase: 'listo', verdict: r.verdict, features: r.features, detalles: r.detalles });
      // La advertencia acaba de aparecer: es el denominador de todas las tasas
      // de interaccion, y se emite antes que la expansion que viene con ella.
      interacciones?.advertenciaMostrada(veredictoAnalitico(r.verdict));
      setAbierto(true);
      interacciones?.advertenciaExpandida();

      // La encuesta se consulta DESPUES de mostrar el veredicto y sin bloquearlo.
      void encuesta?.ofrecer().then((i) => {
        if (i === null) return;
        setInstrumento(i);
        setFaseEncuesta('visible');
      });
    });
  };

  const clave =
    estado.fase === 'listo'
      ? estado.verdict.kind === 'riesgo'
        ? estado.verdict.nivel
        : 'evidencia-insuficiente'
      : null;

  const panelDeEncuesta =
    instrumento === null || estado.fase !== 'listo' || faseEncuesta === 'oculta' ? null : (
      faseEncuesta === 'gracias' ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Gracias por responder.
        </p>
      ) : (
        <EncuestaSatisfaccion
          instrumento={instrumento}
          enviando={faseEncuesta === 'enviando'}
          fallo={faseEncuesta === 'fallo'}
          onDescartar={() => {
            setFaseEncuesta('oculta');
            encuesta?.descartar();
          }}
          onEnviar={({ rating, comment, consentGiven }) => {
            if (!consentGiven || encuesta === undefined) return;
            const ctx = contextoDelVeredicto(estado.verdict, estado.features);
            setFaseEncuesta('enviando');
            void encuesta
              .enviar({
                rating,
                comment,
                consentGiven,
                consentVersion: instrumento.consentVersion,
                instrumentCode: instrumento.code,
                ...ctx,
              })
              .then((r) => {
                setFaseEncuesta(r === 'fallo' ? 'fallo' : 'gracias');
              });
          }}
        />
      )
    );

  return (
    <div className="relative my-3 font-sans">
      <button
        type="button"
        onClick={analizar}
        className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
          clave === null
            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            : COLOR_DESENLACE[clave]
        }`}
      >
        {estado.fase === 'analizando' ? (
          <Loader2 size={20} className="animate-spin" aria-hidden />
        ) : estado.fase === 'requiere-sesion' ? (
          <LogIn size={20} aria-hidden />
        ) : clave === null ? (
          <Shield size={20} aria-hidden />
        ) : clave === 'bajo' ? (
          <ShieldCheck size={20} aria-hidden />
        ) : clave === 'evidencia-insuficiente' ? (
          <ShieldQuestion size={20} aria-hidden />
        ) : (
          <ShieldAlert size={20} aria-hidden />
        )}

        <span className="flex-1">
          <span className="block text-sm font-bold">ScamShield</span>
          <span className="block text-xs opacity-80">
            {estado.fase === 'inactivo' && 'Analizar esta publicacion'}
            {estado.fase === 'analizando' && 'Analizando...'}
            {estado.fase === 'requiere-sesion' && 'Inicia sesion para ver el reporte'}
            {clave !== null && ETIQUETA_DESENLACE[clave]}
          </span>
        </span>

        {estado.fase === 'listo' && (
          <span className="text-xs font-semibold underline">
            {abierto ? 'Ocultar' : 'Ver detalle'}
          </span>
        )}
      </button>

      {abierto && estado.fase === 'requiere-sesion' && (
        <div className="absolute right-0 z-[2147483647] mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-slate-800">
            Inicia sesion para obtener el reporte
          </p>
          <p className="mt-1 text-sm text-slate-600">
            La estimacion de riesgo necesita una cuenta de ScamShield.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Inicia sesion desde el icono de ScamShield en la barra del navegador. Nunca te vamos a
            pedir tu contrasena dentro de una pagina de un marketplace.
          </p>
          <a
            href={URL_REGISTRO}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Crear una cuenta
          </a>
        </div>
      )}

      {abierto && estado.fase === 'listo' && (
        <div className="absolute right-0 z-[2147483647] mt-2 w-[380px]">
          <VerdictPanel
            verdict={estado.verdict}
            features={estado.features}
            detalles={estado.detalles}
            plataforma={plataforma}
            encuesta={panelDeEncuesta}
            onDetalleAbierto={() => {
              interacciones?.detalleAbierto();
            }}
            onCerrar={() => {
              setAbierto(false);
              interacciones?.advertenciaCerrada();
            }}
          />
        </div>
      )}
    </div>
  );
}
