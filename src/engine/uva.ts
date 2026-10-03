/**
 * UVA (Unidad de Valor Adquisitivo, BCRA).
 *
 * Regla verificada contra los valores publicados (113 fines de mes 2017-2026 y todos los días hábiles de may-ago 2026):
 * del día 17 del mes m al día 16 del mes m+1, la UVA crece cada día el mismo factor
 *   (1 + variación mensual del IPC nacional de m−1, como la publica INDEC, con un decimal) ^ (1 / días del mes m).
 * Con esa regla se reconstruye cualquier día a partir de un valor oficial (ancla).
 */
import { type ISODate, addDays, daysInMonth, diffDays } from './dates';
import { type Period, addMonths } from './period';

/** Variación mensual publicada (en %) para un mes. `undefined` si todavía no se publicó. */
export type PublishedRate = (period: Period) => number | undefined;

/** Mes cuyo IPC rige el día `iso` y la cantidad de días del tramo. */
export function uvaTramo(iso: ISODate): { tramo: Period; ipcMonth: Period; days: number } {
  let y = Number(iso.slice(0, 4));
  let m = Number(iso.slice(5, 7));
  if (Number(iso.slice(8, 10)) < 17) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  const tramo = `${y}-${String(m).padStart(2, '0')}`;
  return { tramo, ipcMonth: addMonths(tramo, -1), days: daysInMonth(y, m) };
}

/** Factor por el que se multiplica la UVA del día anterior para obtener la del día `iso`. */
export function uvaDailyFactor(iso: ISODate, rate: PublishedRate): number | undefined {
  const { ipcMonth, days } = uvaTramo(iso);
  const r = rate(ipcMonth);
  if (r == null || !Number.isFinite(r)) return undefined;
  return (1 + r / 100) ** (1 / days);
}

/** Último día calculable: el 16 del mes siguiente al primer mes sin IPC publicado. */
export function uvaLastComputableDate(lastPublishedIpc: Period): ISODate {
  return `${addMonths(lastPublishedIpc, 2)}-16`;
}

export interface UvaAnchor {
  date: ISODate;
  value: number;
}

/**
 * Valor de la UVA en `target`, encadenando factores diarios desde el ancla oficial.
 * Devuelve `undefined` si algún día del camino no tiene IPC publicado.
 */
export function uvaFromAnchor(anchor: UvaAnchor, target: ISODate, rate: PublishedRate): number | undefined {
  const n = diffDays(anchor.date, target);
  let v = anchor.value;
  if (n >= 0) {
    for (let k = 1; k <= n; k++) {
      const f = uvaDailyFactor(addDays(anchor.date, k), rate);
      if (f == null) return undefined;
      v *= f;
    }
  } else {
    for (let k = 0; k > n; k--) {
      const f = uvaDailyFactor(addDays(anchor.date, k), rate);
      if (f == null) return undefined;
      v /= f;
    }
  }
  return v;
}

/** Redondeo a dos decimales, como publica el BCRA. */
export function roundUva(v: number): number {
  return Math.round(v * 100) / 100;
}
