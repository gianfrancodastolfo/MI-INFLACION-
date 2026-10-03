# Mi Inflación: análisis previo (oct-2026)

Este documento responde los pasos 1 a 7 del pedido original. Explica qué datos existen de verdad, qué limitaciones tienen, qué decisiones se tomaron y qué cambiaría del planteo inicial. Las fórmulas están en [METODOLOGIA.md](METODOLOGIA.md), la arquitectura y el modelo de datos en [ARQUITECTURA.md](ARQUITECTURA.md) y el registro de fuentes en [FUENTES.md](FUENTES.md).

## 1. El concepto

El producto responde una pregunta concreta: *¿cuánto debería ganar hoy para vivir como vivía en tal fecha?* Lo hace de dos maneras:

| | Qué es | Qué no es |
|---|---|---|
| **IPC INDEC** | Indicador estadístico oficial: la variación de precios de una canasta fija que representa el gasto promedio de los hogares de cada región. | No es "la inflación de cada persona". |
| **Mi inflación** | Estimación de la app: el costo de *tu* canasta (tus participaciones de gasto) valuada con los índices oficiales de cada categoría en tu región. | No es un indicador oficial ni una medición estadística. |

La diferencia entre ambas no significa que el IPC esté mal: mide otra canasta. La app tiene que decirlo siempre y mostrar de dónde sale cada número (dato oficial / cálculo con datos oficiales / estimación personal).

## 2. Qué datos existen realmente (verificado el 2/10/2026)

### IPC de INDEC: la fuente principal

| Aspecto | Disponibilidad real |
|---|---|
| Base | Diciembre 2016 = 100. Serie nacional desde dic-2016. |
| Frecuencia y rezago | Mensual. Se publica a mediados del mes siguiente, a las 16 h. Último dato a hoy: **agosto 2026** (publicado el 10/09/2026). El de septiembre sale el 13/10/2026 según el calendario difundido. |
| Cobertura geográfica | Total nacional + 6 regiones: GBA, Pampeana, Noreste, Noroeste, Cuyo, Patagonia. Se relevan unos 320.000 precios por mes en 39 aglomerados. |
| Apertura por categoría | Nivel general + 12 divisiones COICOP en todas las regiones. Además hay "aperturas" (subgrupos): carnes, lácteos y huevos, verduras, frutas, pan y cereales, alquiler de la vivienda, electricidad y gas, prepagas, transporte público, combustibles, restaurantes, cuidado personal, etc. |
| Otras clasificaciones | Bienes / servicios; núcleo / regulados / estacionales. |
| Ponderaciones | Publicadas por INDEC: peso de cada división en cada región (por ejemplo, alimentos 23,4% en GBA y 35,3% en NEA) y peso de cada región en el total (GBA 44,7%, Pampeana 34,2%…). |
| Canasta | Encuesta de Gastos de los Hogares 2004/05. El IPC nuevo (ENGHo 2017/18, COICOP 2018 con 13 divisiones) se anunció para enero 2026 y se **postergó sin fecha** en febrero 2026. |

**Cómo se accede.** INDEC no tiene una API propia. Hay dos vías oficiales:

1. **Archivos de INDEC**: `serie_ipc_divisiones.csv` y `serie_ipc_aperturas.csv` (y versiones XLS) en la página del IPC. Son la fuente primaria y la única con aperturas para todas las regiones.
2. **API de Series de Tiempo** (`apis.datos.gob.ar`), que republica las series de INDEC. Está actualizada a agosto 2026. Verificamos uno por uno los identificadores de nivel general, 12 divisiones, núcleo, regulados y estacionales para las 7 regiones (ver [FUENTES.md](FUENTES.md)). Solo tiene aperturas para GBA.

### Calidad de los datos: lo que encontramos al validar

Validamos las 94 series que usa la app con tres controles independientes:

- **Contra lo publicado**: agosto 2026 da 1,7% mensual, 33,5% interanual y 21,3% acumulado en el año. Las 12 divisiones y las 6 regiones coinciden con el informe de INDEC, y 2024 da 117,8% y 2025 da 31,5%.
- **Consistencia interna**: en cada región, el nivel general se reproduce con las ponderaciones oficiales y las 12 divisiones con un desvío menor a 0,06% (menor a 0,15% en el peor mes de NOA).
- **Agregación nacional**: las divisiones nacionales se reproducen desde las regionales con un desvío menor a 0,002%.

Errores detectados **en la API** (no en INDEC):

- **NEA jul-2022, nivel general**: la API tiene 861,702, que es el valor de la región Pampeana. Se corrigió a 887,9576, reconstruido desde las divisiones. Esto reproduce exactamente las variaciones que publicó INDEC (jul 7,4%, ago 7,6%) y queda registrado en el archivo de datos.
- **Bienes y servicios, total nacional, ago-2018**: valores inconsistentes. Por eso esas dos series no se usan desde la API.

Conclusión: el proceso de datos tiene que tomar los archivos de INDEC como fuente principal y validar siempre. Ya está implementado así.

### Otros indicadores útiles

| Indicador | Fuente | Para qué sirve | Estado |
|---|---|---|---|
| Índice de salarios | INDEC (base oct-2016) | Comparar tu sueldo con el promedio: total, privado registrado, público y no registrado. Jul-2026: total +2,8% mensual y 36,2% interanual. Se publica con unos 2 meses de rezago (el no registrado, con 5). | Fase 2 |
| Canasta básica alimentaria y total | INDEC (mensual, GBA, por tipo de hogar) | Mostrar "tu sueldo equivale a X canastas" y las líneas de indigencia y pobreza. | Fase 2 |
| Precios promedio de productos | INDEC (GBA) | Detalle de productos puntuales (pan, leche, nafta…). | Fase 3 |
| Tipo de cambio oficial | BCRA (API) | Calculadora del dólar, como fuente externa identificada. | Fase 3 |
| RIPTE | Secretaría de Seguridad Social | Otra referencia salarial (trabajadores estables). | Opcional |
| IPC CABA | Estadística CABA | Más detalle para CABA y fechas anteriores a 2017. Es fuente externa (no INDEC). | Opcional |
| REM | BCRA | Expectativas de inflación para precargar el simulador (marcado como expectativa, no dato). | Fase 3 |

## 3. Qué nivel de detalle permite INDEC

- **Por región sí; por ciudad o barrio no.** La provincia alcanza para elegir la región. Solo en la provincia de Buenos Aires hace falta saber si es conurbano (GBA) o interior (Pampeana).
- **Por categoría: 12 divisiones siempre, y subgrupos en los archivos de INDEC.** Con subgrupos, alquilar o no, usar colectivo o auto, tener prepaga o no comer carne cambian el resultado de forma medible. Con divisiones solamente, el efecto vegetariano no se ve, porque todo cae en "alimentos".
- **Productos puntuales (tofu, soja texturizada): no existen índices.** Se asignan al subgrupo más cercano (verduras, tubérculos y legumbres) y se documenta.
- **Antes de dic-2016 no hay serie nacional comparable.** 2007-2015 es el período de emergencia estadística. Fechas anteriores: la app avisa. A futuro se puede empalmar con el IPC CABA como fuente externa marcada como tal.

## 4. Lo que cambiaría del planteo original

1. **La inflación personal se calcula con tus pesos × los índices oficiales, no con la variación de tus gastos.** Si en marzo gastaste más en comida puede ser porque compraste más, no porque subieron los precios. El historial de gastos se mostraría como "variación de tu gasto", un indicador distinto. La excepción útil son los gastos con contrato (alquiler, prepaga, cuota del colegio, expensas): ahí el monto sí es un precio del mismo bien y puede reemplazar al índice de esa categoría ("precio propio").
2. **Ubicación: solo provincia, más "¿conurbano o interior?" para Buenos Aires.** Pedir localidad no agrega precisión con los datos de INDEC y suma fricción.
3. **Los pesos tienen fecha.** Si el usuario carga sus gastos de hoy, esas participaciones ya incluyen las subas pasadas. La fórmula los trata como estructura de hoy. Si no, en un período como 2024 se sobrepondera vivienda y servicios, que fue lo que más subió. Está resuelto en el motor y testeado.
4. **Perfiles rápidos sin pesos inventados.** "Vegetariano", "alquila" o "tiene auto" no traen porcentajes predefinidos. El inicio rápido es "partí del promedio de tu región": se toma la canasta del IPC de la región escalada a tu gasto total y después se ajustan los rubros que difieren. También hay un perfil de ejemplo, marcado como tal.
5. **El "mes actual" no tiene dato.** La fecha de comparación por defecto es el último mes publicado, con el aviso correspondiente.
6. **Se compara contra el IPC de tu región, con el nacional como referencia.** La descomposición "por qué tu inflación es distinta" es exacta solo dentro de una región. A nivel nacional, INDEC agrega las divisiones con pesos regionales distintos por división, así que el nivel general nacional no es una combinación fija de las divisiones nacionales.
7. **Índice de salarios desde la fase 2.** "¿Le ganaste al promedio de los salarios registrados?" es barato de hacer y muy útil.
8. **Lenguaje natural en fase 3, y solo como traductor.** El modelo de IA convierte la pregunta en una llamada al motor de cálculo y el número sale siempre del motor. Requiere backend, tiene costo por consulta y envía datos a un proveedor: hay que avisarlo.
9. **Local primero.** La fase 1 no guarda datos personales en servidores. La cuenta (fase 2) sirve para sincronizar entre dispositivos. Antes de guardar datos financieros en un servidor, hay que revisar las obligaciones de la Ley 25.326 de Protección de Datos Personales (inscripción de la base, política de privacidad, consentimiento). Conviene consultarlo con un abogado: esto no es asesoramiento legal.
10. **Canasta nueva del IPC.** El modelo de datos ya contempla otra base y otro conjunto de divisiones (13 con COICOP 2018) para cuando INDEC la implemente: series identificadas por base y empalme documentado.

## 5. Decisiones técnicas

- **Fase 1 sin servidor.** Un proceso programado descarga y valida los datos y genera `src/data/ipc.json`. La web estática (React + Vite + TypeScript) calcula todo en el navegador. Costo casi cero, sin datos personales en servidores y fácil de mantener.
- **Motor de cálculo puro y testeado** (`src/engine`), separado de la interfaz y de los datos.
- **Hosting: Netlify** (ya lo usás). Actualización: GitHub Actions todos los días, a las 16:30 y a las 9:00 (hora argentina).
- **Fase 2: Supabase** (autenticación con email o Google y Postgres con políticas por usuario). No hace falta un backend propio.
- **Precisión numérica.** Se calcula con los índices completos y se redondea solo al mostrar.

## 6. MVP construido (fase 1)

| Ítem del pedido | Estado |
|---|---|
| Web pública | ✔ 7 secciones, rutas reales |
| Calculadora "¿Cuánto debería ganar?" | ✔ con IPC nacional o regional; ejemplo precargado |
| Datos reales de INDEC | ✔ 94 series validadas, dic-2016 → ago-2026 |
| Historial IPC | ✔ "Datos de Argentina": mensual, interanual, por división, núcleo/regulados/estacionales |
| Sueldo equivalente | ✔ |
| Perfil básico de inflación personal | ✔ 12 rubros con detalle opcional, inicio desde el promedio regional o con un ejemplo |
| Comparación personal vs INDEC | ✔ con explicación y descomposición exacta |
| Dashboard | ✔ "Mi situación" |
| Responsive | ✔ probado a 390 px y 1280 px, tema claro y oscuro |
| Almacenamiento local | ✔ con exportar y borrar |
| Extra adelantado | "Mi sueldo" (historial local) y poder adquisitivo, que eran fase 2 |

## 6b. Servicios: lo que el IPC vigente subpondera

Con los datos oficiales, desde dic-2023 hasta ago-2026 los servicios subieron 425,6% y los bienes 193,9%. La canasta 2004/05 les da menos peso a los servicios que la de 2017/18: vivienda y servicios 9,4% contra 14,5%, transporte 11% contra 14,3%, comunicación 2,8% contra 5,1%. La app agrega tres cosas:

- **"IPC con canasta 2017/18"**: una estimación propia, marcada como tal.
- **Servicios contra bienes**: gráfico con dato oficial.
- **Precio propio**: para contratos y facturas, la app usa el aumento real que tuvo el usuario.

## 7. Qué sigue

Ver [ROADMAP.md](ROADMAP.md) y [../HANDOFF.md](../HANDOFF.md). El paso con más impacto es incorporar las **aperturas** desde `serie_ipc_aperturas.csv`. El código ya está hecho y testeado con datos de prueba: falta correrlo con el archivo real. Con eso, alquiler, prepaga, transporte público y la dieta pasan a valuarse con su propio índice, y la explicación separa el efecto peso del efecto composición.
