/**
 * Calculadora de alquiler: une el motor (src/engine/rent.ts) con los datos oficiales.
 * IPC: variaciones mensuales publicadas por INDEC (nacional, un decimal), multiplicadas.
 * ICL: valores diarios oficiales del BCRA.
 */
import { type ISODate, type Period, type RentIclUpdate, type RentIpcUpdate, addMonths, rentScheduleIcl, rentScheduleIpc } from '../engine';
import { ICL_LAST, iclAt, ipcPublishedRate } from './bcra';
import { LAST_PERIOD } from './data';

export type RentIndex = 'ipc' | 'icl';

export const RENT_FREQUENCIES = [
  { value: 3, label: 'Cada 3 meses' },
  { value: 4, label: 'Cada 4 meses' },
  { value: 6, label: 'Cada 6 meses' },
  { value: 12, label: 'Cada 12 meses' },
] as const;

export function rentIpc(amount: number, start: Period, every: number, lag = 2, until: Period = addMonths(LAST_PERIOD, 3)): RentIpcUpdate[] {
  return rentScheduleIpc({ amount, start, every, lag, until, rate: ipcPublishedRate });
}

export function rentIcl(amount: number, startDate: ISODate, every: number, until: ISODate): RentIclUpdate[] {
  return rentScheduleIcl({ amount, startDate, every, until, icl: iclAt });
}

/** Mes en que se publica el IPC de `p` (INDEC lo difunde a mediados del mes siguiente). */
export function ipcPublishedIn(p: Period): Period {
  return addMonths(p, 1);
}

export { ICL_LAST };
