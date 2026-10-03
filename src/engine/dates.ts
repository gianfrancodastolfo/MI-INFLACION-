/**
 * Fechas diarias 'YYYY-MM-DD' (UVA, ICL y contratos). Se trabaja en UTC para que no influya la zona horaria.
 */
import { MONTHS_LONG, type Period } from './period';

export type ISODate = string;
const ISO_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isISODate(v: unknown): v is ISODate {
  if (typeof v !== 'string' || !ISO_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  return d <= daysInMonth(y, m);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUTC(iso: ISODate): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * 86_400_000);
}

/** Días de `a` a `b` (positivo si `b` es posterior). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function periodOfISO(iso: ISODate): Period {
  return iso.slice(0, 7);
}

/** Mismo día en el mes `p` (si el mes es más corto, el último día). */
export function isoInPeriod(p: Period, day: number): ISODate {
  const y = Number(p.slice(0, 4));
  const m = Number(p.slice(5, 7));
  const d = Math.min(Math.max(1, day), daysInMonth(y, m));
  return `${p}-${String(d).padStart(2, '0')}`;
}

/** Suma meses conservando el día (31/1 + 1 mes = 28 o 29/2). */
export function addMonthsISO(iso: ISODate, n: number): ISODate {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12 + 1;
  return isoInPeriod(`${yy}-${String(mm).padStart(2, '0')}`, Number(iso.slice(8, 10)));
}

/** Fecha local del navegador como 'YYYY-MM-DD'. */
export function todayISO(d: Date = new Date()): ISODate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatISODate(iso: ISODate, style: 'short' | 'long' = 'short'): string {
  const d = Number(iso.slice(8, 10));
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  if (style === 'long') return `${d} de ${MONTHS_LONG[m - 1]} de ${y}`;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
