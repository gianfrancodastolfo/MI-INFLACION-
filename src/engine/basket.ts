/**
 * Inflación personal = costo de una canasta fija (tus participaciones de gasto)
 * valuada con los índices oficiales de cada categoría.
 *
 * Fórmula (índice de canasta fija tipo Lowe, la misma familia que usa el IPC):
 *
 *   C(t) = Σ_i s_i · I_i(t) / I_i(b)
 *
 *   s_i  = participación de la categoría i en tu gasto, observada en el período b
 *   I_i  = índice oficial de la categoría i (INDEC, por región)
 *   b    = período al que se refieren tus montos ("weightsPeriod")
 *
 * Inflación personal entre t0 y t1:  C(t1) / C(t0) - 1.
 *
 * Por qué importa `b`: si cargás tus gastos de HOY, esas participaciones ya incluyen
 * las subas pasadas. Valuarlas como si fueran del inicio sobrepondera lo que más subió.
 * Con esta fórmula, si b = t1, el resultado es la media armónica ponderada de las
 * variaciones (canasta actual valuada a precios del pasado), y si b = t0 es la media
 * aritmética (Laspeyres). Ambas miden la misma canasta: son consistentes.
 */
import { type Period, comparePeriods, periodRange } from './period';
import { type IndexSeries, type Result, fail, ok, valueAt } from './series';

export type Weights = Readonly<Record<string, number>>;
export type IndexSet = Readonly<Record<string, IndexSeries>>;

export interface Basket {
  /** Montos (en pesos) o participaciones por categoría. Se normalizan a 1. */
  weights: Weights;
  /** Período al que corresponden esos montos. */
  weightsPeriod: Period;
}

/** Normaliza montos/participaciones a participaciones que suman 1 (descarta ceros). */
export function normalizeWeights(w: Weights): Result<Record<string, number>> {
  let total = 0;
  for (const [, v] of Object.entries(w)) {
    if (!Number.isFinite(v) || v < 0) return fail({ code: 'INVALID_AMOUNT', value: v });
    total += v;
  }
  if (total <= 0) return fail({ code: 'EMPTY_BASKET' });
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(w)) if (v > 0) out[k] = v / total;
  return ok(out);
}

function relative(indices: IndexSet, category: string, t: Period, b: Period): Result<number> {
  const s = indices[category];
  if (!s) return fail({ code: 'UNKNOWN_CATEGORY', category });
  const at = valueAt(s, t, category);
  if (!at.ok) return at;
  const base = valueAt(s, b, category);
  if (!base.ok) return base;
  return ok(at.value / base.value);
}

/** C(t): costo de la canasta en t relativo a su período de referencia (C(b) = 1). */
export function basketCost(basket: Basket, indices: IndexSet, t: Period): Result<number> {
  const shares = normalizeWeights(basket.weights);
  if (!shares.ok) return shares;
  let c = 0;
  for (const [cat, s] of Object.entries(shares.value)) {
    const r = relative(indices, cat, t, basket.weightsPeriod);
    if (!r.ok) return r;
    c += s * r.value;
  }
  return ok(c);
}

/** Factor de la canasta entre dos períodos: C(to) / C(from). */
export function basketFactor(basket: Basket, indices: IndexSet, from: Period, to: Period): Result<number> {
  const a = basketCost(basket, indices, from);
  if (!a.ok) return a;
  const b = basketCost(basket, indices, to);
  if (!b.ok) return b;
  return ok(b.value / a.value);
}

export interface PersonalInflation {
  factor: number;
  inflation: number;
}

export function calculatePersonalInflation(
  basket: Basket,
  indices: IndexSet,
  from: Period,
  to: Period,
): Result<PersonalInflation> {
  const f = basketFactor(basket, indices, from, to);
  if (!f.ok) return f;
  return ok({ factor: f.value, inflation: f.value - 1 });
}

/** Participaciones de la misma canasta valuada a precios de `at` (cantidades fijas). */
export function effectiveShares(basket: Basket, indices: IndexSet, at: Period): Result<Record<string, number>> {
  const shares = normalizeWeights(basket.weights);
  if (!shares.ok) return shares;
  const raw: Record<string, number> = {};
  let total = 0;
  for (const [cat, s] of Object.entries(shares.value)) {
    const r = relative(indices, cat, at, basket.weightsPeriod);
    if (!r.ok) return r;
    raw[cat] = s * r.value;
    total += raw[cat]!;
  }
  for (const k of Object.keys(raw)) raw[k] = raw[k]! / total;
  return ok(raw);
}

export interface IndexPoint {
  period: Period;
  value: number;
}

/** Índice personal mensual, normalizado a 100 en `baseAt`. */
export function personalIndexSeries(
  basket: Basket,
  indices: IndexSet,
  from: Period,
  to: Period,
  baseAt: Period = from,
): Result<IndexPoint[]> {
  if (comparePeriods(from, to) > 0) return fail({ code: 'INVALID_ORDER', from, to });
  const base = basketCost(basket, indices, baseAt);
  if (!base.ok) return base;
  const out: IndexPoint[] = [];
  for (const p of periodRange(from, to)) {
    const c = basketCost(basket, indices, p);
    if (!c.ok) return c;
    out.push({ period: p, value: (c.value / base.value) * 100 });
  }
  return ok(out);
}

/**
 * El IPC oficial expresado como canasta: ponderaciones publicadas por INDEC,
 * que están valuadas a precios de dic-2016 (período base del índice).
 */
export function officialBasket(weights: Weights, basePeriod: Period = '2016-12'): Basket {
  return { weights, weightsPeriod: basePeriod };
}

export interface CategoryContribution {
  category: string;
  /** Participación efectiva de la categoría en tu canasta al inicio del período. */
  personalShare: number;
  /** Participación efectiva en la canasta del IPC al inicio del período. */
  officialShare: number;
  /** Variación de precios de la categoría en el período. */
  categoryInflation: number;
  /** Aporte a la diferencia (tanto por uno; ×100 = puntos porcentuales). */
  contribution: number;
}

export interface Comparison {
  from: Period;
  to: Period;
  personal: PersonalInflation;
  /** IPC reconstruido con las mismas categorías y las ponderaciones oficiales. */
  official: PersonalInflation;
  /** IPC publicado (nivel general), si se informó la serie. */
  published?: PersonalInflation;
  /** personal - oficial reconstruido (tanto por uno). Igual a la suma de contribuciones. */
  gap: number;
  /** oficial reconstruido - publicado: efecto del redondeo de ponderaciones. */
  adjustment?: number;
  contributions: CategoryContribution[];
}

export interface CompareInput {
  personal: Basket;
  official: Basket;
  indices: IndexSet;
  from: Period;
  to: Period;
  publishedGeneral?: IndexSeries;
}

/**
 * Compara tu inflación con la del IPC y descompone la diferencia por categoría:
 *
 *   F_p - F_o = Σ_i (p_i - o_i) · (R_i - F_o)
 *
 *   R_i = I_i(t1)/I_i(t0); p_i y o_i = participaciones efectivas en t0.
 *
 * Es una identidad exacta: una categoría aporta a que tu inflación sea mayor si pesa más
 * en tu gasto que en el IPC y además subió más que el promedio (o si pesa menos y subió menos).
 */
export function comparePersonalVsOfficialInflation(input: CompareInput): Result<Comparison> {
  const { personal, official, indices, from, to, publishedGeneral } = input;
  const p = effectiveShares(personal, indices, from);
  if (!p.ok) return p;
  const o = effectiveShares(official, indices, from);
  if (!o.ok) return o;

  const categories = Array.from(new Set([...Object.keys(p.value), ...Object.keys(o.value)]));
  const rel: Record<string, number> = {};
  for (const cat of categories) {
    const r = relative(indices, cat, to, from);
    if (!r.ok) return r;
    rel[cat] = r.value;
  }

  let fp = 0;
  let fo = 0;
  for (const cat of categories) {
    fp += (p.value[cat] ?? 0) * rel[cat]!;
    fo += (o.value[cat] ?? 0) * rel[cat]!;
  }

  const contributions: CategoryContribution[] = categories.map((cat) => {
    const ps = p.value[cat] ?? 0;
    const os = o.value[cat] ?? 0;
    return {
      category: cat,
      personalShare: ps,
      officialShare: os,
      categoryInflation: rel[cat]! - 1,
      contribution: (ps - os) * (rel[cat]! - fo),
    };
  });
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const result: Comparison = {
    from,
    to,
    personal: { factor: fp, inflation: fp - 1 },
    official: { factor: fo, inflation: fo - 1 },
    gap: fp - fo,
    contributions,
  };

  if (publishedGeneral) {
    const a = valueAt(publishedGeneral, from);
    const b = valueAt(publishedGeneral, to);
    if (a.ok && b.ok) {
      const f = b.value / a.value;
      result.published = { factor: f, inflation: f - 1 };
      result.adjustment = fo - f;
    }
  }
  return ok(result);
}

export interface DivisionContribution extends CategoryContribution {
  /** (P_d − O_d) · (R_d − F_o): por pesar distinto que en el IPC. */
  weightEffect: number;
  /** P_d · (R_d^personal − R_d): por la composición de tu gasto dentro de la división (subgrupos). */
  mixEffect: number;
  /** Variación de tu propia mezcla dentro de la división. */
  personalCategoryInflation: number;
  /** Subgrupos de tu canasta dentro de la división, con su participación efectiva y variación. */
  leaves: Array<{ category: string; share: number; inflation: number }>;
}

export interface DivisionComparison extends Omit<Comparison, 'contributions'> {
  contributions: DivisionContribution[];
}

/**
 * Descomposición en dos niveles, para canastas personales con subgrupos ("aperturas").
 * La canasta personal puede tener categorías hoja (subgrupos o divisiones); `parentOf` asigna cada hoja a su división.
 * La canasta oficial está en divisiones. Identidad exacta:
 *
 *   F_p − F_o = Σ_d (P_d − O_d)(R_d − F_o)  +  Σ_d P_d (R_dᵖ − R_d)
 *               └──── efecto peso ────┘       └── efecto composición ──┘
 *
 * Sin subgrupos, el efecto composición es cero y coincide con comparePersonalVsOfficialInflation.
 */
export function comparePersonalVsOfficialByDivision(
  input: CompareInput & { parentOf: Readonly<Record<string, string>> },
): Result<DivisionComparison> {
  const { personal, official, indices, from, to, publishedGeneral, parentOf } = input;
  const p = effectiveShares(personal, indices, from);
  if (!p.ok) return p;
  const o = effectiveShares(official, indices, from);
  if (!o.ok) return o;

  const leafRel: Record<string, number> = {};
  for (const leaf of Object.keys(p.value)) {
    const r = relative(indices, leaf, to, from);
    if (!r.ok) return r;
    leafRel[leaf] = r.value;
  }
  const divisions = Array.from(new Set([...Object.keys(o.value), ...Object.keys(p.value).map((l) => parentOf[l] ?? l)]));
  const divRel: Record<string, number> = {};
  for (const d of divisions) {
    const r = relative(indices, d, to, from);
    if (!r.ok) return r;
    divRel[d] = r.value;
  }

  let fp = 0;
  for (const [leaf, s] of Object.entries(p.value)) fp += s * leafRel[leaf]!;
  let fo = 0;
  for (const d of divisions) fo += (o.value[d] ?? 0) * divRel[d]!;

  const contributions: DivisionContribution[] = divisions.map((d) => {
    const leaves = Object.entries(p.value).filter(([leaf]) => (parentOf[leaf] ?? leaf) === d);
    const P = leaves.reduce((acc, [, s]) => acc + s, 0);
    const O = o.value[d] ?? 0;
    const Rp = P > 0 ? leaves.reduce((acc, [leaf, s]) => acc + s * leafRel[leaf]!, 0) / P : divRel[d]!;
    const weightEffect = (P - O) * (divRel[d]! - fo);
    const mixEffect = P * (Rp - divRel[d]!);
    return {
      category: d,
      personalShare: P,
      officialShare: O,
      categoryInflation: divRel[d]! - 1,
      personalCategoryInflation: Rp - 1,
      weightEffect,
      mixEffect,
      contribution: weightEffect + mixEffect,
      leaves: leaves.map(([leaf, s]) => ({ category: leaf, share: s, inflation: leafRel[leaf]! - 1 })),
    };
  });
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const result: DivisionComparison = {
    from, to,
    personal: { factor: fp, inflation: fp - 1 },
    official: { factor: fo, inflation: fo - 1 },
    gap: fp - fo,
    contributions,
  };
  if (publishedGeneral) {
    const a = valueAt(publishedGeneral, from);
    const b = valueAt(publishedGeneral, to);
    if (a.ok && b.ok) {
      const f = b.value / a.value;
      result.published = { factor: f, inflation: f - 1 };
      result.adjustment = fo - f;
    }
  }
  return ok(result);
}
