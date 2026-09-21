import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

/** Lo que devuelve una evaluacion completa. */
export interface Evaluado {
  readonly verdict: Verdict;
  readonly features: FeatureSet;
  readonly detalles: Detalles;
}

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
  /** Devuelve el instrumento vigente, o null si no toca preguntar en esta consulta. */
  readonly ofrecer: () => Promise<{
    readonly instrumento: Instrumento;
    /** La persona ya acepto esta version del consentimiento. */
    readonly consentimientoVigente: boolean;
  } | null>;
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
  readonly retirarConsentimiento: () => void;
}

interface Props {
  readonly plataforma: string;
  /** Devuelve null cuando el motor exige una sesion que no hay. */
  readonly evaluar: () => Promise<Evaluado | null>;
  readonly interacciones?: InteraccionesDelBadge;
  readonly encuesta?: CanalDeEncuesta;
  /**
   * Donde se dibujan los paneles flotantes: una capa colgada del `<html>`, fuera
   * de la columna de compra. Sin ella se dibujan junto al badge.
   */
  readonly capa?: HTMLElement | null;
  /**
   * Vuelve a evaluar tras leer el perfil del vendedor, y null si no se pudo.
   *
   * Solo llega en las plataformas donde los datos del vendedor NO estan en la
   * ficha (Facebook Marketplace). Se ofrece como boton: la extension no abre el
   * perfil por su cuenta.
   */
  readonly revisarVendedor?: () => Promise<Evaluado | null>;
  /**
   * Si la evaluacion ya incluyo el perfil del vendedor. Cuando se leyo solo, el
   * aviso para revisarlo no tiene nada que ofrecer y no se muestra.
   */
  readonly perfilLeido?: () => boolean;
}

type FaseEncuesta = 'oculta' | 'visible' | 'enviando' | 'fallo' | 'gracias';

/** En que punto va la revision del perfil del vendedor, si la plataforma la pide. */
type FaseVendedor = 'sin-revisar' | 'revisando' | 'revisado' | 'fallo';

/**
 * Los paneles desplegados flotan sobre la pagina, pegados al borde derecho de la
 * ventana, en vez de colgar del badge.
 *
 * El badge vive dentro de la columna de compra del marketplace, que suele ser mas
 * angosta que el panel y tiene `overflow: hidden`: colgado de ahi, el panel salia
 * recortado por la izquierda y por abajo (AliExpress). Fijo en la ventana ninguna
 * columna lo recorta, y con alto maximo y scroll propio cabe en cualquier pantalla.
 *
 * Pero `fixed` solo se mide contra la ventana si ningun ancestro tiene
 * `transform`, `filter` o `contain`. La columna de Temu lo tiene: el panel
 * quedaba pegado a la columna, cortado, y debajo de los botones flotantes de la
 * pagina. Por eso los paneles se dibujan en la `capa`, fuera de la ficha.
 */
const FLOTANTE =
  'fixed right-4 top-4 z-[2147483647] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto';

/**
 * Badge insertado en la propia ficha del producto.
 *
 * El analisis es deliberadamente diferido: al cargar la pagina no se lee nada ni
 * se consulta nada. Recien al hacer clic se extrae el DOM y se pide el veredicto.
 * Asi el comprador decide cuando analizar, y la extension no hace trabajo ni
 * emite peticiones que el usuario no pidio.
 */
export function ScamShieldBadge({
  plataforma,
  evaluar,
  interacciones,
  encuesta,
  capa,
  revisarVendedor,
  perfilLeido,
}: Props) {
  const flotar = (panel: ReactNode): ReactNode => (capa ? createPortal(panel, capa) : panel);
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' });
  const [abierto, setAbierto] = useState(false);
  const [instrumento, setInstrumento] = useState<Instrumento | null>(null);
  const [faseEncuesta, setFaseEncuesta] = useState<FaseEncuesta>('oculta');
  const [consentimientoVigente, setConsentimientoVigente] = useState(false);
  const [vendedor, setVendedor] = useState<FaseVendedor>('sin-revisar');

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
      void encuesta?.ofrecer().then((oferta) => {
        if (oferta === null) return;
        setInstrumento(oferta.instrumento);
        setConsentimientoVigente(oferta.consentimientoVigente);
        setFaseEncuesta('visible');
      });
    });
  };

  /**
   * Lee el perfil del vendedor y rehace el veredicto con lo que traiga. Un fallo
   * no rompe nada: el reporte se queda como estaba, sin esos datos.
   */
  const revisar = (): void => {
    if (revisarVendedor === undefined || vendedor === 'revisando') return;
    setVendedor('revisando');
    void revisarVendedor().then((r) => {
      if (r === null) {
        setVendedor('fallo');
        return;
      }
      setEstado({ fase: 'listo', verdict: r.verdict, features: r.features, detalles: r.detalles });
      setVendedor('revisado');
      interacciones?.advertenciaMostrada(veredictoAnalitico(r.verdict));
    });
  };

  const avisoDelVendedor =
    revisarVendedor === undefined || vendedor === 'revisado' || perfilLeido?.() === true ? null : (
      <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">
          {vendedor === 'fallo' ? 'No se pudo leer el perfil' : 'Faltan los datos del vendedor'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {vendedor === 'fallo'
            ? 'Revisa que tengas la sesion de Facebook iniciada y vuelve a intentarlo.'
            : 'Facebook no publica las calificaciones del vendedor en la publicacion, sino en su perfil.'}
        </p>
        <button
          type="button"
          onClick={revisar}
          disabled={vendedor === 'revisando'}
          className="mt-2 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {vendedor === 'revisando' ? 'Revisando al vendedor...' : 'Revisar al vendedor'}
        </button>
        <p className="mt-2 text-[11px] text-slate-500">
          Se abre su perfil en segundo plano para leer sus calificaciones, y se cierra solo.
        </p>
      </div>
    );

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
          consentimientoVigente={consentimientoVigente}
          onRetirarConsentimiento={() => {
            setConsentimientoVigente(false);
            encuesta?.retirarConsentimiento();
          }}
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

      {abierto &&
        estado.fase === 'requiere-sesion' &&
        flotar(
        <div className={`${FLOTANTE} w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg`}>
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
        </div>,
        )}

      {abierto &&
        estado.fase === 'listo' &&
        flotar(
        <div className={`${FLOTANTE} w-[380px] rounded-2xl`}>
          {avisoDelVendedor}
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
        </div>,
        )}
    </div>
  );
}
