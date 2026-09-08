import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
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
