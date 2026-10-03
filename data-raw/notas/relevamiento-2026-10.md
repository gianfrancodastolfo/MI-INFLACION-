# Relevamiento de fuentes nuevas (2/10/2026)

Todo se bajó con WebFetch. Desde el entorno de construcción, la política de red bloquea los dominios .gob.ar (403). El crudo de cada consulta está en `data-raw/api-snapshot-2026-10/` y en `data-raw/bcra-api/`.

## IPC de la Ciudad de Buenos Aires (IPCBA)

- **Fuente**: Instituto de Estadística y Censos (GCBA), vía la API de Series de Tiempo (dataset 193).
- **Base anterior** (jul-2011/jun-2012 = 100): `193.1_NIVEL_GENERAL_JULI_0_13`, de 2012-07 a 2022-02.
- **Base 2021 = 100**: `193.2_*`, de 2022-02 a 2026-08. Tiene 13 divisiones (COICOP 2018), además de estacionales, regulados y resto.
- **Empalme**: la base anterior se usa hasta feb-2022 y la base 2021 desde mar-2022. Así se reproduce la inflación anual publicada.
  - 2022: 93,4%. [Ámbito](https://www.ambito.com/economia/inflacion/la-ciudad-fue-del-58-diciembre-y-acumulo-un-934-2022-n5625148)
  - 2023: 198,4%, con diciembre en 21,1%. [El Economista](https://eleconomista.com.ar/economia/la-inflacion-caba-trepo-211-diciembre-acumulo-casi-200-2023-n69932)
  - 2025: 31,8%, con diciembre en 2,7%. [Cadena 3](https://www.cadena3.com/noticia/politica-y-economia/la-inflacion-en-caba-fue-de-27-en-diciembre-y-cerro-2025-con-un-alza-de-318_507347)
- **Validación de agosto 2026** contra el [informe 2053](https://www.estadisticaciudad.gob.ar/eyc/wp-content/uploads/2026/09/ir_2026_2053.pdf):
  - índice 2596,60; 1,7% mensual; 21,5% en el año; 33,3% interanual;
  - las 13 divisiones y estacionales, regulados y resto coinciden.
- **Otros meses verificados**:
  - ene-2026: 3,1%. [Canal 26](https://www.canal26.com/economia/2026/02/09/la-inflacion-en-caba-fue-de-31-en-enero-marco-la-mayor-alza-en-10-meses/)
  - jul-2026: 2,9% mensual y 19,4% en el año. [Perfil](https://www.perfil.com/noticias/economia/la-inflacion-en-caba-se-acerco-al-3-marco-29-en-julio-y-acumula-194-en-lo-que-va-del-ano-a40.phtml)
  - nov-2025: 2,4% mensual y 28,3% en el año. [La Gaceta](https://www.lagaceta.com.ar/nota/1116257/economia/inflacion-ciudad-buenos-aires-subio-24porciento-noviembre-acumula-283porciento-2025.html)
- **Errores de la API corregidos**:
  1. `estacionales` repite exactamente el nivel general entre feb-2022 y sep-2023 (20 meses). Esos meses quedan sin dato; no se inventan.
  2. `recreacion_cultura` de ene-2026 repite el valor de educación (2305,09). Se reconstruyó con la variación publicada para enero, +7,4% ([Canal 26](https://www.canal26.com/economia/2026/02/09/la-inflacion-en-caba-fue-de-31-en-enero-marco-la-mayor-alza-en-10-meses/)): 1830,10 × 1,074 = 1965,53.
- **Pendiente**: el documento metodológico de la base 2021 (pesos de cada división) pide permiso de lectura y no se pudo abrir.

## IPC provinciales que publica la API de Series de Tiempo

| Provincia | Id | Base | Disponible | Notas |
|---|---|---|---|---|
| Córdoba | 194.1_NIVEL_GENERAL_2014_0_13 | 2014=100 | 2013-07 → 2025-08 | La API dejó de actualizarse. La provincia sigue publicando: jun-2026 1,9% ([Perfil](https://www.perfil.com/noticias/cordoba/cordoba-cerro-junio-con-una-inflacion-del-19-y-acumulo-159-en-el-primer-semestre.phtml)) |
| Mendoza (DEIE) | 195.1_NIVEL_GENERAL_0_0_13 | 2010=100 | 2004-12 → 2012-03 y 2016-04 → 2026-07 | No hay datos entre abr-2012 y mar-2016 |
| Neuquén | 196.1_NIVEL_GENERAL_2014_0_13 | ene-2007=100 | 2004-12 → 2026-01 | Desactualizada desde feb-2026 |
| San Luis | 197.1_NIVEL_GENERAL_2014_0_13 | 2003=100 | 2005-10 → 2026-06 | |
| Santa Fe (IPEC) | 198.1_NIVEL_GENERAL_2014_0_13 | 2014=100 | 2013-12 → 2026-07 | |
| Tucumán | 199.1_NIVEL_GENERAL_2014_0_13 | dic-2017=100 | 2004-12 → 2026-07 | La 199.2 es la misma serie y llega a 2026-01 |
| Chaco (Gran Resistencia) | 464.1_IPC_CHACO_NG_0_0_22_93 | sep-2010=100 | 2004-12 → 2026-06 | La 464.2 es la misma serie y llega a 2026-01 |

**Otras con índice propio, pero fuera de la API**: Río Negro (2,1%) y Jujuy (1,7%) informaron agosto 2026 según la compilación de Politikon Chaco ([El Economista](https://eleconomista.com.ar/economia/inflacion-una-provincia-llego-23-otras-cinco-superaron-promedio-nacional-n98162)).

**Agosto 2026 según esa misma compilación**: Neuquén 2,3; Río Negro 2,1; Chaco 1,9; Santa Fe 1,8; Tucumán 1,8; Córdoba 1,8; CABA 1,7; Jujuy 1,7; San Luis 1,7; Mendoza 1,5. El nacional fue 1,7.

## Salarios
- **Índice de salarios INDEC** (base oct-2016=100), hasta jul-2026. Ids:
  - total: 149.1_TL_INDIIOS_OCTU_0_21
  - registrado: 149.1_TL_REGIADO_OCTU_0_16
  - privado registrado: 149.1_SOR_PRIADO_OCTU_0_25
  - público: 149.1_SOR_PUBICO_OCTU_0_14
  - no registrado: 149.1_SOR_PRIADO_OCTU_0_28
- **Validación de jul-2026**: total +2,8% mensual, 36,2% interanual y 21,8% en el año. Privado registrado +2,3%, público +3,0%, no registrado +3,9%. Todo coincide con el [informe de INDEC](https://www.indec.gob.ar/uploads/informesdeprensa/salarios_09_268274C91CE4.pdf).
- **RIPTE**: 158.1_REPTE_0_0_5, hasta jul-2026 ($1.946.028,12).

## Canasta básica (INDEC, Gran Buenos Aires, por adulto equivalente)
- **Series**: CBA 150.1_CSTA_BARIA_0_D_26 y CBT 150.1_CSTA_BATAL_0_D_20, de 2016-04 a 2026-08.
- **Validación de junio 2026**: CBA $223.253,29 y CBT $495.622,30. El hogar 2 (3,09 unidades) da $1.531.472,91. Coincide con el [informe](https://www.indec.gob.ar/uploads/informesdeprensa/canasta_07_26F3FFC1D5EC.pdf).
- **Tabla de adulto equivalente**: es el Cuadro 4 del informe. Se transcribió desde el informe de oct-2018 de INDEC ([copia](https://cdn1.eldia.com/112018/1542914556099.pdf)) y se controló contra los hogares tipo del informe de 2026 (2,46 / 3,09 / 3,25).
- **Canastas regionales**: la API las tiene hasta dic-2025, pero la consulta devuelve error 400. INDEC informa mensualmente solo Gran Buenos Aires.

## Referencias
- **Salario mínimo (SMVM)**: 57.1_SMVMM_0_M_34, de 2016-01 a 2027-04. Incluye el cronograma de la Res. 4/2026: sep-2026 $383.800, oct $391.200, nov $398.800, dic $406.400, ene-2027 $414.200, feb $422.000, mar $429.600, abr $437.000.
- **Haber mínimo jubilatorio**: 58.1_MP_0_M_24, hasta sep-2026 ($428.633,20).
  - Octubre 2026: $435.748,51, por la movilidad del 1,66% (IPC de agosto, Decreto 274/2024). El bono de $70.000 se pagó en septiembre; el de octubre estaba sin confirmar al 15/9 ([MisionesOnline](https://misionesonline.net/2026/09/15/jubilaciones-minimas-de-anses/)).
  - Otras notas dan valores distintos para octubre (C5N: $435.919,96, que usa 1,7% redondeado). Por eso la app muestra el último dato oficial de la serie y calcula octubre con la regla, aclarándolo.

## UVA (BCRA)
- **Serie**: 94.2_UVAD_D_0_0_10 en la API de Series de Tiempo. Se bajaron los fines de mes de 2016-04 a 2026-08 y los valores diarios de may a ago 2026.
- **Particularidad de la API**: trae valores reales de martes a sábado y repite el sábado en domingos, lunes y feriados.
- **Regla validada**: del día 17 del mes m al 16 del mes m+1, la UVA crece todos los días el mismo factor, (1 + variación del IPC nacional de m−1, con un decimal)^(1/días del mes m).
  - Coincide con los 81 valores diarios reales de may-ago 2026.
  - Coincide con los 110 fines de mes de 2017-03 a 2026-04, contando el arrastre de fin de semana.
  - Con la variación exacta (sin redondear) no coincide.

## ICL (BCRA, base 30/6/2020 = 1)
- **Serie**: valores diarios oficiales de la API del BCRA v4.0 (variable 40), del 2020-07-01 al 2026-10-16. Son 2.299 días, sin huecos ni bajas.
- **Control cruzado**: coincide en los 134 valores de 5 Comunicaciones "B": B12303, B12545, B13109, B13175 y B13189 (parcial).
- **Metodología**: del 17 al 16, media geométrica de las variaciones del IPC y del RIPTE del mes m−2 ([Contadores en Red](https://contadoresenred.com/indice-para-contratos-de-locacion-ley-27-551-com-a-bcra-7096-20-y-b-12059/amp/)). La app usa los valores oficiales.

## Alquiler por IPC (práctica habitual)
- **Qué meses se toman**: los últimos N meses publicados al momento del ajuste. Por ejemplo, un ajuste cuatrimestral en agosto 2026 usa marzo, abril, mayo y junio ([La Nación](https://www.lanacion.com.ar/propiedades/casas-y-departamentos/alquileres-como-calcular-los-aumentos-por-inflacion-en-agosto-2026-nid03082026/)).
- **Cómo se combinan**: las variaciones se multiplican, no se suman.

## Calendario INDEC, segundo semestre 2026 ([PDF](https://www.indec.gob.ar/ftp/cuadros/publicaciones/calendario_2sem2026.pdf))
- **IPC y canasta**: 13/10 (septiembre), 12/11 (octubre) y 15/12 (noviembre).
- **Índice de salarios**: 21/10, 13/11 y 16/12.
- **IPCBA**: no se encontró el calendario de la Ciudad. Suele publicar unos días antes que INDEC; el de agosto salió el 8/9.
