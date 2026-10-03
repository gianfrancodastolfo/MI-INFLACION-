#!/usr/bin/env node
/**
 * Actualiza los precios promedio de INDEC (src/data/precios.json).
 *
 *   npm run data:precios                                              # con red (API de Series de Tiempo)
 *   npm run data:precios -- --from-dir=data-raw/api-snapshot-2026-10  # sin red
 *   npm run data:precios -- --validate-only
 *
 * Si la validación da error, no se pisa el archivo.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sameContent } from './lib.mjs';
import { buildPrecios, readPreciosFromApi, readPreciosFromDir } from './precios.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'src/data/precios.json');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));

async function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, file);
}

async function main() {
  if (args['validate-only']) {
    const cur = JSON.parse(await readFile(OUT, 'utf8'));
    console.log(JSON.stringify(cur.meta.validation, null, 2));
    process.exit(cur.meta.validation.status === 'error' ? 1 : 0);
  }
  console.log('→ Leyendo precios promedio de INDEC…');
  const source = args['from-dir'] ? await readPreciosFromDir(path.resolve(String(args['from-dir']))) : await readPreciosFromApi();
  const out = buildPrecios(source);
  const v = out.meta.validation;
  console.log(`  estado=${v.status} errores=${v.errors.length} advertencias=${v.warnings.length} correcciones=${out.meta.corrections.length} controles=${v.checks}`);
  for (const w of v.warnings) console.warn(`  ⚠ ${w}`);
  if (v.status === 'error') {
    console.error('  ✗ Validación con errores:\n   - ' + v.errors.join('\n   - '));
    console.error('  Se mantiene el archivo anterior.');
    process.exit(1);
  }
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* primera vez */ }
  if (sameContent(out, previous)) {
    console.log(`✓ Sin datos nuevos (precios hasta ${out.meta.last}). No se reescribe el archivo.`);
    return;
  }
  await writeAtomic(OUT, out);
  console.log(`✓ Precios actualizados hasta ${out.meta.last} (${out.products.length} productos en GBA, ${out.products.filter((p) => p.regional).length} por región).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
