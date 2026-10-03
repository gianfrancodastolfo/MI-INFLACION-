/**
 * Períodos mensuales con formato 'YYYY-MM'.
 * Todas las series oficiales del IPC son mensuales, así que el mes es la unidad mínima.
 */
export type Period = string;

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
export const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && PERIOD_RE.test(value);
}

/** Convierte 'YYYY-MM' en un entero correlativo (año*12 + mes-1). */
export function toMonthIndex(p: Period): number {
  const m = PERIOD_RE.exec(p);
  if (!m) throw new Error(`Período inválido: ${p}`);
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

export function fromMonthIndex(i: number): Period {
  const year = Math.floor(i / 12);
  const month = (i % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function addMonths(p: Period, n: number): Period {
  return fromMonthIndex(toMonthIndex(p) + n);
}

/** Cantidad de meses de `from` a `to` (positivo si `to` es posterior). */
export function diffMonths(from: Period, to: Period): number {
  return toMonthIndex(to) - toMonthIndex(from);
}

export function comparePeriods(a: Period, b: Period): number {
  return toMonthIndex(a) - toMonthIndex(b);
}

export function maxPeriod(a: Period, b: Period): Period {
  return comparePeriods(a, b) >= 0 ? a : b;
}

export function minPeriod(a: Period, b: Period): Period {
  return comparePeriods(a, b) <= 0 ? a : b;
}

/** Lista inclusiva de períodos entre `from` y `to`. */
export function periodRange(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  for (let i = toMonthIndex(from); i <= toMonthIndex(to); i++) out.push(fromMonthIndex(i));
  return out;
}

/** Diciembre del año anterior: base de la "inflación acumulada en el año" que publica INDEC. */
export function decemberOfPreviousYear(p: Period): Period {
  const year = Number(p.slice(0, 4));
  return `${year - 1}-12`;
}

export function periodYear(p: Period): number {
  return Number(p.slice(0, 4));
}

export function periodMonth(p: Period): number {
  return Number(p.slice(5, 7));
}

export function formatPeriod(p: Period, style: 'short' | 'long' = 'short'): string {
  const year = p.slice(0, 4);
  const month = periodMonth(p) - 1;
  if (style === 'long') return `${MONTHS_LONG[month]} de ${year}`;
  return `${MONTHS_SHORT[month]} ${year}`;
}

/** Período del calendario para una fecha dada (zona horaria local del navegador). */
export function periodOfDate(d: Date): Period {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
