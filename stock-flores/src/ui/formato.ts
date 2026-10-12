import type { TipoMovimiento } from '../core/tipos';

/** Fecha local de hoy, AAAA-MM-DD. */
export function hoyLocal(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "mar 14/10" a partir de AAAA-MM-DD. */
export function fechaCorta(f: string): string {
  if (!f) return '';
  const [a, m, d] = f.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return `${DIAS[fecha.getDay()]} ${d}/${m}`;
}

/** "hoy", "mañana", "ayer" o "mar 14/10". */
export function fechaRelativa(f: string, hoy = hoyLocal()): string {
  if (!f) return '';
  if (f === hoy) return 'hoy';
  const manana = hoyLocal(new Date(Date.now() + 86_400_000));
  const ayer = hoyLocal(new Date(Date.now() - 86_400_000));
  if (f === manana) return 'mañana';
  if (f === ayer) return 'ayer';
  return fechaCorta(f);
}

/** "hoy 16:40", "ayer 10:02" o "12/10 09:15" a partir de un ISO. */
export function momento(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia = hoyLocal(d);
  const rel = fechaRelativa(dia);
  if (rel === 'hoy' || rel === 'ayer') return `${rel} ${hora}`;
  return `${d.getDate()}/${d.getMonth() + 1} ${hora}`;
}

export function haceCuanto(d: Date | null, ahora = Date.now()): string {
  if (!d) return '';
  const s = Math.round((ahora - d.getTime()) / 1000);
  if (s < 10) return 'recién';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return momento(d.toISOString());
}

export const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  stock_inicial: 'Stock inicial',
  ingreso: 'Ingreso',
  venta: 'Venta',
  reserva: 'Reserva',
  cancelacion: 'Cancelación',
  entrega: 'Entrega',
  descarte: 'Descarte',
  conteo: 'Conteo',
  ajuste: 'Corrección',
  producto: 'Cambio de datos',
};

export function conSigno(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
