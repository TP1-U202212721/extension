import type { ReactNode } from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion, CircleHelp, CircleCheck } from 'lucide-react';
import {
  FEATURE_IDS,
  FEATURE_META,
  esConocida,
  type FeatureId,
  type FeatureSet,
} from '../domain/features.js';
import type { Verdict } from '../domain/verdict.js';
import type { DetalleDominio, SenalDominio } from '../transport/DomainVeracityClient.js';
import type { DetalleVendedor, SenalVendedor } from '../transport/SellerReputationClient.js';
import type { Detalles } from '../transport/RiskEngineClient.js';
import type { EntradasModelo } from '../transport/DocumentAnalysisClient.js';
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
  /** Evidencia de cada analizador del backend, si respondieron. */
  readonly detalles?: Detalles;
  /** Inputs del modelo de la plataforma, para Facebook Marketplace. */
  readonly entradasModelo?: EntradasModelo | undefined;
  readonly onCerrar?: () => void;
  /**
   * La encuesta de satisfaccion, cuando toca ofrecerla. Entra como nodo y no
   * como bandera para que el panel no sepa nada del modulo de encuesta: aqui
   * solo se decide DONDE va, que es debajo del veredicto y encima del aviso.
   */
  readonly encuesta?: ReactNode;
  /** El comprador abrio el desglose de senales de un analizador. */
  readonly onDetalleAbierto?: () => void;
}

/**
 * Presentacion deliberadamente explicativa: junto al veredicto se muestra que
 * se verifico, que quedo sin resolver y que acredita cada caracteristica. La
 * ausencia de informacion se muestra como tal, nunca como seguridad.
 */
export function VerdictPanel({
  verdict,
  features,
  plataforma,
  detalles,
  entradasModelo,
  onCerrar,
  encuesta,
  onDetalleAbierto,
}: Props) {
  const documento = detalles?.documento ?? null;
  const dominio = detalles?.dominio ?? null;
  const vendedor = detalles?.vendedor ?? null;
  const clave = verdict.kind === 'riesgo' ? verdict.nivel : 'evidencia-insuficiente';
  const Icono = iconoDe(clave);

  const esFacebook = plataforma === 'Facebook Marketplace';

  const featuresVisibles = FEATURE_IDS.filter((id) => {
    if (esFacebook && (
      id === 'veracidadDeDominio' ||
      id === 'autenticidadDeResenas' ||
      id === 'proteccionDePago' ||
      id === 'reputacionDelVendedor'
    )) return false;
    return true;
  });

  const resueltas = featuresVisibles.filter((id) => esConocida(features[id]));
  const pendientes = featuresVisibles.filter((id) => !esConocida(features[id]));

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-lg font-sans text-slate-900">
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

      {documento != null && (
        <p className="mb-3 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600">
          El documento resolvio el{' '}
          <span className="font-bold">{Math.round(documento.coverage * 100)}%</span> de las
          caracteristicas que se leen de la pagina
          {documento.reviewCount > 0 && `, con ${String(documento.reviewCount)} resenas visibles`}.
        </p>
      )}

      {dominio != null && <AnalisisDeDominio d={dominio} onAbrir={onDetalleAbierto} />}

      {vendedor != null && <AnalisisDelVendedor d={vendedor} onAbrir={onDetalleAbierto} />}

      {esFacebook ? (
        <ListaInputsModelo entradas={entradasModelo} />
      ) : (
        <>
          <ListaCaracteristicas titulo="Se verifico" ids={resueltas} features={features} verificado plataforma={plataforma} />
          <ListaCaracteristicas
            titulo="No se pudo verificar"
            ids={pendientes}
            features={features}
            verificado={false}
            plataforma={plataforma}
          />
        </>
      )}

      {encuesta}

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
  plataforma,
}: {
  readonly titulo: string;
  readonly ids: readonly FeatureId[];
  readonly features: FeatureSet;
  readonly verificado: boolean;
  readonly plataforma: string;
}) {
  if (ids.length === 0) return null;
  const Icono = verificado ? CircleCheck : CircleHelp;
  const esFacebook = plataforma === 'Facebook Marketplace';

  const etiqueta = (id: FeatureId): string => {
    if (!esFacebook) return FEATURE_META[id].etiqueta;
    switch (id) {
      case 'puntuacionDelProducto': return 'Calificación del vendedor';
      case 'presenciaDeResenas': return 'Opiniones del vendedor';
      case 'politicasDeGarantia': return 'Políticas de la publicación';
      case 'volumenDeVentas': return 'Ventas del vendedor';
      default: return FEATURE_META[id].etiqueta;
    }
  };

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
                <span className="font-semibold">{etiqueta(id)}</span>
                <span className="block text-xs text-slate-500">{detalle}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Desglose del analizador de dominio. Las senales sin verificar se muestran
 * aparte y con el mismo peso visual que las demas: que algo no se haya podido
 * comprobar es informacion para el comprador, no un detalle a esconder.
 */
function AnalisisDeDominio({
  d,
  onAbrir,
}: {
  readonly d: DetalleDominio;
  readonly onAbrir?: (() => void) | undefined;
}) {
  const cobertura = Math.round(d.coverage * 100);
  return (
    <details
      className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
      onToggle={(e) => {
        if (e.currentTarget.open) onAbrir?.();
      }}
    >
      <summary className="cursor-pointer list-none text-sm font-bold text-slate-800">
        Analisis del dominio · {d.registrableDomain}
      </summary>

      <p className="mt-2 text-sm leading-snug text-slate-700">{d.summary}</p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Dato titulo="Nivel" valor={d.veracityLabel} />
        <Dato titulo="Confianza" valor={d.confidenceLabel} />
        <Dato titulo="Cobertura" valor={`${String(cobertura)}%`} />
      </dl>

      <GrupoSenales titulo="Señales de riesgo" senales={d.riskSignals} />
      <GrupoSenales titulo="Señales a favor" senales={d.trustSignals} />
      <GrupoSenales titulo="No se pudo comprobar" senales={d.unverifiedSignals} />

      {d.limitations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Limitaciones aplicadas
          </p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-snug text-slate-600">
            {d.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

/**
 * Desglose del analizador de reputacion del vendedor. Misma estructura que
 * AnalisisDeDominio: el comprador necesita ver las senales que respaldan
 * la estimacion, no solo el nivel final.
 */
function AnalisisDelVendedor({
  d,
  onAbrir,
}: {
  readonly d: DetalleVendedor;
  readonly onAbrir?: (() => void) | undefined;
}) {
  const cobertura = Math.round(d.coverage * 100);
  return (
    <details
      className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
      onToggle={(e) => {
        if (e.currentTarget.open) onAbrir?.();
      }}
    >
      <summary className="cursor-pointer list-none text-sm font-bold text-slate-800">
        Reputacion del vendedor · {d.sellerName}
      </summary>

      <p className="mt-2 text-sm leading-snug text-slate-700">{d.summary}</p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Dato titulo="Nivel" valor={d.reputationLabel} />
        <Dato titulo="Confianza" valor={d.confidenceLabel} />
        <Dato titulo="Cobertura" valor={`${String(cobertura)}%`} />
      </dl>

      <GrupoSenalesVendedor titulo="Señales de riesgo" senales={d.riskSignals} />
      <GrupoSenalesVendedor titulo="Señales a favor" senales={d.trustSignals} />
      <GrupoSenalesVendedor titulo="No se pudo comprobar" senales={d.unverifiedSignals} />

      {d.limitations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Limitaciones aplicadas
          </p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-snug text-slate-600">
            {d.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

function GrupoSenalesVendedor({
  titulo,
  senales,
}: {
  readonly titulo: string;
  readonly senales: readonly SenalVendedor[];
}) {
  if (senales.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {senales.map((s) => (
          <li key={s.code} className="text-xs leading-snug text-slate-700">
            <span className="font-semibold">{s.familyLabel}: </span>
            {s.explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dato({ titulo, valor }: { readonly titulo: string; readonly valor: string }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1.5">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{titulo}</dt>
      <dd className="text-xs font-semibold text-slate-800">{valor === '' ? '—' : valor}</dd>
    </div>
  );
}

function GrupoSenales({
  titulo,
  senales,
}: {
  readonly titulo: string;
  readonly senales: readonly SenalDominio[];
}) {
  if (senales.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {senales.map((s) => (
          <li key={s.code} className="text-xs leading-snug text-slate-700">
            <span className="font-semibold">{s.familyLabel}: </span>
            {s.explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Inputs del modelo de Facebook Marketplace, según Classification Model Marketplace/README.md. */
const FACEBOOK_MODEL_INPUTS: readonly { key: keyof EntradasModelo; label: string; fmt: (v: number) => string }[] = [
  { key: 'sellerSeniorityInDays', label: 'Antigüedad del vendedor', fmt: (v) => `${String(v)} días` },
  { key: 'ratingAvg', label: 'Calificación promedio', fmt: (v) => (v > 0 ? `${v.toFixed(1)} / 5` : 'Sin calificaciones') },
  { key: 'ratingCount', label: 'Cantidad de calificaciones', fmt: (v) => v > 0 ? String(v) : 'Ninguna' },
  { key: 'shopFollowerCount', label: 'Seguidores', fmt: (v) => v > 0 ? String(v) : 'Sin seguidores' },
  { key: 'shopItemCount', label: 'Publicaciones activas', fmt: (v) => v > 0 ? String(v) : 'Sin publicaciones' },
  { key: 'isShopeeVerified', label: 'Vendedor verificado', fmt: (v) => v >= 1 ? 'Sí' : 'No' },
  { key: 'discount', label: 'Descuento', fmt: (v) => (v > 0 ? `${String(v)}%` : 'Sin descuento') },
  { key: 'imagesCount', label: 'Imágenes', fmt: (v) => v > 0 ? String(v) : 'Sin imágenes' },
  {
    key: 'cobertura_evidencia',
    label: 'Cobertura de evidencia',
    fmt: (v) => `${String(Math.round(v * 100))}%`,
  },
];

function ListaInputsModelo({ entradas }: { readonly entradas?: EntradasModelo | undefined }) {
  return (
    <div className="mb-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        Criterios del modelo ({FACEBOOK_MODEL_INPUTS.length})
      </h2>
      <ul className="space-y-2">
        {FACEBOOK_MODEL_INPUTS.map(({ key, label, fmt }) => {
          const valor = entradas?.[key] ?? null;
          // null es "no se pudo leer"; 0 es un dato. No se presentan igual.
          const sinDatos = valor === null;
          const esCero = valor === 0;
          return (
            <li key={key} className="flex items-start gap-2 text-sm">
              <CircleHelp
                size={16}
                aria-hidden
                className={`mt-0.5 shrink-0 ${sinDatos ? 'text-slate-400' : esCero ? 'text-amber-500' : 'text-emerald-600'}`}
              />
              <span>
                <span className="font-semibold">{label}</span>
                <span className="block text-xs text-slate-500">
                  {sinDatos ? 'No se pudo leer' : fmt(valor)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
