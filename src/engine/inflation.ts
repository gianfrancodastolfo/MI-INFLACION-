import { type Period, addMonths, comparePeriods, decemberOfPreviousYear, periodRange } from './period';
import { type IndexSeries, type Result, fail, ok, valueAt } from './series';

/**
 * Factor de precios entre dos períodos: I(to) / I(from).
 * Es la forma correcta de acumular inflación: los índices ya están compuestos,
 * así que nunca se suman variaciones mensuales.
 */
export function priceFactor(s: IndexSeries, from: Period, to: Period): Result<number> {
  const a = valueAt(s, from);
  if (!a.ok) return a;
  const b = valueAt(s, to);
  if (!b.ok) return b;
  return ok(b.value / a.value);
}

/** Inflación acumulada entre `from` y `to` (0.25 = 25%). Admite `to` anterior a `from` (deflación del monto). */
export function calculateInflation(s: IndexSeries, from: Period, to: Period): Result<number> {
  const f = priceFactor(s, from, to);
  return f.ok ? ok(f.value - 1) : f;
}

/** Alias con el nombre del documento de producto. */
export const calculateAccumulatedInflation = calculateInflation;

/** Variación mensual: I(p) / I(p-1) - 1. */
export function monthlyInflation(s: IndexSeries, p: Period): Result<number> {
  return calculateInflation(s, addMonths(p, -1), p);
}

/** Variación interanual: I(p) / I(p-12) - 1. */
export function yearOverYearInflation(s: IndexSeries, p: Period): Result<number> {
  return calculateInflation(s, addMonths(p, -12), p);
}

/** Variación acumulada en el año (contra diciembre del año anterior), como la publica INDEC. */
export function yearToDateInflation(s: IndexSeries, p: Period): Result<number> {
  return calculateInflation(s, decemberOfPreviousYear(p), p);
}

/** Compone tasas sucesivas: Π(1 + r) - 1. */
export function compoundRates(rates: ReadonlyArray<number>): number {
  return rates.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

/** Tasa mensual promedio equivalente (geométrica) para un factor acumulado en `months` meses. */
export function averageMonthlyRate(factor: number, months: number): number {
  if (months <= 0) return 0;
  return Math.pow(factor, 1 / months) - 1;
}

/** Anualiza una tasa mensual: (1 + r)^12 - 1. */
export function annualizeMonthlyRate(r: number): number {
  return Math.pow(1 + r, 12) - 1;
}

export interface MonthlyPoint {
  period: Period;
  value: number;
}

/** Serie de variaciones mensuales entre `from` y `to` (incluidos). */
export function monthlyInflationSeries(s: IndexSeries, from: Period, to: Period): Result<MonthlyPoint[]> {
  if (comparePeriods(from, to) > 0) return fail({ code: 'INVALID_ORDER', from, to });
  const out: MonthlyPoint[] = [];
  for (const p of periodRange(from, to)) {
    const r = monthlyInflation(s, p);
    if (!r.ok) return r;
    out.push({ period: p, value: r.value });
  }
  return ok(out);
}
