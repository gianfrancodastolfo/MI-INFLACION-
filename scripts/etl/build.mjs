/**
 * Normaliza observaciones a la estructura publicada en src/data/ipc.json y la valida.
 */
import {
  API_CORRECTIONS, APERTURA_PARENT_BY_NAME, BASE_PERIOD, CONSISTENCY_ERROR, CONSISTENCY_WARN, CORE_CATEGORIES, DIVISIONS,
  DIVISION_BY_CODE, EXTRA_CATEGORIES_NATIONAL, KNOWN_QUIRKS, OFFICIAL_WEIGHTS, REGIONS, REGION_SHARES,
} from './config.mjs';
import { addMonths, aperturaKey, toMonthIndex } from './lib.mjs';

const PARENT_BY_KEY = Object.fromEntries(Object.entries(APERTURA_PARENT_BY_NAME).map(([name, d]) => [aperturaKey(name), d]));

function parentOfApertura(key, code) {
  if (PARENT_BY_KEY[key]) return PARENT_BY_KEY[key];
  // Solo códigos COICOP con punto (01.1, 01.1.1): un código correlativo como "111" no indica la división.
  const m = /^(\d{2})\.\d/.exec(String(code ?? '').trim());
  return m && DIVISION_BY_CODE[m[1]] ? DIVISION_BY_CODE[m[1]] : null;
}

/**
 * Subgrupos por región, alineados al mismo calendario que las series principales.
 * Solo se incluyen los que tienen división conocida y datos completos; el resto se informa como advertencia.
 */
export function buildAperturas(observations, { first, last }) {
  const n = toMonthIndex(last) - toMonthIndex(first) + 1;
  const byKey = new Map();
  const names = {};
  const parents = {};
  const warnings = [];
  for (const o of observations) {
    if (!String(o.category).startsWith('apertura:')) continue;
    const parent = parentOfApertura(o.category, o.code);
    if (!parent) { names[o.category] ??= o.name; continue; }
    names[o.category] = o.name;
    parents[o.category] = parent;
    const k = `${o.region}|${o.category}`;
    if (!byKey.has(k)) byKey.set(k, new Map());
    byKey.get(k).set(o.period, o.value);
  }
  const unknown = Object.keys(names).filter((k) => !parents[k]);
  if (unknown.length) warnings.push(`Subgrupos sin división conocida (no se usan): ${unknown.map((k) => names[k]).join('; ')}`);
  const aperturas = {};
  for (const [k, m] of byKey) {
    const [region, key] = k.split('|');
    const values = Array.from({ length: n }, (_, i) => m.get(addMonths(first, i)) ?? null);
    const firstVal = values.find((v) => v != null);
    const complete = values.every((v) => v != null && v > 0);
    if (!complete) { warnings.push(`${region}/${names[key]}: serie incompleta, no se usa`); continue; }
    // Rebase a 100 en el primer mes si la fuente usa otra base (no cambia ninguna variación).
    const scale = firstVal && Math.abs(firstVal - 100) > 1e-9 ? 100 / firstVal : 1;
    aperturas[region] ??= {};
    aperturas[region][key] = scale === 1 ? values : values.map((v) => Number((v * scale).toFixed(6)));
  }
  return { aperturas, aperturaNames: names, aperturaParent: parents, warnings };
}

export function buildDataset(source, { generatedAt = new Date().toISOString(), aperturas: aperturasSource } = {}) {
  const { observations, via, url } = source;
  const byKey = new Map(); // region|category -> Map(period -> value)
  let last = BASE_PERIOD;
  for (const o of observations) {
    if (toMonthIndex(o.period) < toMonthIndex(BASE_PERIOD)) continue;
    const k = `${o.region}|${o.category}`;
    if (!byKey.has(k)) byKey.set(k, new Map());
    byKey.get(k).set(o.period, o.value);
    if (toMonthIndex(o.period) > toMonthIndex(last)) last = o.period;
  }

  const corrections = [];
  if (via.startsWith('api')) {
    for (const c of API_CORRECTIONS) {
      const m = byKey.get(`${c.region}|${c.category}`);
      const current = m?.get(c.period);
      if (current != null && Math.abs(current - c.sourceValue) < 1e-6) {
        m.set(c.period, c.value);
        corrections.push(c);
      }
    }
  }

  const n = toMonthIndex(last) - toMonthIndex(BASE_PERIOD) + 1;
  const series = {};
  for (const region of REGIONS) {
    const cats = region === 'nacional' ? [...CORE_CATEGORIES, ...EXTRA_CATEGORIES_NATIONAL] : CORE_CATEGORIES;
    for (const category of cats) {
      const m = byKey.get(`${region}|${category}`);
      if (!m) continue;
      const values = Array.from({ length: n }, (_, k) => {
        const v = m.get(addMonths(BASE_PERIOD, k));
        return v == null ? null : v;
      });
      series[region] ??= {};
      series[region][category] = values;
    }
  }

  const dataset = {
    schema: 1,
    meta: {
      indicator: 'IPC',
      title: 'Índice de precios al consumidor (IPC). Base diciembre 2016 = 100',
      producer: 'INDEC',
      basket: 'ENGHo 2004/05; 12 divisiones COICOP; 6 regiones',
      via,
      url,
      base: BASE_PERIOD,
      first: BASE_PERIOD,
      last,
      generatedAt,
      corrections,
      validation: null,
    },
    regions: REGIONS,
    categories: [...CORE_CATEGORIES, ...EXTRA_CATEGORIES_NATIONAL],
    weights: OFFICIAL_WEIGHTS,
    regionShares: REGION_SHARES,
    series,
  };
  if (aperturasSource?.observations?.length) {
    const ap = buildAperturas(aperturasSource.observations, { first: BASE_PERIOD, last });
    if (Object.keys(ap.aperturas).length) {
      dataset.aperturas = ap.aperturas;
      dataset.aperturaNames = ap.aperturaNames;
      dataset.aperturaParent = ap.aperturaParent;
      dataset.meta.aperturas = { url: aperturasSource.url, via: aperturasSource.via, warnings: ap.warnings };
    }
  }
  dataset.meta.validation = validateDataset(dataset);
  return dataset;
}

function isQuirk(region, category, period) {
  return KNOWN_QUIRKS.some(
    (q) => q.period === period && q.category === category && (!q.region || q.region === region),
  );
}

export function validateDataset(ds, previous) {
  const errors = [];
  const warnings = [];
  const { series, meta } = ds;
  const n = toMonthIndex(meta.last) - toMonthIndex(meta.first) + 1;

  // 1. Estructura: todas las series núcleo presentes, base 100, sin huecos, valores positivos.
  for (const region of REGIONS) {
    for (const category of CORE_CATEGORIES) {
      const v = series[region]?.[category];
      if (!v) { errors.push(`Falta la serie ${region}/${category}`); continue; }
      if (v.length !== n) errors.push(`${region}/${category}: largo ${v.length}, esperado ${n}`);
      if (Math.abs((v[0] ?? 0) - 100) > 1e-6) errors.push(`${region}/${category}: no vale 100 en ${meta.first}`);
      v.forEach((x, k) => {
        if (x == null || !(x > 0)) errors.push(`${region}/${category}: dato faltante en ${addMonths(meta.first, k)}`);
      });
      // 2. Plausibilidad de variaciones mensuales. Hubo subas reales muy altas
      //    (educación +52,7% en mar-2024; bienes y servicios varios +57% en Patagonia en ene-2024),
      //    así que el umbral de error es amplio y lo extremo solo se informa.
      for (let k = 1; k < v.length; k++) {
        if (v[k] == null || v[k - 1] == null) continue;
        const r = v[k] / v[k - 1] - 1;
        const at = addMonths(meta.first, k);
        if (r < -0.3 || r > 1.0) errors.push(`${region}/${category}: variación implausible ${(r * 100).toFixed(1)}% en ${at}`);
        else if (r > 0.4 || r < -0.15) warnings.push(`${region}/${category}: variación extrema ${(r * 100).toFixed(1)}% en ${at} (revisar)`);
      }
    }
  }

  // 2b. Categorías analíticas nacionales: completas y plausibles (advertencia, no error).
  for (const category of EXTRA_CATEGORIES_NATIONAL) {
    const v = series.nacional?.[category];
    if (!v) { warnings.push(`Sin serie nacional/${category}`); continue; }
    for (let k = 1; k < v.length; k++) {
      if (v[k] == null || v[k - 1] == null) { warnings.push(`nacional/${category}: dato faltante en ${addMonths(meta.first, k)}`); continue; }
      const r = v[k] / v[k - 1] - 1;
      if (r < -0.3 || r > 1.0) errors.push(`nacional/${category}: variación implausible ${(r * 100).toFixed(1)}% en ${addMonths(meta.first, k)}`);
    }
  }

  // 3. Consistencia: nivel general ≈ Σ ponderación oficial × división (por región).
  const consistency = {};
  for (const region of Object.keys(OFFICIAL_WEIGHTS)) {
    const w = OFFICIAL_WEIGHTS[region];
    const total = DIVISIONS.reduce((a, d) => a + w[d], 0);
    let maxDev = 0;
    let maxAt = null;
    for (let k = 0; k < n; k++) {
      const g = series[region]?.nivel_general?.[k];
      if (g == null) continue;
      let s = 0;
      let okRow = true;
      for (const d of DIVISIONS) {
        const x = series[region]?.[d]?.[k];
        if (x == null) { okRow = false; break; }
        s += (w[d] / total) * x;
      }
      if (!okRow) continue;
      const dev = Math.abs(s / g - 1);
      const period = addMonths(meta.first, k);
      if (dev > Math.abs(maxDev)) { maxDev = dev; maxAt = period; }
      if (dev > CONSISTENCY_ERROR) errors.push(`${region} ${period}: nivel general difiere ${(dev * 100).toFixed(3)}% de la suma ponderada de divisiones`);
      else if (dev > CONSISTENCY_WARN && !isQuirk(region, 'nivel_general', period)) {
        warnings.push(`${region} ${period}: desvío ${(dev * 100).toFixed(3)}% entre nivel general y divisiones`);
      }
    }
    consistency[region] = { maxDeviation: Number(maxDev.toFixed(6)), at: maxAt };
  }

  // 4. Revisiones: INDEC no revisa el IPC. Si un valor histórico cambia, se avisa.
  const revisions = [];
  if (previous?.series) {
    for (const region of Object.keys(previous.series)) {
      for (const [category, old] of Object.entries(previous.series[region])) {
        const cur = series[region]?.[category];
        if (!cur) continue;
        for (let k = 0; k < Math.min(old.length, cur.length); k++) {
          if (old[k] != null && cur[k] != null && Math.abs(cur[k] / old[k] - 1) > 1e-6) {
            revisions.push(`${region}/${category} ${addMonths(meta.first, k)}: ${old[k]} → ${cur[k]}`);
          }
        }
      }
    }
    if (revisions.length) warnings.push(`${revisions.length} valores históricos cambiaron respecto de la versión anterior`);
    if (toMonthIndex(meta.last) < toMonthIndex(previous.meta.last)) {
      errors.push(`La fuente termina en ${meta.last}, antes que la versión anterior (${previous.meta.last})`);
    }
  }

  return {
    status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
    errors: errors.slice(0, 50),
    warnings: warnings.slice(0, 50),
    consistency,
    revisions: revisions.slice(0, 50),
  };
}
