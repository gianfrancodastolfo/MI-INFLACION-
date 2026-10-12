import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../../api/tipos';
import type { Rol, Usuario } from '../../core/tipos';
import { Boton, Campo, Hoja, MensajeError } from '../componentes';
import { useApp } from '../contexto';

export const NOMBRE_ROL: Record<Rol, string> = { admin: 'Administra', vendedor: 'Vende' };

export function Usuarios() {
  const { backend, sesion, esAdmin, cerrarSesion } = useApp();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [clave, setClave] = useState<{ email: string; clave: string } | null>(null);

  const manejar = useCallback(
    (e: unknown) => {
      const err = e instanceof ErrorApi ? e : new ErrorApi('Algo salió mal.');
      if (err.codigo === 'sesion') cerrarSesion(err.message);
      setError(err.message);
    },
    [cerrarSesion],
  );

  const cargar = useCallback(async () => {
    try {
      setUsuarios(await backend.usuarios(sesion.token));
    } catch (e) {
      manejar(e);
    }
  }, [backend, sesion.token, manejar]);

  useEffect(() => {
    if (esAdmin) void cargar();
  }, [cargar, esAdmin]);

  if (!esAdmin) return <div className="vacio">Esta sección es solo para administradores.</div>;

  return (
    <>
      <div className="titulo-pantalla">
        <h1>Usuarios</h1>
        <Boton variante="primario" onClick={() => setCreando(true)} disabled={backend.modo === 'demo'}>
          + Nuevo
        </Boton>
      </div>
      <p className="nota-suave">
        “Vende” puede vender, reservar, entregar, cancelar y cargar ingresos. “Administra” además hace descartes, conteos y correcciones,
        edita productos y maneja usuarios.
      </p>
      <MensajeError>{error}</MensajeError>
      <div className="tarjeta">
        {usuarios.map((u) => (
          <button key={u.email} type="button" className="renglon opcion-producto" onClick={() => setElegido(u)}>
            <span className="renglon-info">
              <span className="renglon-titulo">{u.nombre}</span>
              <span className="nota-suave"> · {u.email}</span>
            </span>
            <span className={`pastilla ${u.activo ? 'ok' : 'neutra'}`}>{u.activo ? NOMBRE_ROL[u.rol] : 'Inactivo'}</span>
          </button>
        ))}
      </div>

      {creando && (
        <HojaNuevoUsuario
          alCerrar={() => setCreando(false)}
          alCrear={(email, c) => {
            setCreando(false);
            setClave({ email, clave: c });
            void cargar();
          }}
        />
      )}
      {elegido && (
        <HojaUsuario
          usuario={elegido}
          esYo={elegido.email === sesion.usuario.email}
          alCerrar={() => setElegido(null)}
          alCambiar={() => void cargar()}
          alRestablecer={(c) => {
            setClave({ email: elegido.email, clave: c });
            setElegido(null);
          }}
        />
      )}
      {clave && (
        <Hoja titulo="Contraseña temporal" alCerrar={() => setClave(null)}>
          <p>
            Pasale esta contraseña a <strong>{clave.email}</strong>. La app le va a pedir que la cambie la primera vez que entre.
          </p>
          <div className="clave-mostrada">{clave.clave}</div>
          <p className="nota-suave">No se vuelve a mostrar. Si se pierde, restablecela de nuevo.</p>
          <Boton variante="primario" className="ancho" onClick={() => setClave(null)}>
            Listo
          </Boton>
        </Hoja>
      )}
    </>
  );
}

function HojaNuevoUsuario({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (email: string, clave: string) => void }) {
  const { backend, sesion } = useApp();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('vendedor');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <Hoja titulo="Nuevo usuario" alCerrar={alCerrar}>
      <Campo etiqueta="Email">
        <input type="email" value={email} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
      </Campo>
      <Campo etiqueta="Nombre para mostrar">
        <input type="text" value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo etiqueta="Rol">
        <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="vendedor">Vende</option>
          <option value="admin">Administra</option>
        </select>
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton
        variante="primario"
        className="ancho"
        cargando={enviando}
        disabled={!email.trim() || !nombre.trim()}
        onClick={async () => {
          setEnviando(true);
          setError('');
          try {
            const r = await backend.crearUsuario(sesion.token, email, nombre, rol);
            alCrear(r.usuario.email, r.claveTemporal);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo crear.');
          } finally {
            setEnviando(false);
          }
        }}
      >
        Crear usuario
      </Boton>
    </Hoja>
  );
}

function HojaUsuario({
  usuario: u,
  esYo,
  alCerrar,
  alCambiar,
  alRestablecer,
}: {
  usuario: Usuario;
  esYo: boolean;
  alCerrar: () => void;
  alCambiar: () => void;
  alRestablecer: (clave: string) => void;
}) {
  const { backend, sesion } = useApp();
  const [nombre, setNombre] = useState(u.nombre);
  const [rol, setRol] = useState<Rol>(u.rol);
  const [activo, setActivo] = useState(u.activo);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState<'' | 'guardar' | 'clave'>('');

  async function intentar(tipo: 'guardar' | 'clave', fn: () => Promise<void>) {
    setEnviando(tipo);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo.');
    } finally {
      setEnviando('');
    }
  }

  return (
    <Hoja titulo={u.nombre} alCerrar={alCerrar}>
      <p className="nota-suave">{u.email}</p>
      <Campo etiqueta="Nombre para mostrar">
        <input type="text" value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo etiqueta="Rol">
        <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={esYo}>
          <option value="vendedor">Vende</option>
          <option value="admin">Administra</option>
        </select>
      </Campo>
      <label className="check">
        <input type="checkbox" checked={activo} disabled={esYo} onChange={(e) => setActivo(e.target.checked)} />
        Activo (puede entrar a la app)
      </label>
      <MensajeError>{error}</MensajeError>
      <div className="acciones">
        <Boton
          variante="primario"
          className="completo"
          cargando={enviando === 'guardar'}
          disabled={backend.modo === 'demo'}
          onClick={() =>
            intentar('guardar', async () => {
              await backend.editarUsuario(sesion.token, u.email, { nombre, rol, activo });
              alCambiar();
              alCerrar();
            })
          }
        >
          Guardar
        </Boton>
        {!esYo && (
          <Boton
            variante="borde"
            className="completo"
            cargando={enviando === 'clave'}
            disabled={backend.modo === 'demo'}
            onClick={() =>
              intentar('clave', async () => {
                alRestablecer(await backend.restablecerPassword(sesion.token, u.email));
              })
            }
          >
            Restablecer contraseña
          </Boton>
        )}
      </div>
    </Hoja>
  );
}
