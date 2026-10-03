# Metodología de cálculo

Todas las funciones están en `src/engine` (TypeScript puro, sin dependencias) y tienen tests en `src/engine/__tests__` y `src/domain/__tests__`. Se calcula con los valores completos de los índices y se redondea solo al mostrar.

**Notación**

- `I(t)`: índice del mes `t` (IPC base dic-2016 = 100).
- `Iᵢ(t)`: índice de la categoría `i`.
- Las tasas se expresan en tanto por uno (0,25 = 25%).

## 1. Inflación (`calculateInflation`, `priceFactor`)

```
factor(t0, t1)       = I(t1) / I(t0)
inflación acumulada  = I(t1) / I(t0) − 1
mensual              = I(t) / I(t−1) − 1
interanual           = I(t) / I(t−12) − 1
acumulada en el año  = I(t) / I(dic del año anterior) − 1   (como la publica INDEC)
```

Nunca se suman tasas mensuales. Dos meses de 10% dan (1,1 × 1,1) − 1 = 21%, no 20% (`compoundRates`). Tasa mensual promedio equivalente: `factor^(1/n) − 1`. Anualizar una tasa mensual: `(1 + r)^12 − 1`.

Convención: un sueldo "de enero" se compara con el IPC de enero (precios promedio de ese mes).

## 2. Sueldo equivalente, real y poder adquisitivo (`salary.ts`)

```
sueldo equivalente(t1)   = sueldo(t0) × factor(t0, t1)
sueldo real (en $ de t0) = sueldo(t1) / factor(t0, t1)
variación real           = (sueldo(t1) / sueldo(t0)) / factor − 1 = (1 + g) / (1 + π) − 1
brecha vs. equivalente   = sueldo actual / sueldo equivalente − 1   (igual a la variación real)
sueldo objetivo          = sueldo(t0) × factor × (1 + objetivo real)
```

Ejemplo del documento de producto: sueldo +80%, precios +95% → 1,80 / 1,95 − 1 = **−7,7%**, no −15 puntos.

El `factor` puede ser el del IPC o el de la canasta personal. El motor no mezcla fuentes: recibe el factor ya resuelto.

## 3. Inflación personal (`basket.ts`)

Canasta fija valuada con índices oficiales: un índice tipo Lowe, la misma familia que usa el IPC.

```
C(t) = Σᵢ sᵢ · Iᵢ(t) / Iᵢ(b)                 C(b) = 1
inflación personal(t0, t1) = C(t1) / C(t0) − 1
```

- `sᵢ`: participación de la categoría `i` en el gasto del usuario (montos normalizados a 1).
- `b` (`weightsPeriod`): mes al que se refieren los montos. Por defecto, el último mes con datos.
- `Iᵢ`: índice de la categoría en la **región del usuario**.

### Por qué importa `b`

Si `b = t0`, la fórmula es un Laspeyres: `Σ sᵢ · Rᵢ`, con `Rᵢ = Iᵢ(t1)/Iᵢ(t0)`.

Si `b = t1` (el usuario cargó sus gastos de hoy), la fórmula da la media armónica ponderada: `1 / Σ sᵢ / Rᵢ`. Es el costo de la canasta de hoy valuada a precios del pasado.

Las dos miden la misma canasta. El atajo incorrecto sería usar las participaciones de hoy con la media aritmética:

> A se duplica, B queda igual. Con participaciones iniciales 50/50, la canasta sube 50%. Hoy esa misma canasta se reparte 2/3 – 1/3. El atajo daría 2/3 × 2 + 1/3 × 1 = **66,7%**, cuando la respuesta correcta es **50%**. (Test: "con participaciones de HOY da el mismo resultado".)

En Argentina, con precios relativos que cambian mucho (tarifas en 2024, alquileres, prepagas), la diferencia es grande.

### Participaciones efectivas

La misma canasta, valuada a precios de otro mes `a`:

```
sᵢ(a) = sᵢ · Iᵢ(a)/Iᵢ(b) / C(a)
```

Se usa para mostrar "tu peso" y el "peso del IPC" en un mes dado.

### El IPC como canasta

Las ponderaciones publicadas por INDEC están valuadas a precios de dic-2016, el período base. Por eso el IPC de cada región es la misma fórmula con `sᵢ` = ponderación oficial y `b = 2016-12`. Con las ponderaciones redondeadas a un decimal, el nivel general se reproduce con un desvío menor a 0,06% en todas las regiones; el peor caso es 0,15% en NOA en jun-2021, un desvío que ya trae la fuente. Lo controlan un test y la validación del proceso de datos.

## 4. Comparación y explicación (`comparePersonalVsOfficialInflation`)

Con `pᵢ` y `oᵢ` como participaciones efectivas en `t0` de la canasta personal y del IPC, y `Rᵢ = Iᵢ(t1)/Iᵢ(t0)`:

```
F_p = Σ pᵢ Rᵢ           (factor personal)
F_o = Σ oᵢ Rᵢ           (IPC reconstruido con las mismas categorías)
F_p − F_o = Σ (pᵢ − oᵢ) · (Rᵢ − F_o)      ← identidad exacta, porque Σ(pᵢ − oᵢ) = 0
```

El aporte de cada categoría, en puntos porcentuales, es `100 · (pᵢ − oᵢ)(Rᵢ − F_o)`. Una categoría sube tu inflación si pesa más que en el IPC y subió más que el promedio, o si pesa menos y subió menos.

La cifra que se muestra como "IPC" es la publicada por INDEC. La diferencia entre el IPC publicado y el reconstruido (`adjustment`) es el efecto del redondeo de las ponderaciones. Si llega a 0,05 p.p., se informa.

### Reglas de la explicación (`domain/explain.ts`)

- Si la diferencia es menor a `max(0,5 p.p.; 2% de la inflación oficial)`, se dice que fue "prácticamente igual".
- Si no, se nombran las categorías con aporte del mismo signo que la diferencia, hasta cubrir el 75% (máximo 3). Para cada una se dan los pesos y las variaciones que lo explican.
- Si la categoría principal explica menos del 30% de la diferencia, se dice que "la diferencia se reparte entre varias categorías y ninguna la explica por sí sola".
- Una categoría que empuja en sentido contrario se menciona si su aporte supera el 25% de la diferencia.
- Nunca se atribuye una causa que no salga de estos números.

## 5. Precisión que se informa

| Situación | Texto |
|---|---|
| Perfil = promedio de la región sin editar | "Es el promedio de tu región: todavía no refleja tus gastos." |
| Perfil por rubros (divisiones) | "Estimación basada en 12 categorías generales del IPC." |
| Con subgrupos (cuando se incorporen) | "Estimación basada en una estructura de gastos más específica." |

## 6. Simulador (`scenario.ts`, fase 3)

Datos: sueldo `S`, aumentos `{mes, tasa}` y una inflación mensual hipotética `π` constante durante `n` meses.

```
precios(m)       = (1 + π)^m
sueldo real(m)   = sueldo nominal(m) / precios(m)
sueldo necesario = S · (1 + π)^n
```

Se informan el poder adquisitivo al final y el promedio del período (lo que se vive mes a mes). Se rotula siempre como "simulación matemática, no predicción".

## 7. Datos faltantes y bordes

- Fechas fuera de rango devuelven el motivo, no un número: `PERIOD_BEFORE_START` (antes de dic-2016) o `PERIOD_AFTER_END` ("El último dato oficial disponible corresponde a…").
- Montos ≤ 0, canasta vacía o categorías inexistentes devuelven error con un mensaje para el usuario ("Necesitamos información adicional…").
- Un sueldo cargado en un mes sin IPC publicado se guarda, pero su equivalente se muestra como "sin dato".

## 8. Índices de CABA y provincias (`domain/externos.ts`)

Se usan como el IPC: sueldo equivalente = sueldo × I(t1) ÷ I(t0), con el índice del organismo elegido. Reglas:

- El IPCBA se empalma en feb-2022: antes, la base jul-2011/jun-2012 reescalada; desde feb-2022, la base 2021. Reproduce las cifras anuales publicadas.
- Si una serie tiene meses sin dato entre t0 y t1 (Mendoza 2012-2016), no se calcula (`MISSING_VALUE`): no se interpola.
- Siempre se muestran como fuente externa, con su organismo, cobertura y base.

## 9. Alquiler (`engine/rent.ts`)

- **IPC**: en cada ajuste (mes M, cada N meses, rezago r) se multiplican las variaciones mensuales publicadas de los meses M−r−N+1 … M−r. Con r = 2, un ajuste cuatrimestral de agosto usa marzo a junio. Se usa la variación con un decimal, como la difunde INDEC. Si falta algún mes, el ajuste queda "pendiente" y no se calcula ninguno posterior.
- **ICL**: alquiler nuevo = alquiler anterior × ICL(fecha del ajuste) ÷ ICL(fecha del ajuste anterior o del inicio), con los valores diarios oficiales del BCRA.

## 10. UVA (`engine/uva.ts`)

UVA(d) = UVA(d−1) × (1 + π(m−1))^(1/días(m)) para d entre el 17 del mes m y el 16 de m+1, con π la variación mensual del IPC nacional publicada (un decimal). Se ancla en un valor oficial (último día hábil real de la API) y se recorre hacia atrás o hacia adelante. Validación en el proceso de datos: los cierres de mes oficiales desde 2017 coinciden (±0,01). Antes de mar-2017 la UVA usaba otros índices: la calculadora arranca ahí.

## 11. "¿Le ganaste al promedio?" (`domain/ingresos.ts`)

contra el promedio = (1 + g) ÷ (1 + w) − 1, con g el aumento del sueldo del usuario y w el del índice de salarios de INDEC entre los mismos meses. Es la misma lógica que la variación real (no se restan porcentajes).

## 12. Canasta básica del hogar

CBT del hogar = CBT por adulto equivalente (INDEC, GBA) × Σ unidades de adulto equivalente de cada integrante (cuadro de INDEC por sexo y edad). Con esto se reproducen los hogares tipo de los informes. "Canastas que cubre" = ingreso del hogar ÷ CBT del hogar.

## 13. Precios promedio: "¿cuánto aumentó?" (`domain/precios.ts`)

variación = P(t₁) ÷ P(t₀) − 1, con P el precio promedio que publica INDEC para el producto en la región.

contra la inflación = (1 + variación) ÷ (1 + π), con π la variación del nivel general del IPC de la misma región entre t₀ y t₁. "Si hubiera subido como la inflación" = P(t₀) × (1 + π).

- Cada producto se compara solo consigo mismo en el tiempo: INDEC advierte que las variedades no están armonizadas entre regiones.
- Si INDEC no publicó el precio de un mes (por ejemplo, algunos productos en marzo-abril de 2020), la app lo dice y no interpola.
- Las variaciones mensuales que da la app coinciden con las del Cuadro 20 de INDEC (por ejemplo, julio 2026: pan francés +1,7%, papa +20,8%, zapallo +55,1%, naranja −7,7%).

## 14. Jubilación mínima del mes siguiente (`haberMinimoByRule`)

haber(m) = redondeo al centavo de haber(m − 1) × (1 + π(m − 2)), con π(m − 2) la variación del IPC nacional de dos meses antes, con dos decimales (Decreto 274/2024). Se usa solo para el mes que todavía no figura en la serie oficial y se rotula como cálculo de la app. Reproduce al centavo todos los meses publicados de mayo de 2024 a septiembre de 2026.

- **Control en cada carga** (`nextHaberMinimo`): el mes siguiente se calcula solo si la regla da al centavo el último dato oficial. Si no coincide (cambio de ley, aumento extraordinario), la app muestra el dato oficial y lo dice.
- **Bono** (`bonoFor`): se suma solo en el mes que tiene decreto (`BONO_PREVISIONAL`). Para los meses sin decreto, la app muestra el haber sin bono y cita el último.

