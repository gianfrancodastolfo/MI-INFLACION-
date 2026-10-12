// Prueba el archivo que se pega en Apps Script (apps-script/StockFlores.gs) contra una planilla simulada.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { construir, SALIDA } from '../../scripts/build-gas.mjs';
import { crearEntorno, type Entorno, type FakeSheet } from './fakes';

let codigo: string;
let ent: Entorno;
let ctx: Record<string, (...a: unknown[]) => unknown>;

beforeAll(async () => {
  codigo = await construir();
});

function iniciar() {
  ent = crearEntorno();
  ctx = vm.createContext({ ...ent.globales }) as typeof ctx;
  vm.runInContext(codigo, ctx);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function api(cuerpo: Record<string, unknown>): any {
  const salida = ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } }) as { getContent(): string };
  return JSON.parse(salida.getContent());
}

function hoja(nombre: string): FakeSheet {
  const h = ent.libro.getSheetByName(nombre);
  if (!h) throw new Error(nombre);
  return h;
}

let opN = 0;
function operar(token: string, comando: Record<string, unknown>, opId = `operacion-${++opN}`) {
  return api({ accion: 'operar', token, opId, comando });
}

/** Prepara la planilla y deja una sesión de administrador con contraseña propia. */
function prepararConAdmin(): string {
  ent.respuestasUi.push(' Mama@Ejemplo.com ', 'Mamá');
  ctx.prepararPlanilla();
  const temporal = /Contraseña temporal: (\S+)/.exec(ent.alertas.at(-1) ?? '')?.[1];
  expect(temporal).toBeTruthy();
  const l = api({ accion: 'login', email: 'mama@ejemplo.com', password: temporal });
  const c = api({ accion: 'cambiar_password', token: l.token, actual: temporal, nueva: 'flores2026' });
  expect(c.ok).toBe(true);
  return c.token;
}

beforeEach(() => {
  iniciar();
});

describe('archivo generado', () => {
  it('apps-script/StockFlores.gs está al día con el código fuente', () => {
    expect(readFileSync(SALIDA, 'utf8')).toBe(codigo);
  });

  it('pide permisos solo sobre esta planilla', () => {
    expect(codigo.startsWith('/** @OnlyCurrentDoc */')).toBe(true);
  });
});

describe('preparar planilla', () => {
  it('crea las hojas, carga el catálogo sin stock y el primer administrador', () => {
    ent.respuestasUi.push('mama@ejemplo.com', 'Mamá');
    ctx.prepararPlanilla();
    expect(ent.libro.getSheets().map((h) => h.getName())).toEqual(['Productos', 'Reservas', 'Movimientos', 'Usuarios']);
    const productos = hoja('Productos').tabla();
    expect(productos).toHaveLength(25);
    expect(productos[1]).toMatchObject({ ID: 'pensamiento', Nombre: 'Pensamiento', Físico: 0, 'Stock cargado': false });
    expect(hoja('Usuarios').tabla()).toMatchObject([{ Email: 'mama@ejemplo.com', Rol: 'admin', 'Debe cambiar contraseña': true }]);
    expect(String(hoja('Usuarios').tabla()[0]['Clave (no tocar)'])).toMatch(/^1000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(ent.alertas.at(-1)).toMatch(/Contraseña temporal: [a-z]+-\d{4}/);
  });

  it('se puede correr dos veces sin duplicar nada', () => {
    ent.respuestasUi.push('mama@ejemplo.com', 'Mamá');
    ctx.prepararPlanilla();
    ctx.prepararPlanilla();
    expect(hoja('Productos').tabla()).toHaveLength(25);
    expect(hoja('Usuarios').tabla()).toHaveLength(1);
  });
});

describe('sesiones', () => {
  it('rechaza contraseñas incorrectas y bloquea tras varios intentos', () => {
    prepararConAdmin();
    expect(api({ accion: 'login', email: 'mama@ejemplo.com', password: 'mala' })).toMatchObject({
      ok: false,
      error: 'Email o contraseña incorrectos.',
    });
    for (let i = 0; i < 5; i++) api({ accion: 'login', email: 'mama@ejemplo.com', password: 'mala' });
    expect(api({ accion: 'login', email: 'mama@ejemplo.com', password: 'flores2026' }).error).toMatch(/Demasiados intentos/);
  });

  it('cambiar la contraseña invalida la sesión anterior', () => {
    ent.respuestasUi.push('mama@ejemplo.com', 'Mamá');
    ctx.prepararPlanilla();
    const temporal = /Contraseña temporal: (\S+)/.exec(ent.alertas.at(-1) ?? '')![1];
    const l = api({ accion: 'login', email: 'MAMA@ejemplo.com', password: temporal });
    expect(l).toMatchObject({ ok: true, debeCambiar: true, usuario: { nombre: 'Mamá', rol: 'admin' } });
    const c = api({ accion: 'cambiar_password', token: l.token, actual: temporal, nueva: 'otra-clave' });
    expect(api({ accion: 'estado', token: l.token })).toMatchObject({ ok: false, codigo: 'sesion' });
    expect(api({ accion: 'estado', token: c.token }).ok).toBe(true);
    expect(api({ accion: 'login', email: 'mama@ejemplo.com', password: 'otra-clave' }).debeCambiar).toBe(false);
  });

  it('un token alterado no sirve', () => {
    const token = prepararConAdmin();
    const [email, v, vence, firma] = token.split('|');
    expect(api({ accion: 'estado', token: `${email}|${v}|${Number(vence) + 1}|${firma}` })).toMatchObject({
      ok: false,
      codigo: 'sesion',
    });
    expect(api({ accion: 'estado' })).toMatchObject({ ok: false, codigo: 'sesion' });
  });
});

describe('operaciones', () => {
  it('estado, stock inicial, versión y operación repetida', () => {
    const token = prepararConAdmin();
    const e1 = api({ accion: 'estado', token });
    expect(e1.estado.productos).toHaveLength(25);
    expect(api({ accion: 'estado', token, version: e1.estado.version })).toMatchObject({ sinCambios: true });
    // Las consultas periódicas salen de la caché (las propiedades tienen cuota diaria).
    ent.lecturasPropiedades = 0;
    api({ accion: 'estado', token, version: e1.estado.version });
    expect(ent.lecturasPropiedades).toBe(0);

    const r = operar(token, { tipo: 'stock_inicial', productoId: 'pensamiento', cantidad: 12 }, 'op-repetida-1');
    expect(r).toMatchObject({ ok: true, mensaje: 'Stock inicial de Pensamiento: 12 bandejas.' });
    expect(r.estado.version).toBeGreaterThan(e1.estado.version);
    expect(r.estado.productos.find((p: { id: string }) => p.id === 'pensamiento')).toMatchObject({ fisico: 12, stockCargado: true });

    // Si la conexión se corta y la app reintenta, no se registra dos veces.
    const repetida = operar(token, { tipo: 'stock_inicial', productoId: 'pensamiento', cantidad: 12 }, 'op-repetida-1');
    expect(repetida).toMatchObject({ ok: true, repetida: true });
    expect(hoja('Movimientos').tabla()).toHaveLength(1);
    expect(hoja('Productos').tabla()[1]).toMatchObject({ Físico: 12, Disponible: 12, 'Stock cargado': true });
  });

  it('reserva y entrega parcial quedan en la planilla', () => {
    const token = prepararConAdmin();
    operar(token, { tipo: 'stock_inicial', productoId: 'pensamiento', cantidad: 12 });
    operar(token, { tipo: 'stock_inicial', productoId: 'violitas', cantidad: 5 });
    const r = operar(token, {
      tipo: 'reservar',
      cliente: '=HYPERLINK("x")',
      fechaEntrega: '2026-10-14',
      items: [
        { productoId: 'pensamiento', cantidad: 6 },
        { productoId: 'violitas', cantidad: 2 },
      ],
    });
    expect(r.ok).toBe(true);
    const pedido = r.estado.pedidos[0];
    expect(pedido).toMatchObject({ numero: 1, cliente: '=HYPERLINK("x")', estado: 'pendiente', fechaEntrega: '2026-10-14' });
    expect(hoja('Reservas').tabla()[0]).toMatchObject({ Detalle: '6 Pensamiento, 2 Violitas', Estado: 'pendiente' });

    const e = operar(token, {
      tipo: 'entregar',
      pedidoId: pedido.id,
      items: [
        { productoId: 'pensamiento', cantidad: 4 },
        { productoId: 'violitas', cantidad: 2 },
      ],
    });
    expect(e.mensaje).toBe('Reserva #1 entregada. Se liberaron 2 para la venta.');
    expect(hoja('Reservas').tabla()[0]).toMatchObject({ Detalle: '4/6 Pensamiento, 2 Violitas', Estado: 'entregado' });
    expect(hoja('Productos').tabla()[1]).toMatchObject({ Físico: 8, Reservado: 0, Disponible: 8 });
    expect(hoja('Reservas').tabla()).toHaveLength(1);
  });

  it('los errores de negocio vuelven como mensaje claro', () => {
    const token = prepararConAdmin();
    expect(operar(token, { tipo: 'venta', productoId: 'pensamiento', cantidad: 1 })).toMatchObject({
      ok: false,
      error: 'Primero hay que cargar el stock inicial de Pensamiento.',
    });
    expect(api({ accion: 'operar', token, opId: 'x', comando: {} })).toMatchObject({ ok: false });
    expect(hoja('Movimientos').tabla()).toHaveLength(0);
  });

  it('lee bien fechas que la planilla convirtió en Date', () => {
    const token = prepararConAdmin();
    operar(token, { tipo: 'stock_inicial', productoId: 'tatsoi', cantidad: 3 });
    const h = hoja('Productos');
    const col = (h.datos[0] as string[]).indexOf('Vencimiento');
    const fila = h.datos.findIndex((f) => f[0] === 'tatsoi');
    h.datos[fila][col] = new Date('2026-10-20T03:00:00.000Z');
    const e = api({ accion: 'estado', token });
    expect(e.estado.productos.find((p: { id: string }) => p.id === 'tatsoi').vencimiento).toBe('2026-10-20');
  });

  it('historial: más nuevos primero, filtro por producto y paginado', () => {
    const token = prepararConAdmin();
    operar(token, { tipo: 'stock_inicial', productoId: 'pensamiento', cantidad: 10 });
    operar(token, { tipo: 'stock_inicial', productoId: 'violas', cantidad: 10 });
    for (let i = 0; i < 3; i++) operar(token, { tipo: 'venta', productoId: 'pensamiento', cantidad: 1 });
    const h1 = api({ accion: 'historial', token, productoId: 'pensamiento', limite: 2 });
    expect(h1.movimientos.map((m: { tipo: string; fisico: number }) => [m.tipo, m.fisico])).toEqual([
      ['venta', 7],
      ['venta', 8],
    ]);
    const h2 = api({ accion: 'historial', token, productoId: 'pensamiento', limite: 2, cursor: h1.cursor });
    expect(h2.movimientos.map((m: { tipo: string; fisico: number }) => [m.tipo, m.fisico])).toEqual([
      ['venta', 9],
      ['stock_inicial', 10],
    ]);
    expect(api({ accion: 'historial', token, tipos: ['stock_inicial'] }).movimientos).toHaveLength(2);
  });
});

describe('usuarios y permisos', () => {
  it('vendedor: vende pero no ajusta; desactivarlo corta su sesión', () => {
    const admin = prepararConAdmin();
    operar(admin, { tipo: 'stock_inicial', productoId: 'pensamiento', cantidad: 4 });
    const c = api({ accion: 'crear_usuario', token: admin, email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'vendedor' });
    expect(c).toMatchObject({ ok: true, usuario: { email: 'ana@ejemplo.com', rol: 'vendedor' } });
    const ana = api({ accion: 'login', email: 'ana@ejemplo.com', password: c.claveTemporal }).token;
    expect(operar(ana, { tipo: 'venta', productoId: 'pensamiento', cantidad: 1 }).ok).toBe(true);
    expect(operar(ana, { tipo: 'descarte', productoId: 'pensamiento', cantidad: 1 }).error).toMatch(/administrador/);
    expect(api({ accion: 'usuarios', token: ana }).error).toMatch(/administrador/);
    expect(hoja('Movimientos').tabla().at(-1)).toMatchObject({ Usuario: 'Ana', Tipo: 'venta', 'Δ Físico': -1 });

    api({ accion: 'editar_usuario', token: admin, email: 'ana@ejemplo.com', activo: false });
    expect(api({ accion: 'estado', token: ana })).toMatchObject({ ok: false, codigo: 'sesion' });
    expect(api({ accion: 'login', email: 'ana@ejemplo.com', password: c.claveTemporal }).ok).toBe(false);
  });

  it('nadie se puede sacar a sí mismo el rol de administrador', () => {
    const admin = prepararConAdmin();
    expect(api({ accion: 'editar_usuario', token: admin, email: 'mama@ejemplo.com', rol: 'vendedor' }).error).toMatch(
      /vos mismo/,
    );
  });

  it('restablecer la contraseña da una temporal nueva', () => {
    const admin = prepararConAdmin();
    const c = api({ accion: 'crear_usuario', token: admin, email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'vendedor' });
    const r = api({ accion: 'restablecer_password', token: admin, email: 'ana@ejemplo.com' });
    expect(r.claveTemporal).not.toBe(c.claveTemporal);
    expect(api({ accion: 'login', email: 'ana@ejemplo.com', password: r.claveTemporal })).toMatchObject({
      ok: true,
      debeCambiar: true,
    });
  });
});

describe('revisión de consistencia', () => {
  it('avisa si alguien cambió el stock a mano en la planilla', () => {
    const token = prepararConAdmin();
    operar(token, { tipo: 'stock_inicial', productoId: 'aleli', cantidad: 5 });
    ctx.menuRevisarConsistencia();
    expect(ent.alertas.at(-1)).toMatch(/Todo coincide/);
    const h = hoja('Productos');
    const col = (h.datos[0] as string[]).indexOf('Físico');
    h.datos[h.datos.findIndex((f) => f[0] === 'aleli')][col] = 7;
    ctx.menuRevisarConsistencia();
    expect(ent.alertas.at(-1)).toMatch(/Alelí: físico 7, según el historial 5/);
  });
});
