/**
 * Casos de uso que consume la interfaz. Unen datos oficiales, perfil y motor de cálculo.
 */
import {
  type CalcError, type DivisionComparison, type Period, type Result, calculateEquivalentSalary, calculateInflation,
  calculatePersonalInflation, calculatePurchasingPower, comparePersonalVsOfficialByDivision, comparePeriods, fail,
  formatPeriod, ok, priceFactor,
} from '../engine';
import { DIVISIONS, type DivisionId } from './categories';
import { DATASET, type Dataset, divisionIndices, getSeries } from './data';
import { type Profile, buildBasket, officialRegionBasket, type ProfileBasket } from './profile';
import type { ProvinceRegion, RegionId } from './regions';

export interface Equivalent {
  amount: number;
  from: Period;
  to: Period;
  factor: number;
  inflation: number;
  equivalent: number;
}

/** "¿Cuánto debería ganar hoy?" según el IPC (nivel general) de una región o el total nacional. */
export function officialEquivalent(amount: number, from: Period, to: Period, region: RegionId = 'nacional', ds: Dataset = DATASET): Result<Equivalent> {
  if (!(amount > 0)) return fail({ code: 'INVALID_AMOUNT', value: amount });
  const s = getSeries(region, 'nivel_general', ds);
  if (!s) return fail({ code: 'UNKNOWN_CATEGORY', category: `${region}/nivel_general` });
  const f = priceFactor(s, from, to);
  if (!f.ok) return f;
  return ok({ amount, from, to, factor: f.value, inflation: f.value - 1, equivalent: calculateEquivalentSalary(amount, f.value) });
}

export interface PersonalEquivalent extends Equivalent {
  region: ProvinceRegion;
  precision: ProfileBasket['precision'];
}

/** Mismo cálculo, con la canasta personal. */
export function personalEquivalent(amount: number, from: Period, to: Period, profile: Profile, ds: Dataset = DATASET): Result<PersonalEquivalent> {
  if (!(amount > 0)) return fail({ code: 'INVALID_AMOUNT', value: amount });
  const pb = buildBasket(profile, ds);
  if (!pb) return fail({ code: 'EMPTY_BASKET' });
  const r = calculatePersonalInflation(pb.basket, pb.indices, from, to);
  if (!r.ok) return r;
  return ok({
    amount, from, to, factor: r.value.factor, inflation: r.value.inflation,
    equivalent: calculateEquivalentSalary(amount, r.value.factor), region: pb.region, precision: pb.precision,
  });
}

export interface ProfileComparison extends DivisionComparison {
  region: ProvinceRegion;
  precision: ProfileBasket['precision'];
  leafNames: Record<string, string>;
  /** IPC nacional del mismo período, como referencia. */
  national?: number;
}

/** "¿Tu inflación fue igual a la del país?" Compara con el IPC de tu región y descompone la diferencia. */
export function compareProfile(profile: Profile, from: Period, to: Period, ds: Dataset = DATASET): Result<ProfileComparison> {
  const pb = buildBasket(profile, ds);
  if (!pb) return fail({ code: 'EMPTY_BASKET' });
  if (comparePeriods(from, to) >= 0) return fail({ code: 'INVALID_ORDER', from, to });
  const r = comparePersonalVsOfficialByDivision({
    personal: pb.basket,
    official: officialRegionBasket(pb.region, ds),
    indices: pb.indices,
    parentOf: pb.parentOf,
    from,
    to,
    publishedGeneral: getSeries(pb.region, 'nivel_general', ds),
  });
  if (!r.ok) return r;
  const nat = getSeries('nacional', 'nivel_general', ds);
  const natInfl = nat ? calculateInflation(nat, from, to) : undefined;
  return ok({ ...r.value, region: pb.region, precision: pb.precision, leafNames: pb.leafNames, national: natInfl?.ok ? natInfl.value : undefined });
}

export interface CategoryChange {
  division: DivisionId;
  inflation: number;
}

/** "¿Qué aumentó más?" Variación de cada división en la región y el período. */
export function categoryChanges(region: RegionId, from: Period, to: Period, ds: Dataset = DATASET): Result<CategoryChange[]> {
  const idx = divisionIndices(region, ds);
  const out: CategoryChange[] = [];
  for (const d of DIVISIONS) {
    const s = idx[d.id];
    if (!s) continue;
    const r = calculateInflation(s, from, to);
    if (!r.ok) return r;
    out.push({ division: d.id, inflation: r.value });
  }
  return ok(out.sort((a, b) => b.inflation - a.inflation));
}

export { calculatePurchasingPower };

/** Texto para el usuario a partir de un error del motor. */
export function describeError(e: CalcError, ds: Dataset = DATASET): string {
  switch (e.code) {
    case 'PERIOD_AFTER_END':
      return `El último dato oficial disponible corresponde a ${formatPeriod(e.last, 'long')}.`;
    case 'PERIOD_BEFORE_START':
      return `La serie oficial del IPC nacional comparable empieza en ${formatPeriod(ds.meta.first, 'long')}. Antes de esa fecha no hay un dato de INDEC equivalente.`;
    case 'MISSING_VALUE':
      return `Falta el dato oficial de ${formatPeriod(e.period, 'long')}.`;
    case 'INVALID_ORDER':
      return 'La fecha de inicio tiene que ser anterior a la de comparación.';
    case 'INVALID_AMOUNT':
      return 'Ingresá un monto mayor a cero.';
    case 'EMPTY_BASKET':
      return 'Necesitamos información adicional: cargá tu provincia y al menos un gasto.';
    case 'UNKNOWN_CATEGORY':
      return 'Necesitamos información adicional para calcular este indicador.';
    case 'INVALID_PERIOD':
      return 'La fecha no es válida.';
  }
}

export { divisionIndices };
