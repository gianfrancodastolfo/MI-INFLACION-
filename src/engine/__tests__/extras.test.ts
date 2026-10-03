import { describe, expect, it } from 'vitest';
import {
  addDays, addMonthsISO, adultEquivalent, diffDays, householdUnits, isISODate, rentScheduleIcl, rentScheduleIpc, uvaDailyFactor, uvaFromAnchor,
  uvaLastComputableDate, uvaTramo, type AdultEquivalentRow,
} from '..';

describe('fechas diarias', () => {
  it('suma días cruzando meses y años bisiestos', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(diffDays('2020-06-30', '2020-07-01')).toBe(1);
    expect(diffDays('2026-10-16', '2026-01-01')).toBe(-288);
  });
  it('suma meses conservando el día o usando el último del mes', () => {
    expect(addMonthsISO('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsISO('2023-07-01', 12)).toBe('2024-07-01');
    expect(addMonthsISO('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('valida fechas', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
  });
});

describe('UVA: regla del 17 al 16', () => {
  it('asigna cada día a su tramo y al IPC del mes anterior al tramo', () => {
    expect(uvaTramo('2026-08-16')).toEqual({ tramo: '2026-07', ipcMonth: '2026-06', days: 31 });
    expect(uvaTramo('2026-08-17')).toEqual({ tramo: '2026-08', ipcMonth: '2026-07', days: 31 });
    expect(uvaTramo('2026-01-05')).toEqual({ tramo: '2025-12', ipcMonth: '2025-11', days: 31 });
    expect(uvaTramo('2026-03-16')).toEqual({ tramo: '2026-02', ipcMonth: '2026-01', days: 28 });
  });
  it('en un tramo completo acumula exactamente la inflación del mes', () => {
    const rate = () => 2.1;
    let f = 1;
    for (let d = '2026-08-17'; d <= '2026-09-16'; d = addDays(d, 1)) f *= uvaDailyFactor(d, rate)!;
    expect(f).toBeCloseTo(1.021, 12);
  });
  it('va y vuelve desde el ancla sin perder precisión', () => {
    const rate = (p: string) => (p < '2026-01' ? 2.5 : 1.8);
    const anchor = { date: '2026-05-16', value: 1946.77 };
    const back = uvaFromAnchor(anchor, '2025-11-03', rate)!;
    expect(uvaFromAnchor({ date: '2025-11-03', value: back }, '2026-05-16', rate)).toBeCloseTo(1946.77, 9);
    expect(uvaFromAnchor(anchor, '2026-05-16', rate)).toBe(1946.77);
  });
  it('sin IPC publicado no inventa valores', () => {
    const rate = (p: string) => (p <= '2026-08' ? 2 : undefined);
    expect(uvaFromAnchor({ date: '2026-08-29', value: 2096.27 }, '2026-10-16', rate)).toBeDefined();
    expect(uvaFromAnchor({ date: '2026-08-29', value: 2096.27 }, '2026-10-17', rate)).toBeUndefined();
    expect(uvaLastComputableDate('2026-08')).toBe('2026-10-16');
  });
});

describe('alquiler por IPC', () => {
  it('multiplica las variaciones de los meses que corresponden', () => {
    const rate = () => 1;
    const u = rentScheduleIpc({ amount: 100_000, start: '2026-01', every: 3, lag: 2, until: '2026-12', rate });
    expect(u.map((x) => x.at)).toEqual(['2026-04', '2026-07', '2026-10']);
    expect(u[0]!.months).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(u[0]!.amount).toBeCloseTo(100_000 * 1.01 ** 3, 6);
    expect(u[2]!.amount).toBeCloseTo(100_000 * 1.01 ** 9, 6);
  });
  it('marca pendiente el primer ajuste sin datos y no calcula los siguientes', () => {
    const rate = (p: string) => (p <= '2026-08' ? 2 : undefined);
    const u = rentScheduleIpc({ amount: 500_000, start: '2026-04', every: 4, lag: 2, until: '2027-03', rate });
    expect(u[0]).toMatchObject({ at: '2026-08', status: 'ok' });
    expect(u[1]).toMatchObject({ at: '2026-12', status: 'pendiente', missing: '2026-09' });
    expect(u[1]!.amount).toBeUndefined();
  });
  it('con rezago de 1 mes usa hasta el mes anterior al ajuste', () => {
    const u = rentScheduleIpc({ amount: 1, start: '2026-01', every: 6, lag: 1, until: '2026-07', rate: () => 1 });
    expect(u[0]!.months).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });
});

describe('alquiler por ICL', () => {
  it('encadena cocientes del ICL entre fechas de ajuste', () => {
    const icl = (d: string) => ({ '2023-07-01': 4.55, '2024-07-01': 15.67, '2025-07-01': 26.03 } as Record<string, number>)[d];
    const u = rentScheduleIcl({ amount: 100_000, startDate: '2023-07-01', every: 12, until: '2026-07-01', icl });
    expect(u[0]).toMatchObject({ date: '2024-07-01', status: 'ok' });
    expect(u[0]!.factor).toBeCloseTo(15.67 / 4.55, 12);
    expect(u[1]!.amount).toBeCloseTo(100_000 * (26.03 / 4.55), 6);
    expect(u[2]).toMatchObject({ date: '2026-07-01', status: 'pendiente' });
  });
});

describe('adulto equivalente', () => {
  const table: AdultEquivalentRow[] = [
    { desde: 0, hasta: 17, mujer: 0.5, varon: 0.6 },
    { desde: 18, hasta: 60, mujer: 0.77, varon: 1 },
    { desde: 61, hasta: null, mujer: 0.63, varon: 0.74 },
  ];
  it('busca por edad y sexo, con el último tramo abierto', () => {
    expect(adultEquivalent({ sexo: 'varon', edad: 35 }, table)).toBe(1);
    expect(adultEquivalent({ sexo: 'mujer', edad: 99 }, table)).toBe(0.63);
    expect(adultEquivalent({ sexo: 'mujer', edad: -1 }, table)).toBeUndefined();
    expect(householdUnits([{ sexo: 'varon', edad: 35 }, { sexo: 'mujer', edad: 10 }], table)).toBe(1.5);
  });
});
