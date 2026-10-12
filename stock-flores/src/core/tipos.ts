// Tipos compartidos por la app y por el servidor de Google (Apps Script).
// Todas las cantidades son bandejas o envases completos (enteros).

export type Categoria = 'flores' | 'hojas';
export type Unidad = 'bandeja' | 'envase';
export type Rol = 'admin' | 'vendedor';

export interface Producto {
  /** Identificador estable: no cambia al renombrar, así el historial no se toca. */
  id: string;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  descripcion: string;
  fisico: number;
  reservado: number;
  /** 0 = sin mínimo configurado. */
  minimo: number;
  /** false = stock inicial pendiente de cargar (no es lo mismo que agotado). */
  stockCargado: boolean;
  activo: boolean;
  orden: number;
  notas: string;
  proveedor: string;
  sku: string;
  /** Observaciones de calidad. */
  calidad: string;
  /** AAAA-MM-DD o ''. */
  fechaIngreso: string;
  /** AAAA-MM-DD o '' (solo si se conoce). */
  vencimiento: string;
  /** Ruta (/fotos/...) o URL https, o ''. */
  foto: string;
  /** ISO. */
  actualizado: string;
}

export type EstadoPedido = 'pendiente' | 'entregado' | 'cancelado';

export interface ItemPedido {
  productoId: string;
  cantidad: number;
  /** Cantidad realmente entregada (solo en reservas entregadas). */
  entregado?: number;
}

/** Una reserva: separa bandejas para un cliente hasta que se entregan o se cancela. */
export interface Pedido {
  id: string;
  numero: number;
  cliente: string;
  /** AAAA-MM-DD o ''. */
  fechaEntrega: string;
  nota: string;
  items: ItemPedido[];
  estado: EstadoPedido;
  creado: string;
  creadoPor: string;
  creadoPorNombre: string;
  cerrado: string;
  cerradoPor: string;
  cerradoPorNombre: string;
  cierreNota: string;
}

export type TipoMovimiento =
  | 'stock_inicial'
  | 'ingreso'
  | 'venta'
  | 'reserva'
  | 'cancelacion'
  | 'entrega'
  | 'descarte'
  | 'conteo'
  | 'ajuste'
  | 'producto';

/** Registro inmutable de cada cambio. Nada modifica el inventario sin dejar uno. */
export interface Movimiento {
  id: string;
  /** Operación que lo generó (una reserva de 3 productos genera 3 movimientos con el mismo opId). */
  opId: string;
  fecha: string;
  usuario: string;
  usuarioNombre: string;
  tipo: TipoMovimiento;
  productoId: string;
  /** Nombre del producto en ese momento (referencia; la app muestra el nombre actual). */
  productoNombre: string;
  dFisico: number;
  dReservado: number;
  /** Stock después del movimiento. */
  fisico: number;
  reservado: number;
  pedidoId: string;
  pedidoNumero: number;
  nota: string;
}

export interface Usuario {
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

export interface Actor {
  email: string;
  nombre: string;
  rol: Rol;
}

export interface CantidadProducto {
  productoId: string;
  cantidad: number;
}

/** Datos editables de un producto (nunca las cantidades: esas solo cambian con movimientos). */
export interface DatosProducto {
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  descripcion: string;
  minimo: number;
  activo: boolean;
  orden: number;
  notas: string;
  proveedor: string;
  sku: string;
  calidad: string;
  fechaIngreso: string;
  vencimiento: string;
  foto: string;
}

export type Comando =
  | { tipo: 'venta'; productoId: string; cantidad: number; nota?: string }
  | {
      tipo: 'ingreso';
      productoId: string;
      cantidad: number;
      fechaIngreso?: string;
      vencimiento?: string;
      nota?: string;
    }
  | {
      tipo: 'stock_inicial';
      productoId: string;
      cantidad: number;
      fechaIngreso?: string;
      vencimiento?: string;
    }
  | { tipo: 'reservar'; cliente: string; fechaEntrega?: string; nota?: string; items: CantidadProducto[] }
  | { tipo: 'entregar'; pedidoId: string; items: CantidadProducto[]; nota?: string }
  | { tipo: 'cancelar'; pedidoId: string; motivo?: string }
  | { tipo: 'editar_reserva'; pedidoId: string; cliente: string; fechaEntrega: string; nota: string }
  | { tipo: 'descarte'; productoId: string; cantidad: number; nota?: string }
  | { tipo: 'conteo'; productoId: string; contado: number; nota?: string }
  | { tipo: 'correccion'; productoId: string; diferencia: number; nota: string }
  | { tipo: 'crear_producto'; datos: Partial<DatosProducto> & { nombre: string; categoria: Categoria } }
  | { tipo: 'editar_producto'; productoId: string; datos: Partial<DatosProducto> };

export type TipoComando = Comando['tipo'];

/** Lo que la app necesita para dibujar todo. */
export interface Estado {
  version: number;
  productos: Producto[];
  /** Pendientes + cerradas recientes. */
  pedidos: Pedido[];
  usuario: Usuario;
  ahora: string;
}
