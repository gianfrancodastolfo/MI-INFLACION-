import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { apiSeriesId, CORE_CATEGORIES, EXTRA_CATEGORIES_NATIONAL, OFFICIAL_WEIGHTS, REGIONS } from '../config.mjs';
import { parseCsv, parseNumber, parsePeriod, sameContent } from '../lib.mjs';
import { parseApiCsv, parseIndecLongCsv } from '../sources.mjs';
import { buildAperturas, buildDataset, validateDataset } from '../build.mjs';

describe('identificadores de la API (verificados contra apis.datos.gob.ar)', () => {
  it.each([
    ['nivel_general', 'nacional', '148.3_INIVELNAL_DICI_M_26'],
    ['nivel_general', 'gba', '148.3_INIVELGBA_DICI_M_21'],
    ['nivel_general', 'pampeana', '148.3_INIVELANA_DICI_M_26'],
    ['nivel_general', 'nea', '148.3_INIVELNEA_DICI_M_21'],
    ['nivel_general', 'noa', '148.3_INIVELNOA_DICI_M_21'],
    ['nivel_general', 'cuyo', '148.3_INIVELUYO_DICI_M_22'],
    ['nivel_general', 'patagonia', '148.3_INIVELNIA_DICI_M_27'],
    ['alimentos', 'nacional', '146.3_IALIMENNAL_DICI_M_45'],
    ['vivienda', 'nacional', '146.3_IVIVIENNAL_DICI_M_52'],
    ['vivienda', 'patagonia', '146.3_IVIVIENNIA_DICI_M_53'],
    ['equipamiento', 'nacional', '146.3_IEQUIPANAL_DICI_M_46'],
    ['salud', 'gba', '146.3_ISALUDGBA_DICI_M_13'],
    ['transporte', 'cuyo', '146.3_ITRANSPUYO_DICI_M_19'],
    ['comunicacion', 'patagonia', '146.3_ICOMUNINIA_DICI_M_28'],
    ['recreacion', 'nacional', '146.3_IRECREANAL_DICI_M_31'],
    ['restaurantes', 'nacional', '146.3_IRESTAUNAL_DICI_M_33'],
    ['varios', 'nacional', '146.3_IBIENESNAL_DICI_M_36'],
    ['nucleo', 'nacional', '148.3_INUCLEONAL_DICI_M_19'],
    ['estacionales', 'cuyo', '148.3_IESTACIUYO_DICI_M_21'],
    ['bienes', 'nacional', '147.3_IBIENESNAL_DICI_T_19'],
    ['servicios', 'nacional', '147.3_ISERVICNAL_DICI_T_22'],
  ])('%s / %s → %s', (cat, region, id) => {
    expect(apiSeriesId(cat, region)).toBe(id);
  });
});

describe('lectores', () => {
  it('períodos y números en formatos habituales de INDEC', () => {
    expect(parsePeriod('2016-12-01')).toBe('2016-12');
    expect(parsePeriod('201701')).toBe('2017-01');
    expect(parsePeriod('ene-17')).toBe('2017-01');
    expect(parsePeriod('Dic-2016')).toBe('2016-12');
    expect(parsePeriod('3/2024')).toBe('2024-03');
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1234.56')).toBe(1234.56);
    expect(parseNumber('100')).toBe(100);
    expect(parseNumber('NA')).toBeNull();
  });

  it('CSV con comillas y punto y coma', () => {
    const { delimiter, rows } = parseCsv('"a";"b"\n"x;y";"2"\n');
    expect(delimiter).toBe(';');
    expect(rows).toEqual([['a', 'b'], ['x;y', '2']]);
  });

  it('CSV de la API', () => {
    const text = 'indice_tiempo,ipc_nivel_general_gba,ipc_salud_nea\n2016-12-01,100.0,100.0\n2017-01-01,101.313,101.9\n';
    const obs = parseApiCsv(text);
    expect(obs).toContainEqual({ region: 'gba', category: 'nivel_general', period: '2017-01', value: 101.313 });
    expect(obs).toContainEqual({ region: 'nea', category: 'salud', period: '2017-01', value: 101.9 });
  });

  it('CSV largo de INDEC (formato esperado de serie_ipc_divisiones.csv; confirmar con el archivo real)', () => {
    const text = [
      'Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region',
      '0;NIVEL GENERAL;Nivel general y divisiones COICOP;201612;100;NA;NA;Nacional',
      '01;Alimentos y bebidas no alcohólicas;Nivel general y divisiones COICOP;201701;101,3;1,3;NA;GBA',
      '04;Vivienda, agua, electricidad, gas y otros combustibles;Nivel general y divisiones COICOP;201701;102,0;2;NA;Noreste',
      'B;Bienes;Bienes y servicios;201701;101,0;1;NA;Patagonia',
      'N;Núcleo;Categorías;201701;101,5;1,5;NA;Nacional',
    ].join('\n');
    const { observations } = parseIndecLongCsv(text);
    expect(observations).toContainEqual({ region: 'nacional', category: 'nivel_general', period: '2016-12', value: 100 });
    expect(observations).toContainEqual({ region: 'gba', category: 'alimentos', period: '2017-01', value: 101.3 });
    expect(observations).toContainEqual({ region: 'nea', category: 'vivienda', period: '2017-01', value: 102 });
    expect(observations).toContainEqual({ region: 'patagonia', category: 'bienes', period: '2017-01', value: 101 });
    expect(observations).toContainEqual({ region: 'nacional', category: 'nucleo', period: '2017-01', value: 101.5 });
  });

  it('rechaza un CSV de INDEC con columnas desconocidas en vez de adivinar', () => {
    expect(() => parseIndecLongCsv('a;b;c\n1;2;3')).toThrow(/Formato inesperado/);
  });
});

describe('construcción y validación', () => {
  const synthetic = () => {
    const observations = [];
    const months = ['2016-12', '2017-01', '2017-02'];
    for (const region of REGIONS) {
      months.forEach((period, k) => {
        let general = 0;
        let total = 0;
        for (const cat of CORE_CATEGORIES.slice(1)) {
          const v = 100 * (1 + 0.01 * k * (1 + cat.length / 20));
          observations.push({ region, category: cat, period, value: v });
          const w = region === 'nacional' ? 1 : OFFICIAL_WEIGHTS[region][cat];
          general += w * v;
          total += w;
        }
        observations.push({ region, category: 'nivel_general', period, value: general / total });
        if (region === 'nacional') for (const cat of EXTRA_CATEGORIES_NATIONAL) observations.push({ region, category: cat, period, value: 100 + k });
      });
    }
    return observations;
  };

  it('arma la estructura y valida sin errores un conjunto coherente', () => {
    const ds = buildDataset({ via: 'test', url: 'x', observations: synthetic() });
    expect(ds.meta.last).toBe('2017-02');
    expect(ds.series.gba.nivel_general).toHaveLength(3);
    expect(ds.meta.validation.status).toBe('ok');
  });

  it('detecta un nivel general inconsistente con sus divisiones', () => {
    const obs = synthetic().map((o) => (o.region === 'cuyo' && o.category === 'nivel_general' && o.period === '2017-02' ? { ...o, value: o.value * 1.03 } : o));
    const ds = buildDataset({ via: 'test', url: 'x', observations: obs });
    expect(ds.meta.validation.status).toBe('error');
    expect(ds.meta.validation.errors.join(' ')).toMatch(/cuyo 2017-02/);
  });

  it('detecta datos faltantes', () => {
    const obs = synthetic().filter((o) => !(o.region === 'noa' && o.category === 'salud' && o.period === '2017-01'));
    const ds = buildDataset({ via: 'test', url: 'x', observations: obs });
    expect(ds.meta.validation.errors.join(' ')).toMatch(/noa\/salud: dato faltante en 2017-01/);
  });

  it('avisa si cambia un valor histórico respecto de la versión anterior', () => {
    const prev = buildDataset({ via: 'test', url: 'x', observations: synthetic() });
    const obs = synthetic().map((o) => (o.region === 'gba' && o.category === 'salud' && o.period === '2017-01' ? { ...o, value: o.value + 0.5 } : o));
    const cur = buildDataset({ via: 'test', url: 'x', observations: obs });
    const v = validateDataset(cur, prev);
    expect(v.revisions.join(' ')).toMatch(/gba\/salud 2017-01/);
  });

  it('el archivo publicado en src/data/ipc.json pasa la validación', () => {
    const ds = JSON.parse(readFileSync(new URL('../../../src/data/ipc.json', import.meta.url), 'utf8'));
    const v = validateDataset(ds);
    expect(v.errors).toEqual([]);
  });
});

describe('subgrupos (aperturas)', () => {
  const csv = [
    'Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region',
    '04;Vivienda, agua, electricidad, gas y otros combustibles;Divisiones;201612;100;NA;NA;GBA',
    'X1;Alquiler de la vivienda;Aperturas;201612;100;NA;NA;GBA',
    'X1;Alquiler de la vivienda;Aperturas;201701;103,5;3,5;NA;GBA',
    'X2;Gastos de prepagas;Aperturas;201612;100;NA;NA;GBA',
    'X2;Gastos de prepagas;Aperturas;201701;102;2;NA;GBA',
    '07.3;Algo nuevo;Aperturas;201612;100;NA;NA;GBA',
    '07.3;Algo nuevo;Aperturas;201701;101;1;NA;GBA',
    'Z;Sin división conocida;Aperturas;201612;100;NA;NA;GBA',
  ].join('\n');

  it('lee subgrupos, asigna su división por nombre o por código COICOP y descarta los incompletos', () => {
    const { observations } = parseIndecLongCsv(csv, { keepUnknown: true });
    const ap = buildAperturas(observations, { first: '2016-12', last: '2017-01' });
    expect(ap.aperturas.gba['apertura:alquiler_de_la_vivienda']).toEqual([100, 103.5]);
    expect(ap.aperturaParent['apertura:alquiler_de_la_vivienda']).toBe('vivienda');
    expect(ap.aperturaParent['apertura:gastos_de_prepagas']).toBe('salud');
    expect(ap.aperturaParent['apertura:algo_nuevo']).toBe('transporte');
    expect(ap.aperturas.gba['apertura:sin_division_conocida']).toBeUndefined();
    expect(ap.warnings.join(' ')).toMatch(/Sin división conocida/);
  });
});

describe('archivos sin datos nuevos', () => {
  // El workflow diario commitea solo si cambió algún archivo: no hay que reescribirlos por la fecha de generación.
  const a = { schema: 1, meta: { via: 'api', generatedAt: '2026-10-02T18:00:00Z', last: '2026-08', validation: { status: 'ok', warnings: [] } }, series: { gba: [100, 101.5] } };
  it('ignora la fecha de generación y la validación', () => {
    expect(sameContent({ ...a, meta: { ...a.meta, generatedAt: '2026-10-03T12:00:00Z', validation: { status: 'warning', warnings: ['x'] } } }, a)).toBe(true);
  });
  it('detecta datos nuevos, otra fuente o un archivo que no existía', () => {
    expect(sameContent({ ...a, meta: { ...a.meta, last: '2026-09' }, series: { gba: [100, 101.5, 103.6] } }, a)).toBe(false);
    expect(sameContent({ ...a, meta: { ...a.meta, via: 'indec' } }, a)).toBe(false);
    expect(sameContent(a, null)).toBe(false);
  });
});
