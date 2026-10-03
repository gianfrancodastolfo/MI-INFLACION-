# HANDOFF: Mi Inflación (estado al 2/10/2026)

Este archivo es para continuar el proyecto en otra sesión con más permisos (red abierta, GitHub, Netlify). Arriba está el prompt para pegar; abajo, el detalle de cada tarea.

---

## Prompt para pegar en el otro chat

```
Te paso el proyecto "Mi Inflación" (adjunto mi-inflacion.zip). Es una web para Argentina que calcula cuánto
debería ganar una persona hoy para mantener su poder adquisitivo, según el IPC de INDEC y según su inflación
personal (sus gastos valuados con los índices oficiales de su región).

El MVP (fase 1) ya está construido y testeado en otra sesión que NO tenía acceso de red a indec.gob.ar.
Tu trabajo es terminar lo que requiere red y permisos, sin rehacer lo que ya funciona.

Antes de tocar código:
1. Descomprimí el zip y leé HANDOFF.md completo, y después docs/ANALISIS.md, docs/METODOLOGIA.md,
   docs/ARQUITECTURA.md y docs/FUENTES.md.
2. Corré: npm ci && npm test && npm run build. Tienen que pasar los 137 tests.

Tareas, en este orden (el detalle y los criterios de aceptación están en HANDOFF.md):
0. Conseguir de INDEC la tabla completa de ponderaciones de la canasta 2017/18 (tarea 6b).
1. Datos directo de INDEC: bajar serie_ipc_divisiones.csv, confirmar el formato real de columnas y que
   `npm run data:update` lo lea. Comparar con el snapshot actual, que sale de la API.
2. Subgrupos: bajar serie_ipc_aperturas.csv y correr
   `npm run data:update -- --aperturas-file=serie_ipc_aperturas.csv`. Ajustar nombres si difieren y verificar
   en la app que alquiler, prepaga, transporte público y la dieta usen su propio índice.
3. Crear el repo en GitHub (privado por ahora), subir todo y activar Actions.
4. Publicar en Netlify desde el repo (la configuración ya está en netlify.toml).
5. Correr a mano el workflow "Actualizar datos oficiales" y confirmar que commitea y redespliega.
6. Confirmar que `npm run data:externos` y `npm run data:precios` corren con red desde GitHub Actions
   (API de Series de Tiempo y API del BCRA para el ICL) y que pasan todos los controles (tarea 7).
7. Después del 13/10/2026 (IPC de septiembre), confirmar que el workflow de las 16:30 lo tomó solo y publicó.

Reglas:
- No inventar datos, endpoints ni categorías. Si un formato no coincide con lo esperado, mostrame el
  encabezado y 5 filas reales antes de adaptar el código.
- Mantener siempre separados "dato oficial (INDEC)", "cálculo con datos oficiales" y "estimación personal".
- Nunca sumar tasas de inflación: se usan los índices (ver docs/METODOLOGIA.md).
- Tests en verde después de cada tarea. Agregá tests con muestras reales de los archivos de INDEC.
- Los tests no pueden depender del último mes publicado: el workflow diario los corre con los datos nuevos
  y, si fallan, no publica nada. Para cifras puntuales, usá meses cerrados.
- Textos de la interfaz en español rioplatense.
- No subir datos personales a ningún servidor (fase 1 = todo local).

Al terminar cada tarea, contame en pocas líneas qué cambió y el resultado de los tests.
```

---

## Contexto en un minuto

- **Qué es.** Una calculadora de sueldo equivalente con el IPC de INDEC, más una "inflación personal" que valúa la canasta del usuario con los índices oficiales de su región y explica la diferencia por categoría.
- **Stack.** React 18 + Vite + TypeScript, sin servidor. Gráficos SVG propios. Datos en `src/data/ipc.json`, generado por `scripts/etl`. Hosting previsto en Netlify; actualización diaria con GitHub Actions.
- **Decisiones clave.** Están explicadas en `docs/ANALISIS.md §4`:
  - la inflación personal se calcula con pesos × índices, no con la variación de los gastos;
  - los pesos tienen fecha (`weightsPeriod`);
  - solo se pide provincia, más conurbano/interior para Buenos Aires;
  - se compara contra el IPC de la región, con el nacional como referencia.

## Qué está hecho (verificado)

| Área | Estado |
|---|---|
| Motor de cálculo (`src/engine`) | Completo. Incluye la descomposición en uno y dos niveles (efecto peso + efecto composición) y el simulador |
| Datos | 94 series (7 regiones × nivel general + 12 divisiones, más núcleo, regulados y estacionales nacionales), dic-2016 → ago-2026, validadas contra el informe de INDEC |
| Interfaz | Calculadora, Mi inflación, Comparar, Mi sueldo, Mi situación, Datos de Argentina, Metodología. Responsive, tema claro y oscuro, guardado local |
| Agregados | "IPC con canasta 2017/18" (estimación con 8 de 13 pesos publicados), servicios contra bienes, regulados contra núcleo y precio propio para contratos y facturas |
| Nuevo (oct-2026) | IPC de la Ciudad (IPCBA desde 2012, con 13 divisiones) y de 7 provincias, como fuente externa; calculadora de alquiler (IPC e ICL); cuota UVA; "¿le ganaste al promedio?" (índice de salarios); canasta básica del hogar; salario mínimo, jubilación mínima y RIPTE; compartir como imagen; aviso de publicaciones con .ics |
| Nuevo (oct-2026, segunda parte) | "¿Cuánto aumentó?": precios promedio de INDEC (59 productos en GBA y 14 por región) contra el IPC de la región, con 4 errores de la API corregidos con los informes y 550 controles. Jubilación mínima de octubre con la regla de movilidad ($ 435.748,51) y bono de $ 70.000 (Decreto 1108/2026) |
| Proceso de datos | Lectores de INDEC (divisiones y aperturas) y de la API, correcciones, validación y escritura atómica. No reescribe los archivos si no hay datos nuevos |
| Tests | 137 (`npm test`): motor, datos reales contra cifras publicadas, proceso de datos, subgrupos, canasta 2017/18, precio propio, fuentes complementarias, UVA, ICL, alquiler, calendario, precios promedio y movilidad jubilatoria. No dependen del último mes: se simuló la llegada de sep y oct 2026 y pasan |
| Infra | `netlify.toml` (SPA + headers de seguridad), `.github/workflows/update-data.yml` (diario) y `ci.yml` |
| Docs | `docs/*.md`: análisis, metodología, arquitectura con SQL de la fase 2, fuentes, hoja de ruta |

## Qué no se pudo hacer en la sesión original y por qué

La red de esa sesión bloqueaba `indec.gob.ar` y `apis.datos.gob.ar` (403 del proxy). Los datos se leyeron con el lector web desde la **API de Series de Tiempo**, en consultas chicas, y se validaron con tres controles (ver `docs/FUENTES.md`). Quedaron pendientes dos cosas:

1. **Confirmar el formato real de los CSV de INDEC.** El lector (`parseIndecLongCsv`) busca las columnas por nombre (descripción, período, índice, región, código). Si no coinciden, falla con un mensaje claro.
2. **Cargar los subgrupos reales.** El código está, pero solo se probó con datos de prueba.

---

## Tareas pendientes (en orden)

### 1. Levantar el proyecto

```bash
npm ci && npm test && npm run build && npm run dev
```

✅ **Aceptación**: 137 tests en verde; la app abre en http://localhost:5173 y muestra "$ 2.304.667" para $800.000 de ene-2024 (IPC nacional a ago-2026).

### 2. Datos directo de INDEC (divisiones)

```bash
curl -fL -o /tmp/div.csv https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv
head -5 /tmp/div.csv            # anotar encabezado, separador y formato del período
cp src/data/ipc.json /tmp/ipc-api.json
npm run data:update -- --indec-file=/tmp/div.csv
```

- Si falla con "Formato inesperado", ajustar `INDEC_*_BY_TEXT` o los nombres de columna en `scripts/etl/sources.mjs` según el encabezado real. Agregar un test en `scripts/etl/__tests__/etl.test.mjs` con las primeras filas reales.
- Si el archivo viene en latin-1, `decodeText()` ya lo contempla. Revisá que los acentos se lean bien.
- **Comparar con el snapshot de la API.** Ejemplo para nivel general GBA:

  ```bash
  node -e "const a=require('/tmp/ipc-api.json'),b=require('./src/data/ipc.json');let m=0;for(const r in a.series)for(const c in a.series[r]){const x=a.series[r][c],y=b.series[r]?.[c];if(!y)continue;x.forEach((v,i)=>{if(v&&y[i])m=Math.max(m,Math.abs(y[i]/v-1))})}console.log('max dif rel',m)"
  ```

  Diferencias esperables: menores a 1e-5. NEA jul-2022 debería salir cerca de 887,96 sin corrección (si INDEC tiene el valor bien). Si INDEC trae otro valor, documentarlo en `docs/FUENTES.md`.
- Si INDEC incluye bienes y servicios por región, se pueden mostrar en "Datos de Argentina". Desde la API se descartaron por un error en ago-2018.

✅ **Aceptación**: `src/data/ipc.json` con `meta.via = "indec-file"` (o `"indec"` online), validación sin errores, `npm test` en verde y diferencias con la API documentadas.

### 3. Subgrupos (aperturas)

```bash
curl -fL -o /tmp/ap.csv https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_aperturas.csv
head -5 /tmp/ap.csv
npm run data:update -- --indec-file=/tmp/div.csv --aperturas-file=/tmp/ap.csv
node -e "const d=require('./src/data/ipc.json');console.log(Object.keys(d.aperturas||{}), Object.values(d.aperturaNames||{}).slice(0,40))"
```

- Los nombres esperados están en `scripts/etl/config.mjs → APERTURA_PARENT_BY_NAME` y en `src/domain/categories.ts` (campo `apertura` de cada ítem). La coincidencia se hace por nombre normalizado (`aperturaKey`). Si INDEC usa otro texto (por ejemplo "Alquiler de la vivienda" con otra redacción), corregí **las dos** listas.
- Revisá las advertencias "Subgrupos sin división conocida" y "serie incompleta".
- Revisá en la app, con un perfil detallado en CABA (Mi inflación → "Detallar" en vivienda, salud y transporte):
  - el texto del ítem dice "Con subgrupos de INDEC: alquiler → «Alquiler de la vivienda»…";
  - en Comparar → "Ver tabla" aparecen las columnas "Efecto peso" y "Efecto composición";
  - la explicación menciona "Dentro de vivienda, tu gasto se concentra en alquiler…" cuando corresponde.
- Agregar validaciones de subgrupos en `validateDataset`: base 100 o rebase, sin huecos y variaciones plausibles. Hoy solo se descartan los incompletos.
- Agregar un test con una muestra real del CSV de aperturas.

✅ **Aceptación**: `ipc.json` con `aperturas` para las 6 regiones (o las que publique INDEC), tests en verde y un perfil vegetariano (carnes = 0, verduras alto) que da un resultado distinto al omnívoro.

### 4. Repositorio y CI

```bash
git init && git add . && git commit -m "Mi Inflación: MVP fase 1"
gh repo create mi-inflacion --private --source=. --push
```

- En GitHub → Settings → Actions → General → Workflow permissions: "Read and write" (el workflow de datos hace push).
- Verificá que `ci.yml` corra en verde.

### 5. Netlify

- New site → Import from Git → elegir el repo. Netlify toma `netlify.toml`: build `npm run build`, publish `dist`, Node 22.
- Probar rutas profundas (`/comparar`, `/ipc-indec`) recargando la página. Tienen que abrir, no dar 404.
- Revisar los headers (CSP). Si se agregan analytics, sumar su dominio a la CSP.
- Dominio: definir con Gianfranco (por ejemplo, revisar disponibilidad de un `.com.ar` en NIC Argentina).

### 6. Actualización automática

- Actions → "Actualizar datos oficiales" → Run workflow. Sin datos nuevos, termina con "Sin datos nuevos.": los scripts no reescriben los JSON si solo cambiaría la fecha de generación. La primera corrida sí commitea, porque cambia la fuente (`via`) de "api-offline" a "indec" o "api". Para probar el commit, borrar el último mes de `ipc.json` en una rama.
- Después del 13/10/2026 (IPC de septiembre), confirmar que el workflow de las 16:30 lo toma solo. Es la primera prueba real. Los tests ya no fijan el último mes: se simuló en una copia la llegada de sep-2026 (con y sin precios nuevos) y de oct-2026, y pasan. Si los precios o las fuentes complementarias llegan días después que el IPC, el IPC se publica igual.

### 6b. Pesos completos de la canasta 2017/18

- Buscar en INDEC la tabla completa de ponderaciones del IPC nuevo (13 divisiones, total nacional y, si existe, por región) y reemplazar `KNOWN_2018` en `src/domain/basket2018.ts`. Si están todas, poner `BASKET_2018_META.complete = true` y sacar la mención de "provisorio".
- Si INDEC publica pesos por región, la estimación puede hacerse por región (hoy es solo total nacional).

### 7. Datos complementarios con red (CABA, provincias, salarios, canasta, UVA, ICL)

```bash
npm run data:externos          # API de Series de Tiempo + API del BCRA (ICL)
npm run data:precios           # precios promedio de INDEC (API de Series de Tiempo)
git diff --stat src/data/
```

- El proceso está en `scripts/etl/externos.mjs`. Los ids y las consultas están en `API_QUERIES`; las correcciones, en `EXTERNAL_CORRECTIONS`; los controles contra cifras publicadas, en `EXTERNAL_CHECKS`.
- **ICL**: se baja de `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/40?desde=…&hasta=…` por año. Si el certificado del BCRA da problemas en Node, documentarlo y probar con la cadena completa; nunca desactivar la verificación TLS. Si falla, se conserva la serie anterior.
- **UVA**: se ancla en el último valor diario real de la API. La validación compara la regla con todos los cierres de mes desde 2017: tiene que dar 0 errores.
- Revisar que el workflow diario (`update-data.yml`) commitee también `externos.json`, `ingresos.json` y `bcra.json`.

- **Precios promedio**: el proceso está en `scripts/etl/precios.mjs`. Corrige los cuatro errores conocidos de la API con las cifras de los informes (`PUBLISHED`, `SWAPS`) y controla 550 precios. Si INDEC cambia otra vez el orden de las filas, el control contra el informe de julio 2026 lo detecta y se conserva el archivo anterior. Detalle en `data-raw/notas/relevamiento-precios-2026-10.md`.

✅ **Aceptación**: validación `ok`, 10 controles en verde y el ICL hasta el día 16 del mes siguiente. Precios: validación `ok` con 550 controles.

### 8. Pendientes de fuentes (ver `docs/FUENTES.md §4`)

1. **Pesos del IPCBA por división**: está en el documento metodológico de la base 2021 (`https://www.estadisticaciudad.gob.ar/eyc/wp-content/uploads/2023/09/IPCBA-Aspectos-metodológicos-2021100.pdf`). Con eso se puede calcular la inflación personal con las divisiones de CABA.
2. **Córdoba y Neuquén al día**: la API está demorada (ago-2025 y ene-2026). Buscar la serie en las direcciones provinciales y agregar un lector.
3. **Río Negro y Jujuy**: publican índice propio, pero no están en la API.
4. **Canastas regionales**: la API las tiene hasta dic-2025, pero la consulta devolvió 400 desde acá.
5. **Bono previsional**: hoy está el de octubre 2026 (Decreto 1108/2026) en `src/domain/ingresos.ts` (`BONO_PREVISIONAL`). Para otros meses la app no lo suma y cita el último. Actualizarlo cuando salga el decreto de cada mes, o conseguir una serie.
6. **Calendario 2027**: cuando INDEC publique el del primer semestre de 2027, agregarlo en `src/domain/calendario.ts`.
7. **Precios, agua sin gas en GBA, may-2019**: +30,6% y −16,7% al mes siguiente. Falta el informe de mayo 2019 para confirmar que es el dato publicado.
8. **Avisar a datos.gob.ar** de los errores de la API de precios (lista en `data-raw/notas/relevamiento-precios-2026-10.md`). Si los corrigen, las correcciones de la app dejan de aplicarse solas.

### 9. Siguientes, por impacto

1. Prerender de las páginas para SEO, con `meta` y Open Graph por ruta (ver `docs/ARQUITECTURA.md §SEO`).
1b. Ideas investigadas con datos verificados: ver `docs/ROADMAP.md §Ideas investigadas` y `docs/FUENTES.md §3`.
2. Página de privacidad y "Acerca de"; métricas sin cookies y sin montos.
3. Fase 2: aviso por notificación o mail el día del IPC (hoy hay un .ics sin cuenta).
3b. Dividir el resto del bundle por ruta (/precios ya carga aparte; el principal pesa ~172 KB comprimido).
4. Fase 2: Supabase con el SQL de `docs/ARQUITECTURA.md`.

---

## Reglas del proyecto

1. Nada se inventa: cada número sale de una serie con fuente o de una fórmula documentada.
2. Siempre se distingue "Dato oficial · INDEC", "Cálculo con datos oficiales" y "Estimación personal" (`SourceBadge`).
3. Las tasas se componen con índices. La variación real es (1+g)/(1+π)−1.
4. Si falta un dato se dice ("El último dato oficial disponible corresponde a…"); no se extrapola.
5. Datos personales: solo en el navegador en la fase 1.

## Mapa del código

| Archivo | Para qué |
|---|---|
| `src/engine/basket.ts` | Canasta fija, participaciones efectivas y las dos descomposiciones |
| `src/engine/inflation.ts`, `salary.ts`, `period.ts`, `series.ts` | Inflación, sueldo, períodos y errores tipados |
| `src/domain/profile.ts` | Perfil → canasta (con subgrupos si existen), promedio regional, ejemplo |
| `src/domain/calculations.ts` | Casos de uso de la UI y mensajes de error |
| `src/domain/explain.ts` | Explicación en lenguaje simple, basada solo en números calculados |
| `src/domain/categories.ts` | Rubros e ítems del formulario → divisiones y subgrupos |
| `src/domain/regions.ts` | Provincias → regiones del IPC, partidos del GBA |
| `src/ui/pages/*` | Una página por ruta (`Alquiler`, `Uva`, `Provincias`, `MiSueldoExtras` y `Precios` son las nuevas) |
| `src/engine/rent.ts`, `uva.ts`, `dates.ts`, `household.ts` | Alquiler por IPC e ICL, regla de la UVA, fechas diarias, adulto equivalente |
| `src/domain/externos.ts`, `ingresos.ts`, `bcra.ts`, `alquiler.ts`, `calendario.ts` | IPCBA y provincias; salarios, canasta, SMVM, haber mínimo; ICL y UVA; alquiler; calendario e .ics |
| `scripts/etl/externos.mjs`, `update-externos.mjs` | Proceso de las fuentes complementarias |
| `scripts/etl/precios.mjs`, `update-precios.mjs` | Precios promedio: ids, cifras publicadas (`PUBLISHED`), correcciones y controles |
| `src/domain/precios.ts`, `src/ui/pages/Precios.tsx` | "¿Cuánto aumentó?": variación del precio contra el IPC de la región y ranking (la página carga aparte) |
| `scripts/etl/lib.mjs` → `sameContent` | Evita reescribir un JSON sin datos nuevos (y el commit diario vacío) |
| `src/ui/share.tsx`, `ReleaseCalendar.tsx` | Imagen para compartir (solo porcentajes) y aviso de publicaciones |
| `scripts/etl/config.mjs` | IDs de la API, URLs de INDEC, ponderaciones oficiales, correcciones, umbrales |
| `scripts/etl/sources.mjs` | Lectores de INDEC y de la API |
| `scripts/etl/build.mjs` | Normalización, subgrupos, validación |

## Decisiones abiertas (para Gianfranco)

- Nombre y dominio definitivos.
- Resuelto: las fechas anteriores a dic-2016 se calculan con el IPCBA (desde jul-2012) o con un índice provincial, siempre marcados como fuente externa.
- Si se quiere mostrar también el IPC de Río Negro y Jujuy sin serie completa (solo el último dato publicado).
- Cuándo arranca la fase 2 (cuentas). Antes de guardar datos en servidores, hacer la revisión legal (Ley 25.326).
