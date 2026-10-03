/**
 * Precios promedio de INDEC (productos seleccionados de la canasta del IPC): cuánto aumentó un producto
 * y cómo le fue contra la inflación de su región.
 *
 * Los precios son dato oficial de INDEC. Las variaciones y la comparación con el IPC son cálculos de la app.
 * INDEC advierte que comparar precios entre regiones puede no ser válido (las variedades no son iguales):
 * acá solo se compara cada producto consigo mismo en el tiempo.
 */
import raw from '../data/precios.json';
import { type IndexSeries, type Period, addMonths, comparePeriods, maxPeriod, minPeriod, priceFactor, valueAt } from '../engine';
import { DIVISION_BY_ID, type DivisionId } from './categories';
import { getSeries } from './data';
import type { ProvinceRegion } from './regions';

export type ProductGroup = 'panificados' | 'carnes' | 'lacteos' | 'frutas_verduras' | 'almacen' | 'bebidas' | 'limpieza' | 'cuidado';

export interface PriceProduct {
  id: string;
  /** Nombre de la variedad como la publica INDEC. */
  name: string;
  /** Unidad que informa INDEC (Kg, 500 g, Docena, Bot. 1,5 litros…). */
  unit: string;
  group: ProductGroup;
  /** División del IPC que lo contiene. */
  division: DivisionId;
  /** Si INDEC lo publica también para las otras cinco regiones. */
  regional: boolean;
}

export interface PriceCorrection {
  kind: 'swap' | 'published';
  region?: ProvinceRegion;
  period?: Period;
  periods?: [Period, Period];
  series?: string[];
  months?: number;
  products?: Array<{ product: string; api: number | null; published: number }>;
  why?: string;
  source: string;
}

export interface PreciosDataset {
  schema: number;
  meta: {
    via: string;
    generatedAt: string;
    producer: string;
    title: string;
    note: string;
    last: Period;
    sources: Record<string, string>;
    corrections: PriceCorrection[];
    validation: { status: 'ok' | 'warning' | 'error'; errors: string[]; warnings: string[]; checks: number };
  };
  products: PriceProduct[];
  series: Record<ProvinceRegion, Record<string, IndexSeries>>;
}

export const PRECIOS = raw as unknown as PreciosDataset;
export const PRECIOS_LAST: Period = PRECIOS.meta.last;
export const PRECIOS_NOTE = PRECIOS.meta.note;

export const PRODUCT_GROUPS: Array<{ id: ProductGroup; name: string }> = [
  { id: 'panificados', name: 'Pan, harina, arroz y fideos' },
  { id: 'carnes', name: 'Carnes, pescado y fiambres' },
  { id: 'lacteos', name: 'Lácteos y huevos' },
  { id: 'frutas_verduras', name: 'Frutas y verduras' },
  { id: 'almacen', name: 'Almacén' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'limpieza', name: 'Limpieza' },
  { id: 'cuidado', name: 'Cuidado personal' },
];

const BY_ID = new Map(PRECIOS.products.map((p) => [p.id, p]));

export function priceProduct(id: string): PriceProduct | undefined {
  return BY_ID.get(id);
}

/** Productos que INDEC publica para la región (59 en GBA, 14 en las demás). */
export function productsFor(region: ProvinceRegion): PriceProduct[] {
  return PRECIOS.products.filter((p) => PRECIOS.series[region]?.[p.id]);
}

export function priceSeries(region: ProvinceRegion, id: string): IndexSeries | undefined {
  return PRECIOS.series[region]?.[id];
}

/** Primer y último mes con precio. */
export function priceRange(region: ProvinceRegion, id: string): { first: Period; last: Period } | undefined {
  const s = priceSeries(region, id);
  if (!s) return undefined;
  let a = 0;
  let b = s.values.length - 1;
  while (a <= b && s.values[a] == null) a++;
  while (b >= a && s.values[b] == null) b--;
  return a <= b ? { first: addMonths(s.start, a), last: addMonths(s.start, b) } : undefined;
}

export function priceAt(region: ProvinceRegion, id: string, p: Period): number | undefined {
  const s = priceSeries(region, id);
  if (!s) return undefined;
  const v = valueAt(s, p);
  return v.ok ? v.value : undefined;
}

/** "Kg" → "el kilo de pan francés"; "500 g" → "el paquete de 500 g de fideos"… para el texto del resultado. */
export function unitPhrase(p: PriceProduct): string {
  const n = p.name.toLowerCase();
  const u = p.unit;
  if (u === 'Kg') return `el kilo de ${n}`;
  if (u === 'Litro') return `el litro de ${n}`;
  if (u === 'Docena') return `la docena de ${n}`;
  if (/^Bot\./.test(u)) return `la botella de ${u.replace(/^Bot\.\s*/, '')} de ${n}`;
  if (/^Lata/.test(u)) return `la lata de ${u.replace(/^Lata\s*/, '')} de ${n}`;
  if (/^Env\./.test(u)) return `el paquete de ${u.replace(/^Env\.\s*/, '').replace(/ u$/, ' unidades')} de ${n}`;
  if (/ u$/.test(u)) return `el paquete de ${u.replace(/ u$/, ' unidades')} de ${n}`;
  if (u === '8 porciones') return `el paquete de ${n} (8 porciones)`;
  return `${n} (${u})`;
}

export interface PriceChange {
  region: ProvinceRegion;
  product: PriceProduct;
  from: Period;
  to: Period;
  priceFrom: number;
  priceTo: number;
  /** Variación del precio (tanto por uno). */
  change: number;
  /** Inflación de la región (nivel general del IPC) en el mismo período. */
  ipc?: number;
  /** (1 + variación) ÷ (1 + inflación) − 1: si subió más o menos que la inflación. */
  real?: number;
  /** IPC de la división del producto en la región. */
  division?: { id: DivisionId; name: string; change: number };
  /** El precio de `from` llevado a pesos de `to` con el IPC de la región. */
  priceFromAdjusted?: number;
}

export type PriceError = 'NO_PRODUCT' | 'NO_PRICE_FROM' | 'NO_PRICE_TO' | 'BAD_RANGE';
export type PriceResult = { ok: true; value: PriceChange } | { ok: false; error: PriceError };
const fail = (error: PriceError): PriceResult => ({ ok: false, error });

function ipcChange(region: ProvinceRegion, category: 'nivel_general' | DivisionId, from: Period, to: Period): number | undefined {
  const s = getSeries(region, category);
  if (!s) return undefined;
  const f = priceFactor(s, from, to);
  return f.ok ? f.value - 1 : undefined;
}

export function priceChange(region: ProvinceRegion, id: string, from: Period, to: Period): PriceResult {
  const product = BY_ID.get(id);
  if (!product || !priceSeries(region, id)) return fail('NO_PRODUCT');
  if (comparePeriods(from, to) >= 0) return fail('BAD_RANGE');
  const a = priceAt(region, id, from);
  if (a == null) return fail('NO_PRICE_FROM');
  const b = priceAt(region, id, to);
  if (b == null) return fail('NO_PRICE_TO');
  const change = b / a - 1;
  const ipc = ipcChange(region, 'nivel_general', from, to);
  const div = ipcChange(region, product.division, from, to);
  return { ok: true, value: {
    region, product, from, to, priceFrom: a, priceTo: b, change,
    ipc,
    real: ipc != null ? (1 + change) / (1 + ipc) - 1 : undefined,
    division: div != null ? { id: product.division, name: DIVISION_BY_ID[product.division].name, change: div } : undefined,
    priceFromAdjusted: ipc != null ? a * (1 + ipc) : undefined,
  } };
}

/** Todos los productos de la región ordenados por cuánto aumentaron entre dos meses (los que tienen precio en ambos). */
export function priceRanking(region: ProvinceRegion, from: Period, to: Period): PriceChange[] {
  return productsFor(region)
    .map((p) => priceChange(region, p.id, from, to))
    .flatMap((r) => (r.ok ? [r.value] : []))
    .sort((x, y) => y.change - x.change);
}

/** Meses válidos para elegir en la región: desde el primer precio hasta el último. */
export function regionRange(region: ProvinceRegion): { first: Period; last: Period } {
  const ps = productsFor(region).map((p) => priceRange(region, p.id)).filter(Boolean) as Array<{ first: Period; last: Period }>;
  return {
    first: ps.reduce((m, r) => minPeriod(m, r.first), ps[0]?.first ?? PRECIOS_LAST),
    last: ps.reduce((m, r) => maxPeriod(m, r.last), ps[0]?.last ?? PRECIOS_LAST),
  };
}

/** Resumen de las correcciones aplicadas a la API, para la explicación de la página. */
export function correctionsSummary(): string[] {
  const out: string[] = [];
  const pub = PRECIOS.meta.corrections.filter((c) => c.kind === 'published');
  const regional23 = pub.filter((c) => c.period && c.period >= '2023-06' && c.period <= '2023-08');
  if (regional23.length) out.push('Regiones, junio a agosto de 2023: la API trae junio y julio cruzados y repite julio en agosto. Se reemplazaron por las cifras de los informes de INDEC de esos meses.');
  if (pub.some((c) => c.period === '2025-07')) out.push('Noreste y Noroeste, julio de 2025: la API trae las dos regiones cruzadas. Se usaron las cifras del informe de INDEC.');
  if (pub.some((c) => c.region === 'gba' && c.period === '2017-03')) out.push('GBA, marzo de 2017: detergente, jabón en pan, lavandina, algodón y champú están corridos una columna en la API. Se usaron las cifras del informe de INDEC.');
  if (PRECIOS.meta.corrections.some((c) => c.kind === 'swap')) out.push('GBA, desde enero de 2026: la API trae cruzados el desodorante y el jabón de tocador. Se ordenaron como en el informe de INDEC.');
  return out;
}
