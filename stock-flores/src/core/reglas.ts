import type {
  Actor,
  CantidadProducto,
  Comando,
  DatosProducto,
  Movimiento,
  Pedido,
  Producto,
  TipoComando,
  TipoMovimiento,
} from './tipos';
import { disponible, esFechaValida, normalizar, slug, unidades } from './util';

// Reglas del negocio. Funciones puras: reciben los datos actuales y devuelven qué cambió.
// Las usan tanto el servidor de Google como el modo de prueba, así las reglas son una sola.

export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorNegocio';
  }
}

export interface Datos {
  productos: Producto[];
  pedidos: Pedido[];
}

export interface Opciones {
  /** Momento de la operación (ISO). */
  ahora: string;
  /** Fecha local AAAA-MM-DD. */
  hoy: string;
  opId: string;
  nuevoId: () => string;
}

export interface Resultado {
  /** Productos que cambiaron (copias nuevas). */
  productos: Producto[];
  /** Reservas nuevas o modificadas. */
  pedidos: Pedido[];
  movimientos: Movimiento[];
  mensaje: string;
}

const SOLO_ADMIN: ReadonlySet<TipoComando> = new Set<TipoComando>([
  'descarte',
  'conteo',
  'correccion',
  'crear_producto',
  'editar_producto',
]);

export function requiereAdmin(tipo: TipoComando): boolean {
  return SOLO_ADMIN.has(tipo);
}

const MAX_CANTIDAD = 10000;

const LIMITES: Record<string, number> = {
  nombre: 60,
  descripcion: 300,
  notas: 500,
  proveedor: 80,
  sku: 40,
  calidad: 300,
  foto: 500,
  cliente: 80,
  nota: 300,
};

function texto(valor: unknown, campo: keyof typeof LIMITES, etiqueta: string): string {
  if (valor === undefined || valor === null) return '';
  if (typeof valor !== 'string') throw new ErrorNegocio(`${etiqueta}: valor inválido.`);
  const t = valor.trim();
  if (t.length > LIMITES[campo]) throw new ErrorNegocio(`${etiqueta}: máximo ${LIMITES[campo]} caracteres.`);
  return t;
}

function fecha(valor: unknown, etiqueta: string): string {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor !== 'string' || !esFechaValida(valor)) throw new ErrorNegocio(`${etiqueta}: la fecha no es válida.`);
  return valor;
}

function entero(valor: unknown, { min, etiqueta }: { min: number; etiqueta: string }): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    throw new ErrorNegocio(`${etiqueta}: tiene que ser un número entero.`);
  }
  if (valor < min) {
    throw new ErrorNegocio(min > 0 ? `${etiqueta}: tiene que ser mayor que cero.` : `${etiqueta}: no puede ser negativa.`);
  }
  if (Math.abs(valor) > MAX_CANTIDAD) throw new ErrorNegocio(`${etiqueta}: el número es demasiado grande.`);
  return valor;
}

export function ejecutar(cmd: Comando, datos: Datos, actor: Actor, op: Opciones): Resultado {
  if (!cmd || typeof cmd !== 'object' || typeof cmd.tipo !== 'string') throw new ErrorNegocio('Operación inválida.');
  if (requiereAdmin(cmd.tipo) && actor.rol !== 'admin') {
    throw new ErrorNegocio('Esta operación solo la puede hacer un administrador.');
  }

  const originales = new Map(datos.productos.map((p) => [p.id, p]));
  const tocados = new Map<string, Producto>();
  const pedidosTocados = new Map<string, Pedido>();
  const movimientos: Movimiento[] = [];

  /** Copia editable de un producto (se guarda como "cambiado"). */
  function tocar(id: string): Producto {
    const ya = tocados.get(id);
    if (ya) return ya;
    const original = originales.get(id);
    if (!original) throw new ErrorNegocio('No encontré ese producto. Actualizá la pantalla y probá de nuevo.');
    const copia = { ...original, actualizado: op.ahora };
    tocados.set(id, copia);
    return copia;
  }

  function ver(id: unknown): Producto {
    const p = typeof id === 'string' ? tocados.get(id) ?? originales.get(id) : undefined;
    if (!p) throw new ErrorNegocio('No encontré ese producto. Actualizá la pantalla y probá de nuevo.');
    return p;
  }

  /** Producto activo y con stock cargado: se puede vender o reservar. */
  function vendible(id: unknown): Producto {
    const p = ver(id);
    if (!p.activo) throw new ErrorNegocio(`${p.nombre} está inactivo.`);
    if (!p.stockCargado) throw new ErrorNegocio(`Primero hay que cargar el stock inicial de ${p.nombre}.`);
    return p;
  }

  function mover(
    id: string,
    tipo: TipoMovimiento,
    dFisico: number,
    dReservado: number,
    extra: { nota?: string; pedido?: Pedido } = {},
  ): Producto {
    const p = tocar(id);
    dFisico = dFisico || 0; // evita -0
    dReservado = dReservado || 0;
    p.fisico += dFisico;
    p.reservado += dReservado;
    // Sin stock físico, el vencimiento cargado ya no corresponde a nada.
    if (p.fisico === 0 && dFisico < 0) p.vencimiento = '';
    movimientos.push({
      id: op.nuevoId(),
      opId: op.opId,
      fecha: op.ahora,
      usuario: actor.email,
      usuarioNombre: actor.nombre,
      tipo,
      productoId: p.id,
      productoNombre: p.nombre,
      dFisico,
      dReservado,
      fisico: p.fisico,
      reservado: p.reservado,
      pedidoId: extra.pedido?.id ?? '',
      pedidoNumero: extra.pedido?.numero ?? 0,
      nota: extra.nota ?? '',
    });
    return p;
  }

  function pedidoPendiente(id: unknown): Pedido {
    const pedido = datos.pedidos.find((x) => x.id === id);
    if (!pedido) throw new ErrorNegocio('No encontré esa reserva. Actualizá la pantalla.');
    if (pedido.estado === 'entregado') throw new ErrorNegocio(`La reserva #${pedido.numero} ya fue entregada.`);
    if (pedido.estado === 'cancelado') throw new ErrorNegocio(`La reserva #${pedido.numero} ya fue cancelada.`);
    return pedido;
  }

  function aviso(p: Producto): string {
    const d = disponible(p);
    return d < 0 ? ` Atención: faltan ${unidades(-d, p.unidad)} para cubrir las reservas de ${p.nombre}.` : '';
  }

  let mensaje = '';

  switch (cmd.tipo) {
    case 'venta': {
      const p = vendible(cmd.productoId);
      const n = entero(cmd.cantidad, { min: 1, etiqueta: 'Cantidad' });
      const d = disponible(p);
      if (d < n) {
        const reservadas = p.reservado > 0 ? ` (${unidades(p.reservado, p.unidad)} reservadas)` : '';
        throw new ErrorNegocio(
          d <= 0
            ? `No hay ${p.nombre} disponible para vender${reservadas}.`
            : `Solo hay ${unidades(d, p.unidad)} de ${p.nombre} disponibles${reservadas}.`,
        );
      }
      mover(p.id, 'venta', -n, 0, { nota: texto(cmd.nota, 'nota', 'Nota') });
      mensaje = `Venta registrada: ${unidades(n, p.unidad)} de ${p.nombre}.`;
      break;
    }

    case 'ingreso': {
      const p0 = ver(cmd.productoId);
      if (!p0.activo) throw new ErrorNegocio(`${p0.nombre} está inactivo. Activalo antes de cargar mercadería.`);
      const n = entero(cmd.cantidad, { min: 1, etiqueta: 'Cantidad' });
      const fIngreso = fecha(cmd.fechaIngreso, 'Fecha de ingreso') || op.hoy;
      const venc = fecha(cmd.vencimiento, 'Vencimiento');
      const nota = [texto(cmd.nota, 'nota', 'Nota'), venc ? `Vence ${venc}` : ''].filter(Boolean).join(' · ');
      const p = tocar(p0.id);
      p.stockCargado = true;
      p.fechaIngreso = fIngreso;
      if (venc) p.vencimiento = venc;
      mover(p.id, 'ingreso', n, 0, { nota });
      mensaje = `Ingreso registrado: +${unidades(n, p.unidad)} de ${p.nombre}.`;
      break;
    }

    case 'stock_inicial': {
      const p0 = ver(cmd.productoId);
      if (p0.stockCargado) {
        throw new ErrorNegocio(`El stock de ${p0.nombre} ya está cargado. Para corregirlo, un administrador puede hacer un conteo.`);
      }
      const n = entero(cmd.cantidad, { min: 0, etiqueta: 'Cantidad' });
      const fIngreso = fecha(cmd.fechaIngreso, 'Fecha de ingreso');
      const venc = fecha(cmd.vencimiento, 'Vencimiento');
      const p = tocar(p0.id);
      p.stockCargado = true;
      if (fIngreso) p.fechaIngreso = fIngreso;
      if (venc && n > 0) p.vencimiento = venc;
      mover(p.id, 'stock_inicial', n, 0, { nota: venc && n > 0 ? `Vence ${venc}` : '' });
      mensaje = `Stock inicial de ${p.nombre}: ${unidades(n, p.unidad)}.`;
      break;
    }

    case 'reservar': {
      const cliente = texto(cmd.cliente, 'cliente', 'Cliente');
      if (!cliente) throw new ErrorNegocio('Escribí para quién es la reserva.');
      const fechaEntrega = fecha(cmd.fechaEntrega, 'Fecha de entrega');
      const nota = texto(cmd.nota, 'nota', 'Nota');
      const items = agrupar(cmd.items);
      if (items.length === 0) throw new ErrorNegocio('Agregá al menos un producto a la reserva.');
      const faltantes: string[] = [];
      for (const it of items) {
        const p = vendible(it.productoId);
        entero(it.cantidad, { min: 1, etiqueta: `Cantidad de ${p.nombre}` });
        const d = disponible(p);
        if (d < it.cantidad) faltantes.push(`${p.nombre} (hay ${Math.max(d, 0)}, pediste ${it.cantidad})`);
      }
      if (faltantes.length) throw new ErrorNegocio(`No alcanza el stock disponible: ${faltantes.join('; ')}.`);
      const numero = datos.pedidos.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
      const pedido: Pedido = {
        id: op.nuevoId(),
        numero,
        cliente,
        fechaEntrega,
        nota,
        items: items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad })),
        estado: 'pendiente',
        creado: op.ahora,
        creadoPor: actor.email,
        creadoPorNombre: actor.nombre,
        cerrado: '',
        cerradoPor: '',
        cerradoPorNombre: '',
        cierreNota: '',
      };
      for (const it of items) mover(it.productoId, 'reserva', 0, it.cantidad, { pedido, nota: cliente });
      pedidosTocados.set(pedido.id, pedido);
      mensaje = `Reserva #${numero} para ${cliente} guardada.`;
      break;
    }

    case 'entregar': {
      const original = pedidoPendiente(cmd.pedidoId);
      const nota = texto(cmd.nota, 'nota', 'Nota');
      const entregas = new Map<string, number>();
      for (const it of Array.isArray(cmd.items) ? cmd.items : []) {
        if (it && typeof it.productoId === 'string') entregas.set(it.productoId, it.cantidad);
      }
      const pedido: Pedido = { ...original, items: original.items.map((it) => ({ ...it })) };
      let total = 0;
      let liberadas = 0;
      for (const it of pedido.items) {
        const p = ver(it.productoId);
        const e = entregas.has(it.productoId)
          ? entero(entregas.get(it.productoId), { min: 0, etiqueta: `Entrega de ${p.nombre}` })
          : it.cantidad;
        if (e > it.cantidad) {
          throw new ErrorNegocio(
            `De ${p.nombre} se reservaron ${it.cantidad}. Si se llevan más, registrá una venta aparte.`,
          );
        }
        if (e > p.fisico) throw new ErrorNegocio(`Solo hay ${unidades(p.fisico, p.unidad)} físicas de ${p.nombre}.`);
        it.entregado = e;
        total += e;
        liberadas += it.cantidad - e;
      }
      if (total === 0) throw new ErrorNegocio('No se entrega nada: si el cliente no retira, cancelá la reserva.');
      for (const it of pedido.items) {
        const p = ver(it.productoId);
        const liberar = Math.min(it.cantidad, p.reservado);
        const e = it.entregado ?? 0;
        const partes = [
          e < it.cantidad ? `Entregó ${e} de ${it.cantidad}; se liberaron ${it.cantidad - e}` : '',
          nota,
        ].filter(Boolean);
        mover(it.productoId, 'entrega', -e, -liberar, { pedido, nota: partes.join(' · ') || pedido.cliente });
      }
      pedido.estado = 'entregado';
      pedido.cerrado = op.ahora;
      pedido.cerradoPor = actor.email;
      pedido.cerradoPorNombre = actor.nombre;
      pedido.cierreNota = nota;
      pedidosTocados.set(pedido.id, pedido);
      mensaje =
        `Reserva #${pedido.numero} entregada.` +
        (liberadas === 1 ? ' Se liberó 1 para la venta.' : liberadas > 1 ? ` Se liberaron ${liberadas} para la venta.` : '');
      break;
    }

    case 'cancelar': {
      const original = pedidoPendiente(cmd.pedidoId);
      const motivo = texto(cmd.motivo, 'nota', 'Motivo');
      const pedido: Pedido = { ...original };
      for (const it of pedido.items) {
        const p = ver(it.productoId);
        mover(it.productoId, 'cancelacion', 0, -Math.min(it.cantidad, p.reservado), {
          pedido,
          nota: motivo || pedido.cliente,
        });
      }
      pedido.estado = 'cancelado';
      pedido.cerrado = op.ahora;
      pedido.cerradoPor = actor.email;
      pedido.cerradoPorNombre = actor.nombre;
      pedido.cierreNota = motivo;
      pedidosTocados.set(pedido.id, pedido);
      mensaje = `Reserva #${pedido.numero} cancelada. Las bandejas volvieron a estar disponibles.`;
      break;
    }

    case 'editar_reserva': {
      const original = pedidoPendiente(cmd.pedidoId);
      const cliente = texto(cmd.cliente, 'cliente', 'Cliente');
      if (!cliente) throw new ErrorNegocio('Escribí para quién es la reserva.');
      const pedido: Pedido = {
        ...original,
        cliente,
        fechaEntrega: fecha(cmd.fechaEntrega, 'Fecha de entrega'),
        nota: texto(cmd.nota, 'nota', 'Nota'),
      };
      pedidosTocados.set(pedido.id, pedido);
      mensaje = `Reserva #${pedido.numero} actualizada.`;
      break;
    }

    case 'descarte': {
      const p0 = ver(cmd.productoId);
      if (!p0.stockCargado) throw new ErrorNegocio(`Primero hay que cargar el stock inicial de ${p0.nombre}.`);
      const n = entero(cmd.cantidad, { min: 1, etiqueta: 'Cantidad' });
      if (n > p0.fisico) {
        throw new ErrorNegocio(`Hay ${unidades(p0.fisico, p0.unidad)} físicas de ${p0.nombre}; no se pueden descartar más.`);
      }
      const p = mover(p0.id, 'descarte', -n, 0, { nota: texto(cmd.nota, 'nota', 'Motivo') || 'Descarte' });
      mensaje = `Descarte registrado: ${unidades(n, p.unidad)} de ${p.nombre}.` + aviso(p);
      break;
    }

    case 'conteo': {
      const p0 = ver(cmd.productoId);
      const contado = entero(cmd.contado, { min: 0, etiqueta: 'Cantidad contada' });
      const nota = texto(cmd.nota, 'nota', 'Nota');
      const eraPendiente = !p0.stockCargado;
      const dif = contado - p0.fisico;
      tocar(p0.id).stockCargado = true;
      const p = mover(p0.id, 'conteo', dif, 0, {
        nota: nota || (eraPendiente ? 'Primer conteo' : dif === 0 ? 'Conteo sin diferencias' : 'Conteo de inventario'),
      });
      mensaje =
        dif === 0
          ? `Conteo de ${p.nombre}: sin diferencias.`
          : `Conteo de ${p.nombre}: ${dif > 0 ? '+' : ''}${dif}. Ahora hay ${unidades(p.fisico, p.unidad)}.`;
      mensaje += aviso(p);
      break;
    }

    case 'correccion': {
      const p0 = ver(cmd.productoId);
      if (!p0.stockCargado) throw new ErrorNegocio(`Primero hay que cargar el stock inicial de ${p0.nombre}.`);
      const dif = cmd.diferencia;
      if (typeof dif !== 'number' || !Number.isInteger(dif) || dif === 0 || Math.abs(dif) > MAX_CANTIDAD) {
        throw new ErrorNegocio('La corrección tiene que ser un número entero distinto de cero (por ejemplo 2 o -2).');
      }
      const nota = texto(cmd.nota, 'nota', 'Motivo');
      if (!nota) throw new ErrorNegocio('Escribí el motivo de la corrección.');
      if (p0.fisico + dif < 0) throw new ErrorNegocio(`Hay ${unidades(p0.fisico, p0.unidad)} físicas de ${p0.nombre}.`);
      const p = mover(p0.id, 'ajuste', dif, 0, { nota });
      mensaje = `Corrección registrada en ${p.nombre}: ${dif > 0 ? '+' : ''}${dif}.` + aviso(p);
      break;
    }

    case 'crear_producto': {
      const d = validarDatos(cmd.datos ?? {}, null);
      if (!d.nombre) throw new ErrorNegocio('Escribí el nombre del producto.');
      if (!d.categoria) throw new ErrorNegocio('Elegí la categoría.');
      verificarNombreUnico(d.nombre, null, datos.productos);
      let id = slug(d.nombre) || 'producto';
      for (let i = 2; originales.has(id); i++) id = `${slug(d.nombre) || 'producto'}-${i}`;
      const orden =
        d.orden ??
        datos.productos.filter((x) => x.categoria === d.categoria).reduce((m, x) => Math.max(m, x.orden), 0) + 1;
      const nuevo: Producto = {
        id,
        nombre: d.nombre,
        categoria: d.categoria,
        unidad: d.unidad ?? 'bandeja',
        descripcion: d.descripcion ?? '',
        fisico: 0,
        reservado: 0,
        minimo: d.minimo ?? 0,
        stockCargado: false,
        activo: d.activo ?? true,
        orden,
        notas: d.notas ?? '',
        proveedor: d.proveedor ?? '',
        sku: d.sku ?? '',
        calidad: d.calidad ?? '',
        fechaIngreso: d.fechaIngreso ?? '',
        vencimiento: d.vencimiento ?? '',
        foto: d.foto ?? '',
        actualizado: op.ahora,
      };
      originales.set(id, nuevo);
      mover(id, 'producto', 0, 0, { nota: 'Producto creado' });
      mensaje = `Producto ${nuevo.nombre} creado. Falta cargar su stock inicial.`;
      break;
    }

    case 'editar_producto': {
      const p0 = ver(cmd.productoId);
      const d = validarDatos(cmd.datos ?? {}, p0);
      if (d.nombre !== undefined) {
        if (!d.nombre) throw new ErrorNegocio('El nombre no puede quedar vacío.');
        verificarNombreUnico(d.nombre, p0.id, datos.productos);
      }
      if (d.activo === false && p0.reservado > 0) {
        throw new ErrorNegocio(`${p0.nombre} tiene reservas pendientes. Entregalas o cancelalas antes de desactivarlo.`);
      }
      const cambios = describirCambios(p0, d);
      if (cambios.length === 0) {
        mensaje = 'No había cambios para guardar.';
        break;
      }
      const p = tocar(p0.id);
      Object.assign(p, d);
      mover(p.id, 'producto', 0, 0, { nota: `Cambió: ${cambios.join('; ')}`.slice(0, 500) });
      mensaje = `${p.nombre} actualizado.`;
      break;
    }

    default:
      throw new ErrorNegocio('Operación desconocida.');
  }

  return {
    productos: [...tocados.values()],
    pedidos: [...pedidosTocados.values()],
    movimientos,
    mensaje,
  };
}

/** Aplica un resultado a los datos (mantiene el orden y agrega lo nuevo al final). */
export function aplicar(datos: Datos, r: Resultado): Datos {
  const productos = new Map(datos.productos.map((p) => [p.id, p]));
  for (const p of r.productos) productos.set(p.id, p);
  const pedidos = new Map(datos.pedidos.map((p) => [p.id, p]));
  for (const p of r.pedidos) pedidos.set(p.id, p);
  return { productos: [...productos.values()], pedidos: [...pedidos.values()] };
}

/** Une renglones repetidos del mismo producto. */
function agrupar(items: unknown): CantidadProducto[] {
  if (!Array.isArray(items)) return [];
  const suma = new Map<string, number>();
  for (const it of items) {
    if (!it || typeof it.productoId !== 'string') throw new ErrorNegocio('Hay un renglón inválido en la reserva.');
    const n = it.cantidad;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_CANTIDAD) {
      throw new ErrorNegocio('Las cantidades tienen que ser números enteros mayores que cero.');
    }
    suma.set(it.productoId, (suma.get(it.productoId) ?? 0) + n);
  }
  return [...suma].map(([productoId, cantidad]) => ({ productoId, cantidad }));
}

function verificarNombreUnico(nombre: string, idPropio: string | null, productos: Producto[]): void {
  const n = normalizar(nombre);
  const otro = productos.find((p) => p.id !== idPropio && normalizar(p.nombre) === n);
  if (otro) throw new ErrorNegocio(`Ya existe un producto llamado ${otro.nombre}.`);
}

const ETIQUETAS: Record<keyof DatosProducto, string> = {
  nombre: 'nombre',
  categoria: 'categoría',
  unidad: 'unidad',
  descripcion: 'descripción',
  minimo: 'stock mínimo',
  activo: 'activo',
  orden: 'orden',
  notas: 'notas',
  proveedor: 'proveedor',
  sku: 'código',
  calidad: 'calidad',
  fechaIngreso: 'fecha de ingreso',
  vencimiento: 'vencimiento',
  foto: 'foto',
};

/** Valida solo los campos presentes. Nunca deja pasar cantidades de stock. */
function validarDatos(entrada: Partial<DatosProducto>, actual: Producto | null): Partial<DatosProducto> {
  const d: Partial<DatosProducto> = {};
  const e = entrada as Record<string, unknown>;
  if ('nombre' in e) d.nombre = texto(e.nombre, 'nombre', 'Nombre');
  if ('categoria' in e) {
    if (e.categoria !== 'flores' && e.categoria !== 'hojas') throw new ErrorNegocio('Categoría inválida.');
    d.categoria = e.categoria;
  }
  if ('unidad' in e) {
    if (e.unidad !== 'bandeja' && e.unidad !== 'envase') throw new ErrorNegocio('Unidad inválida.');
    d.unidad = e.unidad;
  }
  if ('descripcion' in e) d.descripcion = texto(e.descripcion, 'descripcion', 'Descripción');
  if ('minimo' in e) d.minimo = entero(e.minimo, { min: 0, etiqueta: 'Stock mínimo' });
  if ('activo' in e) {
    if (typeof e.activo !== 'boolean') throw new ErrorNegocio('Activo: valor inválido.');
    d.activo = e.activo;
  }
  if ('orden' in e) d.orden = entero(e.orden, { min: 0, etiqueta: 'Orden' });
  if ('notas' in e) d.notas = texto(e.notas, 'notas', 'Notas');
  if ('proveedor' in e) d.proveedor = texto(e.proveedor, 'proveedor', 'Proveedor');
  if ('sku' in e) d.sku = texto(e.sku, 'sku', 'Código');
  if ('calidad' in e) d.calidad = texto(e.calidad, 'calidad', 'Observaciones de calidad');
  if ('fechaIngreso' in e) d.fechaIngreso = fecha(e.fechaIngreso, 'Fecha de ingreso');
  if ('vencimiento' in e) d.vencimiento = fecha(e.vencimiento, 'Vencimiento');
  if ('foto' in e) {
    const f = texto(e.foto, 'foto', 'Foto');
    if (f && !/^https:\/\//.test(f) && !/^\/fotos\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/.test(f)) {
      throw new ErrorNegocio('Foto: tiene que ser un enlace https.');
    }
    d.foto = f;
  }
  if (actual) {
    // Solo lo que realmente cambia.
    for (const k of Object.keys(d) as (keyof DatosProducto)[]) {
      if (d[k] === actual[k]) delete d[k];
    }
  }
  return d;
}

function describirCambios(actual: Producto, d: Partial<DatosProducto>): string[] {
  return (Object.keys(d) as (keyof DatosProducto)[]).map((k) => {
    const antes = actual[k];
    const despues = d[k];
    if (k === 'nombre' || k === 'minimo' || k === 'categoria' || k === 'unidad' || k === 'activo' || k === 'vencimiento' || k === 'fechaIngreso') {
      return `${ETIQUETAS[k]} (${formatoValor(antes)} → ${formatoValor(despues)})`;
    }
    return ETIQUETAS[k];
  });
}

function formatoValor(v: unknown): string {
  if (v === true) return 'sí';
  if (v === false) return 'no';
  if (v === '' || v === undefined || v === null) return 'vacío';
  return String(v);
}

/**
 * Recalcula el stock a partir del historial y de las reservas pendientes.
 * Sirve para revisar que nada se haya modificado a mano en la planilla.
 */
export function revisarConsistencia(
  productos: Producto[],
  movimientos: Movimiento[],
  pedidos: Pedido[],
): { productoId: string; nombre: string; detalle: string }[] {
  const fisico = new Map<string, number>();
  for (const m of movimientos) fisico.set(m.productoId, (fisico.get(m.productoId) ?? 0) + m.dFisico);
  const reservado = new Map<string, number>();
  for (const pe of pedidos) {
    if (pe.estado !== 'pendiente') continue;
    for (const it of pe.items) reservado.set(it.productoId, (reservado.get(it.productoId) ?? 0) + it.cantidad);
  }
  const problemas: { productoId: string; nombre: string; detalle: string }[] = [];
  for (const p of productos) {
    const f = fisico.get(p.id) ?? 0;
    const r = reservado.get(p.id) ?? 0;
    const partes: string[] = [];
    if (f !== p.fisico) partes.push(`físico ${p.fisico}, según el historial ${f}`);
    if (r !== p.reservado) partes.push(`reservado ${p.reservado}, según las reservas ${r}`);
    if (partes.length) problemas.push({ productoId: p.id, nombre: p.nombre, detalle: partes.join('; ') });
  }
  return problemas;
}
