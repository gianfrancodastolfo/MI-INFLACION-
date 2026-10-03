import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PRECIOS_QUERIES, PRECIOS_REGIONS, PRODUCTS, PUBLISHED, REGIONAL_PRODUCTS, applyPreciosCorrections, buildPrecios, readPreciosFromDir,
} from '../precios.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SNAPSHOT = path.join(ROOT, 'data-raw/api-snapshot-2026-10');

describe('manifiesto de precios', () => {
  it('pide 59 productos de GBA y 14 por región, de a tres series por consulta', async () => {
    expect(PRODUCTS).toHaveLength(59);
    expect(REGIONAL_PRODUCTS).toHaveLength(14);
    const ids = PRECIOS_QUERIES.flatMap((q) => q.ids.map(([id]) => id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(59 + 14 * (PRECIOS_REGIONS.length + 1));
    expect(PRECIOS_QUERIES.every((q) => q.ids.length <= 3)).toBe(true);
    for (const q of PRECIOS_QUERIES) await access(path.join(SNAPSHOT, q.file));
  });
  it('cada cifra publicada apunta a un producto y una región que existen', () => {
    for (const f of PUBLISHED) {
      expect(PRODUCTS.some((p) => p.id === f.product)).toBe(true);
      expect(['gba', ...PRECIOS_REGIONS]).toContain(f.region);
    }
  });
});

describe('correcciones', () => {
  it('intercambia desodorante y jabón solo mientras siguen cruzados', () => {
    const raw = { 'gba.desodorante': { '2025-12': 3630.91, '2026-01': 1268.05 }, 'gba.jabon_tocador': { '2025-12': 1214.92, '2026-01': 3828.19 } };
    const c = applyPreciosCorrections(raw);
    expect(raw['gba.desodorante']['2026-01']).toBe(3828.19);
    expect(raw['gba.jabon_tocador']['2026-01']).toBe(1268.05);
    expect(c.find((x) => x.kind === 'swap')?.months).toBe(1);
    // Ya corregido (o arreglado en la API): no vuelve a intercambiar.
    expect(applyPreciosCorrections(raw).some((x) => x.kind === 'swap')).toBe(false);
  });
  it('reemplaza por la cifra publicada solo si la API difiere', () => {
    const raw = { 'nea.pan_frances': { '2025-07': 2102.32 }, 'noa.pan_frances': { '2025-07': 2102.32 } };
    const c = applyPreciosCorrections(raw);
    expect(raw['noa.pan_frances']['2025-07']).toBe(2341.16);
    const groups = c.filter((x) => x.kind === 'published' && x.period === '2025-07');
    expect(groups.find((g) => g.region === 'noa')?.products.find((p) => p.product === 'pan_frances')).toEqual({ product: 'pan_frances', api: 2102.32, published: 2341.16 });
    expect(groups.find((g) => g.region === 'nea')?.products.some((p) => p.product === 'pan_frances')).toBeFalsy();
  });
});

describe('construcción desde el snapshot (oct-2026)', () => {
  it('pasa todos los controles contra los informes de INDEC', async () => {
    const out = buildPrecios(await readPreciosFromDir(SNAPSHOT));
    const v = out.meta.validation;
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.checks).toBeGreaterThanOrEqual(550);
    expect(out.meta.last).toBe('2026-08');
    expect(Object.keys(out.series.gba)).toHaveLength(59);
    for (const r of PRECIOS_REGIONS) expect(Object.keys(out.series[r])).toHaveLength(14);
    const at = (r, id, p) => { const s = out.series[r][id]; return s.values[(Number(p.slice(0, 4)) * 12 + Number(p.slice(5))) - (Number(s.start.slice(0, 4)) * 12 + Number(s.start.slice(5)))]; };
    expect(at('gba', 'pan_frances', '2026-08')).toBe(4909.98);
    expect(at('gba', 'desodorante', '2026-07')).toBe(4413.17);
    expect(at('gba', 'jabon_tocador', '2026-07')).toBe(1519.85);
    expect(at('gba', 'detergente', '2017-03')).toBe(18.24);
    expect(at('pampeana', 'pan_frances', '2023-06')).toBe(561.86);
    expect(at('pampeana', 'pan_frances', '2023-07')).toBe(598.07);
    expect(at('pampeana', 'pan_frances', '2023-08')).toBe(671.81);
    expect(at('nea', 'carne_picada', '2025-07')).toBe(6845.61);
    expect(at('noa', 'carne_picada', '2025-07')).toBe(8012.37);
    expect(out.series.gba.pan_frances.start).toBe('2016-12');
    expect(out.series.nea.pan_frances.start).toBe('2017-06');
    expect(out.meta.corrections.filter((c) => c.kind === 'published').length).toBe(18);
  });
  it('marca error si una región repite un mes entero', async () => {
    const src = await readPreciosFromDir(SNAPSHOT);
    for (const p of REGIONAL_PRODUCTS) src.raw[`cuyo.${p.id}`]['2024-05'] = src.raw[`cuyo.${p.id}`]['2024-04'];
    const out = buildPrecios(src);
    expect(out.meta.validation.errors.some((e) => e.startsWith('cuyo: 2024-05 repite'))).toBe(true);
  });
});
