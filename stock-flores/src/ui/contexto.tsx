import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Backend, Sesion } from '../api/tipos';
import { ErrorApi } from '../api/tipos';
import type { Comando, Estado } from '../core/tipos';

// Estado compartido de la app: sesión, stock, sincronización y avisos.

const CADA = 20_000; // consulta cambios cada 20 s mientras la app está a la vista
const COMPLETO_CADA = 5 * 60_000; // y relee todo cada 5 min (por si alguien tocó la planilla)

export interface Sync {
  fase: 'cargando' | 'ok' | 'error';
  ultima: Date | null;
  error: string;
}

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error';
}

interface ValorApp {
  backend: Backend;
  sesion: Sesion;
  estado: Estado | null;
  sync: Sync;
  esAdmin: boolean;
  /** Se puede operar: la última consulta al servidor salió bien. */
  conectado: boolean;
  refrescar: (completo?: boolean) => Promise<void>;
  operar: (cmd: Comando, opId: string) => Promise<string>;
  avisar: (texto: string, tipo?: 'ok' | 'error') => void;
  avisos: Aviso[];
  cerrarSesion: (motivo?: string) => void;
  actualizarSesion: (s: Sesion) => void;
}

const Contexto = createContext<ValorApp | null>(null);

export function useApp(): ValorApp {
  const v = useContext(Contexto);
  if (!v) throw new Error('useApp fuera del proveedor');
  return v;
}

function leerCache(clave: string): Estado | null {
  try {
    const t = localStorage.getItem(clave);
    return t ? (JSON.parse(t) as Estado) : null;
  } catch {
    return null;
  }
}

function guardarCache(clave: string, e: Estado): void {
  try {
    localStorage.setItem(clave, JSON.stringify(e));
  } catch {
    // sin almacenamiento
  }
}

export function ProveedorApp({
  backend,
  sesion,
  claveCache,
  alCerrarSesion,
  alActualizarSesion,
  children,
}: {
  backend: Backend;
  sesion: Sesion;
  claveCache: string;
  alCerrarSesion: (motivo?: string) => void;
  alActualizarSesion: (s: Sesion) => void;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<Estado | null>(() => {
    const e = leerCache(claveCache);
    return e && e.usuario.email === sesion.usuario.email ? e : null;
  });
  const [sync, setSync] = useState<Sync>({ fase: 'cargando', ultima: null, error: '' });
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const version = useRef<number | undefined>(undefined);
  const enCurso = useRef(false);
  const ultimoCompleto = useRef(0);
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;

  const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos([{ id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 7000 : 4000);
  }, []);

  const recibir = useCallback(
    (e: Estado) => {
      // Una consulta lenta no puede pisar datos más nuevos (por ejemplo, los de una venta recién hecha).
      if (version.current !== undefined && e.version < version.current) return;
      setEstado(e);
      version.current = e.version;
      guardarCache(claveCache, e);
      const u = sesionRef.current.usuario;
      if (e.usuario.nombre !== u.nombre || e.usuario.rol !== u.rol) {
        alActualizarSesion({ ...sesionRef.current, usuario: e.usuario });
      }
    },
    [claveCache, alActualizarSesion],
  );

  const manejarError = useCallback(
    (err: unknown): string => {
      const e = err instanceof ErrorApi ? err : new ErrorApi('Algo salió mal. Probá de nuevo.');
      if (e.codigo === 'sesion') alCerrarSesion(e.message);
      return e.message;
    },
    [alCerrarSesion],
  );

  const refrescar = useCallback(
    async (completo = false) => {
      if (enCurso.current) return;
      enCurso.current = true;
      const todo = completo || Date.now() - ultimoCompleto.current > COMPLETO_CADA;
      setSync((s) => ({ ...s, fase: 'cargando' }));
      try {
        const e = await backend.estado(sesionRef.current.token, todo ? undefined : version.current);
        if (e) recibir(e);
        if (todo) ultimoCompleto.current = Date.now();
        setSync({ fase: 'ok', ultima: new Date(), error: '' });
      } catch (err) {
        const mensaje = manejarError(err);
        setSync((s) => ({ ...s, fase: 'error', error: mensaje }));
      } finally {
        enCurso.current = false;
      }
    },
    [backend, recibir, manejarError],
  );

  useEffect(() => {
    void refrescar(true);
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') void refrescar();
    }, CADA);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void refrescar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [refrescar]);

  const operar = useCallback(
    async (cmd: Comando, opId: string) => {
      try {
        const r = await backend.operar(sesionRef.current.token, opId, cmd);
        recibir(r.estado);
        setSync({ fase: 'ok', ultima: new Date(), error: '' });
        return r.mensaje;
      } catch (err) {
        if (err instanceof ErrorApi && err.codigo === 'red') {
          setSync((s) => ({ ...s, fase: 'error', error: err.message }));
        }
        manejarError(err);
        throw err;
      }
    },
    [backend, recibir, manejarError],
  );

  const valor = useMemo<ValorApp>(
    () => ({
      backend,
      sesion,
      estado,
      sync,
      esAdmin: sesion.usuario.rol === 'admin',
      conectado: sync.fase !== 'error' && estado !== null,
      refrescar,
      operar,
      avisar,
      avisos,
      cerrarSesion: alCerrarSesion,
      actualizarSesion: alActualizarSesion,
    }),
    [backend, sesion, estado, sync, refrescar, operar, avisar, avisos, alCerrarSesion, alActualizarSesion],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function nuevoOpId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Ejecuta una operación. Si se corta la conexión, reintentar la misma operación
 * reusa su identificador: el servidor no la registra dos veces.
 */
export function useOperacion() {
  const { operar, avisar } = useApp();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const pendiente = useRef<{ clave: string; opId: string } | null>(null);

  const ejecutar = useCallback(
    async (cmd: Comando): Promise<boolean> => {
      const clave = JSON.stringify(cmd);
      if (!pendiente.current || pendiente.current.clave !== clave) pendiente.current = { clave, opId: nuevoOpId() };
      setEnviando(true);
      setError('');
      try {
        const mensaje = await operar(cmd, pendiente.current.opId);
        pendiente.current = null;
        avisar(mensaje);
        return true;
      } catch (e) {
        const err = e instanceof ErrorApi ? e : new ErrorApi('Algo salió mal. Probá de nuevo.');
        if (err.codigo === 'red') {
          setError(`${err.message} Tocá el botón de nuevo para reintentar: si ya se había guardado, no se duplica.`);
        } else {
          pendiente.current = null;
          setError(err.message);
        }
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [operar, avisar],
  );

  return { ejecutar, enviando, error, limpiarError: () => setError('') };
}
