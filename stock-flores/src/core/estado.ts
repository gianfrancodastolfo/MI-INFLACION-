import type { Producto } from './tipos';
import { disponible, sumarDias } from './util';

/** Cómo se ve cada producto en la pantalla de stock. */
export type Nivel = 'pendiente' | 'faltante' | 'agotado' | 'bajo' | 'ok';

export function nivel(p: Producto): Nivel {
  if (!p.stockCargado) return 'pendiente';
  const d = disponible(p);
  if (d < 0) return 'faltante';
  if (d === 0) return 'agotado';
  if (p.minimo > 0 && d <= p.minimo) return 'bajo';
  return 'ok';
}

export type AlertaVencimiento = 'vencido' | 'hoy' | 'manana' | 'fecha';

/** Solo usa la fecha cargada: no supone vidas útiles. */
export function alertaVencimiento(p: Producto, hoy: string): AlertaVencimiento | null {
  if (!p.vencimiento || p.fisico <= 0) return null;
  if (p.vencimiento < hoy) return 'vencido';
  if (p.vencimiento === hoy) return 'hoy';
  if (p.vencimiento === sumarDias(hoy, 1)) return 'manana';
  return 'fecha';
}
