import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildExternos, findDuplicatedRuns, linkCaba, parseApiCsvByOrder, parseBcraJson, pickUvaAnchor, publishedRate, readExternosFromDir, readIclFromDir,
  toSeries, uvaDailyFactor,
} from '../externos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('lectura de la API por posición de columna', () => {
  it('asigna columnas aunque los nombres se repitan', () => {
    const csv = 'indice_tiempo,nivel_general,nivel_general\n2026-01-01,10,\n2026-02-01,11,20\n';
    const out = parseApiCsvByOrder(csv, [['A', 'prov.a'], ['B', 'prov.b']]);
    expect(out).toEqual({ 'prov.a': { '2026-01': 10, '2026-02': 11 }, 'prov.b': { '2026-02': 20 } });
  });
  it('falla si la cantidad de columnas no coincide con los ids', () => {
    expect(() => parseApiCsvByOrder('indice_tiempo,a\n2026-01-01,1\n', [['A', 'x'], ['B', 'y']])).toThrow(/columnas/);
  });
  it('lee fechas diarias', () => {
    const out = parseApiCsvByOrder('indice_tiempo,uva_diario\n2026-08-28,2094.86\n2026-08-29,2096.27\n', [['U', 'uva']], { daily: true });
    expect(out.uva['2026-08-29']).toBe(2096.27);
  });
});

describe('empalme y controles del IPCBA', () => {
  it('reescala la base anterior al mes de empalme', () => {
    const raw = {
      'caba.base2011.nivel_general': { '2022-01': 200, '2022-02': 220 },
      'caba.base2021.nivel_general': { '2022-02': 110, '2022-03': 121 },
    };
    expect(linkCaba(raw)).toEqual({ '2022-01': 100, '2022-02': 110, '2022-03': 121 });
  });
  it('detecta columnas que repiten a otra', () => {
    const raw = { 'caba.base2021.a': { '2022-01': 1, '2022-02': 2, '2022-03': 3, '2022-04': 9 }, 'caba.base2021.b': { '2022-01': 1, '2022-02': 2, '2022-03': 3, '2022-04': 4 } };
    expect(findDuplicatedRuns(raw, 'caba.base2021.', 3)).toEqual([{ a: 'caba.base2021.a', b: 'caba.base2021.b', from: '2022-01', to: '2022-03', months: 3 }]);
  });
  it('arma series continuas con nulos en los huecos', () => {
    expect(toSeries({ '2026-01': 1, '2026-03': 3 })).toEqual({ start: '2026-01', values: [1, null, 3] });
  });
});

describe('regla de la UVA', () => {
  const ipc = { '2026-05': 100, '2026-06': 101.9, '2026-07': 104.04 };
  it('redondea la variación publicada a un decimal', () => {
    expect(publishedRate(ipc, '2026-06')).toBe(1.9);
    expect(publishedRate(ipc, '2026-07')).toBe(2.1);
  });
  it('del 17 al 16 rige el IPC del mes anterior al tramo', () => {
    expect(uvaDailyFactor('2026-07-17', ipc)).toBeCloseTo(1.019 ** (1 / 31), 15);
    expect(uvaDailyFactor('2026-08-17', ipc)).toBeCloseTo(1.021 ** (1 / 31), 15);
    expect(uvaDailyFactor('2026-08-16', ipc)).toBeCloseTo(1.019 ** (1 / 31), 15);
  });
  it('el ancla saltea los días repetidos por fin de semana', () => {
    expect(pickUvaAnchor({ '2026-08-28': 2094.86, '2026-08-29': 2096.27, '2026-08-30': 2096.27, '2026-08-31': 2096.27 })).toEqual({ date: '2026-08-29', value: 2096.27 });
  });
});

describe('ICL del BCRA', () => {
  it('lee el JSON de la API v4.0', () => {
    const json = JSON.stringify({ status: 200, results: [{ idVariable: 40, detalle: [{ fecha: '2026-10-16', valor: 36.88000000000 }, { fecha: '2026-10-15', valor: 36.86 }] }] });
    expect(parseBcraJson(json)).toEqual({ '2026-10-16': 36.88, '2026-10-15': 36.86 });
  });
});

describe('snapshot completo (sin red)', () => {
  it('se construye sin errores y pasa todos los controles publicados', async () => {
    const src = await readExternosFromDir(path.join(ROOT, 'data-raw/api-snapshot-2026-10'));
    const icl = await readIclFromDir(path.join(ROOT, 'data-raw/bcra-api'));
    const ipc = JSON.parse(await readFile(path.join(ROOT, 'src/data/ipc.json'), 'utf8'));
    const out = buildExternos(src, icl, ipc);
    expect(out.externos.meta.validation.errors).toEqual([]);
    expect(out.externos.meta.validation.checks.every((c) => c.ok)).toBe(true);
    expect(out.bcra.icl.values).toHaveLength(2299);
    expect(out.bcra.uva.validation.misses).toEqual([]);
    expect(out.externos.meta.corrections.filter((c) => c.target.endsWith('recreacion'))).toHaveLength(1);
  });
});
