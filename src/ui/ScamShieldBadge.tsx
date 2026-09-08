import { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, LogIn } from 'lucide-react';
import { URL_LOGIN, URL_REGISTRO } from '../auth/sesion.js';
import type { FeatureSet } from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import { COLOR_DESENLACE, ETIQUETA_DESENLACE } from './estilos.js';
import { VerdictPanel } from './VerdictPanel.js';

type Estado =
  | { readonly fase: 'inactivo' }
  | { readonly fase: 'analizando' }
  | { readonly fase: 'requiere-sesion' }
  | { readonly fase: 'listo'; readonly verdict: Verdict; readonly features: FeatureSet };

interface Props {
  readonly plataforma: string;
  /** Lectura del DOM. Se ejecuta al hacer clic, no al cargar la pagina. */
  readonly extraer: () => FeatureSet;
  /** Devuelve null cuando el motor exige una sesion que no hay. */
  readonly evaluar: (
    features: FeatureSet,
  ) => Promise<{ verdict: Verdict; features: FeatureSet } | null>;
}

/**
 * Badge insertado en la propia ficha del producto.
 *
 * El analisis es deliberadamente diferido: al cargar la pagina no se lee nada ni
 * se consulta nada. Recien al hacer clic se extrae el DOM y se pide el veredicto.
 * Asi el comprador decide cuando analizar, y la extension no hace trabajo ni
 * emite peticiones que el usuario no pidio.
 */
export function ScamShieldBadge({ plataforma, extraer, evaluar }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' });
  const [abierto, setAbierto] = useState(false);

  const analizar = (): void => {
    if (estado.fase === 'analizando') return;
    if (estado.fase === 'listo') {
      setAbierto((v) => !v);
      return;
    }
    setEstado({ fase: 'analizando' });
    void evaluar(extraer()).then((r) => {
      if (r === null) {
        setEstado({ fase: 'requiere-sesion' });
        setAbierto(true);
        return;
      }
      setEstado({ fase: 'listo', verdict: r.verdict, features: r.features });
      setAbierto(true);
    });
  };

  const clave =
    estado.fase === 'listo'
      ? estado.verdict.kind === 'riesgo'
        ? estado.verdict.nivel
        : 'evidencia-insuficiente'
      : null;

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
            {estado.fase === 'requiere-sesion' && 'Inicia sesion para analizar'}
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
          <p className="text-sm text-slate-700">
            Para estimar el riesgo necesitas una cuenta de ScamShield.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={URL_LOGIN}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-blue-700"
            >
              Iniciar sesion
            </a>
            <a
              href={URL_REGISTRO}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              Registrarte
            </a>
          </div>
        </div>
      )}

      {abierto && estado.fase === 'listo' && (
        <div className="absolute right-0 z-[2147483647] mt-2 w-[380px]">
          <VerdictPanel
            verdict={estado.verdict}
            features={estado.features}
            plataforma={plataforma}
            onCerrar={() => {
              setAbierto(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
