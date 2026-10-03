#!/usr/bin/env node
/**
 * Actualiza los datos complementarios: IPC de CABA y provincias, salarios, canasta, SMVM,
 * haber mínimo (src/data/externos.json, src/data/ingresos.json) y UVA/ICL del BCRA (src/data/bcra.json).
 *
 *   npm run data:externos                                   # con red (API de Series de Tiempo + API del BCRA)
 *   npm run data:externos -- --from-dir=data-raw/api-snapshot-2026-10 --icl-dir=data-raw/bcra-api   # sin red
 *   npm run data:externos -- --validate-only
 *
 * Necesita src/data/ipc.json (lo usa para validar la regla de la UVA).
 * Si la validación da error, no se pisa ningún archivo.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExternos, readExternosFromApi, readExternosFromDir, readIclFromBcra, readIclFromDir } from './externos.mjs';
import { sameContent } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = {
  externos: path.join(ROOT, 'src/data/externos.json'),
  ingresos: path.join(ROOT, 'src/data/ingresos.json'),
  bcra: path.join(ROOT, 'src/data/bcra.json'),
};
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

async function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, file);
}

async function main() {
  const ipc = await readJson(path.join(ROOT, 'src/data/ipc.json'));
  if (!ipc) throw new Error('Falta src/data/ipc.json: corré antes npm run data:update');

  if (args['validate-only']) {
    const ex = await readJson(OUT.externos);
    if (!ex) throw new Error(`No existe ${OUT.externos}`);
    console.log(JSON.stringify(ex.meta.validation, null, 2));
    process.exit(ex.meta.validation.status === 'error' ? 1 : 0);
  }

  console.log('→ Leyendo IPC de CABA y provincias, salarios, canasta y referencias…');
  const source = args['from-dir'] ? await readExternosFromDir(path.resolve(String(args['from-dir']))) : await readExternosFromApi();

  let icl;
  try {
    console.log('→ Leyendo ICL del BCRA…');
    icl = args['icl-dir'] ? await readIclFromDir(path.resolve(String(args['icl-dir']))) : await readIclFromBcra();
  } catch (e) {
    const prev = await readJson(OUT.bcra);
    if (!prev?.icl?.values?.length) throw e;
    console.warn(`  ⚠ No se pudo leer el ICL (${e.message}). Se mantiene la serie anterior (hasta ${prev.icl.last}).`);
    icl = {};
    const d = new Date(`${prev.icl.start}T00:00:00Z`);
    for (const v of prev.icl.values) { icl[d.toISOString().slice(0, 10)] = v; d.setUTCDate(d.getUTCDate() + 1); }
  }

  const out = buildExternos(source, icl, ipc);
  const v = out.externos.meta.validation;
  console.log(`  estado=${v.status} errores=${v.errors.length} advertencias=${v.warnings.length} correcciones=${out.externos.meta.corrections.length} controles=${v.checks.length}`);
  for (const w of v.warnings) console.warn(`  ⚠ ${w}`);
  if (v.status === 'error') {
    console.error('  ✗ Validación con errores:\n   - ' + v.errors.join('\n   - '));
    console.error('  Se mantienen los archivos anteriores.');
    process.exit(1);
  }
  const changed = [];
  for (const key of ['externos', 'ingresos', 'bcra']) {
    if (sameContent(out[key], await readJson(OUT[key]))) continue;
    await writeAtomic(OUT[key], out[key]);
    changed.push(path.basename(OUT[key]));
  }
  const caba = out.externos.indices.caba;
  if (!changed.length) console.log(`✓ Sin datos nuevos (IPCBA hasta ${caba.last}; ICL hasta ${out.bcra.icl.last}). No se reescriben los archivos.`);
  else console.log(`✓ Actualizados: ${changed.join(', ')}. IPCBA hasta ${caba.last}; ICL hasta ${out.bcra.icl.last}; UVA anclada el ${out.bcra.uva.anchor?.date}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
