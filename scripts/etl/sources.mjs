/**
 * Fuentes del IPC. Cada lector devuelve el mismo formato intermedio:
 *   { via, url, observations: Array<{ region, category, period, value }> }
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  API_BASE, API_FIELD_PREFIX, CORE_CATEGORIES, EXTRA_CATEGORIES_NATIONAL, INDEC_SOURCES, REGIONS, apiSeriesId,
} from './config.mjs';
import { aperturaKey, decodeText, fetchWithRetry, norm, parseCsv, parseNumber, parsePeriod } from './lib.mjs';

// ---------------------------------------------------------------------------
// API de Series de Tiempo (formato CSV: indice_tiempo, <campo_1>, <campo_2>, ...)
// ---------------------------------------------------------------------------
function regionFromField(suffix) {
  return REGIONS.includes(suffix) ? suffix : null;
}

export function parseApiCsv(text) {
  const { rows } = parseCsv(text);
  const [header, ...data] = rows;
  if (!header || header[0].trim() !== 'indice_tiempo') throw new Error('CSV de la API sin columna indice_tiempo');
  const cols = header.slice(1).map((h) => {
    const field = h.trim();
    // El prefijo más largo gana (ipc_bienes_servicios_varios_ antes que ipc_bienes_).
    const prefix = Object.keys(API_FIELD_PREFIX).sort((a, b) => b.length - a.length).find((p) => field.startsWith(p));
    if (!prefix) return null;
    const region = regionFromField(field.slice(prefix.length));
    return region ? { category: API_FIELD_PREFIX[prefix], region } : null;
  });
  const observations = [];
  for (const row of data) {
    const period = parsePeriod(row[0]);
    if (!period) continue;
    cols.forEach((c, j) => {
      if (!c) return;
      const v = parseNumber(row[j + 1]);
      if (v != null) observations.push({ ...c, period, value: v });
    });
  }
  return observations;
}

export async function readFromApi({ batchSize = 10 } = {}) {
  const pairs = [];
  for (const region of REGIONS) for (const category of CORE_CATEGORIES) pairs.push([category, region]);
  for (const category of EXTRA_CATEGORIES_NATIONAL) pairs.push([category, 'nacional']);
  const observations = [];
  for (let i = 0; i < pairs.length; i += batchSize) {
    const ids = pairs.slice(i, i + batchSize).map(([c, r]) => apiSeriesId(c, r));
    const url = `${API_BASE}?format=csv&limit=1000&ids=${ids.join(',')}`;
    const text = decodeText(await fetchWithRetry(url));
    observations.push(...parseApiCsv(text));
  }
  return { via: 'api', url: API_BASE, observations };
}

/** Lee CSV ya descargados de la API (modo sin red). */
export async function readFromDir(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.csv')).sort();
  if (files.length === 0) throw new Error(`No hay CSV en ${dir}`);
  const observations = [];
  for (const f of files) observations.push(...parseApiCsv(await readFile(path.join(dir, f), 'utf8')));
  return { via: 'api-offline', url: API_BASE, observations };
}

// ---------------------------------------------------------------------------
// Archivo de INDEC serie_ipc_divisiones.csv (formato largo: una fila por región, código y período).
// El lector identifica columnas por nombre para tolerar cambios menores de formato.
// ---------------------------------------------------------------------------
const INDEC_CATEGORY_BY_TEXT = [
  [/^nivel general$/, 'nivel_general'],
  [/^alimentos y bebidas no alcoholicas$/, 'alimentos'],
  [/^bebidas alcoholicas y tabaco$/, 'bebidas_alcoholicas'],
  [/^prendas de vestir y calzado$/, 'prendas'],
  [/^vivienda agua electricidad gas y otros combustibles$/, 'vivienda'],
  [/^equipamiento y mantenimiento del hogar$/, 'equipamiento'],
  [/^salud$/, 'salud'],
  [/^transporte$/, 'transporte'],
  [/^comunicacion$/, 'comunicacion'],
  [/^recreacion y cultura$/, 'recreacion'],
  [/^educacion$/, 'educacion'],
  [/^restaurantes y hoteles$/, 'restaurantes'],
  [/^bienes y servicios varios$/, 'varios'],
  [/^nucleo$/, 'nucleo'],
  [/^regulados$/, 'regulados'],
  [/^estacional(es)?$/, 'estacionales'],
  [/^bienes$/, 'bienes'],
  [/^servicios$/, 'servicios'],
];

const INDEC_REGION_BY_TEXT = [
  [/^(total )?nacional$|^total pais$/, 'nacional'],
  [/^gba$|^gran buenos aires$|^region gba$/, 'gba'],
  [/pampeana/, 'pampeana'],
  [/noreste|^nea$/, 'nea'],
  [/noroeste|^noa$/, 'noa'],
  [/cuyo/, 'cuyo'],
  [/patagonia/, 'patagonia'],
];

function matchFirst(table, text) {
  const t = norm(text);
  for (const [re, id] of table) if (re.test(t)) return id;
  return null;
}

export function parseIndecLongCsv(text, { keepUnknown = false } = {}) {
  const { rows } = parseCsv(text);
  const [header, ...data] = rows;
  if (!header) throw new Error('CSV de INDEC vacío');
  const h = header.map(norm);
  const col = (pred) => h.findIndex(pred);
  const iDesc = col((x) => x.startsWith('descrip'));
  const iCode = col((x) => x === 'codigo' || x.startsWith('cod'));
  const iPeriod = col((x) => x.startsWith('periodo') || x === 'fecha' || x === 'mes');
  const iIndex = col((x) => x.startsWith('indice'));
  const iRegion = col((x) => x.startsWith('region'));
  if (iDesc < 0 || iPeriod < 0 || iIndex < 0 || iRegion < 0) {
    throw new Error(`Formato inesperado en CSV de INDEC. Encabezado: ${header.join(' | ')}`);
  }
  const observations = [];
  const unknown = new Map();
  for (const row of data) {
    const region = matchFirst(INDEC_REGION_BY_TEXT, row[iRegion]);
    const period = parsePeriod(row[iPeriod]);
    const value = parseNumber(row[iIndex]);
    if (!region || !period || value == null) continue;
    const category = matchFirst(INDEC_CATEGORY_BY_TEXT, row[iDesc]);
    if (category) observations.push({ region, category, period, value });
    else if (keepUnknown) {
      const name = String(row[iDesc]).trim();
      const code = iCode >= 0 ? String(row[iCode]).trim() : '';
      unknown.set(`${code}|${name}`, { code, name });
      observations.push({ region, category: aperturaKey(name), name, code, period, value });
    }
  }
  return { observations, unknown: [...unknown.values()] };
}

export async function readFromIndec() {
  const text = decodeText(await fetchWithRetry(INDEC_SOURCES.divisiones));
  const { observations } = parseIndecLongCsv(text);
  return { via: 'indec', url: INDEC_SOURCES.divisiones, observations };
}

/** Lee un archivo de INDEC local (por ejemplo, descargado a mano desde la web). */
export async function readIndecFile(file) {
  const buf = await readFile(file);
  const { observations } = parseIndecLongCsv(decodeText(buf));
  return { via: 'indec-file', url: INDEC_SOURCES.divisiones, observations };
}

/** Aperturas (subgrupos) por región desde serie_ipc_aperturas.csv. */
export async function readAperturasFromIndec(file) {
  const buf = file ? await readFile(file) : await fetchWithRetry(INDEC_SOURCES.aperturas);
  const { observations, unknown } = parseIndecLongCsv(decodeText(buf), { keepUnknown: true });
  return { via: file ? 'indec-file' : 'indec', url: INDEC_SOURCES.aperturas, observations, aperturas: unknown };
}
