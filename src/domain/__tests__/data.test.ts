import { describe, expect, it } from 'vitest';
import {
  addMonths, calculateInflation, monthlyInflation, priceFactor, yearOverYearInflation, yearToDateInflation,
  basketCost, officialBasket,
} from '../../engine';
import { DATASET, LAST_PERIOD, divisionIndices, getSeries } from '../data';
import { DIVISIONS } from '../categories';
import { averageProfile, emptyProfile, officialSharesAt } from '../profile';
import { compareProfile, officialEquivalent, personalEquivalent } from '../calculations';
import { explainComparison } from '../explain';
import type { RegionId } from '../regions';
import { buildBasket } from '../profile';
import { aperturaKey, type Dataset } from '../data';

const pct1 = (x: number) => Math.round(x * 1000) / 10; // tanto por uno → % con 1 decimal
const nat = getSeries('nacional', 'nivel_general')!;

describe('datos oficiales: coinciden con lo publicado por INDEC', () => {
  it('último dato y estado de validación', () => {
    // Sin fijar el mes: la actualización automática agrega meses y estos tests tienen que seguir pasando.
    expect(LAST_PERIOD >= '2026-08').toBe(true);
    expect(DATASET.meta.first).toBe('2016-12');
    expect(DATASET.meta.validation.status).not.toBe('error');
  });

  it('agosto 2026: 1,7% mensual, 33,5% interanual, 21,3% en el año (informe INDEC 10/09/2026)', () => {
    const m = monthlyInflation(nat, '2026-08');
    const y = yearOverYearInflation(nat, '2026-08');
    const a = yearToDateInflation(nat, '2026-08');
    expect(m.ok && pct1(m.value)).toBe(1.7);
    expect(y.ok && pct1(y.value)).toBe(33.5);
    expect(a.ok && pct1(a.value)).toBe(21.3);
  });

  it('inflación anual 2024 (117,8%) y 2025 (31,5%)', () => {
    const y24 = calculateInflation(nat, '2023-12', '2024-12');
    const y25 = calculateInflation(nat, '2024-12', '2025-12');
    expect(y24.ok && pct1(y24.value)).toBe(117.8);
    expect(y25.ok && pct1(y25.value)).toBe(31.5);
  });

  it('agosto 2026 por división, total nacional', () => {
    const expected: Record<string, number> = {
      alimentos: 1.7, bebidas_alcoholicas: 2.1, prendas: -0.6, vivienda: 2.8, equipamiento: 1.4, salud: 2.4,
      transporte: 1.5, comunicacion: 2.3, recreacion: 0.0, educacion: 2.5, restaurantes: 1.8, varios: 2.4,
    };
    for (const [cat, v] of Object.entries(expected)) {
      const r = monthlyInflation(getSeries('nacional', cat as never)!, '2026-08');
      expect(r.ok && pct1(r.value) + 0).toBe(v);
    }
  });

  it('variaciones regionales publicadas (jul y ago 2026)', () => {
    const aug: Record<string, number> = { gba: 1.6, pampeana: 1.6, nea: 1.8, noa: 1.8, cuyo: 1.7, patagonia: 1.8 };
    const jul: Record<string, number> = { gba: 2.3, pampeana: 2.0, nea: 2.0, noa: 2.0, cuyo: 1.9, patagonia: 2.0 };
    for (const r of Object.keys(aug)) {
      const s = getSeries(r as RegionId, 'nivel_general')!;
      const a = monthlyInflation(s, '2026-08');
      const j = monthlyInflation(s, '2026-07');
      expect(a.ok && pct1(a.value)).toBe(aug[r]);
      expect(j.ok && pct1(j.value)).toBe(jul[r]);
    }
  });

  it('corrección NEA jul-2022 reproduce las variaciones publicadas (7,4% y 7,6%)', () => {
    const s = getSeries('nea', 'nivel_general')!;
    const j = monthlyInflation(s, '2022-07');
    const a = monthlyInflation(s, '2022-08');
    expect(j.ok && pct1(j.value)).toBe(7.4);
    expect(a.ok && pct1(a.value)).toBe(7.6);
    expect(DATASET.meta.corrections.some((c) => c.region === 'nea' && c.period === '2022-07')).toBe(true);
  });

  it('en cada región, la canasta oficial reproduce el nivel general (desvío < 0,2%)', () => {
    for (const region of ['gba', 'pampeana', 'nea', 'noa', 'cuyo', 'patagonia'] as const) {
      const basket = officialBasket(DATASET.weights[region], DATASET.meta.base);
      const idx = divisionIndices(region);
      const general = getSeries(region, 'nivel_general')!;
      general.values.forEach((g, k) => {
        const p = `${2016 + Math.floor((11 + k) / 12)}-${String(((11 + k) % 12) + 1).padStart(2, '0')}`;
        const c = basketCost(basket, idx, p);
        expect(c.ok).toBe(true);
        if (c.ok && g != null) expect(Math.abs((c.value * 100) / g - 1)).toBeLessThan(0.002);
      });
    }
  });
});

describe('casos de uso', () => {
  it('ejemplo del documento: $500.000 de enero 2023, actualizado a agosto 2026', () => {
    const r = officialEquivalent(500_000, '2023-01', '2026-08');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Math.round(r.value.equivalent)).toBe(5_102_652); // 500.000 × 12.276,766 / 1.202,979
  });

  it('con el último dato, el equivalente es el monto por el cociente de índices', () => {
    const r = officialEquivalent(500_000, '2023-01', LAST_PERIOD);
    const f = priceFactor(nat, '2023-01', LAST_PERIOD);
    expect(r.ok && f.ok).toBe(true);
    if (!r.ok || !f.ok) return;
    expect(r.value.equivalent).toBeCloseTo(500_000 * f.value, 6);
  });

  it('fechas fuera de rango devuelven el motivo', () => {
    const r = officialEquivalent(500_000, '2015-06', LAST_PERIOD);
    expect(!r.ok && r.error.code).toBe('PERIOD_BEFORE_START');
    const s = officialEquivalent(500_000, '2024-01', addMonths(LAST_PERIOD, 1));
    expect(!s.ok && s.error.code).toBe('PERIOD_AFTER_END');
  });

  it('el perfil promedio de la región reproduce el IPC de la región', () => {
    const base = { ...emptyProfile(), provinceId: 'cordoba' };
    const avg = averageProfile(base, 1_000_000)!;
    const c = compareProfile(avg, '2024-01', LAST_PERIOD);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.value.region).toBe('pampeana');
    expect(Math.abs(c.value.gap)).toBeLessThan(1e-4);
    expect(explainComparison(c.value).verdict).toBe('similar');
  });

  it('participaciones del IPC actualizadas a precios del último mes suman 1', () => {
    const sh = officialSharesAt('gba', LAST_PERIOD)!;
    const sum = DIVISIONS.reduce((a, d) => a + sh[d.id], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('un perfil concentrado en vivienda: la diferencia se explica con datos', () => {
    const p = {
      ...emptyProfile(), provinceId: 'caba', origin: 'manual' as const, edited: true,
      amounts: { vivienda: 700_000, alimentos: 300_000, transporte: 60_000, salud: 120_000, comunicacion: 40_000, restaurantes: 80_000 },
    };
    const c = compareProfile(p, '2024-01', LAST_PERIOD);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const sum = c.value.contributions.reduce((a, x) => a + x.contribution, 0);
    expect(sum).toBeCloseTo(c.value.gap, 10);
    const e = explainComparison(c.value);
    expect(e.headline.length).toBeGreaterThan(20);
    const pe = personalEquivalent(1_000_000, '2024-01', LAST_PERIOD, p);
    expect(pe.ok && pe.value.factor).toBeCloseTo(c.value.personal.factor, 12);
  });
});

describe('subgrupos (con un archivo de datos de prueba)', () => {
  // Datos de prueba: se agrega a GBA un subgrupo "Alquiler de la vivienda" que sube 1% más por mes que su división.
  const gbaViv = DATASET.series.gba.vivienda!;
  const alq = gbaViv.map((v, k) => (v == null ? null : v * Math.pow(1.01, k)));
  const key = aperturaKey('Alquiler de la vivienda');
  const ds: Dataset = {
    ...DATASET,
    aperturas: { gba: { [key]: alq } },
    aperturaNames: { [key]: 'Alquiler de la vivienda' },
    aperturaParent: { [key]: 'vivienda' },
  };
  const profile = {
    ...emptyProfile(), provinceId: 'caba', origin: 'manual' as const, edited: true,
    amounts: { alimentos: 300_000 }, items: { alquiler: 500_000, servicios: 60_000 },
  };

  it('el ítem con subgrupo disponible usa su índice y el resto la división', () => {
    const pb = buildBasket(profile, ds)!;
    expect(pb.precision).toBe('subgrupo');
    expect(pb.basket.weights[key]).toBe(500_000);
    expect(pb.basket.weights.vivienda).toBe(60_000);
    expect(pb.parentOf[key]).toBe('vivienda');
    expect(pb.shares.vivienda).toBeCloseTo(560_000 / 860_000, 12);
  });

  it('la diferencia se reparte en efecto peso y efecto composición, y suma exacto', () => {
    const c = compareProfile(profile, '2025-01', LAST_PERIOD, ds);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const sum = c.value.contributions.reduce((a, x) => a + x.contribution, 0);
    expect(sum).toBeCloseTo(c.value.gap, 10);
    const v = c.value.contributions.find((x) => x.category === 'vivienda')!;
    expect(v.mixEffect).toBeGreaterThan(0);
    const e = explainComparison(c.value);
    expect(e.reasons.join(' ')).toMatch(/alquiler de la vivienda/);
  });

  it('sin subgrupos en los datos, el mismo perfil cae a divisiones', () => {
    const pb = buildBasket(profile)!;
    expect(pb.precision).toBe('division');
    expect(pb.basket.weights.vivienda).toBe(560_000);
  });
});

import { BASKET_2018_META, inflation2018, nationalOfficialWeights, weights2018 } from '../basket2018';
import { ownPriceSeries } from '../ownPrice';
import { priceFactor as pf } from '../../engine';

describe('IPC con canasta 2017/18 (estimación)', () => {
  it('pesos: los publicados se respetan y todo suma 100', () => {
    const w = weights2018();
    const sum = Object.values(w).reduce((a, v) => a + v, 0);
    expect(sum).toBeCloseTo(100, 10);
    expect(w.vivienda).toBe(14.5);
    expect(w.alimentos).toBe(22.7);
    expect(BASKET_2018_META.complete).toBe(false);
  });

  it('ponderaciones nacionales vigentes derivadas de las regionales (26,9% alimentos, 9,4% vivienda)', () => {
    const w = nationalOfficialWeights();
    expect(Math.round(w.alimentos * 10) / 10).toBe(26.9);
    expect(Math.round(w.vivienda * 10) / 10).toBe(9.4);
    expect(Math.round(w.prendas * 10) / 10).toBe(9.9);
  });

  it('da más inflación que el IPC vigente desde 2024, en línea con estimaciones privadas', () => {
    const y25 = inflation2018('2024-12', '2025-12');
    const acc = inflation2018('2023-12', '2025-12');
    // IPC oficial 2025: 31,5%. Estimaciones privadas con la canasta nueva: Equilibra 32,1%; González-Rozada 33,6%.
    expect(y25.ok && pct1(y25.value.inflation)).toBe(32.1);
    // Dic-2023 → dic-2025: IPC oficial 186,5%; estimación privada citada en prensa: 194,8%.
    expect(acc.ok && acc.value.inflation).toBeGreaterThan(1.9);
    expect(acc.ok && acc.value.inflation).toBeLessThan(2.0);
  });
});

describe('precio propio', () => {
  const div = getSeries('gba', 'vivienda')!;
  it('entre las dos fechas varía exactamente lo que pagó el usuario y fuera de ellas sigue al índice', () => {
    const s = ownPriceSeries(div, { period: '2025-08', amount: 400_000 }, { period: '2026-08', amount: 700_000 })!;
    const own = pf(s, '2025-08', '2026-08');
    expect(own.ok && own.value).toBeCloseTo(1.75, 12);
    const before = pf(s, '2024-01', '2025-08');
    const idx = pf(div, '2024-01', '2025-08');
    expect(before.ok && idx.ok && before.value).toBeCloseTo(idx.ok ? idx.value : 0, 12);
  });

  it('en el perfil: el alquiler usa tu variación y la diferencia se explica dentro de vivienda', () => {
    const p = {
      ...emptyProfile(), provinceId: 'caba', origin: 'manual' as const, edited: true,
      amounts: { alimentos: 300_000 }, items: { alquiler: 700_000 },
      ownPrices: { alquiler: { period: '2025-08', amount: 400_000 } },
    };
    const pb = buildBasket(p)!;
    expect(pb.basket.weights['propio:alquiler']).toBe(700_000);
    expect(pb.ownPriceItems).toEqual(['Alquiler']);
    const c = compareProfile(p, '2025-08', LAST_PERIOD);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.value.contributions.reduce((a, x) => a + x.contribution, 0)).toBeCloseTo(c.value.gap, 10);
    const v = c.value.contributions.find((x) => x.category === 'vivienda')!;
    expect(v.personalCategoryInflation).toBeCloseTo(0.75, 10);
    expect(explainComparison(c.value).reasons.join(' ')).toMatch(/alquiler \(tu precio\)/);
  });
});
