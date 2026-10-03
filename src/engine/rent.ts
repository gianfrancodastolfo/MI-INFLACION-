/**
 * Actualización de alquileres.
 *
 * IPC (práctica habitual desde el DNU 70/2023): en cada ajuste se multiplican las variaciones mensuales
 * publicadas de los últimos N meses disponibles. Con un rezago de 2 meses, un ajuste cuatrimestral de agosto
 * usa marzo, abril, mayo y junio (el último IPC publicado al 1° de agosto es el de junio).
 *
 * ICL (Ley 27.551): factor = ICL del día del ajuste ÷ ICL del día del ajuste anterior (o del inicio).
 */
import { type ISODate, addMonthsISO } from './dates';
import { type Period, addMonths, comparePeriods } from './period';
import type { PublishedRate } from './uva';

export interface RentIpcInput {
  /** Alquiler inicial. */
  amount: number;
  /** Mes de inicio del contrato. */
  start: Period;
  /** Cada cuántos meses se ajusta (3, 4, 6, 12…). */
  every: number;
  /** Meses entre el último IPC usado y el mes del ajuste (2 = el último publicado al día 1). */
  lag: number;
  /** Hasta qué mes mostrar ajustes (por ejemplo, el fin del contrato). */
  until: Period;
  rate: PublishedRate;
}

export interface RentIpcUpdate {
  /** Mes desde el que rige el nuevo monto. */
  at: Period;
  /** Meses de IPC que se multiplican. */
  months: Period[];
  /** Variación publicada de cada mes (%), en el mismo orden. */
  rates: Array<number | undefined>;
  status: 'ok' | 'pendiente';
  /** Primer mes sin dato publicado (si está pendiente). */
  missing?: Period;
  factor?: number;
  amount?: number;
}

export function rentScheduleIpc(input: RentIpcInput): RentIpcUpdate[] {
  const { amount, start, every, lag, until, rate } = input;
  if (!(amount > 0) || !(every >= 1) || lag < 0) return [];
  const out: RentIpcUpdate[] = [];
  let current: number | undefined = amount;
  for (let k = 1; k <= 60; k++) {
    const at = addMonths(start, k * every);
    if (comparePeriods(at, until) > 0) break;
    const last = addMonths(at, -lag);
    const months = Array.from({ length: every }, (_, j) => addMonths(last, j - every + 1));
    const rates = months.map((p) => rate(p));
    const missingIdx = rates.findIndex((r) => r == null);
    if (missingIdx >= 0 || current == null) {
      out.push({ at, months, rates, status: 'pendiente', missing: missingIdx >= 0 ? months[missingIdx] : undefined });
      current = undefined;
      continue;
    }
    const factor = rates.reduce<number>((f, r) => f * (1 + (r as number) / 100), 1);
    current *= factor;
    out.push({ at, months, rates, status: 'ok', factor, amount: current });
  }
  return out;
}

export interface RentIclInput {
  amount: number;
  startDate: ISODate;
  every: number;
  /** Hasta qué fecha mostrar ajustes. */
  until: ISODate;
  icl: (date: ISODate) => number | undefined;
}

export interface RentIclUpdate {
  date: ISODate;
  from: ISODate;
  iclFrom?: number;
  iclTo?: number;
  status: 'ok' | 'pendiente';
  factor?: number;
  amount?: number;
}

export function rentScheduleIcl(input: RentIclInput): RentIclUpdate[] {
  const { amount, startDate, every, until, icl } = input;
  if (!(amount > 0) || !(every >= 1)) return [];
  const out: RentIclUpdate[] = [];
  let current: number | undefined = amount;
  let prev = startDate;
  for (let k = 1; k <= 60; k++) {
    const date = addMonthsISO(startDate, k * every);
    if (date > until) break;
    const a = icl(prev);
    const b = icl(date);
    if (a == null || b == null || current == null) {
      out.push({ date, from: prev, iclFrom: a, iclTo: b, status: 'pendiente' });
      current = undefined;
    } else {
      const factor = b / a;
      current *= factor;
      out.push({ date, from: prev, iclFrom: a, iclTo: b, status: 'ok', factor, amount: current });
    }
    prev = date;
  }
  return out;
}
