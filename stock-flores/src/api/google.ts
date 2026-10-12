import type { Estado } from '../core/tipos';
import { ErrorApi, type Backend, type PaginaHistorial, type RespuestaOperacion, type Sesion } from './tipos';

const ESPERA_MAX = 45_000;

/** Servidor en Google Apps Script (la planilla). */
export function crearBackendGoogle(url: string): Backend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function llamar(accion: string, datos: Record<string, unknown> = {}): Promise<any> {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MAX);
    let respuesta: Response;
    try {
      // text/plain evita el "preflight" CORS, que Apps Script no contesta.
      respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion, ...datos }),
        redirect: 'follow',
        signal: control.signal,
      });
    } catch {
      throw new ErrorApi('No se pudo conectar con el servidor. Revisá la conexión a internet.', 'red');
    } finally {
      clearTimeout(reloj);
    }
    let cuerpo: { ok?: boolean; error?: string; codigo?: string };
    try {
      cuerpo = await respuesta.json();
    } catch {
      throw new ErrorApi('El servidor respondió algo inesperado. Revisá que la dirección configurada sea la correcta.', 'red');
    }
    if (!cuerpo.ok) throw new ErrorApi(cuerpo.error || 'Error desconocido.', cuerpo.codigo === 'sesion' ? 'sesion' : '');
    return cuerpo;
  }

  return {
    modo: 'google',
    async login(email, password) {
      const r = await llamar('login', { email, password });
      return { token: r.token, usuario: r.usuario, debeCambiar: r.debeCambiar } satisfies Sesion;
    },
    async estado(token, version) {
      const r = await llamar('estado', { token, version });
      return r.sinCambios ? null : (r.estado as Estado);
    },
    async operar(token, opId, comando) {
      const r = await llamar('operar', { token, opId, comando });
      return { mensaje: r.mensaje, estado: r.estado, repetida: r.repetida } satisfies RespuestaOperacion;
    },
    async historial(token, filtro) {
      const r = await llamar('historial', { token, ...filtro });
      return { movimientos: r.movimientos, cursor: r.cursor } satisfies PaginaHistorial;
    },
    async cambiarPassword(token, actual, nueva) {
      const r = await llamar('cambiar_password', { token, actual, nueva });
      return { token: r.token, usuario: r.usuario, debeCambiar: false };
    },
    async usuarios(token) {
      return (await llamar('usuarios', { token })).usuarios;
    },
    async crearUsuario(token, email, nombre, rol) {
      const r = await llamar('crear_usuario', { token, email, nombre, rol });
      return { usuario: r.usuario, claveTemporal: r.claveTemporal };
    },
    async editarUsuario(token, email, cambios) {
      return (await llamar('editar_usuario', { token, email, ...cambios })).usuario;
    },
    async restablecerPassword(token, email) {
      return (await llamar('restablecer_password', { token, email })).claveTemporal;
    },
  };
}

/** Comprueba que la dirección sea la del servidor de Stock Flores. */
export async function probarServidor(url: string): Promise<void> {
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
    throw new ErrorApi('La dirección tiene que empezar con https://script.google.com/');
  }
  const r = await crearBackendGoogle(url)
    .login('', '')
    .catch((e: ErrorApi) => e);
  // Sin datos, un servidor correcto contesta "Completá el email y la contraseña".
  if (r instanceof ErrorApi && r.codigo === 'red') throw r;
  if (!(r instanceof ErrorApi) || !/email/.test(r.message)) {
    throw new ErrorApi('Esa dirección no parece ser el servidor de Stock Flores.');
  }
}
