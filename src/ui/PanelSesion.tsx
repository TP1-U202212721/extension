import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { googleDisponible, iniciarSesionConGoogle } from '../auth/google.js';
import {
  APP_WEB,
  cerrarSesion,
  iniciarSesion,
  registrarse,
  validarPassword,
  URL_RECUPERAR,
  type Sesion,
} from '../auth/sesion.js';

interface Props {
  readonly sesion: Sesion | null;
  readonly onCambio: (s: Sesion | null) => void;
}

/**
 * Sesion del comprador, con el mismo lenguaje visual que las pantallas de
 * autenticacion del cliente web: tarjeta azul, campos blancos redondeados,
 * boton negro. Se replican tambien las reglas de contrasena para que el error
 * sea identico en los dos lugares.
 *
 * El formulario vive en el popup y no en la pagina del marketplace a proposito:
 * pedir credenciales dentro de una pagina de terceros es el patron del
 * phishing, y una herramienta antifraude no deberia ensenarlo.
 */
export function PanelSesion({ sesion, onCambio }: Props) {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

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

  const enviar = (): void => {
    if (enviando) return;
    setError('');
    setAviso('');

    const problema = validarPassword(password);
    if (problema !== '') {
      setError(problema);
      return;
    }

    setEnviando(true);
    if (modo === 'login') {
      void iniciarSesion(email, password).then((r) => {
        setEnviando(false);
        if (r.ok) {
          setPassword('');
          onCambio(r.sesion);
        } else setError(r.mensaje);
      });
      return;
    }

    void registrarse(fullName, email, password).then((r) => {
      if (!r.ok) {
        setEnviando(false);
        setError(r.mensaje);
        return;
      }
      // Cuenta creada: se inicia sesion de inmediato para no pedirla dos veces.
      void iniciarSesion(email, password).then((s) => {
        setEnviando(false);
        if (s.ok) {
          setPassword('');
          onCambio(s.sesion);
        } else {
          setModo('login');
          setAviso('Cuenta creada. Inicia sesion para continuar.');
        }
      });
    });
  };

  const conGoogle = (): void => {
    if (enviando) return;
    setError('');
    setAviso('');
    setEnviando(true);
    void iniciarSesionConGoogle().then((r) => {
      setEnviando(false);
      if (r.ok) onCambio(r.sesion);
      else setError(r.mensaje);
    });
  };

  const campo =
    'w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-lg outline-none transition-all focus:ring-4 focus:ring-blue-300';

  return (
    <div className="rounded-[20px] bg-blue-700 p-5 text-white shadow-lg">
      <h2 className="text-2xl font-extrabold leading-tight">
        {modo === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
      </h2>
      <p className="mt-1 mb-4 text-sm font-medium text-blue-100">
        {modo === 'login'
          ? 'Accede para estimar el riesgo de una publicacion'
          : 'Registrate para protegerte de estafas digitales'}
      </p>

      {googleDisponible() && (
        <>
          <button
            type="button"
            onClick={conGoogle}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-slate-800 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-xl active:translate-y-0 disabled:opacity-50"
          >
            <GoogleGlifo />
            Continuar con Google
          </button>
          <div className="my-3 flex w-full items-center">
            <div className="h-px flex-1 bg-blue-400" />
            <span className="px-3 text-xs font-medium text-blue-200">O continua con</span>
            <div className="h-px flex-1 bg-blue-400" />
          </div>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex flex-col"
      >
        {modo === 'registro' && (
          <div className="mb-3 flex flex-col gap-1.5">
            <label htmlFor="ss-nombre" className="self-start text-sm font-bold text-white">
              Nombres
            </label>
            <input
              id="ss-nombre"
              type="text"
              required
              placeholder="Ingrese sus nombres"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
              }}
              className={campo}
            />
          </div>
        )}

        <div className="mb-3 flex flex-col gap-1.5">
          <label htmlFor="ss-email" className="self-start text-sm font-bold text-white">
            Email
          </label>
          <input
            id="ss-email"
            type="email"
            required
            placeholder="correo@ejemplo.com"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            className={campo}
          />
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="ss-pass" className="self-start text-sm font-bold text-white">
            Contrasena
          </label>
          <input
            id="ss-pass"
            type="password"
            required
            placeholder={modo === 'login' ? 'Contrasena' : 'Ingresa tu contrasena'}
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            className={campo}
          />
        </div>

        {error !== '' && (
          <p role="alert" className="mb-3 self-start text-sm font-bold text-red-300">
            {error}
          </p>
        )}
        {aviso !== '' && (
          <p role="status" className="mb-3 self-start text-sm font-bold text-blue-100">
            {aviso}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:opacity-50"
        >
          {enviando && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {modo === 'login' ? 'Iniciar sesion' : 'Registrarse'}
        </button>
      </form>

      {modo === 'login' && (
        <a
          href={URL_RECUPERAR}
          target="_blank"
          rel="noreferrer"
          className="mb-3 block text-center text-sm font-bold text-white transition-colors hover:text-blue-200"
        >
          ¿Olvidaste tu contrasena?
        </a>
      )}

      <p className="mb-3 text-center text-xs font-medium text-blue-100">
        Al continuar, aceptas nuestros{' '}
        <a href={`${APP_WEB}/terms`} target="_blank" rel="noreferrer" className="underline hover:text-white">
          Terminos de Servicio
        </a>{' '}
        y{' '}
        <a href={`${APP_WEB}/terms`} target="_blank" rel="noreferrer" className="underline hover:text-white">
          Politica de Privacidad
        </a>
      </p>

      <p className="text-center text-sm font-bold text-blue-200">
        {modo === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
        <button
          type="button"
          onClick={() => {
            setModo(modo === 'login' ? 'registro' : 'login');
            setError('');
            setAviso('');
          }}
          className="font-bold text-white transition-colors hover:text-blue-100"
        >
          {modo === 'login' ? 'Registrate' : 'Inicia sesion'}
        </button>
      </p>
    </div>
  );
}

/** Glifo oficial de Google, en SVG local: MV3 prohibe traerlo de un CDN. */
function GoogleGlifo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
