# Registro de fuentes

Todo dato que muestra la app tiene fuente, fecha y forma de obtención. Verificado el 2/10/2026.

## 1. IPC de INDEC (en uso)

| Campo | Valor |
|---|---|
| Productor | INDEC, Índice de precios al consumidor con cobertura nacional |
| Base | Diciembre 2016 = 100 |
| Canasta | ENGHo 2004/05; 12 divisiones (COICOP adaptada); 6 regiones + total nacional |
| Período | 2016-12 → 2026-08 (117 meses) |
| Publicación | Mensual, a mediados del mes siguiente (16 h). IPC de ago-2026: 10/09/2026. IPC de sep-2026: 13/10/2026, según [iProUP](https://www.iproup.com/finanzas/71297-inflacion-agosto-dato-oficial-indec-confirma-cuanto-llego-ipc-acumulado-anual-precios-2026) |
| Página oficial | https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31 |
| Informe usado para validar | https://www.indec.gob.ar/uploads/informesdeprensa/ipc_09_26A1BE2DC4CD.pdf |

### Archivos de INDEC (fuente principal del proceso)

- `https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv`: nivel general, divisiones, bienes/servicios y categorías, por región.
- `https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_aperturas.csv`: subgrupos por región.

Las dos URL responden (el lector web las recibe como archivo binario). Desde el entorno donde se construyó esta versión no se pudieron descargar por la política de red, así que **el formato exacto de columnas está por confirmar**. El lector (`scripts/etl/sources.mjs → parseIndecLongCsv`) identifica las columnas por nombre: descripción, período, índice, región y código. Si el encabezado no coincide, falla con un mensaje claro en lugar de adivinar, y el proceso usa la API.

### API de Series de Tiempo (fuente alternativa; snapshot actual)

- Base: `https://apis.datos.gob.ar/series/api/series?ids=…&format=csv&limit=1000`
- Patrón de identificadores, verificado: `{distribución}_I{código}{región}_DICI_M_{largo}`. Se genera en `scripts/etl/config.mjs → apiSeriesId()`.
  - Distribución: 148.3 (nivel general, núcleo, regulados, estacionales), 146.3 (12 divisiones).
  - Región: NAL, GBA, ANA (pampeana), NEA, NOA, UYO (cuyo), NIA (patagonia).
  - Ejemplos: `148.3_INIVELNAL_DICI_M_26` (nivel general nacional), `146.3_IVIVIENGBA_DICI_M_47` (vivienda GBA), `148.3_INUCLEONAL_DICI_M_19` (núcleo nacional).
- Los CSV crudos del snapshot están en `data-raw/api-snapshot-2026-08/`, uno por consulta.

### Validaciones del snapshot

| Control | Resultado |
|---|---|
| Ago-2026 nacional: 1,7% mensual, 33,5% interanual, 21,3% en el año | ✔ coincide con el informe |
| Ago-2026: las 12 divisiones nacionales y las 6 regiones | ✔ coinciden |
| Jul-2026 regional (GBA 2,3%; Pampeana, NEA, NOA y Patagonia 2,0%; Cuyo 1,9%) | ✔ coincide con la prensa |
| 2024: 117,8%; 2025: 31,5% | ✔ |
| Nivel general ≈ Σ ponderación oficial × división | ✔ desvío ≤ 0,06%; NOA jun-2021 0,15% (está en la fuente) |
| División nacional ≈ agregado de las regionales | ✔ desvío ≤ 0,002% |

### Correcciones y particularidades

| Serie | Mes | Qué pasa | Qué se hizo |
|---|---|---|---|
| NEA nivel general (API) | 2022-07 | La API tiene 861,702, que es el valor de Pampeana | Se reemplazó por 887,9576, la agregación de las divisiones de NEA. Reproduce las variaciones publicadas: jul 7,4% ([fuente](https://misionesonline.net/2022/09/14/con-un-ipc-del-76-la-inflacion-de-agosto-en-el-nea-fue-la-mas-alta-en-el-pais/)) y ago 7,6%. Registrado en `meta.corrections` |
| Bienes y servicios nacional (API) | 2018-08 | Valores inconsistentes con jul y sep (184,83 y 191,67) | Se reconstruyeron con las variaciones publicadas por INDEC: bienes ago 3,2% y sep 8,7% → 148,7022; servicios ago 5,0% y sep 3,0% → 167,9606. Error posible < 0,05%. Fuentes: [informe ago-2018](https://argentina.gob.ar/sites/default/files/ipc_-_agosto18_0.pdf), [informe sep-2018](https://argentina.gob.ar/sites/default/files/ipc_-_sept18_0.pdf) |
| Nivel general, todas las regiones | 2019-04 | Encadenado desde una variación redondeada | Se informa como particularidad conocida (desvío ≤ 0,07%) |
| NOA y Cuyo nivel general | 2021-06 | Desvío de 0,15% y 0,04% contra las divisiones | Particularidad conocida |
| Divisiones | 2022-11 | Publicadas con 1 decimal | Sin efecto práctico |

### Ponderaciones oficiales (base dic-2016)

Tomadas del informe técnico del IPC (sep-2026) y cargadas en `scripts/etl/config.mjs → OFFICIAL_WEIGHTS`. Participación regional en el gasto: GBA 44,7%, Pampeana 34,2%, NEA 4,5%, NOA 6,9%, Cuyo 5,2%, Patagonia 4,6%.

### Estado del "IPC nuevo"

INDEC anunció en oct-2025 un IPC con canasta ENGHo 2017/18 y COICOP 2018 (13 divisiones) desde los datos de ene-2026 ([Infobae](https://www.infobae.com/economia/2025/10/14/el-indec-comenzara-a-utilizar-un-nuevo-indice-de-inflacion-a-partir-de-enero-de-2026/)). En feb-2026, tras la salida de Marco Lavagna, se postergó sin fecha ([Chequeado](https://chequeado.com/ultimas-noticias/el-indec-actualizo-la-canasta-de-bienes-y-servicios-para-medir-la-inflacion-que-cambios-implica-y-cuanto-podria-variar-el-ipc/)). El informe de sep-2026 confirma que se sigue usando la canasta 2004/05.

## 2. Ponderaciones de la canasta 2017/18 (estimación "IPC con canasta 2017/18")

Pesos nacionales del IPC que INDEC postergó, publicados en prensa (8 de 13 divisiones): alimentos 22,7; ropa 6,8; vivienda 14,5; salud 9,1; transporte 14,3; comunicación 5,1; recreación 8,6; educación 3,1. El resto (15,8%) se prorratea entre bebidas alcohólicas, hogar, restaurantes y varios, en proporción a sus pesos vigentes (`src/domain/basket2018.ts`). Fuentes: [Chequeado](https://chequeado.com/ultimas-noticias/el-indec-actualizo-la-canasta-de-bienes-y-servicios-para-medir-la-inflacion-que-cambios-implica-y-cuanto-podria-variar-el-ipc/), [BAE Negocios](https://www.baenegocios.com/economia/nuevo-indicador-de-inflacionque-rubros-ganan-peso-y-cuales-pierden/), [Diario de Cuyo](https://www.diariodecuyo.com.ar/economia/como-es-el-nuevo-metodo-para-calcular-el-indice-de-precios-que-presentara-el-gobierno-1827655.html).

Resultado de la estimación contra estimaciones privadas: 2025 da 32,1% (oficial 31,5%; Equilibra 32,1%; González-Rozada 33,6%). Dic-2023 → dic-2025 da 194,6% (oficial 186,5%; estimación privada citada por Chequeado: 194,8%). **Pendiente**: conseguir la tabla completa de INDEC y reemplazar `KNOWN_2018`.

## 3. Fuentes complementarias (integradas en oct-2026)

El detalle de cada consulta, validación y corrección está en `data-raw/notas/relevamiento-2026-10.md`; el crudo, en `data-raw/api-snapshot-2026-10/` y `data-raw/bcra-api/`. Proceso: `scripts/etl/externos.mjs` (`npm run data:externos`). Se muestran siempre identificadas como fuente externa a INDEC cuando corresponde.

| Dato | Fuente e identificador | Período | Validación |
|---|---|---|---|
| IPC de la Ciudad (IPCBA) | Instituto de Estadística y Censos GCBA, API `193.1_NIVEL_GENERAL_JULI_0_13` (base jul-2011/jun-2012) y `193.2_*` (base 2021, 13 divisiones, estacionales, regulados y resto) | 2012-07 → 2026-08, empalmado en feb-2022 | Ago-2026 coincide en índice (2596,60), nivel general y las 13 divisiones ([informe 2053](https://www.estadisticaciudad.gob.ar/eyc/wp-content/uploads/2026/09/ir_2026_2053.pdf)). Anuales: 2022 93,4% ([Ámbito](https://www.ambito.com/economia/inflacion/la-ciudad-fue-del-58-diciembre-y-acumulo-un-934-2022-n5625148)), 2023 198,4% ([El Economista](https://eleconomista.com.ar/economia/la-inflacion-caba-trepo-211-diciembre-acumulo-casi-200-2023-n69932)), 2025 31,8% ([Cadena 3](https://www.cadena3.com/noticia/politica-y-economia/la-inflacion-en-caba-fue-de-27-en-diciembre-y-cerro-2025-con-un-alza-de-318_507347)) |
| IPC provinciales | API: Córdoba `194.1`, Mendoza `195.1`, Neuquén `196.1`, San Luis `197.1`, Santa Fe `198.1`, Tucumán `199.1`, Chaco `464.1` (ids completos en `scripts/etl/externos.mjs`) | Desde 2004-12 (según serie) hasta el último mes que tenga la API | Series de control (`199.2`, `464.2`) coinciden; Mendoza no tiene datos entre abr-2012 y mar-2016; Córdoba (ago-2025) y Neuquén (ene-2026) están demoradas en la API |
| Índice de salarios | INDEC, base oct-2016: `149.1_TL_INDIIOS_OCTU_0_21` (total), `149.1_TL_REGIADO_OCTU_0_16`, `149.1_SOR_PRIADO_OCTU_0_25`, `149.1_SOR_PUBICO_OCTU_0_14`, `149.1_SOR_PRIADO_OCTU_0_28` (no registrado) | 2016-10 → 2026-07 | Jul-2026: +2,8% mensual, 36,2% interanual, 21,8% en el año; privado registrado +2,3%, público +3,0%, no registrado +3,9% ([informe](https://www.indec.gob.ar/uploads/informesdeprensa/salarios_09_268274C91CE4.pdf)) |
| RIPTE | Secretaría de Seguridad Social, `158.1_REPTE_0_0_5` | 2016-10 → 2026-07 | Último $1.946.028,12 |
| Canasta básica (GBA) | INDEC, `150.1_CSTA_BARIA_0_D_26` (CBA) y `150.1_CSTA_BATAL_0_D_20` (CBT), por adulto equivalente | 2016-04 → 2026-08 | Jun-2026: CBA $223.253,29, CBT $495.622,30; hogares tipo 2,46 / 3,09 / 3,25 unidades → $1.219.230,86 / $1.531.472,91 / $1.610.772,48 ([informe](https://www.indec.gob.ar/uploads/informesdeprensa/canasta_07_26F3FFC1D5EC.pdf)). Tabla de adulto equivalente: Cuadro 4 del informe |
| Salario mínimo | `57.1_SMVMM_0_M_34` | 2016-01 → 2027-04 (incluye el cronograma de la Res. 4/2026) | Sep-2026 $383.800 → abr-2027 $437.000 ([Chequeado](https://chequeado.com/el-explicador/el-salario-minimo-sera-de-383-800-en-septiembre-de-2026-y-acumula-una-caida-real-del-397-desde-noviembre-de-2023/)) |
| Haber mínimo jubilatorio | `58.1_MP_0_M_24` (sin bono) | 2016-01 → 2026-09; el mes siguiente se calcula con la regla | Sep-2026 $428.633,20. Regla de movilidad (Decreto 274/2024): haber(m) = haber(m−1) × (1 + IPC nacional de m−2 con dos decimales), redondeado al centavo; reproduce al centavo todos los meses desde may-2024. Oct-2026: 1,66% → $435.748,51, igual a lo informado ([iProfesional](https://www.iprofesional.com/economia/465374-anses-pagara-un-bono-de-hasta-70000-en-octubre-quienes-lo-cobran)). Bono de $70.000 de octubre: Decreto 1108/2026 (BO 28/9/2026). Corrige el valor de $435.875 citado antes en este documento |
| UVA | BCRA vía API `94.2_UVAD_D_0_0_10` (fines de mes y ventana diaria) | 2016-04 → 2026-08 (oficial); la app calcula hasta el 16 del mes siguiente al último IPC | Regla del 17 al 16 con el IPC del mes anterior redondeado a un decimal: coincide con 113 cierres de mes y con todos los días hábiles de may-ago 2026 (diferencia máxima, un centavo). La API repite el sábado en domingos, lunes y feriados |
| ICL | BCRA, API de estadísticas v4.0, variable 40 | 2020-07-01 → 2026-10-16, diario | Coincide en 134 de 134 valores con las Comunicaciones "B" 12303, 12545, 13109, 13175 y 13189. Metodología: media geométrica de IPC y RIPTE del mes m−2, del 17 al 16 ([Contadores en Red](https://contadoresenred.com/indice-para-contratos-de-locacion-ley-27-551-com-a-bcra-7096-20-y-b-12059/amp/)) |
| Calendario INDEC | [Calendario 2º semestre 2026](https://www.indec.gob.ar/ftp/cuadros/publicaciones/calendario_2sem2026.pdf) | Oct-dic 2026 | IPC y canasta: 13/10, 12/11 y 15/12; salarios: 21/10, 13/11 y 16/12 (16 h) |
| Precios promedio GBA | INDEC vía API, distribución 101.9 (series `105.1_*`, 59 productos; ids en `scripts/etl/precios.mjs`) | 2016-12 → 2026-08 (alimentos desde abr-2016 en la API) | Jun y jul 2026: los 59 precios coinciden con el Cuadro 20 del [informe de julio 2026](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_2642C82F62AE.pdf); feb y mar 2017 con el Cuadro 7 del [informe de marzo 2017](https://sitioanterior.indec.gob.ar/uploads/informesdeprensa/ipc_04_17.pdf) |
| Precios promedio por región | INDEC vía API, distribución 145.13 (series `348.1_*`, 14 productos × 6 regiones) | 2017-06 → 2026-08 | Jul 2026 (Cuadro 19), jul 2025 ([informe](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_25B0A3ACE622.pdf)) y jun, jul y ago 2023 ([jun](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_07_23C94E54F825.pdf), [jul](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_23ED301034A4.pdf), [ago](https://www.eltucumano.com/adjunto/2023/09/13/indec.pdf)). 550 controles en total. INDEC advierte que comparar precios entre regiones puede no ser válido |

**Correcciones a la API (IPCBA)**: `estacionales` repite el nivel general entre feb-2022 y sep-2023 (esos meses quedan sin dato) y `recreacion_cultura` de ene-2026 repite el valor de educación (se reconstruyó con la variación publicada, +7,4%). Las correcciones se aplican solo mientras la fuente siga con el error.

**Correcciones a la API (precios promedio)**: regiones jun-ago 2023 (junio y julio cruzados y agosto repetido), NEA y NOA jul-2025 (cruzadas), GBA mar-2017 (cinco productos de limpieza y cuidado personal corridos una columna) y GBA desde ene-2026 (desodorante y jabón de tocador cruzados). Se usan las cifras de los informes de INDEC; el detalle está en `data-raw/notas/relevamiento-precios-2026-10.md`.

**Jurisdicciones con índice propio fuera de la API**: Río Negro y Jujuy (agosto 2026: 2,1% y 1,7%, según la compilación de Politikon Chaco publicada por [El Economista](https://eleconomista.com.ar/economia/inflacion-una-provincia-llego-23-otras-cinco-superaron-promedio-nacional-n98162)).

## 4. Pendientes de fuentes

| Indicador | Detalle |
|---|---|
| Pesos del IPCBA por división | El documento metodológico de la base 2021 pide permiso de lectura desde este entorno |
| Canastas regionales | La API las tiene hasta dic-2025, pero la consulta devolvió error 400 |
| Córdoba y Neuquén al día | Buscar la serie en las direcciones provinciales, ya que la API está demorada |
| Tipo de cambio | BCRA, [catálogo de APIs](https://www.bcra.gob.ar/apis-banco-central/) (Estadísticas Cambiarias v1.0) |
| "Mi propio IPC" | INDEC, [herramienta](http://www.indec.gob.ar/indec/web/Institucional-Indec-mi_propio_IPC) (dic-2024): revisarla para diferenciarse y enlazarla |

Las fuentes externas a INDEC se muestran siempre como "Fuente externa", separadas de INDEC.
