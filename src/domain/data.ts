/**
 * Acceso tipado al archivo de datos oficiales generado por el proceso de actualización (scripts/etl).
 */
import raw from '../data/ipc.json';
import { type IndexSeries, type Period, addMonths, comparePeriods } from '../engine';
import type { DivisionId } from './categories';
import type { ProvinceRegion, RegionId } from './regions';

export type SeriesCategory = 'nivel_general' | DivisionId | 'nucleo' | 'regulados' | 'estacionales' | 'bienes' | 'servicios';

export interface DatasetCorrection {
  region: string;
  category: string;
  period: Period;
  sourceValue: number;
  value: number;
  reason: string;
}

export interface Dataset {
  schema: number;
  meta: {
    indicator: string;
    title: string;
    producer: string;
    basket: string;
    via: string;
    url: string;
    base: Period;
    first: Period;
    last: Period;
    generatedAt: string;
    corrections: DatasetCorrection[];
    validation: { status: 'ok' | 'warning' | 'error'; errors: string[]; warnings: string[] };
  };
  regions: RegionId[];
  categories: SeriesCategory[];
  /** Ponderaciones oficiales (%) por región, base dic-2016. */
  weights: Record<ProvinceRegion, Record<DivisionId, number>>;
  regionShares: Record<ProvinceRegion, number>;
  series: Record<RegionId, Partial<Record<SeriesCategory, Array<number | null>>>>;
  /** Subgrupos por región (opcional: solo si el proceso de datos los incorporó desde INDEC). */
  aperturas?: Partial<Record<RegionId, Record<string, Array<number | null>>>>;
  aperturaNames?: Record<string, string>;
  aperturaParent?: Record<string, DivisionId>;
}

export const DATASET = raw as unknown as Dataset;

/** Misma clave que genera el proceso de datos (scripts/etl/lib.mjs → aperturaKey). */
export function aperturaKey(name: string): string {
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `apertura:${n.replace(/ /g, '_')}`;
}

/** Índices de subgrupos disponibles en una región (vacío si el archivo no los trae). */
export function aperturaIndices(region: RegionId, ds: Dataset = DATASET): Record<string, IndexSeries> {
  const out: Record<string, IndexSeries> = {};
  for (const [k, values] of Object.entries(ds.aperturas?.[region] ?? {})) out[k] = { start: ds.meta.first, values };
  return out;
}

export function hasAperturas(ds: Dataset = DATASET): boolean {
  return !!ds.aperturas && Object.keys(ds.aperturas).length > 0;
}

export const FIRST_PERIOD: Period = DATASET.meta.first;
export const LAST_PERIOD: Period = DATASET.meta.last;

export function getSeries(region: RegionId, category: SeriesCategory, ds: Dataset = DATASET): IndexSeries | undefined {
  const values = ds.series[region]?.[category];
  return values ? { start: ds.meta.first, values } : undefined;
}

/** Índices de las 12 divisiones de una región, en el formato que espera el motor. */
export function divisionIndices(region: RegionId, ds: Dataset = DATASET): Record<string, IndexSeries> {
  const out: Record<string, IndexSeries> = {};
  for (const [cat, values] of Object.entries(ds.series[region] ?? {})) {
    if (cat === 'nivel_general' || !values) continue;
    out[cat] = { start: ds.meta.first, values };
  }
  return out;
}

export function isAvailable(p: Period, ds: Dataset = DATASET): boolean {
  return comparePeriods(p, ds.meta.first) >= 0 && comparePeriods(p, ds.meta.last) <= 0;
}

/** Ajusta un período al rango con datos e indica si hubo que moverlo. */
export function clampToAvailable(p: Period, ds: Dataset = DATASET): { period: Period; clamped: 'before' | 'after' | null } {
  if (comparePeriods(p, ds.meta.first) < 0) return { period: ds.meta.first, clamped: 'before' };
  if (comparePeriods(p, ds.meta.last) > 0) return { period: ds.meta.last, clamped: 'after' };
  return { period: p, clamped: null };
}

/** Lista de meses disponibles, del más reciente al más antiguo (para selectores). */
export function availablePeriodsDesc(ds: Dataset = DATASET): Period[] {
  const out: Period[] = [];
  for (let p = ds.meta.last; comparePeriods(p, ds.meta.first) >= 0; p = addMonths(p, -1)) out.push(p);
  return out;
}
