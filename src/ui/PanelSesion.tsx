import { useEffect, useState } from 'react';
import { ExternalLink, LogIn, LogOut, Mail, User, UserRound } from 'lucide-react';
import {
  abrirLogin,
  APP_WEB,
  cerrarSesion,
  obtenerPerfil,
  URL_REGISTRO,
  type Perfil,
  type Sesion,
} from '../auth/sesion.js';

interface Props {
  readonly sesion: Sesion | null;
  readonly cargando: boolean;
  readonly onCambio: (s: Sesion | null) => void;
}

/**
 * Sesion del comprador.
 *
 * Con sesion iniciada replica "Mi perfil" del cliente web: tarjeta azul con
 * esquinas muy redondeadas, avatar blanco, y los campos de nombre y correo en
 * cajas blancas. Sin sesion, un solo boton que abre el login del cliente web.
 *
 * Aqui no hay formulario a proposito. Autenticar es trabajo del cliente web:
 * asi la extension nunca ve una contrasena, y el inicio con Google, el registro
 * y la recuperacion se heredan sin duplicar ni una pantalla.
 */
export function PanelSesion({ sesion, cargando, onCambio }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    if (sesion === null) {
      setPerfil(null);
      return;
    }
    let vigente = true;
    void obtenerPerfil(sesion.email, sesion.token).then((p) => {
      if (vigente) setPerfil(p);
    });
    return () => {
      vigente = false;
    };
  }, [sesion]);

  if (cargando) {
    return (
      <div className="animate-pulse rounded-[24px] bg-blue-700/20 p-5">
        <div className="h-4 w-24 rounded bg-blue-700/30" />
        <div className="mt-3 h-10 w-full rounded-xl bg-blue-700/30" />
      </div>
    );
  }

  if (sesion !== null) {
    const correo = perfil?.email ?? (sesion.email === '' ? '' : sesion.email);
    const nombre = perfil?.fullName ?? '';
    const titulo = perfil?.username ?? (correo === '' ? 'Mi cuenta' : correo.split('@')[0]);

    return (
      <div className="relative overflow-hidden rounded-[24px] bg-blue-700 p-5 shadow-2xl">
        {/* Los halos difuminados de la pantalla "Mi perfil" del cliente web. */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-blue-600 opacity-50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-blue-800 opacity-50 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-white text-blue-700 shadow-inner">
            <User size={36} aria-hidden />
          </div>
          <h2 className="mt-2 truncate text-xl font-extrabold tracking-wide text-white">
            {titulo}
          </h2>
        </div>

        <div className="relative z-10 mt-4 flex flex-col gap-3">
          {nombre !== '' && (
            <Campo icono={<UserRound size={14} aria-hidden />} etiqueta="Nombre completo" valor={nombre} />
          )}
          <Campo icono={<Mail size={14} aria-hidden />} etiqueta="Correo electronico" valor={correo} />
        </div>

        <div className="relative z-10 mt-4 flex flex-col gap-2">
          <a
            href={`${APP_WEB}/profile`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
          >
            Editar perfil
            <ExternalLink size={13} className="opacity-70" aria-hidden />
          </a>
          <button
            type="button"
            onClick={() => {
              void cerrarSesion().then(() => {
                onCambio(null);
              });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            <LogOut size={15} aria-hidden />
            Cerrar sesion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] bg-blue-700 p-5 text-white shadow-2xl">
      <h2 className="text-2xl font-extrabold leading-tight">Inicia sesion</h2>
      <p className="mt-1 mb-4 text-sm font-medium text-blue-100">
        Accede para estimar el riesgo de una publicacion y proteger tus compras
      </p>

      <button
        type="button"
        onClick={() => {
          void abrirLogin();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
      >
        <LogIn size={18} aria-hidden />
        Iniciar sesion
        <ExternalLink size={14} className="opacity-70" aria-hidden />
      </button>

      <p className="mt-3 text-xs leading-snug text-blue-100">
        Se abre scamshield.ryzeon.dev en una pestaña. Tu contraseña la recibe el sitio de
        ScamShield, nunca la extension.
      </p>

      <p className="mt-3 text-center text-sm font-bold text-blue-200">
        ¿No tienes cuenta?{' '}
        <a
          href={URL_REGISTRO}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-white transition-colors hover:text-blue-100"
        >
          Registrate
        </a>
      </p>
    </div>
  );
}

function Campo({
  icono,
  etiqueta,
  valor,
}: {
  readonly icono: React.ReactNode;
  readonly etiqueta: string;
  readonly valor: string;
}) {
  return (
    <div>
      <p className="ml-1 flex items-center gap-1.5 text-xs font-bold text-blue-100">
        {icono}
        {etiqueta}
      </p>
      <p className="mt-1 truncate rounded-xl bg-white/90 px-3 py-2 text-sm font-bold text-slate-800 shadow-inner">
        {valor === '' ? '—' : valor}
      </p>
    </div>
  );
}
