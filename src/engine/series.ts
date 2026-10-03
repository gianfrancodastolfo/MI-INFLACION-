import { type Period, addMonths, diffMonths, isPeriod } from './period';

/**
 * Serie de índice mensual (por ejemplo, IPC base dic-2016 = 100).
 * `values[k]` corresponde al período `start + k meses`. `null` = dato faltante.
 */
export interface IndexSeries {
  start: Period;
  values: ReadonlyArray<number | null>;
}

export type CalcError =
  | { code: 'INVALID_PERIOD'; period: string }
  | { code: 'PERIOD_BEFORE_START'; period: Period; first: Period }
  | { code: 'PERIOD_AFTER_END'; period: Period; last: Period }
  | { code: 'MISSING_VALUE'; period: Period; category?: string }
  | { code: 'INVALID_ORDER'; from: Period; to: Period }
  | { code: 'INVALID_AMOUNT'; value: number }
  | { code: 'EMPTY_BASKET' }
  | { code: 'UNKNOWN_CATEGORY'; category: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: CalcError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: CalcError): Result<T> => ({ ok: false, error });

export function firstPeriod(s: IndexSeries): Period {
  return s.start;
}

/** Último período con dato (ignora `null` al final). */
export function lastPeriod(s: IndexSeries): Period {
  let k = s.values.length - 1;
  while (k >= 0 && s.values[k] == null) k--;
  return addMonths(s.start, Math.max(k, 0));
}

/** Valor de la serie en un período, con el motivo si no existe. */
export function valueAt(s: IndexSeries, p: Period, category?: string): Result<number> {
  if (!isPeriod(p)) return fail({ code: 'INVALID_PERIOD', period: String(p) });
  const k = diffMonths(s.start, p);
  if (k < 0) return fail({ code: 'PERIOD_BEFORE_START', period: p, first: s.start });
  const last = lastPeriod(s);
  if (diffMonths(last, p) > 0) return fail({ code: 'PERIOD_AFTER_END', period: p, last });
  const v = s.values[k];
  if (v == null || !Number.isFinite(v) || v <= 0) return fail({ code: 'MISSING_VALUE', period: p, category });
  return ok(v);
}

export function hasValue(s: IndexSeries, p: Period): boolean {
  return valueAt(s, p).ok;
}

/** Último período común con dato en todas las series. */
export function commonLastPeriod(series: IndexSeries[]): Period | undefined {
  if (series.length === 0) return undefined;
  return series.map(lastPeriod).reduce((a, b) => (diffMonths(a, b) < 0 ? a : b));
}

/** Primer período común con dato en todas las series. */
export function commonFirstPeriod(series: IndexSeries[]): Period | undefined {
  if (series.length === 0) return undefined;
  return series.map(firstPeriod).reduce((a, b) => (diffMonths(a, b) > 0 ? a : b));
}
