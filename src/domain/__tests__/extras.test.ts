/**
 * Datos complementarios (CABA, provincias, salarios, canasta, SMVM, UVA, ICL) contra cifras publicadas.
 */
import { describe, expect, it } from 'vitest';
import { rentIcl, rentIpc } from '../alquiler';
import { addDays, addMonths, uvaLastComputableDate } from '../../engine';
import { BCRA, ICL_LAST, UVA_LAST, iclAt, ipcPublishedRate, uvaAt } from '../bcra';
import { LAST_PERIOD } from '../data';
import { RELEASES, buildIcs, ipcReleaseDate } from '../calendario';
import { EXTERNOS, cabaDetail, externalEquivalent, externalForProvince, externalHas, externalSummary } from '../externos';
import {
  BONO_PREVISIONAL, HABER_MINIMO_LAST, HABER_MINIMO_NEXT, HABER_RULE_MISSES, HOGARES_TIPO, WAGE_LAST, bonoFor, compareRaise, haberMinimoAt,
  haberMinimoByRule, haberRuleMatches, householdCanasta, ipcRate2, nextHaberMinimo, smvmAt,
} from '../ingresos';

const r1 = (x: number | undefined) => (x == null ? undefined : Math.round(x * 1000) / 10);

describe('IPC de la Ciudad de Buenos Aires (IPCBA)', () => {
  const caba = (from: string, to: string) => {
    const e = externalEquivalent(1, from, to, 'caba');
    return e.ok ? e.value.inflation : undefined;
  };
  it('reproduce el dato de agosto 2026 del informe del Instituto', () => {
    expect(externalSummary('caba').last >= '2026-08').toBe(true);
    expect(r1(caba('2026-07', '2026-08'))).toBe(1.7);
    expect(r1(caba('2025-12', '2026-08'))).toBe(21.5);
    expect(r1(caba('2025-08', '2026-08'))).toBe(33.3);
    const ix = EXTERNOS.indices.caba;
    const k = (2026 * 12 + 8) - (2012 * 12 + 7);
    expect(ix.values[k]).toBe(2596.6);
  });
  it('con el empalme de feb-2022 reproduce las cifras anuales publicadas', () => {
    expect(r1(caba('2021-12', '2022-12'))).toBe(93.4);
    expect(r1(caba('2022-12', '2023-12'))).toBe(198.4);
    expect(r1(caba('2024-12', '2025-12'))).toBe(31.8);
    expect(r1(caba('2023-11', '2023-12'))).toBe(21.1);
  });
  it('permite calcular desde 2012, antes de la serie nacional de INDEC', () => {
    expect(EXTERNOS.indices.caba.start).toBe('2012-07');
    const e = externalEquivalent(100_000, '2013-01', '2026-08', 'caba');
    expect(e.ok && e.value.equivalent).toBeGreaterThan(100_000 * 100);
  });
  it('divisiones de agosto 2026 coinciden con el informe', () => {
    const rows = Object.fromEntries(cabaDetail('2026-08').map((r) => [r.key, r1(r.monthly)]));
    expect(rows).toMatchObject({
      alimentos: 1.8, bebidas_alcoholicas: 2.6, prendas: -0.7, vivienda: 2.6, equipamiento: 2.7, salud: 1.9, transporte: 1.2,
      informacion_comunicacion: 2.2, recreacion: 1.6, educacion: 1.0, restaurantes: -0.1, seguros_financieros: 3.8, cuidado_personal: 2.4,
      estacionales: -2.9, regulados: 1.8, resto: 2.1,
    });
  });
  it('corrige los errores conocidos de la API sin inventar datos', () => {
    const est = EXTERNOS.cabaDetalle.series.estacionales!;
    expect(est[0]).toBeNull(); // feb-2022: la API repetía el nivel general
    const k = (2026 * 12 + 1) - (2022 * 12 + 2);
    expect(EXTERNOS.cabaDetalle.series.recreacion![k]).toBe(1965.53);
    expect(r1(cabaDetail('2026-01').find((r) => r.key === 'recreacion')!.monthly)).toBe(7.4);
    expect(EXTERNOS.meta.validation.status).toBe('ok');
  });
});

describe('IPC provinciales', () => {
  it('asocia provincias con su índice propio', () => {
    expect(externalForProvince('san-luis')?.id).toBe('san_luis');
    expect(externalForProvince('buenos-aires')).toBeUndefined();
    expect(Object.keys(EXTERNOS.indices)).toHaveLength(8);
  });
  it('respeta el hueco de Mendoza (abr-2012 a mar-2016)', () => {
    expect(externalHas('mendoza', '2012-03')).toBe(true);
    expect(externalHas('mendoza', '2014-06')).toBe(false);
    expect(externalHas('mendoza', '2016-04')).toBe(true);
    const across = externalEquivalent(1000, '2011-01', '2017-01', 'mendoza');
    expect(across.ok).toBe(false);
    expect(externalEquivalent(1000, '2016-04', '2026-07', 'mendoza').ok).toBe(true);
  });
  it('informa el último mes real de cada serie', () => {
    expect(EXTERNOS.indices.cordoba.last >= '2025-08').toBe(true);
    expect(EXTERNOS.indices.santa_fe.last >= '2026-07').toBe(true);
    for (const ix of Object.values(EXTERNOS.indices)) expect(ix.values[ix.values.length - 1]).not.toBeNull();
  });
});

describe('índice de salarios', () => {
  it('llega a julio 2026 y compara aumentos', () => {
    expect(WAGE_LAST >= '2026-07').toBe(true);
    const c = compareRaise(1_000_000, 1_300_000, '2025-07', '2026-07', 'total')!;
    expect(r1(c.index)).toBe(36.2);
    expect(c.relative).toBeCloseTo(1.3 / (1 + c.index) - 1, 12);
  });
});

describe('canasta básica (INDEC, GBA)', () => {
  it('reproduce los hogares tipo del informe de junio 2026', () => {
    const [h1, h2, h3] = HOGARES_TIPO.map((h) => householdCanasta(h.members, '2026-06')!);
    expect(h1!.units).toBe(2.46);
    expect(h2!.units).toBe(3.09);
    expect(h3!.units).toBe(3.25);
    expect(h1!.cbt).toBeCloseTo(1_219_230.86, 1);
    expect(h2!.cbt).toBeCloseTo(1_531_472.91, 1);
    expect(h3!.cbt).toBeCloseTo(1_610_772.48, 1);
  });
});

describe('salario mínimo y jubilación mínima', () => {
  it('trae el cronograma vigente y el último haber', () => {
    expect(smvmAt('2026-09')).toBe(383_800);
    expect(smvmAt('2027-04')).toBe(437_000);
    expect(haberMinimoAt('2026-09')).toBeCloseTo(428_633.2, 1);
  });

  it('la regla de movilidad reproduce al centavo cada mes publicado de mayo 2024 a septiembre 2026', () => {
    // Rango fijo y verificado: si en el futuro cambia la ley, la app deja de calcular sola (ver el test siguiente)
    // y la actualización automática no se traba.
    const misses: string[] = [];
    for (let p = '2024-05'; p <= '2026-09'; p = addMonths(p, 1)) if (!haberRuleMatches(p)) misses.push(p);
    expect(misses).toEqual([]);
    if (HABER_MINIMO_LAST === '2026-09') expect(HABER_RULE_MISSES).toEqual([]);
  });

  it('si la regla no da el último dato oficial, no calcula el mes siguiente', () => {
    const raised = (p: string) => (p === '2026-09' ? 450_000 : haberMinimoAt(p));
    expect(nextHaberMinimo('2026-09', raised)).toBeUndefined();
    expect(nextHaberMinimo('2026-09')).toMatchObject({ period: '2026-10', amount: 435_748.51 });
  });

  it('octubre 2026: 1,66% sobre septiembre da $435.748,51 (lo que informó ANSES)', () => {
    expect(ipcRate2('2026-08')).toBe(1.66);
    expect(haberMinimoByRule('2026-10')?.amount).toBe(435_748.51);
    if (HABER_MINIMO_LAST === '2026-09') expect(HABER_MINIMO_NEXT).toMatchObject({ period: '2026-10', amount: 435_748.51, rate: 1.66, ipcPeriod: '2026-08' });
  });

  it('el bono se suma solo en el mes que tiene decreto', () => {
    expect(BONO_PREVISIONAL.amount).toBe(70_000);
    expect(bonoFor('2026-10')).toBe(70_000);
    expect(bonoFor('2026-11')).toBeUndefined();
  });
});

describe('IPC con la variación publicada (un decimal)', () => {
  it('coincide con lo que difunde INDEC', () => {
    expect(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map(ipcPublishedRate)).toEqual([3.4, 2.6, 2.1, 1.9, 2.1, 1.7]);
    if (LAST_PERIOD < '2026-09') expect(ipcPublishedRate('2026-09')).toBeUndefined();
  });
});

describe('UVA', () => {
  it('reproduce los valores oficiales publicados (diferencia máxima: un centavo, por redondeo)', () => {
    // Días hábiles reales de la API (no repetidos por fin de semana) y cierres de mes de martes a sábado.
    const official: Array<[string, number]> = [
      ['2026-08-28', 2094.86], ['2026-06-30', 2016.85], ['2026-05-12', 1938.11], ['2026-07-17', 2040.57],
      ['2025-12-31', 1707.79], ['2024-01-31', 552.55], ['2019-07-31', 39.2], ['2018-10-31', 28.16],
    ];
    for (const [d, v] of official) expect(Math.abs(uvaAt(d)! - v)).toBeLessThanOrEqual(0.0101);
  });
  it('se calcula hasta el 16 del mes posterior al último IPC', () => {
    expect(UVA_LAST).toBe(uvaLastComputableDate(LAST_PERIOD));
    expect(uvaAt(UVA_LAST)).toBeGreaterThan(2096.27);
    expect(uvaAt(addDays(UVA_LAST, 1))).toBeUndefined();
    expect(BCRA.uva.validation?.misses).toEqual([]);
  });
});

describe('ICL y alquileres', () => {
  it('serie diaria oficial completa', () => {
    expect(iclAt('2020-07-01')).toBe(1);
    expect(iclAt('2023-05-17')).toBe(4.02);
    expect(iclAt('2026-07-16')).toBe(34.76);
    expect(ICL_LAST >= '2026-10-16').toBe(true);
    expect(iclAt('2026-10-16')).toBe(36.88);
  });
  it('ejemplo de La Nación: cuatrimestral desde abril 2026, ajuste de agosto', () => {
    const u = rentIpc(650_000, '2026-04', 4, 2, '2027-03');
    expect(u[0]!.months).toEqual(['2026-03', '2026-04', '2026-05', '2026-06']);
    expect(u[0]!.rates).toEqual([3.4, 2.6, 2.1, 1.9]);
    expect(u[0]!.amount).toBeCloseTo(650_000 * 1.034 * 1.026 * 1.021 * 1.019, 4);
    if (LAST_PERIOD < '2026-09') expect(u[1]).toMatchObject({ at: '2026-12', status: 'pendiente', missing: '2026-09' });
    else expect(u[1]).toMatchObject({ at: '2026-12' });
  });
  it('ajuste anual por ICL', () => {
    const u = rentIcl(100_000, '2023-07-01', 12, '2026-07-01');
    expect(u[0]!.factor).toBeCloseTo(15.67 / 4.55, 12);
    expect(u.map((x) => x.status)).toEqual(['ok', 'ok', 'ok']);
  });
});

describe('calendario de INDEC', () => {
  it('genera un .ics válido con las próximas fechas', () => {
    expect(ipcReleaseDate('2026-09')).toBe('2026-10-13');
    const ics = buildIcs(RELEASES, new Date('2026-10-02T12:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261013T190000Z');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(RELEASES.length);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
