import { useState } from 'react';
import { probarServidor } from '../../api/google';
import { USUARIOS_DEMO } from '../../api/demo';
import type { Backend, Sesion } from '../../api/tipos';
import type { Servidor } from '../../config';
import { Boton, Campo, MensajeError } from '../componentes';

// Pantallas antes de entrar: configurar servidor, iniciar sesión y cambiar la contraseña temporal.

function Marco({ subtitulo, children }: { subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="entrada">
      <div className="tarjeta">
        <div className="entrada-logo">
          <img src="/icons/icon-192.png" alt="" />
          <h1>Stock Flores</h1>
          {subtitulo && <div className="nota-suave">{subtitulo}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Configurar({ alListo }: { alListo: (s: Servidor) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [probando, setProbando] = useState(false);
  return (
    <Marco subtitulo="Conectar con la planilla">
      <p>
        Pegá la dirección del servidor: es la URL de la <strong>aplicación web</strong> de Apps Script (termina en <code>/exec</code>).
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setProbando(true);
          setError('');
          try {
            const limpia = url.trim();
            await probarServidor(limpia);
            alListo({ tipo: 'google', url: limpia });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setProbando(false);
          }
        }}
      >
        <Campo etiqueta="Dirección del servidor">
          <input
            type="url"
            value={url}
            placeholder="https://script.google.com/macros/s/…/exec"
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </Campo>
        <MensajeError>{error}</MensajeError>
        <Boton type="submit" variante="primario" className="ancho" cargando={probando}>
          Conectar
        </Boton>
      </form>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '20px 0' }} />
      <p className="nota-suave">¿Todavía no la configuraste? Podés probar la app con datos que quedan solo en este dispositivo.</p>
      <Boton variante="borde" className="ancho" onClick={() => alListo({ tipo: 'demo' })}>
        Probar en modo prueba
      </Boton>
    </Marco>
  );
}

export function Login({
  backend,
  motivo,
  alEntrar,
  alCambiarServidor,
  puedeCambiarServidor,
}: {
  backend: Backend;
  motivo: string;
  alEntrar: (s: Sesion) => void;
  alCambiarServidor: () => void;
  puedeCambiarServidor: boolean;
}) {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(motivo);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: string, c: string) {
    setEnviando(true);
    setError('');
    try {
      alEntrar(await backend.login(e, c));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (backend.modo === 'demo') {
    return (
      <Marco subtitulo="Modo prueba: los datos quedan solo en este dispositivo">
        <MensajeError>{error}</MensajeError>
        <div className="menu-lista">
          {USUARIOS_DEMO.map((u) => (
            <Boton key={u.email} variante={u.rol === 'admin' ? 'primario' : 'borde'} onClick={() => entrar(u.email, '')} cargando={enviando}>
              Entrar como {u.rol === 'admin' ? 'administración' : 'ventas'}
            </Boton>
          ))}
        </div>
        <Boton variante="borde" className="ancho" style={{ marginTop: 16 }} onClick={alCambiarServidor}>
          Conectar con la planilla real
        </Boton>
      </Marco>
    );
  }

  return (
    <Marco>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void entrar(email, clave);
        }}
      >
        <Campo etiqueta="Email">
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Contraseña">
          <input
            type={ver ? 'text' : 'password'}
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
          />
        </Campo>
        <label className="check">
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseña
        </label>
        <MensajeError>{error}</MensajeError>
        <Boton type="submit" variante="primario" className="ancho" cargando={enviando}>
          Entrar
        </Boton>
      </form>
      <p className="nota-suave" style={{ marginTop: 16 }}>
        ¿Olvidaste la contraseña? Pedile a quien administra que te la restablezca.
      </p>
      {puedeCambiarServidor && (
        <button type="button" className="boton chico" style={{ background: 'none', padding: 0 }} onClick={alCambiarServidor}>
          Cambiar la dirección del servidor
        </button>
      )}
    </Marco>
  );
}

export function CambiarClave({
  backend,
  sesion,
  forzado,
  alListo,
  alCancelar,
}: {
  backend: Backend;
  sesion: Sesion;
  forzado: boolean;
  alListo: (s: Sesion) => void;
  alCancelar: () => void;
}) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <Marco subtitulo={forzado ? `Hola, ${sesion.usuario.nombre}. Elegí tu contraseña.` : 'Cambiar contraseña'}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (nueva !== repetida) {
            setError('Las dos contraseñas nuevas no coinciden.');
            return;
          }
          setEnviando(true);
          setError('');
          try {
            alListo(await backend.cambiarPassword(sesion.token, actual, nueva));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setEnviando(false);
          }
        }}
      >
        <Campo etiqueta={forzado ? 'Contraseña temporal' : 'Contraseña actual'}>
          <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Contraseña nueva" ayuda="Al menos 6 caracteres.">
          <input type="password" autoComplete="new-password" minLength={6} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Repetí la contraseña nueva">
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            required
          />
        </Campo>
        <MensajeError>{error}</MensajeError>
        <Boton type="submit" variante="primario" className="ancho" cargando={enviando}>
          Guardar contraseña
        </Boton>
        <Boton variante="borde" className="ancho" style={{ marginTop: 8 }} onClick={alCancelar}>
          {forzado ? 'Salir' : 'Volver'}
        </Boton>
      </form>
    </Marco>
  );
}
