import { productosIniciales } from '../core/catalogo';
import { aplicar, ejecutar, ErrorNegocio } from '../core/reglas';
import type { Estado, Movimiento, Pedido, Producto, Usuario } from '../core/tipos';
import { hoyLocal } from '../ui/formato';
import { ErrorApi, type Backend } from './tipos';

// Modo de prueba: todo queda en este navegador. Usa las mismas reglas que el servidor.

const CLAVE = 'stockflores:demo';

interface Guardado {
  version: number;
  productos: Producto[];
  pedidos: Pedido[];
  movimientos: Movimiento[];
  usuarios: Usuario[];
}

export const USUARIOS_DEMO: Usuario[] = [
  { email: 'admin@demo', nombre: 'Administración (prueba)', rol: 'admin', activo: true },
  { email: 'ventas@demo', nombre: 'Ventas (prueba)', rol: 'vendedor', activo: true },
];

function cargar(): Guardado {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) return JSON.parse(crudo) as Guardado;
  } catch {
    // sin almacenamiento: arranca de cero
  }
  return {
    version: 1,
    productos: productosIniciales(new Date().toISOString()),
    pedidos: [],
    movimientos: [],
    usuarios: USUARIOS_DEMO,
  };
}

function guardar(g: Guardado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    // si no se puede guardar, sigue en memoria
  }
}

export function borrarDemo(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada
  }
}

const pausa = () => new Promise((r) => setTimeout(r, 250));

function nuevoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function crearBackendDemo(): Backend {
  let g = cargar();
  const opsHechas = new Map<string, string>();

  function usuario(token: string): Usuario {
    const u = g.usuarios.find((x) => x.email === token && x.activo);
    if (!u) throw new ErrorApi('Tu sesión terminó. Volvé a entrar.', 'sesion');
    return u;
  }

  function estado(u: Usuario): Estado {
    return { version: g.version, productos: g.productos, pedidos: g.pedidos, usuario: u, ahora: new Date().toISOString() };
  }

  return {
    modo: 'demo',
    async login(email) {
      await pausa();
      const u = g.usuarios.find((x) => x.email === email);
      if (!u) throw new ErrorApi('Usuario de prueba inexistente.');
      return { token: u.email, usuario: u, debeCambiar: false };
    },
    async estado(token, version) {
      await pausa();
      const u = usuario(token);
      g = cargar();
      return version === g.version ? null : estado(u);
    },
    async operar(token, opId, comando) {
      await pausa();
      const u = usuario(token);
      g = cargar();
      const previa = opsHechas.get(opId);
      if (previa) return { mensaje: previa, estado: estado(u), repetida: true };
      try {
        const r = ejecutar(comando, g, u, { ahora: new Date().toISOString(), hoy: hoyLocal(), opId, nuevoId });
        const datos = aplicar(g, r);
        g = { ...g, ...datos, movimientos: g.movimientos.concat(r.movimientos), version: g.version + 1 };
        guardar(g);
        opsHechas.set(opId, r.mensaje);
        return { mensaje: r.mensaje, estado: estado(u) };
      } catch (e) {
        if (e instanceof ErrorNegocio) throw new ErrorApi(e.message);
        throw e;
      }
    },
    async historial(token, filtro) {
      await pausa();
      usuario(token);
      const todos = cargar()
        .movimientos.slice()
        .reverse()
        .filter((m) => (!filtro.productoId || m.productoId === filtro.productoId) && (!filtro.tipos?.length || filtro.tipos.includes(m.tipo)));
      const desde = filtro.cursor ?? 0;
      const limite = filtro.limite ?? 100;
      const pagina = todos.slice(desde, desde + limite);
      return { movimientos: pagina, cursor: desde + limite < todos.length ? desde + limite : null };
    },
    async cambiarPassword() {
      throw new ErrorApi('En el modo de prueba no hay contraseñas.');
    },
    async usuarios(token) {
      usuario(token);
      return g.usuarios;
    },
    async crearUsuario() {
      throw new ErrorApi('En el modo de prueba no se pueden crear usuarios.');
    },
    async editarUsuario() {
      throw new ErrorApi('En el modo de prueba no se pueden editar usuarios.');
    },
    async restablecerPassword() {
      throw new ErrorApi('En el modo de prueba no hay contraseñas.');
    },
  };
}
