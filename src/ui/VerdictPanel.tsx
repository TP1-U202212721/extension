import { ShieldAlert, ShieldCheck, ShieldQuestion, CircleHelp, CircleCheck } from 'lucide-react';
import {
  FEATURE_IDS,
  FEATURE_META,
  esConocida,
  type FeatureId,
  type FeatureSet,
} from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import { AVISO, COLOR_DESENLACE, ETIQUETA_DESENLACE } from './estilos.js';

const iconoDe = (clave: keyof typeof ETIQUETA_DESENLACE) => {
  if (clave === 'bajo') return ShieldCheck;
  if (clave === 'evidencia-insuficiente') return ShieldQuestion;
  return ShieldAlert;
};

interface Props {
  readonly verdict: Verdict;
  readonly features: FeatureSet;
  readonly plataforma: string;
  readonly onCerrar?: () => void;
}

/**
 * Presentacion deliberadamente explicativa: junto al veredicto se muestra que
 * se verifico, que quedo sin resolver y que acredita cada caracteristica. La
 * ausencia de informacion se muestra como tal, nunca como seguridad.
 */
export function VerdictPanel({ verdict, features, plataforma, onCerrar }: Props) {
  const clave = verdict.kind === 'riesgo' ? verdict.nivel : 'evidencia-insuficiente';
  const Icono = iconoDe(clave);

  const resueltas = FEATURE_IDS.filter((id) => esConocida(features[id]));
  const pendientes = FEATURE_IDS.filter((id) => !esConocida(features[id]));

  return (
    <section className="w-[380px] rounded-2xl border border-slate-200 bg-white p-5 shadow-lg font-sans text-slate-900">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-blue-700">ScamShield</h1>
          <p className="text-xs text-slate-500">{plataforma}</p>
        </div>
        {onCerrar !== undefined && (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-rose-100 hover:text-rose-600"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        )}
      </header>

      <div
        className={`mb-4 flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${COLOR_DESENLACE[clave]}`}
      >
        <Icono size={28} aria-hidden />
        <span className="text-lg font-black uppercase tracking-wide">
          {ETIQUETA_DESENLACE[clave]}
        </span>
      </div>

      {verdict.kind === 'evidencia-insuficiente' && (
        <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {verdict.motivo} No se emite un nivel de riesgo porque no hay evidencia suficiente
          para sostenerlo.
        </p>
      )}

      <ListaCaracteristicas titulo="Se verifico" ids={resueltas} features={features} verificado />
      <ListaCaracteristicas
        titulo="No se pudo verificar"
        ids={pendientes}
        features={features}
        verificado={false}
      />

      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-snug text-slate-500">
        {AVISO}
      </p>
    </section>
  );
}

function ListaCaracteristicas({
  titulo,
  ids,
  features,
  verificado,
}: {
  readonly titulo: string;
  readonly ids: readonly FeatureId[];
  readonly features: FeatureSet;
  readonly verificado: boolean;
}) {
  if (ids.length === 0) return null;
  const Icono = verificado ? CircleCheck : CircleHelp;

  return (
    <div className="mb-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {titulo} ({ids.length})
      </h2>
      <ul className="space-y-2">
        {ids.map((id) => {
          const v = features[id];
          const detalle = v.kind === 'conocido' ? v.evidencia : v.motivo;
          return (
            <li key={id} className="flex items-start gap-2 text-sm">
              <Icono
                size={16}
                aria-hidden
                className={`mt-0.5 shrink-0 ${verificado ? 'text-emerald-600' : 'text-slate-400'}`}
              />
              <span>
                <span className="font-semibold">{FEATURE_META[id].etiqueta}</span>
                <span className="block text-xs text-slate-500">{detalle}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
