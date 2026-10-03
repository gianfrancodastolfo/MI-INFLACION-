/**
 * Perfil de consumo del usuario y su conversión a una canasta para el motor de cálculo.
 */
import { type Basket, type IndexSeries, type Period, effectiveShares, officialBasket } from '../engine';
import { DIVISIONS, type DivisionId, RUBROS } from './categories';
import { DATASET, type Dataset, aperturaIndices, aperturaKey, divisionIndices } from './data';
import { type OwnPriceObservation, ownPriceSeries } from './ownPrice';
import { type ProvinceRegion, regionForProvince } from './regions';

export interface Profile {
  version: 1;
  provinceId: string;
  /** Solo para la provincia de Buenos Aires: true = conurbano (GBA), false = interior (Pampeana). */
  conurbano?: boolean;
  /** Monto mensual por rubro (división), cuando no se desglosa. */
  amounts: Partial<Record<DivisionId, number>>;
  /** Desglose opcional por ítem (si hay ítems con monto, el rubro es la suma de sus ítems). */
  items: Partial<Record<string, number>>;
  /** Mes al que se refieren los montos. */
  weightsPeriod: Period;
  /** Precio propio: cuánto pagaba antes por un ítem de contrato o factura (el monto actual es el del ítem). */
  ownPrices?: Partial<Record<string, OwnPriceObservation>>;
  /** Si el perfil arrancó del promedio de la región y si el usuario lo modificó. */
  origin: 'promedio' | 'manual' | 'ejemplo';
  edited: boolean;
  updatedAt: string;
}

export function emptyProfile(weightsPeriod: Period = DATASET.meta.last): Profile {
  return {
    version: 1, provinceId: '', amounts: {}, items: {}, weightsPeriod, origin: 'manual', edited: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Perfil de ejemplo, marcado como tal en la interfaz: alquila en CABA, viaja en transporte público, tiene prepaga. */
export function exampleProfile(weightsPeriod: Period = DATASET.meta.last): Profile {
  return {
    version: 1, provinceId: 'caba', weightsPeriod, origin: 'ejemplo', edited: false, updatedAt: new Date().toISOString(),
    amounts: { alimentos: 320_000, prendas: 40_000, equipamiento: 30_000, comunicacion: 40_000, restaurantes: 70_000, educacion: 0, varios: 30_000 },
    items: { alquiler: 550_000, expensas: 90_000, servicios: 60_000, prepaga: 130_000, medicamentos: 20_000, transporte_publico: 45_000, streaming: 15_000, salidas: 40_000 },
  };
}

export function profileRegion(p: Profile): ProvinceRegion | undefined {
  return regionForProvince(p.provinceId, p.conurbano);
}

/** Suma de los ítems de un rubro, o undefined si no se desglosó. */
export function itemsTotal(p: Profile, rubro: DivisionId): number | undefined {
  const r = RUBROS.find((x) => x.id === rubro);
  if (!r) return undefined;
  let total = 0;
  let any = false;
  for (const it of r.items) {
    const v = p.items[it.id];
    if (v != null && v > 0) { total += v; any = true; }
  }
  return any ? total : undefined;
}

export function rubroAmount(p: Profile, rubro: DivisionId): number {
  return itemsTotal(p, rubro) ?? p.amounts[rubro] ?? 0;
}

export function totalSpending(p: Profile): number {
  return DIVISIONS.reduce((acc, d) => acc + rubroAmount(p, d.id), 0);
}

export type Precision = 'promedio' | 'division' | 'subgrupo';

export interface ProfileBasket {
  region: ProvinceRegion;
  basket: Basket;
  indices: Record<string, IndexSeries>;
  /** División de cada categoría de la canasta (las divisiones apuntan a sí mismas). */
  parentOf: Record<string, DivisionId>;
  /** Nombre visible de cada subgrupo usado. */
  leafNames: Record<string, string>;
  /** Ítems valuados con el precio propio del usuario. */
  ownPriceItems: string[];
  precision: Precision;
  example: boolean;
  total: number;
  shares: Record<DivisionId, number>;
}

/**
 * Canasta para el motor. Con los datos actuales (divisiones) cada rubro usa el índice de su división
 * en la región del usuario. Cuando el archivo de datos traiga subgrupos, este es el lugar para usarlos.
 */
export function buildBasket(p: Profile, ds: Dataset = DATASET): ProfileBasket | undefined {
  const region = profileRegion(p);
  if (!region) return undefined;
  const ap = aperturaIndices(region, ds);
  const div = divisionIndices(region, ds);
  const own: Record<string, IndexSeries> = {};
  const ownPriceItems: string[] = [];
  const weights: Record<string, number> = {};
  const parentOf: Record<string, DivisionId> = {};
  const leafNames: Record<string, string> = {};
  const add = (key: string, parent: DivisionId, v: number) => {
    weights[key] = (weights[key] ?? 0) + v;
    parentOf[key] = parent;
  };
  let total = 0;
  let usedSubgroups = false;
  for (const r of RUBROS) {
    const detailed = itemsTotal(p, r.id) != null;
    if (!detailed) {
      const v = p.amounts[r.id] ?? 0;
      if (v > 0) { add(r.id, r.id, v); total += v; }
      continue;
    }
    // Con detalle: cada ítem usa su subgrupo de INDEC si la región lo tiene; si no, la división.
    for (const it of r.items) {
      const v = p.items[it.id] ?? 0;
      if (!(v > 0)) continue;
      total += v;
      const key = it.apertura ? aperturaKey(it.apertura) : undefined;
      const before = it.ownPrice ? p.ownPrices?.[it.id] : undefined;
      if (before) {
        const baseSeries = (key && ap[key]) || div[r.id];
        const s = baseSeries ? ownPriceSeries(baseSeries, before, { period: p.weightsPeriod, amount: v }) : undefined;
        if (s) {
          const k = `propio:${it.id}`;
          own[k] = s;
          add(k, r.id, v);
          leafNames[k] = `${it.label} (tu precio)`;
          ownPriceItems.push(it.label);
          usedSubgroups = true;
          continue;
        }
      }
      if (key && ap[key]) {
        add(key, r.id, v);
        leafNames[key] = ds.aperturaNames?.[key] ?? it.apertura!;
        usedSubgroups = true;
      } else add(r.id, r.id, v);
    }
  }
  if (total <= 0) return undefined;
  const byDivision: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) byDivision[parentOf[k]!] = (byDivision[parentOf[k]!] ?? 0) + v;
  const shares = Object.fromEntries(DIVISIONS.map((d) => [d.id, (byDivision[d.id] ?? 0) / total])) as Record<DivisionId, number>;
  return {
    region,
    basket: { weights, weightsPeriod: p.weightsPeriod },
    indices: { ...div, ...ap, ...own },
    parentOf,
    leafNames,
    ownPriceItems,
    precision: p.origin === 'promedio' && !p.edited ? 'promedio' : usedSubgroups ? 'subgrupo' : 'division',
    example: p.origin === 'ejemplo',
    total,
    shares,
  };
}

/** Canasta del IPC de la región (ponderaciones oficiales, base dic-2016). */
export function officialRegionBasket(region: ProvinceRegion, ds: Dataset = DATASET): Basket {
  return officialBasket(ds.weights[region], ds.meta.base);
}

/**
 * Participaciones del IPC de la región valuadas a precios de `at`
 * (cómo se reparte hoy el gasto de la canasta oficial).
 */
export function officialSharesAt(region: ProvinceRegion, at: Period, ds: Dataset = DATASET): Record<DivisionId, number> | undefined {
  const r = effectiveShares(officialRegionBasket(region, ds), divisionIndices(region, ds), at);
  return r.ok ? (r.value as Record<DivisionId, number>) : undefined;
}

/** Perfil inicial con la estructura promedio del IPC de la región, escalada a un gasto total. */
export function averageProfile(base: Profile, total: number, ds: Dataset = DATASET): Profile | undefined {
  const region = profileRegion(base);
  if (!region || !(total > 0)) return undefined;
  const at = ds.meta.last;
  const shares = officialSharesAt(region, at, ds);
  if (!shares) return undefined;
  const amounts: Partial<Record<DivisionId, number>> = {};
  for (const d of DIVISIONS) amounts[d.id] = Math.round((shares[d.id] ?? 0) * total);
  return { ...base, amounts, items: {}, weightsPeriod: at, origin: 'promedio', edited: false, updatedAt: new Date().toISOString() };
}

export function isProfileComplete(p: Profile | null | undefined): p is Profile {
  return !!p && !!profileRegion(p) && totalSpending(p) > 0;
}
