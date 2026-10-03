/**
 * "IPC con la canasta 2017/18": estimación de la app, no un dato oficial.
 *
 * INDEC anunció un IPC con ponderaciones de la ENGHo 2017/18 y lo postergó en febrero de 2026.
 * Las ponderaciones de 8 de las 13 divisiones nuevas se publicaron en prensa; el resto (15,8%) se reparte
 * entre las divisiones vigentes que faltan, en proporción a su peso actual. Se valúa con los índices
 * oficiales de las 12 divisiones vigentes (total nacional), como canasta fija con precios de mayo 2018
 * (punto medio de la encuesta, nov-2017 a nov-2018).
 *
 * Cuando INDEC publique la tabla completa, reemplazar KNOWN_2018 y marcar `complete: true`.
 */
import { type Basket, type Period, type Result, calculatePersonalInflation, ok } from '../engine';
import { DIVISIONS, type DivisionId } from './categories';
import { DATASET, type Dataset, divisionIndices } from './data';

export const BASKET_2018_SOURCES = [
  { label: 'Chequeado (feb-2026)', url: 'https://chequeado.com/ultimas-noticias/el-indec-actualizo-la-canasta-de-bienes-y-servicios-para-medir-la-inflacion-que-cambios-implica-y-cuanto-podria-variar-el-ipc/' },
  { label: 'BAE Negocios', url: 'https://www.baenegocios.com/economia/nuevo-indicador-de-inflacionque-rubros-ganan-peso-y-cuales-pierden/' },
  { label: 'Diario de Cuyo', url: 'https://www.diariodecuyo.com.ar/economia/como-es-el-nuevo-metodo-para-calcular-el-indice-de-precios-que-presentara-el-gobierno-1827655.html' },
];

/** Pesos (%) publicados para la canasta nueva, total nacional. */
export const KNOWN_2018: Partial<Record<DivisionId, number>> = {
  alimentos: 22.7,
  prendas: 6.8,
  vivienda: 14.5,
  salud: 9.1,
  transporte: 14.3,
  comunicacion: 5.1,
  recreacion: 8.6,
  educacion: 3.1,
};

export const BASKET_2018_META = {
  weightsPeriod: '2018-05' as Period,
  complete: false,
};

/** Ponderaciones nacionales vigentes por división: Σ región (peso regional × participación de la región). */
export function nationalOfficialWeights(ds: Dataset = DATASET): Record<DivisionId, number> {
  const regions = Object.keys(ds.regionShares) as Array<keyof Dataset['regionShares']>;
  const totalShare = regions.reduce((a, r) => a + ds.regionShares[r], 0);
  const out = {} as Record<DivisionId, number>;
  for (const d of DIVISIONS) out[d.id] = regions.reduce((a, r) => a + (ds.weights[r][d.id] * ds.regionShares[r]) / totalShare, 0);
  return out;
}

/** Pesos completos de la estimación: los publicados y el resto prorrateado. */
export function weights2018(ds: Dataset = DATASET): Record<DivisionId, number> {
  const old = nationalOfficialWeights(ds);
  const known = Object.values(KNOWN_2018).reduce((a, v) => a + (v ?? 0), 0);
  const missing = DIVISIONS.filter((d) => KNOWN_2018[d.id] == null);
  const oldMissing = missing.reduce((a, d) => a + old[d.id], 0);
  const out = {} as Record<DivisionId, number>;
  for (const d of DIVISIONS) out[d.id] = KNOWN_2018[d.id] ?? ((100 - known) * old[d.id]) / oldMissing;
  return out;
}

export function prorated2018(): DivisionId[] {
  return DIVISIONS.filter((d) => KNOWN_2018[d.id] == null).map((d) => d.id);
}

export function basket2018(ds: Dataset = DATASET): Basket {
  return { weights: weights2018(ds), weightsPeriod: BASKET_2018_META.weightsPeriod };
}

/** Inflación del total nacional valuada con la canasta 2017/18 (estimación). */
export function inflation2018(from: Period, to: Period, ds: Dataset = DATASET): Result<{ factor: number; inflation: number }> {
  const r = calculatePersonalInflation(basket2018(ds), divisionIndices('nacional', ds), from, to);
  return r.ok ? ok(r.value) : r;
}
