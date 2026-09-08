import { LogIn, LogOut, ExternalLink } from 'lucide-react';
import { abrirLogin, cerrarSesion, URL_REGISTRO, type Sesion } from '../auth/sesion.js';

interface Props {
  readonly sesion: Sesion | null;
  readonly onCambio: (s: Sesion | null) => void;
}

/**
 * Sesion del comprador, con el lenguaje visual de las pantallas de
 * autenticacion del cliente web: tarjeta azul, boton negro redondeado.
 *
 * Aqui no hay formulario a proposito. Autenticar es trabajo del cliente web:
 * asi la extension nunca ve una contrasena, y el inicio con Google, el registro
 * y la recuperacion se heredan sin duplicar ni una pantalla.
 */
export function PanelSesion({ sesion, onCambio }: Props) {
  if (sesion !== null) {
    return (
      <div className="rounded-[20px] bg-blue-700 p-4 text-white shadow-lg">
        <p className="text-xs font-medium text-blue-100">Sesion iniciada como</p>
        <p className="mt-0.5 truncate text-lg font-extrabold">
          {sesion.email === '' ? 'Tu cuenta de ScamShield' : sesion.email}
        </p>
        <button
          type="button"
          onClick={() => {
            void cerrarSesion().then(() => {
              onCambio(null);
            });
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
        >
          <LogOut size={16} aria-hidden />
          Cerrar sesion
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-blue-700 p-5 text-white shadow-lg">
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
        Se abre scamshield.ryzeon.dev en una pestana. Tu contrasena la recibe el sitio de
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
