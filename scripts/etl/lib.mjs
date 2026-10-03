/** Utilidades compartidas del proceso de datos (sin dependencias externas). */

export function toMonthIndex(p) {
  const [y, m] = p.split('-').map(Number);
  return y * 12 + (m - 1);
}
export function fromMonthIndex(i) {
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}
export function addMonths(p, n) {
  return fromMonthIndex(toMonthIndex(p) + n);
}

const MONTHS_ES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

/** Acepta '2016-12-01', '2016-12', '201612', '12/2016', 'dic-16', 'dic-2016'. Devuelve 'YYYY-MM' o null. */
export function parsePeriod(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  let m;
  if ((m = /^(\d{4})-(\d{2})(-\d{2})?$/.exec(s))) return `${m[1]}-${m[2]}`;
  if ((m = /^(\d{4})(\d{2})$/.exec(s))) return `${m[1]}-${m[2]}`;
  if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) return `${m[2]}-${m[1].padStart(2, '0')}`;
  if ((m = /^([a-z]{3})[a-z]*[-\s/.]+(\d{2}|\d{4})$/.exec(s)) && MONTHS_ES[m[1]]) {
    const y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return `${y}-${String(MONTHS_ES[m[1]]).padStart(2, '0')}`;
  }
  return null;
}

/** Número con punto o coma decimal ("1.234,56", "1234.56", "1234,56"). NA/vacío → null. */
export function parseNumber(raw) {
  let s = String(raw ?? '').trim();
  if (s === '' || /^(na|n\/a|nan|-|s\/d|\/\/\/)$/i.test(s)) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza texto para comparar: minúsculas, sin acentos, espacios simples. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clave estable de un subgrupo: 'apertura:' + nombre normalizado (igual que src/domain/data.ts → aperturaKey). */
export function aperturaKey(name) {
  return `apertura:${norm(name).replace(/ /g, '_')}`;
}

/**
 * Mismo contenido que el archivo anterior, sin contar la fecha de generación ni la validación.
 * Si da true no se reescribe el archivo: así el workflow diario no commitea (ni redespliega) sin datos nuevos.
 */
export function sameContent(next, prev) {
  if (!next || !prev) return false;
  const strip = ({ meta = {}, ...rest }) => {
    const { generatedAt: _g, validation: _v, ...m } = meta;
    return JSON.stringify({ ...rest, meta: m });
  };
  return strip(next) === strip(prev);
}

/** Parser CSV mínimo con comillas, delimitador autodetectado (; o ,). */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? undefined : clean.indexOf('\n'));
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row); }
  return { delimiter: delim, rows };
}

/** Decodifica bytes como UTF-8 y, si aparecen caracteres inválidos, como latin-1 (habitual en INDEC). */
export function decodeText(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('latin1').decode(buf);
}

export async function fetchWithRetry(url, { tries = 3, timeoutMs = 45000 } = {}) {
  let lastErr;
  for (let k = 0; k < tries; k++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'mi-inflacion-etl/0.1 (+datos abiertos)' } });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
    }
  }
  throw lastErr;
}
