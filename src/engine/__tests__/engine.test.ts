import { describe, expect, it } from 'vitest';
import {
  addMonths, annualizeMonthlyRate, averageMonthlyRate, basketCost, calculateEquivalentSalary, calculateFutureScenario,
  calculateInflation, calculatePersonalInflation, calculatePurchasingPower, calculateRealSalary, calculateRealVariation,
  calculateRequiredRaise, calculateRequiredSalary, comparePersonalVsOfficialByDivision, comparePersonalVsOfficialInflation, compoundRates,
  decemberOfPreviousYear, diffMonths, effectiveShares, formatPeriod, monthlyInflation, monthlyInflationSeries,
  normalizeWeights, officialBasket, periodRange, personalIndexSeries, priceFactor, valueAt, yearOverYearInflation,
  yearToDateInflation, type IndexSeries,
} from '../index';

const close = (a: number, b: number, eps = 1e-12) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('períodos', () => {
  it('suma y resta meses cruzando años', () => {
    expect(addMonths('2024-12', 1)).toBe('2025-01');
    expect(addMonths('2024-01', -1)).toBe('2023-12');
    expect(addMonths('2016-12', 116)).toBe('2026-08');
  });
  it('calcula diferencias y rangos', () => {
    expect(diffMonths('2016-12', '2026-08')).toBe(116);
    expect(periodRange('2024-11', '2025-02')).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
    expect(decemberOfPreviousYear('2026-08')).toBe('2025-12');
  });
  it('formatea en español', () => {
    expect(formatPeriod('2024-01')).toBe('ene 2024');
    expect(formatPeriod('2026-09', 'long')).toBe('septiembre de 2026');
  });
});

// Serie sintética: 10% mensual durante 3 meses.
const s10: IndexSeries = { start: '2024-01', values: [100, 110, 121, 133.1] };

describe('inflación', () => {
  it('acumula componiendo índices, no sumando tasas', () => {
    const r = calculateInflation(s10, '2024-01', '2024-03');
    expect(r.ok).toBe(true);
    if (r.ok) close(r.value, 0.21); // 21%, no 20%
    close(compoundRates([0.1, 0.1]), 0.21);
  });
  it('variación mensual, interanual y acumulada en el año', () => {
    const m = monthlyInflation(s10, '2024-04');
    expect(m.ok && Math.abs(m.value - 0.1) < 1e-12).toBe(true);
    const long: IndexSeries = { start: '2023-12', values: Array.from({ length: 14 }, (_, k) => 100 * Math.pow(1.02, k)) };
    const yoy = yearOverYearInflation(long, '2025-01');
    expect(yoy.ok && Math.abs(yoy.value - (Math.pow(1.02, 12) - 1)) < 1e-12).toBe(true);
    const ytd = yearToDateInflation(long, '2024-06');
    expect(ytd.ok && Math.abs(ytd.value - (Math.pow(1.02, 6) - 1)) < 1e-12).toBe(true);
  });
  it('informa cuando falta el dato y por qué', () => {
    const before = priceFactor(s10, '2023-12', '2024-02');
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.error.code).toBe('PERIOD_BEFORE_START');
    const after = valueAt(s10, '2024-05');
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error).toEqual({ code: 'PERIOD_AFTER_END', period: '2024-05', last: '2024-04' });
    const withHole: IndexSeries = { start: '2024-01', values: [100, null, 120] };
    const hole = valueAt(withHole, '2024-02');
    expect(!hole.ok && hole.error.code).toBe('MISSING_VALUE');
  });
  it('anualiza y promedia geométricamente', () => {
    close(annualizeMonthlyRate(0.02), Math.pow(1.02, 12) - 1);
    close(averageMonthlyRate(1.21, 2), 0.1, 1e-12);
  });
  it('serie mensual', () => {
    const r = monthlyInflationSeries(s10, '2024-02', '2024-04');
    expect(r.ok && r.value.map((p) => Number(p.value.toFixed(10)))).toEqual([0.1, 0.1, 0.1]);
  });
});

describe('sueldo y poder adquisitivo', () => {
  it('sueldo equivalente = monto × factor', () => {
    close(calculateEquivalentSalary(800_000, 2.5), 2_000_000, 1e-6);
    close(calculateRealSalary(2_000_000, 2.5), 800_000, 1e-6);
  });
  it('variación real no es nominal menos inflación', () => {
    // Sueldo +80%, precios +95% → -7,69%, no -15 puntos.
    close(calculateRealVariation(1.8, 1.95), 1.8 / 1.95 - 1);
    expect(calculateRealVariation(1.8, 1.95)).toBeCloseTo(-0.076923, 6);
  });
  it('poder adquisitivo completo', () => {
    const p = calculatePurchasingPower({ salaryThen: 500_000, salaryNow: 1_800_000, priceFactor: 3 });
    close(p.equivalentSalary, 1_500_000, 1e-6);
    close(p.nominalChange, 2.6);
    close(p.realChange, 1.8 / 1.5 - 1);
    close(p.gapAmount, 300_000, 1e-6);
  });
  it('sueldo requerido y aumento necesario', () => {
    close(calculateRequiredSalary({ baseSalary: 1_000_000, priceFactor: 1.5 }), 1_500_000, 1e-6);
    close(calculateRequiredSalary({ baseSalary: 1_000_000, priceFactor: 1.5, realTarget: 0.2 }), 1_800_000, 1e-6);
    close(calculateRequiredRaise(1_200_000, 1_500_000), 0.25);
  });
});

describe('canasta personal (índice de canasta fija)', () => {
  // A se duplica, B queda igual. Dic → mar.
  const indices = {
    a: { start: '2024-01', values: [100, 150, 200] } as IndexSeries,
    b: { start: '2024-01', values: [100, 100, 100] } as IndexSeries,
  };

  it('con participaciones del inicio es un Laspeyres', () => {
    const r = calculatePersonalInflation({ weights: { a: 50, b: 50 }, weightsPeriod: '2024-01' }, indices, '2024-01', '2024-03');
    expect(r.ok && r.value.factor).toBeCloseTo(1.5, 12);
  });

  it('con participaciones de HOY da el mismo resultado (no sobrepondera lo que subió)', () => {
    // Misma canasta valuada hoy: A = 100, B = 50 → 2/3 y 1/3.
    const today = calculatePersonalInflation({ weights: { a: 100, b: 50 }, weightsPeriod: '2024-03' }, indices, '2024-01', '2024-03');
    expect(today.ok && today.value.factor).toBeCloseTo(1.5, 12);
    // El atajo incorrecto (participaciones de hoy × variaciones) daría 1,667.
    expect((2 / 3) * 2 + (1 / 3) * 1).toBeCloseTo(1.6667, 4);
  });

  it('C(b) = 1 y participaciones efectivas', () => {
    const basket = { weights: { a: 1, b: 1 }, weightsPeriod: '2024-01' };
    const c = basketCost(basket, indices, '2024-01');
    expect(c.ok && c.value).toBeCloseTo(1, 12);
    const sh = effectiveShares(basket, indices, '2024-03');
    expect(sh.ok && sh.value.a).toBeCloseTo(2 / 3, 12);
  });

  it('normaliza y rechaza canastas vacías o negativas', () => {
    const n = normalizeWeights({ a: 3, b: 1, c: 0 });
    expect(n.ok && n.value).toEqual({ a: 0.75, b: 0.25 });
    const e = normalizeWeights({ a: 0 });
    expect(!e.ok && e.error.code).toBe('EMPTY_BASKET');
    const neg = normalizeWeights({ a: -1 });
    expect(!neg.ok && neg.error.code).toBe('INVALID_AMOUNT');
  });

  it('categoría inexistente', () => {
    const r = calculatePersonalInflation({ weights: { zz: 1 }, weightsPeriod: '2024-01' }, indices, '2024-01', '2024-02');
    expect(!r.ok && r.error.code).toBe('UNKNOWN_CATEGORY');
  });

  it('serie del índice personal base 100', () => {
    const r = personalIndexSeries({ weights: { a: 1, b: 1 }, weightsPeriod: '2024-01' }, indices, '2024-01', '2024-03');
    expect(r.ok && r.value.map((p) => p.value)).toEqual([100, 125, 150]);
  });
});

describe('comparación con el IPC y descomposición', () => {
  const indices = {
    a: { start: '2016-12', values: [100, 130, 200] } as IndexSeries,
    b: { start: '2016-12', values: [100, 105, 110] } as IndexSeries,
    c: { start: '2016-12', values: [100, 120, 140] } as IndexSeries,
  };
  const officialW = { a: 20, b: 50, c: 30 };
  // "Nivel general" coherente con esas ponderaciones.
  const general: IndexSeries = {
    start: '2016-12',
    values: [0, 1, 2].map((k) => (20 * indices.a.values[k]! + 50 * indices.b.values[k]! + 30 * indices.c.values[k]!) / 100),
  };

  it('la suma de contribuciones es exactamente la diferencia', () => {
    const r = comparePersonalVsOfficialInflation({
      personal: { weights: { a: 60, b: 10, c: 30 }, weightsPeriod: '2017-02' },
      official: officialBasket(officialW),
      indices,
      from: '2017-01',
      to: '2017-02',
      publishedGeneral: general,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sum = r.value.contributions.reduce((acc, c) => acc + c.contribution, 0);
    close(sum, r.value.gap, 1e-12);
    close(r.value.official.factor, general.values[2]! / general.values[1]!, 1e-12);
    close(r.value.adjustment ?? 1, 0, 1e-12);
    // "a" pesa más que en el IPC y subió más que el promedio: es la que más empuja hacia arriba.
    expect(r.value.contributions[0]!.category).toBe('a');
    expect(r.value.contributions[0]!.contribution).toBeGreaterThan(0);
  });

  it('con la misma estructura que el IPC, la inflación personal es la oficial', () => {
    const r = comparePersonalVsOfficialInflation({
      personal: officialBasket(officialW),
      official: officialBasket(officialW),
      indices,
      from: '2016-12',
      to: '2017-02',
    });
    expect(r.ok && Math.abs(r.value.gap)).toBeLessThan(1e-12);
  });
});

describe('descomposición en dos niveles (subgrupos)', () => {
  // División V = 50% alquiler + 50% servicios (a precios base); A es otra división.
  const alq = { start: '2016-12', values: [100, 150, 220] } as IndexSeries;
  const serv = { start: '2016-12', values: [100, 110, 120] } as IndexSeries;
  const V = { start: '2016-12', values: [0, 1, 2].map((k) => 0.5 * alq.values[k]! + 0.5 * serv.values[k]!) } as IndexSeries;
  const A = { start: '2016-12', values: [100, 104, 108] } as IndexSeries;
  const indices = { 'apertura:alquiler': alq, 'apertura:servicios': serv, vivienda: V, alimentos: A };
  const parentOf = { 'apertura:alquiler': 'vivienda', 'apertura:servicios': 'vivienda', vivienda: 'vivienda', alimentos: 'alimentos' };
  const official = officialBasket({ vivienda: 30, alimentos: 70 });

  it('la suma de efecto peso + composición es exactamente la diferencia', () => {
    const r = comparePersonalVsOfficialByDivision({
      personal: { weights: { 'apertura:alquiler': 50, alimentos: 50 }, weightsPeriod: '2016-12' },
      official, indices, parentOf, from: '2017-01', to: '2017-02',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sum = r.value.contributions.reduce((acc, c) => acc + c.contribution, 0);
    close(sum, r.value.gap, 1e-12);
    const v = r.value.contributions.find((c) => c.category === 'vivienda')!;
    // Solo alquila: dentro de vivienda su mezcla subió más que la división.
    expect(v.mixEffect).toBeGreaterThan(0);
    close(v.personalCategoryInflation, 220 / 150 - 1, 1e-12);
    expect(v.leaves.map((l) => l.category)).toEqual(['apertura:alquiler']);
  });

  it('sin subgrupos coincide con la descomposición de un nivel', () => {
    const personal = { weights: { vivienda: 60, alimentos: 40 }, weightsPeriod: '2017-02' };
    const one = comparePersonalVsOfficialInflation({ personal, official, indices, from: '2017-01', to: '2017-02' });
    const two = comparePersonalVsOfficialByDivision({ personal, official, indices, parentOf, from: '2017-01', to: '2017-02' });
    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) return;
    close(one.value.gap, two.value.gap, 1e-12);
    for (const c of two.value.contributions) {
      close(c.mixEffect, 0, 1e-12);
      const match = one.value.contributions.find((x) => x.category === c.category)!;
      close(c.contribution, match.contribution, 1e-12);
    }
  });
});

describe('simulador', () => {
  it('aumento de 15% con inflación hipotética de 2% mensual durante 12 meses', () => {
    const r = calculateFutureScenario({ salary: 1_800_000, raises: [{ month: 6, rate: 0.15 }], monthlyInflation: 0.02, months: 12 });
    close(r.finalNominalSalary, 2_070_000, 1e-6);
    close(r.accumulatedInflation, Math.pow(1.02, 12) - 1);
    close(r.requiredSalary, 1_800_000 * Math.pow(1.02, 12), 1e-6);
    close(r.finalRealChange, 1.15 / Math.pow(1.02, 12) - 1);
    expect(r.averageRealChange).toBeLessThan(0);
  });
});
