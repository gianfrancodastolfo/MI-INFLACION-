// Compila el servidor (gas/servidor.ts + src/core) a un único archivo para pegar en Apps Script.
// Uso: node scripts/build-gas.mjs          → escribe apps-script/StockFlores.gs
//      node scripts/build-gas.mjs --check  → falla si el archivo no está al día
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SALIDA = resolve(raiz, 'apps-script/StockFlores.gs');

// Funciones que Apps Script tiene que ver como globales (web app y menú de la planilla).
const GLOBALES = [
  'doGet',
  'doPost',
  'onOpen',
  'prepararPlanilla',
  'menuCrearUsuario',
  'menuRestablecerClave',
  'menuRevisarConsistencia',
];

const CABECERA = `/** @OnlyCurrentDoc */
// Stock Flores — servidor para Google Sheets.
// ARCHIVO GENERADO por scripts/build-gas.mjs desde gas/servidor.ts y src/core: no editar a mano.
// Instalación: ver docs/INSTALACION.md (pegar este archivo completo en Extensiones → Apps Script).
`;

export async function construir() {
  const r = await build({
    entryPoints: [resolve(raiz, 'gas/servidor.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'StockFlores',
    target: 'es2017',
    platform: 'neutral',
    write: false,
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
  });
  const cuerpo = r.outputFiles[0].text;
  const puentes = GLOBALES.map((n) => `function ${n}(e) {\n  return StockFlores.${n}(e);\n}`).join('\n');
  return `${CABECERA}\n${cuerpo}\n${puentes}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const codigo = await construir();
  if (process.argv.includes('--check')) {
    const actual = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8') : '';
    if (actual !== codigo) {
      console.error('apps-script/StockFlores.gs no está al día. Corré: npm run build:gas');
      process.exit(1);
    }
    console.log('apps-script/StockFlores.gs al día.');
  } else {
    writeFileSync(SALIDA, codigo);
    console.log(`Escrito ${SALIDA} (${(codigo.length / 1024).toFixed(1)} KB)`);
  }
}
