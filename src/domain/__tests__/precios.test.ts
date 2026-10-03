/**
 * Precios promedio de INDEC: cuentas contra las variaciones que publica INDEC en el Cuadro 20.
 */
import { describe, expect, it } from 'vitest';
import { DATASET, LAST_PERIOD } from '../data';
import {
  PRECIOS, PRECIOS_LAST, correctionsSummary, priceAt, priceChange, priceProduct, priceRanking, productsFor, regionRange, unitPhrase,
} from '../precios';

const r1 = (x: number) => Math.round(x * 1000) / 10;

describe('datos de precios', () => {
  it('trae 59 productos en GBA y 14 en cada región, sin errores de validación', () => {
    expect(productsFor('gba')).toHaveLength(59);
    for (const r of ['pampeana', 'nea', 'noa', 'cuyo', 'patagonia'] as const) expect(productsFor(r)).toHaveLength(14);
    expect(PRECIOS.meta.validation.status).not.toBe('error');
    expect(PRECIOS.meta.validation.checks).toBeGreaterThanOrEqual(550);
    expect(PRECIOS_LAST >= '2026-08').toBe(true);
    expect(regionRange('gba').first).toBe('2016-12');
    expect(regionRange('nea').first).toBe('2017-06');
  });
  it('el snapshot de oct-2026 llega al mismo mes que el IPC', () => {
    // Solo con los dos archivos del snapshot. En la actualización automática los precios pueden llegar
    // antes o después que el IPC; la página usa el menor de los dos meses.
    if (PRECIOS.meta.via === 'api-offline' && DATASET.meta.via === 'api-offline') expect(PRECIOS_LAST).toBe(LAST_PERIOD);
  });
});

describe('variación de precios (Cuadro 20 de INDEC, julio 2026)', () => {
  it('reproduce las variaciones mensuales publicadas', () => {
    const v = (id: string) => { const c = priceChange('gba', id, '2026-06', '2026-07'); return c.ok ? r1(c.value.change) : undefined; };
    expect(v('pan_frances')).toBe(1.7);
    expect(v('papa')).toBe(20.8);
    expect(v('zapallo')).toBe(55.1);
    expect(v('naranja')).toBe(-7.7);
    expect(v('asado')).toBe(-1.3);
    expect(v('leche')).toBe(3.8);
    expect(v('desodorante')).toBe(3.3);
    expect(v('jabon_tocador')).toBe(3.4);
  });
  it('ordena el ranking de mayor a menor', () => {
    const rank = priceRanking('gba', '2026-06', '2026-07');
    expect(rank).toHaveLength(59);
    expect(rank[0]!.product.id).toBe('zapallo');
    expect(rank[rank.length - 1]!.product.id).toBe('naranja');
  });
  it('compara contra el IPC de la región con cociente, no con resta', () => {
    const c = priceChange('nea', 'pan_frances', '2025-08', '2026-08');
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const { change, ipc, real, priceFrom, priceFromAdjusted, division } = c.value;
    expect(ipc).toBeDefined();
    expect(real).toBeCloseTo((1 + change) / (1 + ipc!) - 1, 12);
    expect(priceFromAdjusted).toBeCloseTo(priceFrom * (1 + ipc!), 6);
    expect(division?.id).toBe('alimentos');
  });
});

describe('correcciones visibles', () => {
  it('usa las cifras publicadas en los meses con errores de la API', () => {
    expect(priceAt('pampeana', 'pan_frances', '2023-08')).toBe(671.81);
    expect(priceAt('nea', 'pan_frances', '2025-07')).toBe(2102.32);
    expect(priceAt('noa', 'pan_frances', '2025-07')).toBe(2341.16);
    expect(priceAt('gba', 'lavandina', '2017-03')).toBe(14.68);
    expect(correctionsSummary()).toHaveLength(4);
  });
});

describe('errores y textos', () => {
  it('avisa cuando falta un dato o el producto no está en la región', () => {
    expect(priceChange('nea', 'asado', '2025-01', '2026-01')).toEqual({ ok: false, error: 'NO_PRODUCT' });
    expect(priceChange('gba', 'pan_frances', '2026-07', '2026-07')).toEqual({ ok: false, error: 'BAD_RANGE' });
    expect(priceChange('nea', 'pan_frances', '2017-05', '2026-07')).toEqual({ ok: false, error: 'NO_PRICE_FROM' });
    // Hueco real de la API (mar-2020). Si algún día lo completan, este control deja de aplicar.
    if (priceAt('patagonia', 'carne_picada', '2020-03') == null) {
      expect(priceChange('patagonia', 'carne_picada', '2020-03', '2026-07')).toEqual({ ok: false, error: 'NO_PRICE_FROM' });
    }
  });
  it('arma la frase de la unidad', () => {
    expect(unitPhrase(priceProduct('pan_frances')!)).toBe('el kilo de pan francés tipo flauta');
    expect(unitPhrase(priceProduct('aceite')!)).toBe('la botella de 1,5 litros de aceite de girasol');
    expect(unitPhrase(priceProduct('hamburguesas')!)).toBe('el paquete de 4 unidades de hamburguesas congeladas');
    expect(unitPhrase(priceProduct('huevos')!)).toBe('la docena de huevos de gallina');
    expect(unitPhrase(priceProduct('leche')!)).toBe('el litro de leche fresca entera en sachet');
    expect(unitPhrase(priceProduct('fideos')!)).toBe('fideos secos tipo guisero (500 g)');
  });
});
