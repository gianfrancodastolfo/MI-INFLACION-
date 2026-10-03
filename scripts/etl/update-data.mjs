#!/usr/bin/env node
/**
 * Actualiza src/data/ipc.json con datos oficiales.
 *
 *   npm run data:update                     # INDEC (CSV) y, si falla, API de Series de Tiempo
 *   npm run data:update -- --source=api     # solo API
 *   npm run data:update -- --indec-file=serie_ipc_divisiones.csv
 *   npm run data:update -- --from-dir=ruta/a/csv_api   # sin red (CSV ya descargados de la API)
 *   npm run data:update -- --aperturas-file=serie_ipc_aperturas.csv   # subgrupos desde un archivo local
 *   npm run data:validate                   # valida el archivo actual sin descargar
 *
 * Si la descarga o la validación fallan, NO se pisa el archivo vigente:
 * la web sigue mostrando el último dato válido con su fecha de actualización.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, validateDataset } from './build.mjs';
import { sameContent } from './lib.mjs';
import { readAperturasFromIndec, readFromApi, readFromDir, readFromIndec, readIndecFile } from './sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'src/data/ipc.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

async function readPrevious() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

function summary(ds) {
  const v = ds.meta.validation;
  return `vía=${ds.meta.via} último=${ds.meta.last} estado=${v.status} errores=${v.errors.length} advertencias=${v.warnings.length} correcciones=${ds.meta.corrections.length}`;
}

async function main() {
  const previous = await readPrevious();

  if (args['validate-only']) {
    if (!previous) throw new Error(`No existe ${OUT}`);
    const v = validateDataset(previous);
    console.log(JSON.stringify(v, null, 2));
    process.exit(v.status === 'error' ? 1 : 0);
  }

  const attempts = [];
  if (args['from-dir']) attempts.push(['csv local (API)', () => readFromDir(path.resolve(String(args['from-dir'])))]);
  else if (args['indec-file']) attempts.push(['archivo INDEC', () => readIndecFile(path.resolve(String(args['indec-file'])))]);
  else {
    if (args.source !== 'api') attempts.push(['INDEC', readFromIndec]);
    if (args.source !== 'indec') attempts.push(['API Series de Tiempo', () => readFromApi()]);
  }

  // Subgrupos: opcionales. Si fallan, se publica igual con divisiones.
  let aperturas = null;
  const wantAperturas = args['aperturas-file'] || (!args['from-dir'] && args.source !== 'api' && !args['no-aperturas']);
  if (wantAperturas) {
    try {
      console.log('→ Leyendo subgrupos (aperturas) de INDEC…');
      aperturas = await readAperturasFromIndec(args['aperturas-file'] ? path.resolve(String(args['aperturas-file'])) : undefined);
      console.log(`  ${aperturas.aperturas.length} subgrupos distintos encontrados.`);
    } catch (e) {
      console.warn(`  ⚠ Sin subgrupos: ${e.message}`);
    }
  }

  for (const [label, read] of attempts) {
    try {
      console.log(`→ Leyendo ${label}…`);
      const source = await read();
      const ds = buildDataset(source, { aperturas });
      if (ds.meta.aperturas?.warnings?.length) for (const w of ds.meta.aperturas.warnings) console.warn(`  ⚠ ${w}`);
      ds.meta.validation = validateDataset(ds, previous);
      console.log(`  ${summary(ds)}`);
      if (ds.meta.validation.status === 'error') {
        console.error('  Validación con errores:\n   - ' + ds.meta.validation.errors.join('\n   - '));
        continue;
      }
      for (const w of ds.meta.validation.warnings) console.warn(`  ⚠ ${w}`);
      if (sameContent(ds, previous)) {
        console.log(`✓ Sin datos nuevos (último dato: ${ds.meta.last}). No se reescribe ${path.relative(ROOT, OUT)}.`);
        return;
      }
      const tmp = `${OUT}.tmp`;
      await writeFile(tmp, JSON.stringify(ds));
      await rename(tmp, OUT);
      console.log(`✓ ${path.relative(ROOT, OUT)} actualizado (último dato: ${ds.meta.last}).`);
      return;
    } catch (e) {
      console.error(`  ✗ ${label}: ${e.message}`);
    }
  }
  console.error(
    previous
      ? `✗ No se pudo actualizar. Se mantiene el último dato válido (${previous.meta.last}, generado ${previous.meta.generatedAt}).`
      : '✗ No se pudo generar el archivo de datos.',
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
