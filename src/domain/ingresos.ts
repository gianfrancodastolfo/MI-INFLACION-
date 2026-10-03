/**
 * Referencias de ingresos: índice de salarios (INDEC), RIPTE, canasta básica (INDEC, GBA),
 * salario mínimo (SMVM) y haber mínimo jubilatorio. Datos oficiales; las cuentas con tu sueldo son de la app.
 */
import raw from '../data/ingresos.json';
import { type AdultEquivalentRow, type IndexSeries, type Member, type Period, addMonths, comparePeriods, householdUnits, priceFactor, valueAt } from '../engine';
import { DATASET, getSeries } from './data';

interface MonthlySeries { start: Period; values: Array<number | null> }

export interface IngresosDataset {
  schema: number;
  meta: { via: string; generatedAt: string };
  salarios: { base: string; producer: string; series: Record<WageIndexId, MonthlySeries> };
  ripte: MonthlySeries & { producer: string; unit: string };
  canasta: { producer: string; region: string; unit: string; cba: MonthlySeries; cbt: MonthlySeries };
  smvm: MonthlySeries & { producer: string; unit: string };
  haberMinimo: MonthlySeries & { producer: string; unit: string };
}

export const INGRESOS = raw as unknown as IngresosDataset;

export type WageIndexId = 'total' | 'registrado' | 'privado_registrado' | 'publico' | 'no_registrado';

export const WAGE_INDEX_NAMES: Record<WageIndexId, string> = {
  total: 'Total (registrados y no registrados)',
  registrado: 'Registrados (privados y públicos)',
  privado_registrado: 'Privados registrados',
  publico: 'Sector público',
  no_registrado: 'No registrados',
};

export const WAGE_INDEX_SHORT: Record<WageIndexId, string> = {
  total: 'Total', registrado: 'Registrados', privado_registrado: 'Privados registrados', publico: 'Públicos', no_registrado: 'No registrados',
};

function lastOf(s: MonthlySeries): Period {
  let k = s.values.length - 1;
  while (k > 0 && s.values[k] == null) k--;
  return addMonths(s.start, k);
}

export function valueOf(s: MonthlySeries, p: Period): number | undefined {
  const k = (Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7))) - (Number(s.start.slice(0, 4)) * 12 + Number(s.start.slice(5, 7)));
  const v = k >= 0 && k < s.values.length ? s.values[k] : null;
  return v != null && v > 0 ? v : undefined;
}

export function wageIndex(id: WageIndexId): IndexSeries {
  return INGRESOS.salarios.series[id];
}

export const WAGE_LAST: Period = lastOf(INGRESOS.salarios.series.total);
export const WAGE_FIRST: Period = INGRESOS.salarios.series.total.start;

export interface RaiseComparison {
  from: Period;
  to: Period;
  /** Aumento de tu sueldo (tanto por uno). */
  mine: number;
  /** Aumento del índice de salarios en el mismo período. */
  index: number;
  /** (1 + tuyo) ÷ (1 + índice) − 1: cuánto mejor o peor quedaste respecto del promedio. */
  relative: number;
}

/** "¿Le ganaste al promedio?": tu aumento contra el del índice de salarios, en los mismos meses. */
export function compareRaise(salaryFrom: number, salaryTo: number, from: Period, to: Period, id: WageIndexId): RaiseComparison | undefined {
  if (!(salaryFrom > 0) || !(salaryTo > 0) || comparePeriods(from, to) >= 0) return undefined;
  const f = priceFactor(wageIndex(id), from, to);
  if (!f.ok) return undefined;
  const mine = salaryTo / salaryFrom - 1;
  return { from, to, mine, index: f.value - 1, relative: (1 + mine) / f.value - 1 };
}

// ---------------------------------------------------------------------------
// Canasta básica (INDEC, Gran Buenos Aires)
// ---------------------------------------------------------------------------

/** Cuadro 4 del informe de canasta de INDEC: unidades de adulto equivalente por sexo y edad. */
export const ADULT_EQUIVALENT_TABLE: AdultEquivalentRow[] = [
  { desde: 0, hasta: 0, mujer: 0.35, varon: 0.35 },
  { desde: 1, hasta: 1, mujer: 0.37, varon: 0.37 },
  { desde: 2, hasta: 2, mujer: 0.46, varon: 0.46 },
  { desde: 3, hasta: 3, mujer: 0.51, varon: 0.51 },
  { desde: 4, hasta: 4, mujer: 0.55, varon: 0.55 },
  { desde: 5, hasta: 5, mujer: 0.6, varon: 0.6 },
  { desde: 6, hasta: 6, mujer: 0.64, varon: 0.64 },
  { desde: 7, hasta: 7, mujer: 0.66, varon: 0.66 },
  { desde: 8, hasta: 8, mujer: 0.68, varon: 0.68 },
  { desde: 9, hasta: 9, mujer: 0.69, varon: 0.69 },
  { desde: 10, hasta: 10, mujer: 0.7, varon: 0.79 },
  { desde: 11, hasta: 11, mujer: 0.72, varon: 0.82 },
  { desde: 12, hasta: 12, mujer: 0.74, varon: 0.85 },
  { desde: 13, hasta: 13, mujer: 0.76, varon: 0.9 },
  { desde: 14, hasta: 14, mujer: 0.76, varon: 0.96 },
  { desde: 15, hasta: 15, mujer: 0.77, varon: 1.0 },
  { desde: 16, hasta: 16, mujer: 0.77, varon: 1.03 },
  { desde: 17, hasta: 17, mujer: 0.77, varon: 1.04 },
  { desde: 18, hasta: 29, mujer: 0.76, varon: 1.02 },
  { desde: 30, hasta: 45, mujer: 0.77, varon: 1.0 },
  { desde: 46, hasta: 60, mujer: 0.76, varon: 1.0 },
  { desde: 61, hasta: 75, mujer: 0.67, varon: 0.83 },
  { desde: 76, hasta: null, mujer: 0.63, varon: 0.74 },
];

export const ADULT_EQUIVALENT_SOURCE = 'https://www.indec.gob.ar/uploads/informesdeprensa/canasta_07_26F3FFC1D5EC.pdf';

/** Hogares tipo que usa INDEC en sus informes (para validar y como atajo). */
export const HOGARES_TIPO: Array<{ id: string; label: string; members: Member[]; units: number }> = [
  { id: 'h1', label: 'Mujer de 35, hijo de 18 y madre de 61', members: [{ sexo: 'mujer', edad: 35 }, { sexo: 'varon', edad: 18 }, { sexo: 'mujer', edad: 61 }], units: 2.46 },
  { id: 'h2', label: 'Pareja de 35 y 31 con hijos de 6 y 8', members: [{ sexo: 'varon', edad: 35 }, { sexo: 'mujer', edad: 31 }, { sexo: 'varon', edad: 6 }, { sexo: 'mujer', edad: 8 }], units: 3.09 },
  { id: 'h3', label: 'Pareja de 30 con hijos de 5, 3 y 1', members: [{ sexo: 'varon', edad: 30 }, { sexo: 'mujer', edad: 30 }, { sexo: 'varon', edad: 5 }, { sexo: 'mujer', edad: 3 }, { sexo: 'varon', edad: 1 }], units: 3.25 },
];

export const CANASTA_LAST: Period = lastOf(INGRESOS.canasta.cbt);

export interface HouseholdCanasta {
  period: Period;
  units: number;
  cba: number;
  cbt: number;
}

/** Canasta básica total y alimentaria de un hogar en un mes. */
export function householdCanasta(members: Member[], period: Period = CANASTA_LAST): HouseholdCanasta | undefined {
  const units = householdUnits(members, ADULT_EQUIVALENT_TABLE);
  const cba = valueOf(INGRESOS.canasta.cba, period);
  const cbt = valueOf(INGRESOS.canasta.cbt, period);
  if (units == null || !(units > 0) || cba == null || cbt == null) return undefined;
  return { period, units, cba: cba * units, cbt: cbt * units };
}

// ---------------------------------------------------------------------------
// Salario mínimo y jubilación mínima
// ---------------------------------------------------------------------------

export const SMVM_LAST: Period = lastOf(INGRESOS.smvm);
export const HABER_MINIMO_LAST: Period = lastOf(INGRESOS.haberMinimo);

export function smvmAt(p: Period): number | undefined {
  return valueOf(INGRESOS.smvm, p);
}

export function haberMinimoAt(p: Period): number | undefined {
  return valueOf(INGRESOS.haberMinimo, p);
}

export function ripteAt(p: Period): number | undefined {
  return valueOf(INGRESOS.ripte, p);
}

// ---------------------------------------------------------------------------
// Movilidad jubilatoria (DNU 274/2024)
// ---------------------------------------------------------------------------
const NG = getSeries('nacional', 'nivel_general', DATASET)!;

/** Variación del IPC nacional del mes, en %, con dos decimales (la que usa la movilidad). */
export function ipcRate2(p: Period): number | undefined {
  const a = valueAt(NG, addMonths(p, -1));
  const b = valueAt(NG, p);
  return a.ok && b.ok ? Math.round(((b.value / a.value - 1) * 100 + 1e-9) * 100) / 100 : undefined;
}

type HaberAt = (p: Period) => number | undefined;

/** Desde cuándo rige la movilidad mensual por IPC. */
export const HABER_RULE_FROM: Period = '2024-05';

/**
 * Haber mínimo de un mes con la regla de movilidad: el del mes anterior por (1 + IPC nacional de dos meses antes,
 * con dos decimales), redondeado al centavo. Reproduce al centavo la serie oficial desde mayo de 2024.
 */
export function haberMinimoByRule(p: Period, at: HaberAt = haberMinimoAt): { amount: number; rate: number; ipcPeriod: Period } | undefined {
  const prev = at(addMonths(p, -1));
  const ipcPeriod = addMonths(p, -2);
  const rate = ipcRate2(ipcPeriod);
  if (prev == null || rate == null) return undefined;
  return { amount: Math.round(prev * (1 + rate / 100) * 100) / 100, rate, ipcPeriod };
}

/** Si la regla da al centavo el dato oficial de ese mes. */
export function haberRuleMatches(p: Period, at: HaberAt = haberMinimoAt): boolean {
  const r = haberMinimoByRule(p, at);
  const official = at(p);
  return r != null && official != null && Math.abs(r.amount - Math.round(official * 100) / 100) <= 0.005;
}

/**
 * Mes siguiente al último dato oficial, calculado con la regla. Solo si la regla da el último dato oficial:
 * si cambia la ley o hay un aumento extraordinario, no se calcula y la app muestra el dato oficial.
 */
export function nextHaberMinimo(last: Period, at: HaberAt = haberMinimoAt): { period: Period; amount: number; rate: number; ipcPeriod: Period } | undefined {
  if (!haberRuleMatches(last, at)) return undefined;
  const period = addMonths(last, 1);
  const r = haberMinimoByRule(period, at);
  return r ? { period, ...r } : undefined;
}

export const HABER_MINIMO_NEXT = nextHaberMinimo(HABER_MINIMO_LAST);

/** Meses publicados desde mayo de 2024 en los que la regla no da el dato oficial (para el texto de la página). */
export const HABER_RULE_MISSES: Period[] = (() => {
  const out: Period[] = [];
  for (let p = HABER_RULE_FROM; comparePeriods(p, HABER_MINIMO_LAST) <= 0; p = addMonths(p, 1)) if (!haberRuleMatches(p)) out.push(p);
  return out;
})();

/** Bono previsional para la jubilación mínima: último decreto publicado. */
export const BONO_PREVISIONAL = {
  amount: 70_000,
  period: '2026-10' as Period,
  norma: 'Decreto 1108/2026 (Boletín Oficial del 28/9/2026)',
  note: 'El bono previsional se paga aparte del haber mínimo y es fijo: no se actualiza con la inflación. El de octubre de 2026 lo fijó el Decreto 1108/2026 (Boletín Oficial del 28/9/2026).',
  source: 'https://www.iprofesional.com/economia/465374-anses-pagara-un-bono-de-hasta-70000-en-octubre-quienes-lo-cobran',
};

/** Bono del mes, solo si ya hay decreto para ese mes (no se supone que se repite). */
export function bonoFor(p: Period): number | undefined {
  return p === BONO_PREVISIONAL.period ? BONO_PREVISIONAL.amount : undefined;
}

export const SMVM_NORMA = { name: 'Resolución 4/2026 del Consejo del Salario', source: 'https://chequeado.com/el-explicador/el-salario-minimo-sera-de-383-800-en-septiembre-de-2026-y-acumula-una-caida-real-del-397-desde-noviembre-de-2023/' };
