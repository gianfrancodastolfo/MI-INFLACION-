/**
 * Coeficientes del BCRA: ICL (alquileres, Ley 27.551) y UVA (créditos).
 * El ICL son los valores diarios oficiales. La UVA se reconstruye día por día con la regla del BCRA
 * a partir de un valor oficial; la regla reproduce todos los valores publicados desde 2017.
 */
import raw from '../data/bcra.json';
import {
  type ISODate, type Period, type UvaAnchor, diffDays, roundUva, uvaFromAnchor, uvaLastComputableDate,
} from '../engine';
import { DATASET, LAST_PERIOD, getSeries } from './data';

export interface BcraDataset {
  schema: number;
  meta: { via: string; generatedAt: string; icl: string; uva: string };
  icl: { producer: string; base: string; start: ISODate; last: ISODate; values: number[] };
  uva: {
    producer: string;
    base: string;
    finDeMes: { start: Period; values: Array<number | null> };
    anchor: UvaAnchor;
    rule: string;
    validation: { checked: number; misses: string[] } | null;
  };
}

export const BCRA = raw as unknown as BcraDataset;

export const ICL_FIRST: ISODate = BCRA.icl.start;
export const ICL_LAST: ISODate = BCRA.icl.last;

/** ICL oficial de un día (base 30/6/2020 = 1). */
export function iclAt(date: ISODate): number | undefined {
  const k = diffDays(BCRA.icl.start, date);
  const v = k >= 0 && k < BCRA.icl.values.length ? BCRA.icl.values[k] : undefined;
  return v != null && v > 0 ? v : undefined;
}

// ---------------------------------------------------------------------------
// IPC con la variación mensual tal como la publica INDEC (un decimal)
// ---------------------------------------------------------------------------
const NG = getSeries('nacional', 'nivel_general', DATASET)!;
const RATE_CACHE = new Map<Period, number | undefined>();

/** Variación mensual del IPC nacional publicada por INDEC (en %, un decimal). */
export function ipcPublishedRate(p: Period): number | undefined {
  if (RATE_CACHE.has(p)) return RATE_CACHE.get(p);
  const y = Number(p.slice(0, 4));
  const m = Number(p.slice(5, 7));
  const k = y * 12 + m - (Number(NG.start.slice(0, 4)) * 12 + Number(NG.start.slice(5, 7)));
  const a = k >= 1 ? NG.values[k - 1] : null;
  const b = k >= 0 && k < NG.values.length ? NG.values[k] : null;
  const r = a && b ? Math.round(((b / a - 1) * 100 + 1e-7) * 10) / 10 : undefined;
  RATE_CACHE.set(p, r);
  return r;
}

// ---------------------------------------------------------------------------
// UVA
// ---------------------------------------------------------------------------
/** Desde cuándo se puede reconstruir día por día con el IPC nacional (antes, solo fin de mes). */
export const UVA_DAILY_FIRST: ISODate = '2017-03-01';
export const UVA_LAST: ISODate = uvaLastComputableDate(LAST_PERIOD);

const UVA_CACHE = new Map<ISODate, number | undefined>();

/** UVA de un día. Usa el valor oficial más cercano (ancla) y la regla del BCRA. */
export function uvaAt(date: ISODate): number | undefined {
  if (date < UVA_DAILY_FIRST || date > UVA_LAST) return undefined;
  if (UVA_CACHE.has(date)) return UVA_CACHE.get(date);
  // Para no recorrer años, se arranca desde el día cacheado más cercano al ancla.
  const v = uvaFromAnchor(BCRA.uva.anchor, date, ipcPublishedRate);
  const out = v == null ? undefined : roundUva(v);
  UVA_CACHE.set(date, out);
  return out;
}

/** Serie mensual de la UVA en un día fijo de cada mes (para gráficos y cuotas). */
export function uvaMonthly(from: Period, to: Period, day: number): Array<{ period: Period; date: ISODate; value: number | undefined }> {
  const out: Array<{ period: Period; date: ISODate; value: number | undefined }> = [];
  let p = from;
  for (let guard = 0; guard < 400 && p <= to; guard++) {
    const dim = new Date(Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)), 0)).getUTCDate();
    const date = `${p}-${String(Math.min(day, dim)).padStart(2, '0')}`;
    out.push({ period: p, date, value: uvaAt(date) });
    const y = Number(p.slice(0, 4));
    const m = Number(p.slice(5, 7));
    p = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return out;
}

/** Valor de la UVA "hoy" (o el último calculable) para mostrar como referencia. */
export function uvaToday(today: ISODate): { date: ISODate; value: number | undefined } {
  const date = today > UVA_LAST ? UVA_LAST : today < UVA_DAILY_FIRST ? UVA_DAILY_FIRST : today;
  return { date, value: uvaAt(date) };
}
