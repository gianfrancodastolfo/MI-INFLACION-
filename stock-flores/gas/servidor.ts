// Servidor en Google Apps Script. Usa la planilla como base de datos.
// Se compila junto con src/core a un solo archivo: apps-script/StockFlores.gs (npm run build:gas).
// Las reglas del stock están en src/core/reglas.ts; acá solo se lee y se escribe la planilla.

import { productosIniciales } from '../src/core/catalogo';
import { ejecutar, ErrorNegocio, revisarConsistencia, type Datos, type Resultado } from '../src/core/reglas';
import type { Actor, Comando, Estado, Movimiento, Pedido, Producto, Rol, Usuario } from '../src/core/tipos';

type Hoja = GoogleAppsScript.Spreadsheet.Sheet;
type Salida = GoogleAppsScript.Content.TextOutput;

export const VERSION_API = 1;

const DIAS_RESERVAS_CERRADAS = 30;
const DIAS_SESION = 90;
const ITERACIONES_CLAVE = 1000;
const MAX_INTENTOS = 5;

class ErrorSesion extends ErrorNegocio {
  codigo = 'sesion';
}

// ---------- Esquema de la planilla ----------

type TipoCol = 'texto' | 'fecha' | 'numero' | 'bool' | 'json';

interface Columna {
  campo: string;
  titulo: string;
  tipo: TipoCol;
  /** Solo para mostrar en la planilla: se escribe, nunca se lee. */
  calc?: (obj: never) => unknown;
  ancho?: number;
}

interface Tabla {
  hoja: string;
  clave: string;
  columnas: Columna[];
}

const col = (campo: string, titulo: string, tipo: TipoCol = 'texto', ancho?: number): Columna => ({
  campo,
  titulo,
  tipo,
  ancho,
});

const T_PRODUCTOS: Tabla = {
  hoja: 'Productos',
  clave: 'id',
  columnas: [
    col('id', 'ID', 'texto', 140),
    col('nombre', 'Nombre', 'texto', 160),
    col('categoria', 'Categoría', 'texto', 80),
    col('unidad', 'Unidad', 'texto', 80),
    col('fisico', 'Físico', 'numero', 70),
    col('reservado', 'Reservado', 'numero', 80),
    { ...col('disponible', 'Disponible', 'numero', 85), calc: (p: Producto) => p.fisico - p.reservado },
    col('minimo', 'Stock mínimo', 'numero', 95),
    col('stockCargado', 'Stock cargado', 'bool', 100),
    col('activo', 'Activo', 'bool', 60),
    col('fechaIngreso', 'Último ingreso', 'fecha', 105),
    col('vencimiento', 'Vencimiento', 'fecha', 100),
    col('descripcion', 'Descripción', 'texto', 260),
    col('notas', 'Notas internas', 'texto', 200),
    col('proveedor', 'Proveedor', 'texto', 120),
    col('sku', 'Código / SKU', 'texto', 100),
    col('calidad', 'Observaciones de calidad', 'texto', 200),
    col('foto', 'Foto', 'texto', 160),
    col('orden', 'Orden', 'numero', 60),
    col('actualizado', 'Actualizado', 'texto', 170),
  ],
};

const T_RESERVAS: Tabla = {
  hoja: 'Reservas',
  clave: 'id',
  columnas: [
    col('numero', 'N°', 'numero', 50),
    col('estado', 'Estado', 'texto', 90),
    col('cliente', 'Cliente', 'texto', 160),
    col('fechaEntrega', 'Fecha de entrega', 'fecha', 115),
    { ...col('detalle', 'Detalle', 'texto', 260), calc: (p: Pedido) => detallePedido(p) },
    col('nota', 'Nota', 'texto', 180),
    col('creado', 'Creada', 'texto', 170),
    col('creadoPorNombre', 'Creada por', 'texto', 110),
    col('cerrado', 'Cerrada', 'texto', 170),
    col('cerradoPorNombre', 'Cerrada por', 'texto', 110),
    col('cierreNota', 'Nota de cierre', 'texto', 160),
    col('items', 'Items (no editar)', 'json', 200),
    col('id', 'ID', 'texto', 120),
    col('creadoPor', 'Email creó', 'texto', 160),
    col('cerradoPor', 'Email cerró', 'texto', 160),
  ],
};

const T_MOVIMIENTOS: Tabla = {
  hoja: 'Movimientos',
  clave: 'id',
  columnas: [
    col('fecha', 'Fecha', 'texto', 170),
    col('usuarioNombre', 'Usuario', 'texto', 110),
    col('tipo', 'Tipo', 'texto', 100),
    col('productoNombre', 'Producto', 'texto', 150),
    col('dFisico', 'Δ Físico', 'numero', 70),
    col('dReservado', 'Δ Reservado', 'numero', 90),
    col('fisico', 'Físico después', 'numero', 105),
    col('reservado', 'Reservado después', 'numero', 125),
    col('pedidoNumero', 'Reserva N°', 'numero', 85),
    col('nota', 'Nota', 'texto', 220),
    col('productoId', 'ID producto', 'texto', 130),
    col('usuario', 'Email', 'texto', 160),
    col('pedidoId', 'ID reserva', 'texto', 120),
    col('opId', 'ID operación', 'texto', 120),
    col('id', 'ID', 'texto', 120),
  ],
};

interface UsuarioGuardado extends Usuario {
  debeCambiar: boolean;
  clave: string;
  version: number;
  creado: string;
}

const T_USUARIOS: Tabla = {
  hoja: 'Usuarios',
  clave: 'email',
  columnas: [
    col('email', 'Email', 'texto', 200),
    col('nombre', 'Nombre', 'texto', 140),
    col('rol', 'Rol', 'texto', 80),
    col('activo', 'Activo', 'bool', 60),
    col('debeCambiar', 'Debe cambiar contraseña', 'bool', 160),
    col('clave', 'Clave (no tocar)', 'texto', 160),
    col('version', 'Versión', 'numero', 70),
    col('creado', 'Creado', 'texto', 170),
  ],
};

const TABLAS = [T_PRODUCTOS, T_RESERVAS, T_MOVIMIENTOS, T_USUARIOS];

// ---------- Acceso a la planilla ----------

function libro(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function hoja(t: Tabla): Hoja {
  const h = libro().getSheetByName(t.hoja);
  if (!h) throw new ErrorNegocio(`Falta la hoja "${t.hoja}". Abrí la planilla y usá el menú Stock Flores → Preparar planilla.`);
  return h;
}

function esFechaCelda(v: unknown): v is Date {
  return Object.prototype.toString.call(v) === '[object Date]';
}

function zona(): string {
  return Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires';
}

function leerCelda(v: unknown, tipo: TipoCol): unknown {
  switch (tipo) {
    case 'numero': {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    case 'bool':
      if (typeof v === 'boolean') return v;
      return ['true', 'verdadero', 'si', 'sí', '1', 'x'].includes(String(v ?? '').trim().toLowerCase());
    case 'json':
      try {
        return v ? JSON.parse(String(v)) : [];
      } catch {
        return [];
      }
    case 'fecha':
      if (esFechaCelda(v)) return Utilities.formatDate(v, zona(), 'yyyy-MM-dd');
      return String(v ?? '').trim();
    default:
      if (esFechaCelda(v)) return v.toISOString();
      return v === null || v === undefined ? '' : String(v);
  }
}

function escribirCelda(v: unknown, tipo: TipoCol): unknown {
  switch (tipo) {
    case 'numero':
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    case 'bool':
      return v === true;
    case 'json':
      return JSON.stringify(v ?? []);
    default: {
      const s = v === null || v === undefined ? '' : String(v);
      // Que la planilla nunca lo interprete como fórmula.
      return /^[=+\-@]/.test(s) ? `'${s}` : s;
    }
  }
}

interface Fila<T> {
  obj: T;
  fila: number;
  crudo: unknown[];
}

interface Lectura<T> {
  hoja: Hoja;
  filas: Fila<T>[];
  idx: number[];
  ancho: number;
}

function indices(h: Hoja, t: Tabla): { idx: number[]; ancho: number } {
  const ancho = h.getLastColumn();
  const encabezado = ancho ? h.getRange(1, 1, 1, ancho).getValues()[0].map((v) => String(v).trim()) : [];
  const idx = t.columnas.map((c) => {
    const i = encabezado.indexOf(c.titulo);
    if (i < 0) {
      throw new ErrorNegocio(`Falta la columna "${c.titulo}" en la hoja "${t.hoja}". Usá el menú Stock Flores → Preparar planilla.`);
    }
    return i;
  });
  return { idx, ancho };
}

function leer<T>(t: Tabla, desde?: number, hasta?: number): Lectura<T> {
  const h = hoja(t);
  const { idx, ancho } = indices(h, t);
  const ultima = h.getLastRow();
  const ini = Math.max(2, desde ?? 2);
  const fin = Math.min(ultima, hasta ?? ultima);
  const filas: Fila<T>[] = [];
  if (fin >= ini) {
    const valores = h.getRange(ini, 1, fin - ini + 1, ancho).getValues();
    const iClave = t.columnas.findIndex((c) => c.campo === t.clave);
    valores.forEach((crudo, i) => {
      if (String(crudo[idx[iClave]] ?? '').trim() === '') return;
      const obj: Record<string, unknown> = {};
      t.columnas.forEach((c, j) => {
        if (!c.calc) obj[c.campo] = leerCelda(crudo[idx[j]], c.tipo);
      });
      filas.push({ obj: obj as T, fila: ini + i, crudo });
    });
  }
  return { hoja: h, filas, idx, ancho };
}

function armarFila<T>(obj: T, t: Tabla, idx: number[], base: unknown[]): unknown[] {
  const fila = base.slice();
  t.columnas.forEach((c, j) => {
    const v = c.calc ? c.calc(obj as never) : (obj as Record<string, unknown>)[c.campo];
    fila[idx[j]] = escribirCelda(v, c.tipo);
  });
  return fila;
}

function asegurarFilas(h: Hoja, necesarias: number): void {
  const max = h.getMaxRows();
  if (necesarias > max) h.insertRowsAfter(max, necesarias - max + 100);
}

/** Actualiza filas existentes (por clave) y agrega las nuevas al final. */
function guardar<T>(l: Lectura<T>, t: Tabla, objetos: T[]): void {
  if (objetos.length === 0) return;
  const porClave = new Map(l.filas.map((f) => [String((f.obj as Record<string, unknown>)[t.clave]), f]));
  const nuevas: unknown[][] = [];
  for (const o of objetos) {
    const existente = porClave.get(String((o as Record<string, unknown>)[t.clave]));
    if (existente) {
      const fila = armarFila(o, t, l.idx, existente.crudo);
      l.hoja.getRange(existente.fila, 1, 1, l.ancho).setValues([fila]);
    } else {
      nuevas.push(armarFila(o, t, l.idx, new Array(l.ancho).fill('')));
    }
  }
  agregar(l.hoja, nuevas);
}

function agregar(h: Hoja, filas: unknown[][]): void {
  if (filas.length === 0) return;
  const desde = h.getLastRow() + 1;
  asegurarFilas(h, desde + filas.length - 1);
  h.getRange(desde, 1, filas.length, filas[0].length).setValues(filas);
}

function agregarMovimientos(movs: Movimiento[]): void {
  if (movs.length === 0) return;
  const h = hoja(T_MOVIMIENTOS);
  const { idx, ancho } = indices(h, T_MOVIMIENTOS);
  agregar(
    h,
    movs.map((m) => armarFila(m, T_MOVIMIENTOS, idx, new Array(ancho).fill(''))),
  );
}

function detallePedido(p: Pedido): string {
  const nombres = new Map(leerProductosCache().map((x) => [x.id, x.nombre]));
  return p.items
    .map((it) => {
      const nombre = nombres.get(it.productoId) ?? it.productoId;
      return it.entregado !== undefined && it.entregado !== it.cantidad
        ? `${it.entregado}/${it.cantidad} ${nombre}`
        : `${it.cantidad} ${nombre}`;
    })
    .join(', ');
}

// Productos leídos en esta ejecución (para armar el detalle de las reservas sin volver a leer).
let productosCache: Producto[] | null = null;
function leerProductosCache(): Producto[] {
  if (!productosCache) productosCache = leer<Producto>(T_PRODUCTOS).filas.map((f) => f.obj);
  return productosCache;
}

// ---------- Versión (para que la app sepa si hay cambios) ----------

// Las propiedades del script tienen cuota diaria (50.000 lecturas en cuentas gratuitas) y la app
// consulta cada 20 s desde cada dispositivo: se leen a través de la caché.
const SEG_CACHE = 21600;

function propiedad(clave: string): string | null {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get(`prop:${clave}`);
  if (enCache !== null) return enCache;
  const valor = PropertiesService.getScriptProperties().getProperty(clave);
  if (valor !== null) cache.put(`prop:${clave}`, valor, SEG_CACHE);
  return valor;
}

function fijarPropiedad(clave: string, valor: string): void {
  PropertiesService.getScriptProperties().setProperty(clave, valor);
  CacheService.getScriptCache().put(`prop:${clave}`, valor, SEG_CACHE);
}

function versionActual(): number {
  return Number(propiedad('VERSION') || '1');
}

function subirVersion(): number {
  // Dentro del bloqueo: se lee la propiedad real, no la caché.
  const v = Number(PropertiesService.getScriptProperties().getProperty('VERSION') || '1') + 1;
  fijarPropiedad('VERSION', String(v));
  return v;
}

// ---------- Claves y sesiones ----------

function hex(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

function aleatorio(): string {
  return Utilities.getUuid().replace(/-/g, '');
}

function secreto(): string {
  let s = propiedad('SECRETO');
  if (!s) {
    s = aleatorio() + aleatorio();
    fijarPropiedad('SECRETO', s);
  }
  return s;
}

function hashClave(clave: string, sal: string, iteraciones: number): string {
  const llave = Utilities.newBlob(clave).getBytes();
  let h = Utilities.computeHmacSha256Signature(Utilities.newBlob(sal).getBytes(), llave);
  for (let i = 1; i < iteraciones; i++) h = Utilities.computeHmacSha256Signature(h, llave);
  return hex(h);
}

function crearClave(clave: string): string {
  const sal = aleatorio();
  return `${ITERACIONES_CLAVE}$${sal}$${hashClave(clave, sal, ITERACIONES_CLAVE)}`;
}

function verificarClave(clave: string, guardada: string): boolean {
  const [it, sal, hash] = String(guardada).split('$');
  if (!it || !sal || !hash) return false;
  return iguales(hashClave(clave, sal, Number(it)), hash);
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function firmar(texto: string): string {
  return hex(Utilities.computeHmacSha256Signature(texto, secreto()));
}

function crearToken(u: UsuarioGuardado): string {
  const vence = Date.now() + DIAS_SESION * 24 * 3600 * 1000;
  const datos = `${u.email}|${u.version}|${vence}`;
  return `${datos}|${firmar(datos)}`;
}

const PALABRAS = ['rosa', 'lila', 'menta', 'salvia', 'tilo', 'malva', 'romero', 'albahaca', 'violeta', 'jazmin'];

function claveTemporal(): string {
  const r = aleatorio();
  const palabra = PALABRAS[parseInt(r.slice(0, 4), 16) % PALABRAS.length];
  const numero = String(parseInt(r.slice(4, 12), 16) % 10000).padStart(4, '0');
  return `${palabra}-${numero}`;
}

function normalizarEmail(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function leerUsuarios(): Lectura<UsuarioGuardado> {
  const l = leer<UsuarioGuardado>(T_USUARIOS);
  for (const f of l.filas) {
    f.obj.email = normalizarEmail(f.obj.email);
    f.obj.rol = f.obj.rol === 'admin' ? 'admin' : 'vendedor';
  }
  return l;
}

function publico(u: UsuarioGuardado): Usuario {
  return { email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo };
}

function autenticar(token: unknown): UsuarioGuardado {
  const partes = String(token ?? '').split('|');
  if (partes.length !== 4) throw new ErrorSesion('Tu sesión terminó. Volvé a entrar.');
  const [email, version, vence, firma] = partes;
  if (!iguales(firmar(`${email}|${version}|${vence}`), firma) || Number(vence) < Date.now()) {
    throw new ErrorSesion('Tu sesión terminó. Volvé a entrar.');
  }
  const u = leerUsuarios().filas.find((f) => f.obj.email === email)?.obj;
  if (!u || !u.activo || String(u.version) !== version) throw new ErrorSesion('Tu sesión terminó. Volvé a entrar.');
  return u;
}

function login(email: unknown, clave: unknown): object {
  const e = normalizarEmail(email);
  if (!e || typeof clave !== 'string' || !clave) throw new ErrorNegocio('Completá el email y la contraseña.');
  const cache = CacheService.getScriptCache();
  const k = `fallos:${e}`;
  const fallos = Number(cache.get(k) || '0');
  if (fallos >= MAX_INTENTOS) throw new ErrorNegocio('Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.');
  const u = leerUsuarios().filas.find((f) => f.obj.email === e)?.obj;
  if (!u || !u.activo || !verificarClave(clave, u.clave)) {
    cache.put(k, String(fallos + 1), 900);
    throw new ErrorNegocio('Email o contraseña incorrectos.');
  }
  cache.remove(k);
  return { token: crearToken(u), usuario: publico(u), debeCambiar: u.debeCambiar };
}

function validarClaveNueva(nueva: unknown): string {
  if (typeof nueva !== 'string' || nueva.length < 6) throw new ErrorNegocio('La contraseña nueva tiene que tener al menos 6 caracteres.');
  if (nueva.length > 100) throw new ErrorNegocio('La contraseña es demasiado larga.');
  return nueva;
}

// ---------- Estado ----------

function leerEstado(usuario: UsuarioGuardado): Estado {
  const productos = leerProductosCache();
  const limite = new Date(Date.now() - DIAS_RESERVAS_CERRADAS * 24 * 3600 * 1000).toISOString();
  const pedidos = leer<Pedido>(T_RESERVAS)
    .filas.map((f) => f.obj)
    .filter((p) => p.estado === 'pendiente' || p.cerrado >= limite);
  return { version: versionActual(), productos, pedidos, usuario: publico(usuario), ahora: new Date().toISOString() };
}

// ---------- Operaciones ----------

function conBloqueo<T>(fn: () => T): T {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new ErrorNegocio('El sistema está ocupado. Probá de nuevo en unos segundos.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function operar(u: UsuarioGuardado, opId: unknown, comando: Comando): object {
  if (typeof opId !== 'string' || opId.length < 8 || opId.length > 64) throw new ErrorNegocio('Operación inválida.');
  return conBloqueo(() => {
    const cache = CacheService.getScriptCache();
    const previa = cache.get(`op:${opId}`);
    if (previa) {
      // Reintento de algo que ya se guardó: no se repite.
      productosCache = null;
      return { mensaje: previa, repetida: true, estado: leerEstado(u) };
    }
    productosCache = null;
    const lp = leer<Producto>(T_PRODUCTOS);
    const lr = leer<Pedido>(T_RESERVAS);
    const datos: Datos = { productos: lp.filas.map((f) => f.obj), pedidos: lr.filas.map((f) => f.obj) };
    const actor: Actor = { email: u.email, nombre: u.nombre, rol: u.rol };
    const r: Resultado = ejecutar(comando, datos, actor, {
      ahora: new Date().toISOString(),
      hoy: Utilities.formatDate(new Date(), zona(), 'yyyy-MM-dd'),
      opId,
      nuevoId: aleatorio,
    });
    // Productos primero: el detalle de las reservas usa los nombres actualizados.
    const cambiados = new Map(r.productos.map((p) => [p.id, p]));
    productosCache = datos.productos.map((p) => cambiados.get(p.id) ?? p).concat(
      r.productos.filter((p) => !datos.productos.some((x) => x.id === p.id)),
    );
    guardar(lp, T_PRODUCTOS, r.productos);
    guardar(lr, T_RESERVAS, r.pedidos);
    agregarMovimientos(r.movimientos);
    SpreadsheetApp.flush();
    if (r.movimientos.length || r.pedidos.length || r.productos.length) subirVersion();
    cache.put(`op:${opId}`, r.mensaje, 21600);
    return { mensaje: r.mensaje, estado: leerEstado(u) };
  });
}

function historial(productoId: unknown, tipos: unknown, limite: unknown, cursor: unknown): object {
  const h = hoja(T_MOVIMIENTOS);
  const max = Math.min(Math.max(Number(limite) || 100, 1), 500);
  const filtroTipos = Array.isArray(tipos) && tipos.length ? new Set(tipos.map(String)) : null;
  let fin = typeof cursor === 'number' && cursor >= 2 ? Math.min(cursor, h.getLastRow()) : h.getLastRow();
  const salida: Movimiento[] = [];
  while (fin >= 2 && salida.length < max) {
    const ini = Math.max(2, fin - 499);
    const l = leer<Movimiento>(T_MOVIMIENTOS, ini, fin);
    let siguiente = ini - 1;
    for (let i = l.filas.length - 1; i >= 0; i--) {
      const m = l.filas[i];
      if (productoId && m.obj.productoId !== productoId) continue;
      if (filtroTipos && !filtroTipos.has(m.obj.tipo)) continue;
      salida.push(m.obj);
      if (salida.length >= max) {
        siguiente = m.fila - 1;
        break;
      }
    }
    fin = siguiente;
  }
  return { movimientos: salida, cursor: fin >= 2 ? fin : null };
}

// ---------- Usuarios ----------

function soloAdmin(u: UsuarioGuardado): void {
  if (u.rol !== 'admin') throw new ErrorNegocio('Esta operación solo la puede hacer un administrador.');
}

function validarRol(rol: unknown): Rol {
  if (rol !== 'admin' && rol !== 'vendedor') throw new ErrorNegocio('Rol inválido.');
  return rol;
}

function validarNombre(nombre: unknown): string {
  const n = String(nombre ?? '').trim();
  if (!n) throw new ErrorNegocio('Escribí el nombre.');
  if (n.length > 40) throw new ErrorNegocio('El nombre es demasiado largo.');
  return n;
}

function crearUsuario(email: unknown, nombre: unknown, rol: unknown): { usuario: Usuario; claveTemporal: string } {
  const e = normalizarEmail(email);
  if (!/^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/.test(e) || e.length > 120) throw new ErrorNegocio('El email no es válido.');
  const n = validarNombre(nombre);
  const r = validarRol(rol);
  return conBloqueo(() => {
    const l = leerUsuarios();
    if (l.filas.some((f) => f.obj.email === e)) throw new ErrorNegocio('Ya existe un usuario con ese email.');
    const temporal = claveTemporal();
    const nuevo: UsuarioGuardado = {
      email: e,
      nombre: n,
      rol: r,
      activo: true,
      debeCambiar: true,
      clave: crearClave(temporal),
      version: 1,
      creado: new Date().toISOString(),
    };
    guardar(l, T_USUARIOS, [nuevo]);
    return { usuario: publico(nuevo), claveTemporal: temporal };
  });
}

function editarUsuario(admin: UsuarioGuardado, req: Record<string, unknown>): Usuario {
  const e = normalizarEmail(req.email);
  return conBloqueo(() => {
    const l = leerUsuarios();
    const u = l.filas.find((f) => f.obj.email === e)?.obj;
    if (!u) throw new ErrorNegocio('No encontré ese usuario.');
    const cambio = { ...u };
    if (req.nombre !== undefined) cambio.nombre = validarNombre(req.nombre);
    if (req.rol !== undefined) cambio.rol = validarRol(req.rol);
    if (req.activo !== undefined) cambio.activo = req.activo === true;
    if (u.email === admin.email && (!cambio.activo || cambio.rol !== 'admin')) {
      throw new ErrorNegocio('No podés quitarte el acceso de administrador a vos mismo/a.');
    }
    if (cambio.rol !== u.rol || cambio.activo !== u.activo) cambio.version = u.version + 1;
    guardar(l, T_USUARIOS, [cambio]);
    return publico(cambio);
  });
}

function restablecerClave(email: unknown): string {
  const e = normalizarEmail(email);
  return conBloqueo(() => {
    const l = leerUsuarios();
    const u = l.filas.find((f) => f.obj.email === e)?.obj;
    if (!u) throw new ErrorNegocio('No encontré ese usuario.');
    const temporal = claveTemporal();
    guardar(l, T_USUARIOS, [{ ...u, clave: crearClave(temporal), debeCambiar: true, version: u.version + 1 }]);
    CacheService.getScriptCache().remove(`fallos:${e}`);
    return temporal;
  });
}

function cambiarClave(u: UsuarioGuardado, actual: unknown, nueva: unknown): object {
  const n = validarClaveNueva(nueva);
  if (typeof actual !== 'string' || !verificarClave(actual, u.clave)) throw new ErrorNegocio('La contraseña actual no es correcta.');
  if (actual === n) throw new ErrorNegocio('La contraseña nueva tiene que ser distinta de la actual.');
  return conBloqueo(() => {
    const l = leerUsuarios();
    const fila = l.filas.find((f) => f.obj.email === u.email);
    if (!fila) throw new ErrorSesion('Tu sesión terminó. Volvé a entrar.');
    const nuevo = { ...fila.obj, clave: crearClave(n), debeCambiar: false, version: fila.obj.version + 1 };
    guardar(l, T_USUARIOS, [nuevo]);
    return { token: crearToken(nuevo), usuario: publico(nuevo), mensaje: 'Contraseña cambiada.' };
  });
}

// ---------- Entrada HTTP ----------

function json(obj: object): Salida {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function despachar(req: Record<string, unknown>): object {
  switch (req.accion) {
    case 'ping':
      return { app: 'stock-flores', version: VERSION_API };
    case 'login':
      return login(req.email, req.password);
  }
  const u = autenticar(req.token);
  switch (req.accion) {
    case 'estado':
      if (typeof req.version === 'number' && req.version === versionActual()) {
        return { sinCambios: true, version: req.version };
      }
      return { estado: leerEstado(u) };
    case 'operar':
      return operar(u, req.opId, req.comando as Comando);
    case 'historial':
      return historial(req.productoId, req.tipos, req.limite, req.cursor);
    case 'cambiar_password':
      return cambiarClave(u, req.actual, req.nueva);
    case 'usuarios':
      soloAdmin(u);
      return { usuarios: leerUsuarios().filas.map((f) => publico(f.obj)) };
    case 'crear_usuario':
      soloAdmin(u);
      return crearUsuario(req.email, req.nombre, req.rol);
    case 'editar_usuario':
      soloAdmin(u);
      return { usuario: editarUsuario(u, req) };
    case 'restablecer_password':
      soloAdmin(u);
      return { claveTemporal: restablecerClave(req.email) };
    default:
      throw new ErrorNegocio('Acción desconocida.');
  }
}

export function doPost(e: GoogleAppsScript.Events.DoPost): Salida {
  productosCache = null;
  let req: Record<string, unknown>;
  try {
    const cuerpo = e?.postData?.contents ?? '';
    if (cuerpo.length > 100000) throw new Error('grande');
    req = JSON.parse(cuerpo);
    if (!req || typeof req !== 'object') throw new Error('vacío');
  } catch {
    return json({ ok: false, error: 'Pedido inválido.' });
  }
  try {
    return json({ ok: true, ...despachar(req) });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return json({ ok: false, error: err.message, codigo: (err as ErrorSesion).codigo ?? '' });
    }
    console.error(err);
    return json({ ok: false, error: 'Error interno del servidor. Probá de nuevo en un momento.' });
  }
}

export function doGet(): Salida {
  return json({ ok: true, app: 'stock-flores', version: VERSION_API });
}

// ---------- Menú de la planilla ----------

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Stock Flores')
    .addItem('Preparar planilla', 'prepararPlanilla')
    .addItem('Crear usuario', 'menuCrearUsuario')
    .addItem('Restablecer contraseña', 'menuRestablecerClave')
    .addItem('Revisar el stock contra el historial', 'menuRevisarConsistencia')
    .addToUi();
}

function prepararHoja(t: Tabla): Hoja {
  const ss = libro();
  let h = ss.getSheetByName(t.hoja);
  if (!h) h = ss.insertSheet(t.hoja);
  const ancho = h.getLastColumn();
  const actuales = ancho ? h.getRange(1, 1, 1, ancho).getValues()[0].map((v) => String(v).trim()) : [];
  const faltan = t.columnas.filter((c) => !actuales.includes(c.titulo));
  if (faltan.length) {
    h.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan.map((c) => c.titulo)]);
  }
  const { idx } = indices(h, t);
  const filas = Math.max(h.getMaxRows() - 1, 1);
  t.columnas.forEach((c, j) => {
    const rango = h.getRange(2, idx[j] + 1, filas, 1);
    if (c.tipo === 'texto' || c.tipo === 'fecha' || c.tipo === 'json') rango.setNumberFormat('@');
    if (c.ancho) h.setColumnWidth(idx[j] + 1, c.ancho);
  });
  h.getRange(1, 1, 1, h.getLastColumn()).setFontWeight('bold').setBackground('#f3e5ec');
  h.setFrozenRows(1);
  if (h.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
    h.protect()
      .setDescription('Se modifica desde la app de stock. Editar a mano puede descuadrar el historial.')
      .setWarningOnly(true);
  }
  return h;
}

export function prepararPlanilla(): void {
  const ui = SpreadsheetApp.getUi();
  for (const t of TABLAS) prepararHoja(t);
  secreto();

  const lp = leer<Producto>(T_PRODUCTOS);
  let cargados = 0;
  if (lp.filas.length === 0) {
    const iniciales = productosIniciales(new Date().toISOString());
    guardar(lp, T_PRODUCTOS, iniciales);
    cargados = iniciales.length;
  }

  // Borra la hoja vacía que trae toda planilla nueva.
  const ss = libro();
  for (const h of ss.getSheets()) {
    if (!TABLAS.some((t) => t.hoja === h.getName()) && h.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(h);
    }
  }

  let mensajeUsuario = '';
  if (leerUsuarios().filas.length === 0) {
    const email = ui.prompt('Primer usuario administrador', 'Email (con el que vas a entrar a la app):', ui.ButtonSet.OK_CANCEL);
    if (email.getSelectedButton() === ui.Button.OK && email.getResponseText().trim()) {
      const nombre = ui.prompt('Primer usuario administrador', 'Nombre para mostrar (por ejemplo: Mamá):', ui.ButtonSet.OK_CANCEL);
      if (nombre.getSelectedButton() === ui.Button.OK) {
        const r = crearUsuario(email.getResponseText(), nombre.getResponseText(), 'admin');
        mensajeUsuario = `\n\nUsuario creado: ${r.usuario.email}\nContraseña temporal: ${r.claveTemporal}\n(La app pide cambiarla al entrar.)`;
      }
    }
    if (!mensajeUsuario) mensajeUsuario = '\n\nTodavía no hay usuarios: creá uno con el menú Stock Flores → Crear usuario.';
  }
  subirVersion();
  ui.alert(
    'Planilla lista',
    (cargados ? `Se cargó el catálogo inicial (${cargados} productos, con el stock pendiente de cargar).` : 'Las hojas están al día.') +
      mensajeUsuario +
      '\n\nÚltimo paso: Implementar → Nueva implementación → Aplicación web (Ejecutar como: yo; Acceso: cualquier usuario) y copiar la URL en la app.',
    ui.ButtonSet.OK,
  );
}

export function menuCrearUsuario(): void {
  const ui = SpreadsheetApp.getUi();
  const email = ui.prompt('Crear usuario', 'Email:', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK) return;
  const nombre = ui.prompt('Crear usuario', 'Nombre para mostrar:', ui.ButtonSet.OK_CANCEL);
  if (nombre.getSelectedButton() !== ui.Button.OK) return;
  const rol = ui.prompt('Crear usuario', 'Rol: escribí "admin" (administra todo) o "vendedor":', ui.ButtonSet.OK_CANCEL);
  if (rol.getSelectedButton() !== ui.Button.OK) return;
  try {
    const r = crearUsuario(email.getResponseText(), nombre.getResponseText(), rol.getResponseText().trim().toLowerCase());
    ui.alert('Usuario creado', `${r.usuario.email}\nContraseña temporal: ${r.claveTemporal}`, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('No se pudo crear', (err as Error).message, ui.ButtonSet.OK);
  }
}

export function menuRestablecerClave(): void {
  const ui = SpreadsheetApp.getUi();
  const email = ui.prompt('Restablecer contraseña', 'Email del usuario:', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK) return;
  try {
    const temporal = restablecerClave(email.getResponseText());
    ui.alert('Contraseña restablecida', `Contraseña temporal: ${temporal}`, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('No se pudo restablecer', (err as Error).message, ui.ButtonSet.OK);
  }
}

export function menuRevisarConsistencia(): void {
  const ui = SpreadsheetApp.getUi();
  const problemas = revisarConsistencia(
    leer<Producto>(T_PRODUCTOS).filas.map((f) => f.obj),
    leer<Movimiento>(T_MOVIMIENTOS).filas.map((f) => f.obj),
    leer<Pedido>(T_RESERVAS).filas.map((f) => f.obj),
  );
  ui.alert(
    'Revisión del stock',
    problemas.length
      ? `Hay diferencias (probablemente por ediciones a mano en la planilla):\n\n${problemas
          .map((p) => `• ${p.nombre}: ${p.detalle}`)
          .join('\n')}\n\nCorregilas desde la app con un conteo.`
      : 'Todo coincide: el stock de cada producto es igual a la suma de su historial.',
    ui.ButtonSet.OK,
  );
}
