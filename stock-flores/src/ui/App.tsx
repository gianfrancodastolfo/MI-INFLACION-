import { useCallback, useMemo, useState } from 'react';
import { crearBackendDemo } from '../api/demo';
import { crearBackendGoogle } from '../api/google';
import type { Sesion } from '../api/tipos';
import { guardarServidor, servidorGuardado, URL_FIJA, type Servidor } from '../config';
import { Iconos } from './componentes';
import { ProveedorApp, useApp } from './contexto';
import { haceCuanto } from './formato';
import { navegar, useRuta } from './ruta';
import { CambiarClave, Configurar, Login } from './pantallas/Entrada';
import { Historial } from './pantallas/Historial';
import { Mas } from './pantallas/Mas';
import { NuevaReserva } from './pantallas/NuevaReserva';
import { Productos } from './pantallas/Productos';
import { Reservas } from './pantallas/Reservas';
import { Stock } from './pantallas/Stock';
import { Usuarios } from './pantallas/Usuarios';

const CLAVE_SESION = 'stockflores:sesion';

function idServidor(s: Servidor): string {
  return s.tipo === 'demo' ? 'demo' : s.url;
}

function leerSesion(s: Servidor | null): Sesion | null {
  if (!s) return null;
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_SESION) ?? 'null') as { servidor: string; sesion: Sesion } | null;
    return g && g.servidor === idServidor(s) ? g.sesion : null;
  } catch {
    return null;
  }
}

function guardarSesion(s: Servidor | null, sesion: Sesion | null): void {
  try {
    if (!s || !sesion) localStorage.removeItem(CLAVE_SESION);
    else localStorage.setItem(CLAVE_SESION, JSON.stringify({ servidor: idServidor(s), sesion }));
  } catch {
    // sin almacenamiento: la sesión dura mientras la app esté abierta
  }
}

export function App() {
  const [servidor, setServidor] = useState<Servidor | null>(servidorGuardado);
  const [sesion, setSesionEstado] = useState<Sesion | null>(() => leerSesion(servidor));
  const [motivo, setMotivo] = useState('');
  const ruta = useRuta();

  const backend = useMemo(
    () => (servidor ? (servidor.tipo === 'demo' ? crearBackendDemo() : crearBackendGoogle(servidor.url)) : null),
    [servidor],
  );

  const setSesion = useCallback(
    (s: Sesion | null) => {
      setSesionEstado(s);
      guardarSesion(servidor, s);
    },
    [servidor],
  );

  const cerrarSesion = useCallback(
    (m = '') => {
      setMotivo(m);
      setSesion(null);
    },
    [setSesion],
  );

  const cambiarServidor = useCallback(() => {
    guardarServidor(null);
    guardarSesion(null, null);
    setSesionEstado(null);
    // Si hay una dirección fija (la de producción), volver a ella; si no, pedirla.
    setServidor(URL_FIJA ? { tipo: 'google', url: URL_FIJA } : null);
  }, []);

  if (!servidor || !backend) {
    return (
      <Configurar
        alListo={(s) => {
          guardarServidor(s);
          setServidor(s);
        }}
      />
    );
  }

  if (!sesion) {
    return (
      <Login
        backend={backend}
        motivo={motivo}
        alEntrar={(s) => {
          setMotivo('');
          setSesion(s);
        }}
        alCambiarServidor={servidor.tipo === 'demo' ? cambiarServidor : () => setServidor(null)}
        puedeCambiarServidor={!URL_FIJA}
      />
    );
  }

  if (sesion.debeCambiar || (ruta.partes[0] === 'clave' && backend.modo === 'google')) {
    return (
      <CambiarClave
        backend={backend}
        sesion={sesion}
        forzado={sesion.debeCambiar}
        alListo={(s) => {
          setSesion(s);
          navegar('/stock');
        }}
        alCancelar={() => (sesion.debeCambiar ? cerrarSesion() : navegar('/mas'))}
      />
    );
  }

  return (
    <ProveedorApp
      key={`${idServidor(servidor)}|${sesion.usuario.email}`}
      backend={backend}
      sesion={sesion}
      claveCache={`stockflores:estado:${idServidor(servidor)}`}
      alCerrarSesion={cerrarSesion}
      alActualizarSesion={setSesion}
    >
      <Principal alCambiarServidor={cambiarServidor} />
    </ProveedorApp>
  );
}

const PESTANAS = [
  { id: 'stock', texto: 'Stock', icono: Iconos.stock },
  { id: 'reservas', texto: 'Reservas', icono: Iconos.reservas },
  { id: 'historial', texto: 'Historial', icono: Iconos.historial },
  { id: 'mas', texto: 'Más', icono: Iconos.mas },
] as const;

function Principal({ alCambiarServidor }: { alCambiarServidor: () => void }) {
  const ruta = useRuta();
  const { estado, sync, backend, avisos, refrescar } = useApp();
  const [p0 = 'stock', p1] = ruta.partes;
  const pendientes = estado?.pedidos.filter((p) => p.estado === 'pendiente').length ?? 0;
  const activa = ['productos', 'usuarios'].includes(p0) ? 'mas' : p0;

  let pantalla: React.ReactNode;
  if (p0 === 'reservas' && p1 === 'nueva') pantalla = <NuevaReserva key={ruta.params.toString()} ruta={ruta} />;
  else if (p0 === 'reservas') pantalla = <Reservas />;
  else if (p0 === 'historial') pantalla = <Historial />;
  else if (p0 === 'mas') pantalla = <Mas alCambiarServidor={alCambiarServidor} />;
  else if (p0 === 'productos') pantalla = <Productos />;
  else if (p0 === 'usuarios') pantalla = <Usuarios />;
  else pantalla = <Stock />;

  const textoSync =
    sync.fase === 'error' ? 'Sin conexión' : sync.fase === 'cargando' && !sync.ultima ? 'Cargando…' : `Al día · ${haceCuanto(sync.ultima)}`;

  return (
    <div className="app">
      <header className="encabezado">
        <div className="encabezado-fila">
          <div className="marca">
            <img src="/icons/icon-192.png" alt="" />
            <span>Stock Flores</span>
          </div>
          <nav className="nav" aria-label="Secciones">
            {PESTANAS.map((t) => (
              <a key={t.id} href={`#/${t.id}`} aria-current={activa === t.id ? 'page' : undefined}>
                {t.icono}
                <span>{t.texto}</span>
                {t.id === 'reservas' && pendientes > 0 && <span className="insignia num">{pendientes}</span>}
              </a>
            ))}
          </nav>
          <button
            type="button"
            className={`sync ${sync.fase}`}
            onClick={() => refrescar(true)}
            title="Actualizar ahora"
            aria-label={`${textoSync}. Tocar para actualizar.`}
          >
            <span className="punto" aria-hidden="true" />
            <span>{textoSync}</span>
          </button>
        </div>
      </header>
      {backend.modo === 'demo' && (
        <div className="banda banda-demo">Modo prueba: nada de esto se guarda en la planilla.</div>
      )}
      {sync.fase === 'error' && (
        <div className="banda banda-error" role="status">
          {sync.error}
          {estado && sync.ultima ? ` Mostrando datos de ${haceCuanto(sync.ultima)}.` : ''} No se pueden registrar operaciones hasta
          que vuelva la conexión.
        </div>
      )}
      <main className="contenido">{pantalla}</main>
      <div className="avisos" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso ${a.tipo}`}>
            {a.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
