# Mi Inflación

Herramienta pública para Argentina que responde **¿cuánto debería ganar hoy para vivir como vivía en otra fecha?** de dos maneras:

- con el **IPC de INDEC**, el indicador oficial;
- con **tu inflación**, una estimación hecha con tu estructura de gastos y los índices oficiales de cada categoría en tu región.

Además: IPC de la Ciudad y de 7 provincias (fuente externa), calculadora de alquiler (IPC e ICL), cuota UVA, "¿le ganaste al promedio?" (índice de salarios), canasta básica del hogar, salario mínimo, jubilación mínima y "¿cuánto aumentó?" con los precios promedio de INDEC (59 productos en GBA, 14 por región).

> El IPC es el indicador estadístico oficial. La inflación personal es una estimación de la app con los datos que carga el usuario.

## Empezar

```bash
npm ci
npm run dev           # http://localhost:5173
npm test              # 137 tests: motor, datos reales y proceso de datos
npm run build         # sitio estático en dist/ (Netlify)
npm run build:preview # un solo HTML autocontenido en dist-preview/ (vista previa)
```

Requiere Node 22 (ver `.nvmrc`).

## Datos oficiales

```bash
npm run data:update                       # INDEC (CSV); si falla, API de Series de Tiempo
npm run data:update -- --source=api       # solo la API
npm run data:update -- --indec-file=serie_ipc_divisiones.csv   # archivo descargado a mano
npm run data:update -- --aperturas-file=serie_ipc_aperturas.csv  # subgrupos desde archivo local
npm run data:update -- --from-dir=data-raw/api-snapshot-2026-08 # sin red
npm run data:validate                     # valida src/data/ipc.json
npm run data:externos                     # CABA, provincias, salarios, canasta, SMVM, haber mínimo, UVA e ICL
npm run data:externos:offline             # lo mismo desde data-raw (sin red)
npm run data:precios                      # precios promedio de INDEC (GBA y regiones), con correcciones y 550 controles
npm run data:precios:offline              # lo mismo desde data-raw (sin red)
npm run data:all                          # IPC, complementarios y precios
```

Cada archivo de `src/data/` se reemplaza solo si pasa la validación, y no se reescribe si no hay datos nuevos. En producción los actualiza todos los días `.github/workflows/update-data.yml`; el commit dispara el deploy en Netlify. Los tests no dependen del último mes, así que el mes nuevo no traba la actualización.

## Estructura

```
src/engine/    motor de cálculo puro (períodos, inflación, sueldo, canasta personal, descomposición, simulador)
src/domain/    datos tipados, regiones, categorías, perfil → canasta, casos de uso, explicaciones, formatos, guardado local
src/ui/        React: páginas, componentes, gráficos SVG, router, estado
src/data/      ipc.json, externos.json, ingresos.json, bcra.json, precios.json (generados por el proceso de datos)
scripts/etl/   descarga, normalización, correcciones, validación
data-raw/      CSV crudos del snapshot actual (auditoría)
docs/          análisis, metodología, arquitectura, fuentes, hoja de ruta
```

## Documentación

- [docs/ANALISIS.md](docs/ANALISIS.md): qué datos existen, límites, decisiones y qué cambiaría del planteo inicial
- [docs/METODOLOGIA.md](docs/METODOLOGIA.md): fórmulas
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): arquitectura, modelo de datos (SQL de la fase 2) y privacidad
- [docs/FUENTES.md](docs/FUENTES.md): registro de fuentes, identificadores, validaciones y correcciones
- [docs/ROADMAP.md](docs/ROADMAP.md): hoja de ruta
- [HANDOFF.md](HANDOFF.md): estado actual y próximos pasos, con un prompt listo para continuar
