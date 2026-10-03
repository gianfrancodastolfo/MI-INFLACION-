/**
 * Fuentes complementarias al IPC de INDEC:
 *  - IPC de la Ciudad de Buenos Aires (IPCBA) y de 7 provincias, vía API de Series de Tiempo.
 *  - Índice de salarios (INDEC), RIPTE, canasta básica (INDEC), salario mínimo y haber mínimo jubilatorio.
 *  - UVA (BCRA, vía API de Series de Tiempo) e ICL (BCRA, API de estadísticas v4.0).
 *
 * Todos los identificadores fueron verificados contra el catálogo de la API (oct-2026).
 * Ver data-raw/notas/relevamiento-2026-10.md y docs/FUENTES.md.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { API_BASE } from './config.mjs';
import { addMonths, decodeText, fetchWithRetry, parseCsv, parseNumber, parsePeriod, toMonthIndex } from './lib.mjs';

// ---------------------------------------------------------------------------
// Manifiesto de consultas a la API de Series de Tiempo.
// Las columnas del CSV vienen en el mismo orden que los ids pedidos; cada una se asigna a un destino.
// `file` es la ruta del CSV crudo dentro del snapshot (modo sin red).
// ---------------------------------------------------------------------------
const caba2021 = (k) => `caba.base2021.${k}`;
export const API_QUERIES = [
  { file: 'caba/old_ng.csv', start: '2012-07-01', ids: [['193.1_NIVEL_GENERAL_JULI_0_13', 'caba.base2011.nivel_general']] },
  { file: 'caba/new_g1.csv', start: '2022-01-01', ids: [['193.2_NIVEL_GENERAL_2021_0_13_2', caba2021('nivel_general')], ['193.2_ESTACIONALLES_2021_0_12_84', caba2021('estacionales')], ['193.2_REGULADOSDOS_2021_0_9_38', caba2021('regulados')]] },
  { file: 'caba/new_g2.csv', start: '2022-01-01', ids: [['193.2_RESTOSTO_2021_0_5_9', caba2021('resto')], ['193.2_ALIMENTOS_CAS_2021_0_32_80', caba2021('alimentos')], ['193.2_BEBIDAS_ALACO_2021_0_26_81', caba2021('bebidas_alcoholicas')]] },
  { file: 'caba/new_g3.csv', start: '2022-01-01', ids: [['193.2_PRENDAS_VEADO_2021_0_22_9', caba2021('prendas')], ['193.2_VIVIENDA_ALES_2021_0_45_98', caba2021('vivienda')], ['193.2_EQUIPAMIENGAR_2021_0_32_39', caba2021('equipamiento')]] },
  { file: 'caba/new_g4.csv', start: '2022-01-01', ids: [['193.2_SALUDLUD_2021_0_5_15', caba2021('salud')], ['193.2_TRANSPORTERTE_2021_0_10_1', caba2021('transporte')], ['193.2_INFORMACIOION_2021_0_24_37', caba2021('informacion_comunicacion')]] },
  { file: 'caba/new_g5.csv', start: '2022-01-01', ids: [['193.2_RECREACIONURA_2021_0_18_78', caba2021('recreacion')], ['193.2_EDUCACIONION_2021_0_9_53', caba2021('educacion')], ['193.2_RESTAURANTLES_2021_0_20_90', caba2021('restaurantes')]] },
  { file: 'caba/new_g6.csv', start: '2022-01-01', ids: [['193.2_SEGUROS_SEROS_2021_0_29_0', caba2021('seguros_financieros')], ['193.2_CUIDADO_PEROS_2021_0_40_67', caba2021('cuidado_personal')]] },
  { file: 'provincias/prov_g1_a.csv', start: '2004-12-01', end: '2015-12-01', ids: [['195.1_NIVEL_GENERAL_0_0_13', 'prov.mendoza'], ['197.1_NIVEL_GENERAL_2014_0_13', 'prov.san_luis'], ['196.1_NIVEL_GENERAL_2014_0_13', 'prov.neuquen']] },
  { file: 'provincias/prov_g1_b.csv', start: '2016-01-01', ids: [['195.1_NIVEL_GENERAL_0_0_13', 'prov.mendoza'], ['197.1_NIVEL_GENERAL_2014_0_13', 'prov.san_luis'], ['196.1_NIVEL_GENERAL_2014_0_13', 'prov.neuquen']] },
  { file: 'provincias/prov_g2_a.csv', start: '2004-12-01', end: '2015-12-01', ids: [['194.1_NIVEL_GENERAL_2014_0_13', 'prov.cordoba'], ['198.1_NIVEL_GENERAL_2014_0_13', 'prov.santa_fe'], ['199.1_NIVEL_GENERAL_2014_0_13', 'prov.tucuman']] },
  { file: 'provincias/prov_g2_b.csv', start: '2016-01-01', ids: [['194.1_NIVEL_GENERAL_2014_0_13', 'prov.cordoba'], ['198.1_NIVEL_GENERAL_2014_0_13', 'prov.santa_fe'], ['199.1_NIVEL_GENERAL_2014_0_13', 'prov.tucuman']] },
  { file: 'provincias/prov_g3_a.csv', start: '2004-12-01', end: '2015-12-01', ids: [['464.1_IPC_CHACO_NG_0_0_22_93', 'prov.chaco']] },
  // La 199.2 y la 464.2 son versiones más cortas de las mismas series: se bajan solo para controlar.
  { file: 'provincias/prov_g3_b.csv', start: '2016-01-01', ids: [['199.2_NIVEL_GENERAL_DICI_0_13_51', 'control.tucuman_199_2'], ['464.1_IPC_CHACO_NG_0_0_22_93', 'prov.chaco'], ['464.2_IPC_CHACO_NG_0_0_12_52', 'control.chaco_464_2']] },
  { file: 'salarios/g1.csv', start: '2016-10-01', ids: [['149.1_TL_INDIIOS_OCTU_0_21', 'salarios.total'], ['149.1_SOR_PRIADO_OCTU_0_25', 'salarios.privado_registrado'], ['149.1_SOR_PUBICO_OCTU_0_14', 'salarios.publico']] },
  { file: 'salarios/g2.csv', start: '2016-10-01', ids: [['149.1_SOR_PRIADO_OCTU_0_28', 'salarios.no_registrado'], ['149.1_TL_REGIADO_OCTU_0_16', 'salarios.registrado'], ['158.1_REPTE_0_0_5', 'ripte']] },
  { file: 'canasta/gba.csv', start: '2016-04-01', ids: [['150.1_CSTA_BARIA_0_D_26', 'canasta.cba'], ['150.1_CSTA_BATAL_0_D_20', 'canasta.cbt']] },
  { file: 'referencias/smvm_haber.csv', start: '2016-01-01', ids: [['57.1_SMVMM_0_M_34', 'smvm'], ['58.1_MP_0_M_24', 'haber_minimo']] },
  { file: 'uva/uva_fin_de_mes.csv', start: '2016-03-01', collapse: 'month', ids: [['94.2_UVAD_D_0_0_10', 'uva.fin_de_mes']] },
];

/** Consulta diaria de la UVA (últimos meses): se usa para anclar y validar la regla de cálculo. */
export const UVA_DAILY = { id: '94.2_UVAD_D_0_0_10', fileGlob: /^uva_diario_.*\.csv$/, dir: 'uva', days: 120 };

export const BCRA_API = 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias';
export const BCRA_ICL_VARIABLE = 40; // "Índice para Contratos de Locación (ICL-Ley 27.551), con dos decimales, base 30.6.20=1"
export const ICL_START = '2020-07-01';

// ---------------------------------------------------------------------------
// Metadatos de cada índice provincial (verificados en el catálogo de la API).
// ---------------------------------------------------------------------------
export const PROVINCIAL_META = {
  caba: {
    name: 'Ciudad de Buenos Aires', short: 'CABA', indicator: 'IPCBA', producer: 'Instituto de Estadística y Censos (GCBA)',
    coverage: 'Hogares de la Ciudad de Buenos Aires', base: '2021 = 100 (empalmado en feb-2022 con la base jul-2011/jun-2012)',
    url: 'https://www.estadisticaciudad.gob.ar/eyc/?cat=93', apiIds: ['193.1_NIVEL_GENERAL_JULI_0_13', '193.2_NIVEL_GENERAL_2021_0_13_2'],
  },
  cordoba: {
    name: 'Córdoba', short: 'Córdoba', indicator: 'IPC Córdoba', producer: 'Dirección General de Estadística y Censos de Córdoba',
    coverage: 'Gran Córdoba', base: '2014 = 100', url: 'https://estadistica.cba.gov.ar/', apiIds: ['194.1_NIVEL_GENERAL_2014_0_13'],
    stale: 'La API de Series de Tiempo dejó de actualizar esta serie en agosto de 2025, aunque la provincia sigue publicando.',
  },
  mendoza: {
    name: 'Mendoza', short: 'Mendoza', indicator: 'IPC Mendoza', producer: 'Dirección de Estadísticas e Investigaciones Económicas (DEIE)',
    coverage: 'Gran Mendoza', base: '2010 = 100', url: 'https://deie.mendoza.gov.ar/', apiIds: ['195.1_NIVEL_GENERAL_0_0_13'],
    gapNote: 'No hay datos entre abril de 2012 y marzo de 2016.',
  },
  neuquen: {
    name: 'Neuquén', short: 'Neuquén', indicator: 'IPC Neuquén', producer: 'Dirección Provincial de Estadística y Censos de Neuquén',
    coverage: 'Neuquén capital', base: 'enero 2007 = 100', url: 'https://www.estadisticaneuquen.gob.ar/', apiIds: ['196.1_NIVEL_GENERAL_2014_0_13'],
    stale: 'La API de Series de Tiempo llega a enero de 2026; la provincia sigue publicando.',
  },
  san_luis: {
    name: 'San Luis', short: 'San Luis', indicator: 'IPC San Luis', producer: 'Dirección Provincial de Estadística y Censos de San Luis',
    coverage: 'San Luis', base: '2003 = 100', url: 'http://www.estadistica.sanluis.gov.ar/', apiIds: ['197.1_NIVEL_GENERAL_2014_0_13'],
  },
  santa_fe: {
    name: 'Santa Fe', short: 'Santa Fe', indicator: 'IPC Santa Fe', producer: 'Instituto Provincial de Estadística y Censos (IPEC)',
    coverage: 'Santa Fe y Rosario', base: '2014 = 100', url: 'https://www.santafe.gov.ar/ipec/', apiIds: ['198.1_NIVEL_GENERAL_2014_0_13'],
  },
  tucuman: {
    name: 'Tucumán', short: 'Tucumán', indicator: 'IPC Tucumán', producer: 'Dirección de Estadística de Tucumán',
    coverage: 'Gran San Miguel de Tucumán', base: 'diciembre 2017 = 100', url: 'https://estadistica.tucuman.gov.ar/', apiIds: ['199.1_NIVEL_GENERAL_2014_0_13'],
  },
  chaco: {
    name: 'Chaco', short: 'Chaco', indicator: 'IPC Gran Resistencia', producer: 'Instituto Provincial de Estadística y Censos del Chaco',
    coverage: 'Gran Resistencia', base: 'septiembre 2010 = 100', url: 'https://estadisticas.chaco.gov.ar/', apiIds: ['464.1_IPC_CHACO_NG_0_0_22_93'],
  },
};

export const CABA_DETAIL_NAMES = {
  nivel_general: 'Nivel general', alimentos: 'Alimentos y bebidas no alcohólicas', bebidas_alcoholicas: 'Bebidas alcohólicas y tabaco',
  prendas: 'Prendas de vestir y calzado', vivienda: 'Vivienda, agua, electricidad, gas y otros combustibles',
  equipamiento: 'Equipamiento y mantenimiento del hogar', salud: 'Salud', transporte: 'Transporte', informacion_comunicacion: 'Información y comunicación',
  recreacion: 'Recreación y cultura', educacion: 'Educación', restaurantes: 'Restaurantes y hoteles', seguros_financieros: 'Seguros y servicios financieros',
  cuidado_personal: 'Cuidado personal, protección social y otros', estacionales: 'Estacionales', regulados: 'Regulados', resto: 'Resto IPCBA',
};

/** Mes en que se empalman las dos bases del IPCBA (último mes de la base anterior). */
export const CABA_LINK_PERIOD = '2022-02';

/**
 * Errores conocidos de la API. Cada corrección se aplica solo si el valor de la fuente sigue siendo el erróneo:
 * si la API se corrige, la corrección deja de aplicarse sola.
 */
export const EXTERNAL_CORRECTIONS = [
  {
    target: 'caba.base2021.estacionales', from: '2022-02', to: '2023-09', when: 'equals:caba.base2021.nivel_general', value: null,
    reason: 'La API repite el nivel general en la serie de estacionales durante 20 meses. Esos meses quedan sin dato.',
  },
  {
    target: 'caba.base2021.recreacion', from: '2026-01', to: '2026-01', when: 'equals:caba.base2021.educacion', value: 'rate:caba.base2021.recreacion:0.074',
    reason: 'La API repite el valor de educación. Se reconstruyó con la variación publicada para enero 2026 (+7,4%).',
    source: 'https://www.canal26.com/economia/2026/02/09/la-inflacion-en-caba-fue-de-31-en-enero-marco-la-mayor-alza-en-10-meses/',
  },
];

/** Cifras publicadas que el dataset tiene que reproducir (validación). */
export const EXTERNAL_CHECKS = [
  { what: 'IPCBA ago-2026 índice', series: 'caba', period: '2026-08', level: 2596.6, tol: 0.006 },
  { what: 'IPCBA 2022 (dic/dic)', series: 'caba', from: '2021-12', to: '2022-12', pct: 93.4 },
  { what: 'IPCBA 2023 (dic/dic)', series: 'caba', from: '2022-12', to: '2023-12', pct: 198.4 },
  { what: 'IPCBA 2025 (dic/dic)', series: 'caba', from: '2024-12', to: '2025-12', pct: 31.8 },
  { what: 'IPCBA ago-2026 mensual', series: 'caba', from: '2026-07', to: '2026-08', pct: 1.7 },
  { what: 'Índice de salarios jul-2026 mensual', series: 'salarios.total', from: '2026-06', to: '2026-07', pct: 2.8 },
  { what: 'Índice de salarios jul-2026 interanual', series: 'salarios.total', from: '2025-07', to: '2026-07', pct: 36.2 },
  { what: 'CBT GBA jun-2026', series: 'canasta.cbt', period: '2026-06', level: 495622.3, tol: 0.005 },
  { what: 'SMVM sep-2026', series: 'smvm', period: '2026-09', level: 383800, tol: 0.5 },
  { what: 'SMVM abr-2027 (cronograma)', series: 'smvm', period: '2027-04', level: 437000, tol: 0.5 },
];

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** CSV de la API → { [destino]: { [YYYY-MM]: valor } }. Las columnas se asignan por posición. */
export function parseApiCsvByOrder(text, ids, { daily = false } = {}) {
  const { rows } = parseCsv(text);
  const [header, ...data] = rows;
  if (!header || header[0].trim() !== 'indice_tiempo') throw new Error('CSV de la API sin columna indice_tiempo');
  if (header.length - 1 !== ids.length) throw new Error(`El CSV tiene ${header.length - 1} columnas y se esperaban ${ids.length}`);
  const out = Object.fromEntries(ids.map(([, target]) => [target, {}]));
  for (const row of data) {
    const key = daily ? String(row[0]).trim().slice(0, 10) : parsePeriod(row[0]);
    if (!key) continue;
    ids.forEach(([, target], j) => {
      const v = parseNumber(row[j + 1]);
      if (v != null) out[target][key] = v;
    });
  }
  return out;
}

function mergeInto(acc, part) {
  for (const [target, values] of Object.entries(part)) acc[target] = { ...(acc[target] ?? {}), ...values };
  return acc;
}

export function apiUrl(q) {
  const ids = q.ids.map(([id]) => id).join(',');
  let url = `${API_BASE}?ids=${ids}&format=csv&limit=1000&start_date=${q.start}`;
  if (q.end) url += `&end_date=${q.end}`;
  if (q.collapse) url += `&collapse=${q.collapse}&collapse_aggregation=end_of_period`;
  return url;
}

export async function readExternosFromApi() {
  const raw = {};
  for (const q of API_QUERIES) mergeInto(raw, parseApiCsvByOrder(decodeText(await fetchWithRetry(apiUrl(q))), q.ids));
  const since = new Date(Date.now() - UVA_DAILY.days * 86400000).toISOString().slice(0, 10);
  const dailyUrl = `${API_BASE}?ids=${UVA_DAILY.id}&format=csv&limit=1000&start_date=${since}`;
  const uvaDaily = parseApiCsvByOrder(decodeText(await fetchWithRetry(dailyUrl)), [[UVA_DAILY.id, 'uva']], { daily: true }).uva;
  return { via: 'api', raw, uvaDaily };
}

export async function readExternosFromDir(dir) {
  const raw = {};
  for (const q of API_QUERIES) mergeInto(raw, parseApiCsvByOrder(await readFile(path.join(dir, q.file), 'utf8'), q.ids));
  const uvaDir = path.join(dir, UVA_DAILY.dir);
  const files = (await readdir(uvaDir)).filter((f) => UVA_DAILY.fileGlob.test(f)).sort();
  let uvaDaily = {};
  for (const f of files) uvaDaily = { ...uvaDaily, ...parseApiCsvByOrder(await readFile(path.join(uvaDir, f), 'utf8'), [[UVA_DAILY.id, 'uva']], { daily: true }).uva };
  return { via: 'api-offline', raw, uvaDaily };
}

/** ICL diario del BCRA (JSON de la API v4.0) → { 'YYYY-MM-DD': valor }. */
export function parseBcraJson(text) {
  const json = JSON.parse(text);
  const det = json?.results?.[0]?.detalle;
  if (!Array.isArray(det)) throw new Error('Respuesta del BCRA sin results[0].detalle');
  const out = {};
  for (const { fecha, valor } of det) if (typeof fecha === 'string' && Number.isFinite(valor)) out[fecha.slice(0, 10)] = Math.round(valor * 100) / 100;
  return out;
}

export async function readIclFromBcra({ until = new Date() } = {}) {
  const out = {};
  for (let y = 2020; y <= until.getFullYear() + 1; y++) {
    const desde = y === 2020 ? ICL_START : `${y}-01-01`;
    const url = `${BCRA_API}/${BCRA_ICL_VARIABLE}?desde=${desde}&hasta=${y}-12-31&limit=3000`;
    Object.assign(out, parseBcraJson(decodeText(await fetchWithRetry(url))));
  }
  return out;
}

export async function readIclFromDir(dir) {
  const files = (await readdir(dir)).filter((f) => /^icl_\d{4}\.csv$/.test(f)).sort();
  const out = {};
  for (const f of files) {
    const { rows } = parseCsv(await readFile(path.join(dir, f), 'utf8'));
    for (const [fecha, valor] of rows.slice(1)) {
      const v = parseNumber(valor);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(fecha).trim()) && v != null) out[String(fecha).trim()] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

/** Mapa {período: valor} → { start, values } continuo (null en los meses sin dato). */
export function toSeries(map, { from, to } = {}) {
  const keys = Object.keys(map).filter((k) => map[k] != null).sort();
  if (!keys.length) return null;
  const start = from && from > keys[0] ? from : keys[0];
  const end = to && to < keys[keys.length - 1] ? to : keys[keys.length - 1];
  const values = [];
  for (let i = toMonthIndex(start); i <= toMonthIndex(end); i++) {
    const p = addMonths(start, i - toMonthIndex(start));
    values.push(map[p] ?? null);
  }
  // Recorta nulos al principio y al final.
  let s = 0;
  while (s < values.length && values[s] == null) s++;
  let e = values.length - 1;
  while (e >= s && values[e] == null) e--;
  return { start: addMonths(start, s), values: values.slice(s, e + 1) };
}

export function valueAtSeries(series, period) {
  if (!series) return undefined;
  const i = toMonthIndex(period) - toMonthIndex(series.start);
  return i >= 0 && i < series.values.length ? series.values[i] ?? undefined : undefined;
}

function applyCorrections(raw) {
  const applied = [];
  for (const c of EXTERNAL_CORRECTIONS) {
    const series = raw[c.target];
    if (!series) continue;
    for (let i = toMonthIndex(c.from); i <= toMonthIndex(c.to); i++) {
      const p = addMonths(c.from, i - toMonthIndex(c.from));
      const src = series[p];
      if (src == null) continue;
      const [kind, ref] = c.when.split(':');
      if (kind === 'equals' && raw[ref]?.[p] !== src) continue; // la fuente ya no tiene el error
      let value = c.value;
      if (typeof value === 'string' && value.startsWith('rate:')) {
        const [, base, rate] = value.split(':');
        const prev = raw[base]?.[addMonths(p, -1)];
        if (prev == null) continue;
        value = Math.round(prev * (1 + Number(rate)) * 100) / 100;
      }
      if (value == null) delete series[p];
      else series[p] = value;
      applied.push({ target: c.target, period: p, sourceValue: src, value, reason: c.reason, ...(c.source ? { source: c.source } : {}) });
    }
  }
  return applied;
}

/** IPCBA empalmado: base 2021 desde el mes de empalme; antes, la base anterior reescalada. */
export function linkCaba(raw) {
  const oldS = raw['caba.base2011.nivel_general'] ?? {};
  const newS = raw['caba.base2021.nivel_general'] ?? {};
  const kOld = oldS[CABA_LINK_PERIOD];
  const kNew = newS[CABA_LINK_PERIOD];
  if (!(kOld > 0 && kNew > 0)) throw new Error(`Falta el mes de empalme del IPCBA (${CABA_LINK_PERIOD}) en alguna de las bases`);
  const out = {};
  for (const [p, v] of Object.entries(oldS)) if (p < CABA_LINK_PERIOD) out[p] = Math.round((v * kNew) / kOld * 10000) / 10000;
  for (const [p, v] of Object.entries(newS)) if (p >= CABA_LINK_PERIOD) out[p] = v;
  return out;
}

/** Detecta columnas que repiten a otra durante varios meses seguidos (error típico de la API). */
export function findDuplicatedRuns(raw, prefix, minRun = 3) {
  const keys = Object.keys(raw).filter((k) => k.startsWith(prefix));
  const found = [];
  for (const a of keys) for (const b of keys) {
    if (a >= b) continue;
    const periods = Object.keys(raw[a]).filter((p) => raw[b][p] != null).sort();
    let run = [];
    const flush = () => { if (run.length >= minRun) found.push({ a, b, from: run[0], to: run[run.length - 1], months: run.length }); run = []; };
    for (const p of periods) {
      if (raw[a][p] === raw[b][p]) run.push(p);
      else flush();
    }
    flush();
  }
  return found;
}

// --- UVA: regla de cálculo (misma que src/engine/uva.ts) ---------------------
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function isoAddDays(iso, n) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/** Variación mensual del IPC publicada (en %, con un decimal), calculada desde los índices. */
export function publishedRate(ipcLevels, period) {
  const a = ipcLevels[addMonths(period, -1)];
  const b = ipcLevels[period];
  if (!(a > 0 && b > 0)) return undefined;
  return Math.round(((b / a - 1) * 100 + 1e-7) * 10) / 10;
}

/** Factor diario de la UVA para el día `iso`: del 17 del mes m al 16 de m+1 rige el IPC de m−1. */
export function uvaDailyFactor(iso, ipcLevels) {
  let y = Number(iso.slice(0, 4));
  let m = Number(iso.slice(5, 7));
  if (Number(iso.slice(8, 10)) < 17) { m -= 1; if (m === 0) { m = 12; y -= 1; } }
  const period = `${y}-${String(m).padStart(2, '0')}`;
  const r = publishedRate(ipcLevels, addMonths(period, -1));
  if (r == null) return undefined;
  return (1 + r / 100) ** (1 / daysInMonth(y, m));
}

/** Último valor diario "real" (no repetido por fin de semana) de la ventana de la API. */
export function pickUvaAnchor(daily) {
  const days = Object.keys(daily).sort();
  for (let i = days.length - 1; i > 0; i--) if (daily[days[i]] !== daily[days[i - 1]]) return { date: days[i], value: daily[days[i]] };
  return null;
}

/** Valida la regla: cada fin de mes oficial tiene que coincidir con el cálculo (o con 1-5 días antes, por el arrastre). */
export function validateUvaRule({ anchor, finDeMes, ipcLevels, from = '2017-03' }) {
  const values = { [anchor.date]: anchor.value };
  let d = anchor.date;
  let v = anchor.value;
  const stop = `${from}-01`;
  while (d > stop) {
    const f = uvaDailyFactor(d, ipcLevels);
    if (f == null) break;
    v /= f; d = isoAddDays(d, -1); values[d] = v;
  }
  let checked = 0;
  const misses = [];
  for (const [p, official] of Object.entries(finDeMes)) {
    if (p < from || `${p}-31` > anchor.date) continue;
    const last = `${p}-${String(daysInMonth(Number(p.slice(0, 4)), Number(p.slice(5, 7)))).padStart(2, '0')}`;
    if (last >= anchor.date) continue;
    checked++;
    let ok = false;
    for (let back = 0; back <= 5 && !ok; back++) {
      const day = isoAddDays(last, -back);
      if (values[day] != null && Math.abs(Math.round(values[day] * 100) / 100 - official) <= 0.011) ok = true;
    }
    if (!ok) misses.push(p);
  }
  return { checked, misses };
}

function pctBetween(series, from, to) {
  const a = valueAtSeries(series, from);
  const b = valueAtSeries(series, to);
  return a > 0 && b > 0 ? (b / a - 1) * 100 : undefined;
}

/**
 * Arma los tres archivos de datos complementarios y su validación.
 * `ipc` es el dataset de INDEC ya generado (para la regla de la UVA).
 */
export function buildExternos({ via, raw: rawIn, uvaDaily }, icl, ipc) {
  const raw = structuredClone(rawIn);
  const errors = [];
  const warnings = [];
  const corrections = applyCorrections(raw);

  for (const dup of findDuplicatedRuns(raw, 'caba.base2021.', 3)) {
    warnings.push(`IPCBA: ${dup.a} repite a ${dup.b} entre ${dup.from} y ${dup.to} (${dup.months} meses). Revisar la fuente.`);
  }

  // --- IPC provinciales -------------------------------------------------------
  const indices = {};
  const cabaLinked = linkCaba(raw);
  const sources = { caba: cabaLinked, ...Object.fromEntries(Object.keys(PROVINCIAL_META).filter((k) => k !== 'caba').map((k) => [k, raw[`prov.${k}`] ?? {}])) };
  for (const [id, map] of Object.entries(sources)) {
    const s = toSeries(map);
    if (!s) { errors.push(`${id}: sin datos`); continue; }
    const last = addMonths(s.start, s.values.length - 1);
    const gaps = s.values.filter((v) => v == null).length;
    const values = s.values.map((v) => (v == null ? null : Math.round(v * 1e4) / 1e4));
    indices[id] = { id, ...PROVINCIAL_META[id], start: s.start, last, values, gaps };
    for (let i = 1; i < s.values.length; i++) {
      const a = s.values[i - 1];
      const b = s.values[i];
      if (a > 0 && b > 0 && (b / a > 1.6 || b / a < 0.85)) warnings.push(`${id}: variación extrema ${((b / a - 1) * 100).toFixed(1)}% en ${addMonths(s.start, i)}`);
    }
  }
  // Las series de control deben coincidir con las principales donde se superponen.
  const ctl = [['control.tucuman_199_2', 'prov.tucuman'], ['control.chaco_464_2', 'prov.chaco']];
  for (const [c, main] of ctl) {
    const a = raw[c] ?? {};
    const b = raw[main] ?? {};
    const common = Object.keys(a).filter((p) => b[p] != null && p >= '2018-01');
    const worst = Math.max(0, ...common.map((p) => Math.abs(a[p] / b[p] - 1)));
    if (worst > 0.005) warnings.push(`${main}: la serie de control ${c} difiere hasta ${(worst * 100).toFixed(2)}%`);
  }

  const cabaDetail = {};
  for (const k of Object.keys(CABA_DETAIL_NAMES)) {
    const s = toSeries(raw[`caba.base2021.${k}`] ?? {}, { from: CABA_LINK_PERIOD });
    if (s) cabaDetail[k] = s;
  }
  const detailStart = CABA_LINK_PERIOD;
  const detailLast = indices.caba?.last;
  const cabaDetalle = {
    start: detailStart, last: detailLast, base: '2021 = 100', names: CABA_DETAIL_NAMES,
    series: Object.fromEntries(Object.entries(cabaDetail).map(([k, s]) => {
      const pad = toMonthIndex(s.start) - toMonthIndex(detailStart);
      const values = [...Array(Math.max(0, pad)).fill(null), ...s.values];
      while (values.length < toMonthIndex(detailLast) - toMonthIndex(detailStart) + 1) values.push(null);
      return [k, values];
    })),
  };

  // --- Ingresos -----------------------------------------------------------
  const ser = (k) => toSeries(raw[k] ?? {});
  const salarios = Object.fromEntries(['total', 'registrado', 'privado_registrado', 'publico', 'no_registrado'].map((k) => [k, ser(`salarios.${k}`)]));
  const ingresos = {
    salarios: { base: 'octubre 2016 = 100', producer: 'INDEC', series: salarios },
    ripte: { producer: 'Secretaría de Seguridad Social', unit: 'pesos', ...ser('ripte') },
    canasta: { producer: 'INDEC', region: 'Gran Buenos Aires', unit: 'pesos por adulto equivalente', cba: ser('canasta.cba'), cbt: ser('canasta.cbt') },
    smvm: { producer: 'Consejo Nacional del Empleo, la Productividad y el SMVM', unit: 'pesos por mes (jornada completa)', ...ser('smvm') },
    haberMinimo: { producer: 'ANSES / Secretaría de Seguridad Social', unit: 'pesos por mes, sin bono', ...ser('haber_minimo') },
  };
  for (const [k, s] of Object.entries(salarios)) if (!s) errors.push(`índice de salarios ${k}: sin datos`);

  // --- BCRA --------------------------------------------------------------
  const iclDays = Object.keys(icl).sort();
  const iclValues = [];
  if (!iclDays.length || iclDays[0] !== ICL_START) errors.push(`ICL: la serie tiene que empezar el ${ICL_START}`);
  for (let d = iclDays[0], k = 0; d && d <= iclDays[iclDays.length - 1]; d = isoAddDays(d, 1), k++) {
    const v = icl[d];
    if (v == null) { errors.push(`ICL: falta el ${d}`); break; }
    if (iclValues.length && v < iclValues[iclValues.length - 1]) warnings.push(`ICL: baja el ${d}`);
    iclValues.push(v);
  }
  const finDeMesMap = raw['uva.fin_de_mes'] ?? {};
  const finDeMes = toSeries(finDeMesMap);
  const anchor = uvaDaily ? pickUvaAnchor(uvaDaily) : null;
  const ipcLevels = {};
  if (ipc) {
    const ng = ipc.series.nacional.nivel_general;
    ng.forEach((v, i) => { ipcLevels[addMonths(ipc.meta.first, i)] = v; });
  }
  let uvaRule = null;
  if (anchor && ipc) {
    uvaRule = validateUvaRule({ anchor, finDeMes: finDeMesMap, ipcLevels });
    if (uvaRule.checked < 12) warnings.push(`UVA: solo se pudieron controlar ${uvaRule.checked} fines de mes`);
    if (uvaRule.misses.length) errors.push(`UVA: la regla de cálculo no reproduce ${uvaRule.misses.length} fines de mes (${uvaRule.misses.slice(0, 5).join(', ')})`);
  } else warnings.push('UVA: sin ventana diaria o sin IPC; no se validó la regla');
  const bcra = {
    icl: { producer: 'BCRA', base: '30/6/2020 = 1', start: iclDays[0], last: iclDays[iclDays.length - 1], values: iclValues },
    uva: {
      producer: 'BCRA', base: '31/3/2016 = 14,05', finDeMes, anchor,
      rule: 'Del día 17 del mes m al 16 del mes m+1, la UVA crece cada día (1 + IPC de m−1 publicado, con un decimal)^(1/días del mes m).',
      validation: uvaRule,
    },
  };

  // --- Controles contra cifras publicadas --------------------------------
  const lookup = (name) => {
    if (name === 'caba') return indices.caba;
    if (name.startsWith('salarios.')) return salarios[name.slice(9)];
    if (name === 'canasta.cbt') return ingresos.canasta.cbt;
    if (name === 'smvm') return toSeries(raw.smvm ?? {});
    return null;
  };
  const checks = [];
  for (const c of EXTERNAL_CHECKS) {
    const s = lookup(c.series);
    let ok;
    let got;
    if (c.level != null) { got = valueAtSeries(s, c.period); ok = got != null && Math.abs(got - c.level) <= c.tol; }
    else { got = pctBetween(s, c.from, c.to); ok = got != null && Math.abs(Math.round(got * 10) / 10 - c.pct) < 0.051; }
    if (got == null) continue; // el período ya no está en la ventana (o todavía no existe)
    checks.push({ what: c.what, expected: c.level ?? c.pct, got: Math.round(got * 1000) / 1000, ok });
    if (!ok) errors.push(`No coincide con lo publicado: ${c.what} (esperado ${c.level ?? c.pct}, da ${got.toFixed(3)})`);
  }

  const status = errors.length ? 'error' : warnings.length ? 'warning' : 'ok';
  const generatedAt = new Date().toISOString();
  const meta = { via, generatedAt, validation: { status, errors, warnings, checks }, corrections };
  return {
    externos: { schema: 1, meta, indices, cabaDetalle },
    ingresos: { schema: 1, meta: { via, generatedAt }, ...ingresos },
    bcra: { schema: 1, meta: { via, generatedAt, icl: 'api.bcra.gob.ar v4.0, variable 40', uva: 'API de Series de Tiempo 94.2_UVAD_D_0_0_10' }, ...bcra },
    status,
  };
}
