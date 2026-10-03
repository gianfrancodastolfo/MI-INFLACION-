/**
 * IPC de la Ciudad de Buenos Aires y de las provincias que publican índice propio.
 * Son fuentes externas a INDEC: canastas, bases y coberturas distintas. Se muestran siempre con su organismo.
 */
import raw from '../data/externos.json';
import {
  type IndexSeries, type Period, type Result, addMonths, calculateEquivalentSalary, comparePeriods, decemberOfPreviousYear, fail, ok, priceFactor,
} from '../engine';
import type { Equivalent } from './calculations';

export type ExternalId = 'caba' | 'cordoba' | 'mendoza' | 'neuquen' | 'san_luis' | 'santa_fe' | 'tucuman' | 'chaco';

export interface ExternalIndex {
  id: ExternalId;
  name: string;
  short: string;
  indicator: string;
  producer: string;
  coverage: string;
  base: string;
  url: string;
  apiIds: string[];
  start: Period;
  last: Period;
  values: Array<number | null>;
  gaps: number;
  stale?: string;
  gapNote?: string;
}

export interface ExternalCorrection {
  target: string;
  period: Period;
  sourceValue: number;
  value: number | null;
  reason: string;
  source?: string;
}

export interface ExternosDataset {
  schema: number;
  meta: {
    via: string;
    generatedAt: string;
    validation: { status: 'ok' | 'warning' | 'error'; errors: string[]; warnings: string[]; checks: Array<{ what: string; expected: number; got: number; ok: boolean }> };
    corrections: ExternalCorrection[];
  };
  indices: Record<ExternalId, ExternalIndex>;
  cabaDetalle: { start: Period; last: Period; base: string; names: Record<string, string>; series: Record<string, Array<number | null>> };
}

export const EXTERNOS = raw as unknown as ExternosDataset;
export const EXTERNAL_IDS = Object.keys(EXTERNOS.indices) as ExternalId[];

/** Provincia (id de regions.ts) → índice propio. */
const BY_PROVINCE: Record<string, ExternalId> = {
  caba: 'caba', cordoba: 'cordoba', mendoza: 'mendoza', neuquen: 'neuquen', 'san-luis': 'san_luis', 'santa-fe': 'santa_fe', tucuman: 'tucuman', chaco: 'chaco',
};

/** Jurisdicciones con índice propio que la API de Series de Tiempo no incluye (no hay serie para calcular). */
export const OTHER_PROVINCIAL_INDICES: Array<{ provinceId: string; name: string; producer: string; note: string; source: string }> = [
  { provinceId: 'rio-negro', name: 'Río Negro', producer: 'Dirección de Estadística y Censos de Río Negro', note: 'Agosto 2026: 2,1% mensual', source: 'https://eleconomista.com.ar/economia/inflacion-una-provincia-llego-23-otras-cinco-superaron-promedio-nacional-n98162' },
  { provinceId: 'jujuy', name: 'Jujuy', producer: 'Dirección Provincial de Estadística y Censos de Jujuy', note: 'Agosto 2026: 1,7% mensual', source: 'https://eleconomista.com.ar/economia/inflacion-una-provincia-llego-23-otras-cinco-superaron-promedio-nacional-n98162' },
];

export function externalForProvince(provinceId: string | undefined): ExternalIndex | undefined {
  const id = provinceId ? BY_PROVINCE[provinceId] : undefined;
  return id ? EXTERNOS.indices[id] : undefined;
}

export function externalSeries(id: ExternalId): IndexSeries {
  const ix = EXTERNOS.indices[id];
  return { start: ix.start, values: ix.values };
}

/** Sueldo equivalente con un índice provincial. */
export function externalEquivalent(amount: number, from: Period, to: Period, id: ExternalId): Result<Equivalent> {
  if (!(amount > 0)) return fail({ code: 'INVALID_AMOUNT', value: amount });
  // Si la serie tiene un hueco en el medio (Mendoza 2012-2016), no se calcula a través del hueco.
  const gap = firstGapBetween(id, from, to);
  if (gap) return fail({ code: 'MISSING_VALUE', period: gap });
  const f = priceFactor(externalSeries(id), from, to);
  if (!f.ok) return f;
  return ok({ amount, from, to, factor: f.value, inflation: f.value - 1, equivalent: calculateEquivalentSalary(amount, f.value) });
}

/** Primer mes sin dato estrictamente entre `from` y `to` (dentro del rango de la serie). */
export function firstGapBetween(id: ExternalId, from: Period, to: Period): Period | undefined {
  const ix = EXTERNOS.indices[id];
  if (!ix.gaps) return undefined;
  const a = comparePeriods(from, to) <= 0 ? from : to;
  const b = comparePeriods(from, to) <= 0 ? to : from;
  for (let p = addMonths(a, 1); comparePeriods(p, b) < 0; p = addMonths(p, 1)) {
    if (comparePeriods(p, ix.start) >= 0 && comparePeriods(p, ix.last) <= 0 && !externalHas(id, p)) return p;
  }
  return undefined;
}

/** ¿El índice tiene dato en ese mes? (Mendoza tiene un hueco 2012-2016.) */
export function externalHas(id: ExternalId, p: Period): boolean {
  const ix = EXTERNOS.indices[id];
  const k = (Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7))) - (Number(ix.start.slice(0, 4)) * 12 + Number(ix.start.slice(5, 7)));
  return k >= 0 && k < ix.values.length && ix.values[k] != null;
}

export interface ExternalSummary {
  last: Period;
  monthly?: number;
  ytd?: number;
  yoy?: number;
}

function rateBetween(s: IndexSeries, from: Period, to: Period): number | undefined {
  const f = priceFactor(s, from, to);
  return f.ok ? f.value - 1 : undefined;
}

export function externalSummary(id: ExternalId): ExternalSummary {
  const ix = EXTERNOS.indices[id];
  const s = externalSeries(id);
  return {
    last: ix.last,
    monthly: rateBetween(s, addMonths(ix.last, -1), ix.last),
    ytd: rateBetween(s, decemberOfPreviousYear(ix.last), ix.last),
    yoy: rateBetween(s, addMonths(ix.last, -12), ix.last),
  };
}

/** Inflación acumulada de cada índice entre dos meses (si los dos tienen dato). */
export function externalBetween(id: ExternalId, from: Period, to: Period): number | undefined {
  if (comparePeriods(from, to) >= 0) return undefined;
  return rateBetween(externalSeries(id), from, to);
}

export interface CabaDetailRow {
  key: string;
  name: string;
  monthly?: number;
  yoy?: number;
}

/** Divisiones y categorías del IPCBA en un mes (variación mensual e interanual). */
export function cabaDetail(period: Period = EXTERNOS.cabaDetalle.last): CabaDetailRow[] {
  const d = EXTERNOS.cabaDetalle;
  return Object.entries(d.series).map(([key, values]) => {
    const s: IndexSeries = { start: d.start, values };
    return { key, name: d.names[key] ?? key, monthly: rateBetween(s, addMonths(period, -1), period), yoy: rateBetween(s, addMonths(period, -12), period) };
  });
}

export const CABA_GROUPS = {
  divisiones: ['alimentos', 'bebidas_alcoholicas', 'prendas', 'vivienda', 'equipamiento', 'salud', 'transporte', 'informacion_comunicacion', 'recreacion', 'educacion', 'restaurantes', 'seguros_financieros', 'cuidado_personal'],
  categorias: ['estacionales', 'regulados', 'resto'],
} as const;
