import type { Comando, Estado, Movimiento, Rol, TipoMovimiento, Usuario } from '../core/tipos';

export interface Sesion {
  token: string;
  usuario: Usuario;
  debeCambiar: boolean;
}

export interface FiltroHistorial {
  productoId?: string;
  tipos?: TipoMovimiento[];
  limite?: number;
  cursor?: number | null;
}

export interface PaginaHistorial {
  movimientos: Movimiento[];
  cursor: number | null;
}

export interface RespuestaOperacion {
  mensaje: string;
  estado: Estado;
  repetida?: boolean;
}

export interface CambiosUsuario {
  nombre?: string;
  rol?: Rol;
  activo?: boolean;
}

/** Lo que la app necesita de un servidor. Hoy: Google Sheets o el modo de prueba local. */
export interface Backend {
  modo: 'google' | 'demo';
  login(email: string, password: string): Promise<Sesion>;
  /** null = no hubo cambios desde esa versión. */
  estado(token: string, version?: number): Promise<Estado | null>;
  operar(token: string, opId: string, comando: Comando): Promise<RespuestaOperacion>;
  historial(token: string, filtro: FiltroHistorial): Promise<PaginaHistorial>;
  cambiarPassword(token: string, actual: string, nueva: string): Promise<Sesion>;
  usuarios(token: string): Promise<Usuario[]>;
  crearUsuario(token: string, email: string, nombre: string, rol: Rol): Promise<{ usuario: Usuario; claveTemporal: string }>;
  editarUsuario(token: string, email: string, cambios: CambiosUsuario): Promise<Usuario>;
  restablecerPassword(token: string, email: string): Promise<string>;
}

export type CodigoError = 'sesion' | 'red' | '';

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public codigo: CodigoError = '',
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}
