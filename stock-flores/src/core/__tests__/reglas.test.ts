import { beforeEach, describe, expect, it } from 'vitest';
import { productosIniciales, CATALOGO_INICIAL } from '../catalogo';
import { nivel, alertaVencimiento } from '../estado';
import { aplicar, ejecutar, revisarConsistencia, type Datos } from '../reglas';
import type { Actor, Comando, Movimiento, Producto } from '../tipos';
import { disponible } from '../util';

const duena: Actor = { email: 'mama@ejemplo.com', nombre: 'Mamá', rol: 'admin' };
const vendedor: Actor = { email: 'ana@ejemplo.com', nombre: 'Ana', rol: 'vendedor' };

let datos: Datos;
let historial: Movimiento[];
let n: number;

function correr(cmd: Comando, actor: Actor = duena) {
  const r = ejecutar(cmd, datos, actor, {
    ahora: `2026-10-12T15:00:${String(n % 60).padStart(2, '0')}.000Z`,
    hoy: '2026-10-12',
    opId: `op-${n}`,
    nuevoId: () => `id-${n++}`,
  });
  datos = aplicar(datos, r);
  historial.push(...r.movimientos);
  return r;
}

function prod(id: string): Producto {
  const p = datos.productos.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
}

beforeEach(() => {
  datos = { productos: productosIniciales('2026-10-12T00:00:00.000Z'), pedidos: [] };
  historial = [];
  n = 1;
});

describe('catálogo inicial', () => {
  it('carga 11 flores y 14 hojas como registros independientes y sin stock', () => {
    expect(CATALOGO_INICIAL.filter((p) => p.categoria === 'flores')).toHaveLength(11);
    expect(CATALOGO_INICIAL.filter((p) => p.categoria === 'hojas')).toHaveLength(14);
    expect(new Set(datos.productos.map((p) => p.id)).size).toBe(25);
    for (const p of datos.productos) {
      expect(p.stockCargado).toBe(false);
      expect(p.fisico).toBe(0);
      expect(p.vencimiento).toBe('');
      expect(nivel(p)).toBe('pendiente');
    }
    expect(prod('calendula-naranja')).not.toBe(prod('calendula-amarilla'));
  });

  it('marca las variedades que hay que confirmar con el proveedor', () => {
    const aConfirmar = datos.productos.filter((p) => p.notas.includes('confirmar')).map((p) => p.nombre);
    expect(aConfirmar).toEqual(['Flores c/tallo', 'Primavera', 'Coqueta', 'Conejito']);
  });
});

describe('stock pendiente vs. agotado', () => {
  it('un producto sin stock cargado no se puede vender ni reservar', () => {
    expect(() => correr({ tipo: 'venta', productoId: 'pensamiento', cantidad: 1 })).toThrow(/stock inicial/);
    expect(() =>
      correr({ tipo: 'reservar', cliente: 'Lola', items: [{ productoId: 'pensamiento', cantidad: 1 }] }),
    ).toThrow(/stock inicial/);
  });

  it('cargar stock inicial en cero lo deja agotado, no pendiente', () => {
    correr({ tipo: 'stock_inicial', productoId: 'violas', cantidad: 0 }, vendedor);
    expect(nivel(prod('violas'))).toBe('agotado');
  });

  it('el stock inicial se carga una sola vez', () => {
    correr({ tipo: 'stock_inicial', productoId: 'violas', cantidad: 5 });
    expect(() => correr({ tipo: 'stock_inicial', productoId: 'violas', cantidad: 6 })).toThrow(/ya está cargado/);
  });
});

describe('ventas, reservas, entregas y cancelaciones', () => {
  beforeEach(() => {
    correr({ tipo: 'stock_inicial', productoId: 'pensamiento', cantidad: 12 });
    correr({ tipo: 'stock_inicial', productoId: 'violitas', cantidad: 6 });
  });

  it('la venta baja el físico y el disponible', () => {
    correr({ tipo: 'venta', productoId: 'pensamiento', cantidad: 2 }, vendedor);
    expect(prod('pensamiento')).toMatchObject({ fisico: 10, reservado: 0 });
    expect(disponible(prod('pensamiento'))).toBe(10);
  });

  it('la reserva baja el disponible pero no el físico', () => {
    const r = correr({
      tipo: 'reservar',
      cliente: 'Pastelería Lola',
      fechaEntrega: '2026-10-14',
      items: [
        { productoId: 'pensamiento', cantidad: 3 },
        { productoId: 'pensamiento', cantidad: 1 },
        { productoId: 'violitas', cantidad: 2 },
      ],
    });
    expect(r.pedidos[0]).toMatchObject({ numero: 1, estado: 'pendiente' });
    expect(r.pedidos[0].items).toEqual([
      { productoId: 'pensamiento', cantidad: 4 },
      { productoId: 'violitas', cantidad: 2 },
    ]);
    expect(prod('pensamiento')).toMatchObject({ fisico: 12, reservado: 4 });
    expect(disponible(prod('pensamiento'))).toBe(8);
  });

  it('no se puede vender lo que está reservado', () => {
    correr({ tipo: 'reservar', cliente: 'Lola', items: [{ productoId: 'violitas', cantidad: 5 }] });
    expect(() => correr({ tipo: 'venta', productoId: 'violitas', cantidad: 2 })).toThrow(/Solo hay 1 bandeja/);
  });

  it('no se puede reservar más de lo disponible (y no reserva nada a medias)', () => {
    expect(() =>
      correr({
        tipo: 'reservar',
        cliente: 'Lola',
        items: [
          { productoId: 'pensamiento', cantidad: 2 },
          { productoId: 'violitas', cantidad: 7 },
        ],
      }),
    ).toThrow(/Violitas \(hay 6, pediste 7\)/);
    expect(prod('pensamiento').reservado).toBe(0);
  });

  it('cancelar libera lo reservado', () => {
    const r = correr({ tipo: 'reservar', cliente: 'Lola', items: [{ productoId: 'pensamiento', cantidad: 4 }] });
    correr({ tipo: 'cancelar', pedidoId: r.pedidos[0].id, motivo: 'No vino' }, vendedor);
    expect(prod('pensamiento')).toMatchObject({ fisico: 12, reservado: 0 });
    expect(datos.pedidos[0]).toMatchObject({ estado: 'cancelado', cierreNota: 'No vino', cerradoPorNombre: 'Ana' });
  });

  it('entregar convierte la reserva en venta y descuenta el físico una sola vez', () => {
    const r = correr({ tipo: 'reservar', cliente: 'Lola', items: [{ productoId: 'pensamiento', cantidad: 4 }] });
    const id = r.pedidos[0].id;
    correr({ tipo: 'entregar', pedidoId: id, items: [] });
    expect(prod('pensamiento')).toMatchObject({ fisico: 8, reservado: 0 });
    expect(() => correr({ tipo: 'entregar', pedidoId: id, items: [] })).toThrow(/ya fue entregada/);
    expect(() => correr({ tipo: 'cancelar', pedidoId: id })).toThrow(/ya fue entregada/);
    expect(prod('pensamiento')).toMatchObject({ fisico: 8, reservado: 0 });
  });

  it('al entregar menos de lo reservado, se vende lo entregado y se libera el resto', () => {
    const r = correr({
      tipo: 'reservar',
      cliente: 'Lola',
      items: [
        { productoId: 'pensamiento', cantidad: 6 },
        { productoId: 'violitas', cantidad: 2 },
      ],
    });
    const e = correr({
      tipo: 'entregar',
      pedidoId: r.pedidos[0].id,
      items: [
        { productoId: 'pensamiento', cantidad: 4 },
        { productoId: 'violitas', cantidad: 0 },
      ],
    });
    expect(e.mensaje).toMatch(/Se liberaron 4/);
    expect(prod('pensamiento')).toMatchObject({ fisico: 8, reservado: 0 });
    expect(prod('violitas')).toMatchObject({ fisico: 6, reservado: 0 });
    expect(datos.pedidos[0].items).toEqual([
      { productoId: 'pensamiento', cantidad: 6, entregado: 4 },
      { productoId: 'violitas', cantidad: 2, entregado: 0 },
    ]);
  });

  it('no se puede entregar más de lo reservado ni entregar nada', () => {
    const r = correr({ tipo: 'reservar', cliente: 'Lola', items: [{ productoId: 'pensamiento', cantidad: 2 }] });
    const pedidoId = r.pedidos[0].id;
    expect(() =>
      correr({ tipo: 'entregar', pedidoId, items: [{ productoId: 'pensamiento', cantidad: 3 }] }),
    ).toThrow(/venta aparte/);
    expect(() =>
      correr({ tipo: 'entregar', pedidoId, items: [{ productoId: 'pensamiento', cantidad: 0 }] }),
    ).toThrow(/cancelá/);
  });

  it('las reservas se numeran correlativamente', () => {
    correr({ tipo: 'reservar', cliente: 'A', items: [{ productoId: 'pensamiento', cantidad: 1 }] });
    const r = correr({ tipo: 'reservar', cliente: 'B', items: [{ productoId: 'pensamiento', cantidad: 1 }] });
    expect(r.pedidos[0].numero).toBe(2);
  });
});

describe('ingresos y ajustes', () => {
  beforeEach(() => {
    correr({ tipo: 'stock_inicial', productoId: 'tatsoi', cantidad: 3 });
  });

  it('el ingreso suma al físico y guarda fechas si se informan', () => {
    correr(
      { tipo: 'ingreso', productoId: 'tatsoi', cantidad: 5, fechaIngreso: '2026-10-12', vencimiento: '2026-10-16' },
      vendedor,
    );
    expect(prod('tatsoi')).toMatchObject({ fisico: 8, fechaIngreso: '2026-10-12', vencimiento: '2026-10-16' });
    expect(historial.at(-1)).toMatchObject({ tipo: 'ingreso', dFisico: 5, fisico: 8, usuarioNombre: 'Ana' });
  });

  it('un ingreso en un producto pendiente lo deja cargado', () => {
    correr({ tipo: 'ingreso', productoId: 'espinaca', cantidad: 4 }, vendedor);
    expect(prod('espinaca')).toMatchObject({ stockCargado: true, fisico: 4, fechaIngreso: '2026-10-12' });
  });

  it('descarte, conteo y corrección quedan en el historial y son solo para la dueña', () => {
    expect(() => correr({ tipo: 'descarte', productoId: 'tatsoi', cantidad: 1 }, vendedor)).toThrow(/administrador/);
    correr({ tipo: 'descarte', productoId: 'tatsoi', cantidad: 1, nota: 'Hojas marchitas' });
    correr({ tipo: 'conteo', productoId: 'tatsoi', contado: 1 });
    correr({ tipo: 'correccion', productoId: 'tatsoi', diferencia: 2, nota: 'Ingreso mal cargado' });
    expect(prod('tatsoi').fisico).toBe(3);
    expect(historial.slice(-3).map((m) => [m.tipo, m.dFisico, m.nota])).toEqual([
      ['descarte', -1, 'Hojas marchitas'],
      ['conteo', -1, 'Conteo de inventario'],
      ['ajuste', 2, 'Ingreso mal cargado'],
    ]);
  });

  it('la corrección pide motivo y no deja el físico negativo', () => {
    expect(() => correr({ tipo: 'correccion', productoId: 'tatsoi', diferencia: -1, nota: '' })).toThrow(/motivo/);
    expect(() => correr({ tipo: 'correccion', productoId: 'tatsoi', diferencia: -4, nota: 'x' })).toThrow();
  });

  it('un descarte puede dejar menos físico que lo reservado, y avisa', () => {
    correr({ tipo: 'reservar', cliente: 'Lola', items: [{ productoId: 'tatsoi', cantidad: 3 }] });
    const r = correr({ tipo: 'descarte', productoId: 'tatsoi', cantidad: 2 });
    expect(r.mensaje).toMatch(/faltan 2 bandejas/);
    expect(nivel(prod('tatsoi'))).toBe('faltante');
  });

  it('cuando el físico llega a cero se borra el vencimiento', () => {
    correr({ tipo: 'ingreso', productoId: 'tatsoi', cantidad: 1, vencimiento: '2026-10-15' });
    correr({ tipo: 'venta', productoId: 'tatsoi', cantidad: 4 });
    expect(prod('tatsoi').vencimiento).toBe('');
  });

  it('rechaza cantidades no enteras o negativas', () => {
    expect(() => correr({ tipo: 'venta', productoId: 'tatsoi', cantidad: 1.5 })).toThrow(/entero/);
    expect(() => correr({ tipo: 'venta', productoId: 'tatsoi', cantidad: -1 })).toThrow(/mayor que cero/);
    expect(() => correr({ tipo: 'ingreso', productoId: 'tatsoi', cantidad: 0 })).toThrow(/mayor que cero/);
  });
});

describe('ninguna operación cambia el inventario sin registro', () => {
  it('el historial reconstruye exactamente el stock', () => {
    correr({ tipo: 'stock_inicial', productoId: 'aleli', cantidad: 10 });
    correr({ tipo: 'venta', productoId: 'aleli', cantidad: 2 });
    const r1 = correr({ tipo: 'reservar', cliente: 'A', items: [{ productoId: 'aleli', cantidad: 3 }] });
    const r2 = correr({ tipo: 'reservar', cliente: 'B', items: [{ productoId: 'aleli', cantidad: 2 }] });
    correr({ tipo: 'entregar', pedidoId: r1.pedidos[0].id, items: [{ productoId: 'aleli', cantidad: 2 }] });
    correr({ tipo: 'cancelar', pedidoId: r2.pedidos[0].id });
    correr({ tipo: 'ingreso', productoId: 'aleli', cantidad: 4 });
    correr({ tipo: 'descarte', productoId: 'aleli', cantidad: 1 });
    correr({ tipo: 'reservar', cliente: 'C', items: [{ productoId: 'aleli', cantidad: 1 }] });
    expect(prod('aleli')).toMatchObject({ fisico: 9, reservado: 1 });
    expect(revisarConsistencia(datos.productos, historial, datos.pedidos)).toEqual([]);
    // Cada movimiento deja el stock "después" igual a la suma acumulada.
    let f = 0;
    for (const m of historial.filter((x) => x.productoId === 'aleli')) {
      f += m.dFisico;
      expect(m.fisico).toBe(f);
    }
  });

  it('detecta una edición a mano', () => {
    correr({ tipo: 'stock_inicial', productoId: 'aleli', cantidad: 10 });
    const tocado = datos.productos.map((p) => (p.id === 'aleli' ? { ...p, fisico: 15 } : p));
    expect(revisarConsistencia(tocado, historial, datos.pedidos)).toEqual([
      { productoId: 'aleli', nombre: 'Alelí', detalle: 'físico 15, según el historial 10' },
    ]);
  });
});

describe('productos', () => {
  it('renombrar no cambia el id ni el historial', () => {
    correr({ tipo: 'stock_inicial', productoId: 'pacchoi', cantidad: 2 });
    correr({ tipo: 'editar_producto', productoId: 'pacchoi', datos: { nombre: 'Pak choi', minimo: 3 } });
    expect(prod('pacchoi')).toMatchObject({ nombre: 'Pak choi', minimo: 3, fisico: 2 });
    expect(historial[0]).toMatchObject({ productoId: 'pacchoi', productoNombre: 'Pacchoi' });
    expect(historial.at(-1)?.nota).toBe('Cambió: nombre (Pacchoi → Pak choi); stock mínimo (0 → 3)');
  });

  it('editar no puede tocar las cantidades', () => {
    correr({ tipo: 'stock_inicial', productoId: 'pacchoi', cantidad: 2 });
    correr({
      tipo: 'editar_producto',
      productoId: 'pacchoi',
      datos: { fisico: 99, reservado: 5, notas: 'ok' } as never,
    });
    expect(prod('pacchoi')).toMatchObject({ fisico: 2, reservado: 0, notas: 'ok' });
  });

  it('no permite nombres repetidos (sin importar tildes)', () => {
    expect(() =>
      correr({ tipo: 'crear_producto', datos: { nombre: 'calendula NARANJA', categoria: 'flores' } }),
    ).toThrow(/Ya existe/);
  });

  it('un producto nuevo arranca pendiente de cargar', () => {
    const r = correr({ tipo: 'crear_producto', datos: { nombre: 'Borraja', categoria: 'flores', minimo: 2 } });
    expect(r.productos[0]).toMatchObject({ id: 'borraja', stockCargado: false, orden: 12, minimo: 2 });
    expect(() =>
      correr({ tipo: 'crear_producto', datos: { nombre: 'Otra', categoria: 'flores' } }, vendedor),
    ).toThrow(/administrador/);
  });

  it('no deja desactivar un producto con reservas pendientes', () => {
    correr({ tipo: 'stock_inicial', productoId: 'pacchoi', cantidad: 2 });
    correr({ tipo: 'reservar', cliente: 'A', items: [{ productoId: 'pacchoi', cantidad: 1 }] });
    expect(() => correr({ tipo: 'editar_producto', productoId: 'pacchoi', datos: { activo: false } })).toThrow(
      /reservas pendientes/,
    );
  });
});

describe('indicadores', () => {
  it('bajo, agotado y faltante según el disponible', () => {
    correr({ tipo: 'stock_inicial', productoId: 'capiqui', cantidad: 3 });
    correr({ tipo: 'editar_producto', productoId: 'capiqui', datos: { minimo: 3 } });
    expect(nivel(prod('capiqui'))).toBe('bajo');
    correr({ tipo: 'ingreso', productoId: 'capiqui', cantidad: 1 });
    expect(nivel(prod('capiqui'))).toBe('ok');
    correr({ tipo: 'reservar', cliente: 'A', items: [{ productoId: 'capiqui', cantidad: 4 }] });
    expect(nivel(prod('capiqui'))).toBe('agotado');
  });

  it('vencimiento solo si hay fecha cargada', () => {
    const p = { ...prod('capiqui'), fisico: 2, stockCargado: true };
    expect(alertaVencimiento(p, '2026-10-12')).toBeNull();
    expect(alertaVencimiento({ ...p, vencimiento: '2026-10-11' }, '2026-10-12')).toBe('vencido');
    expect(alertaVencimiento({ ...p, vencimiento: '2026-10-12' }, '2026-10-12')).toBe('hoy');
    expect(alertaVencimiento({ ...p, vencimiento: '2026-10-13' }, '2026-10-12')).toBe('manana');
    expect(alertaVencimiento({ ...p, vencimiento: '2026-10-20' }, '2026-10-12')).toBe('fecha');
  });
});
