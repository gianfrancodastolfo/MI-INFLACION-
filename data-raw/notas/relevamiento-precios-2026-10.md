# Precios promedio de INDEC (2/10/2026)

Se bajaron con WebFetch desde la API de Series de Tiempo, porque la política de red del entorno de construcción bloquea los dominios .gob.ar. Hay tres series por consulta. El crudo está en `data-raw/api-snapshot-2026-10/precios/`.

## Qué hay

- **GBA, 59 productos.**
  - Distribución 101.9 ("Precios al consumidor de un conjunto de alimentos y bebidas. Base diciembre 2016"), series `105.1_*`.
  - Los alimentos y bebidas empiezan en abr-2016; limpieza y cuidado personal, en jul-2016. La app usa desde dic-2016, la base del IPC.
  - La serie "Aceite mezcla" (`105.1_I2AM_2016_M_22`) termina en nov-2016 y no se usa.
- **Regiones, 14 productos.**
  - Distribución 145.13 ("Precios al consumidor de un conjunto de elementos de la canasta del IPC según regiones"), series `348.1_*`, desde jun-2017.
  - Los productos son pan francés, harina, arroz, fideos, carne picada, pollo, aceite, leche, huevos, papa, azúcar, detergente, lavandina y jabón de tocador.
  - Las series de GBA de esta distribución se usan solo para controlar.
- **Unidades.** Son las que informa INDEC en el informe de julio 2026 (Cuadro 20 para GBA, Cuadro 19 por región).
- **Advertencia de INDEC.** Está en el informe del IPC: "la comparación de precios a través de las regiones puede no ser válida, ya que no se trata de bienes con especificaciones armonizadas a nivel regional". Por eso la app compara cada producto solo consigo mismo en el tiempo.

## Errores de la API y cómo se corrigieron

Todos se verificaron contra los informes del IPC de INDEC. Las cifras publicadas están en `scripts/etl/precios.mjs` (`PUBLISHED`).

1. **Regiones, junio a agosto 2023.**
   - Error: en la 348.1, el slot de junio trae los valores de julio y el de julio trae los de junio. En las cinco regiones del interior, agosto repite a julio.
   - Corrección: se reemplazaron por los Cuadros 19 de los informes de [junio](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_07_23C94E54F825.pdf), [julio](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_23ED301034A4.pdf) y [agosto 2023](https://www.eltucumano.com/adjunto/2023/09/13/indec.pdf). Este último es una copia del informe oficial publicada el día de la difusión; su columna de GBA coincide en los 14 productos con la serie 105.1.
2. **Noreste y Noroeste, julio 2025.**
   - Error: la 348.1 trae las dos regiones cruzadas en los 14 productos.
   - Corrección: se usó el Cuadro 19 del [informe de julio 2025](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_25B0A3ACE622.pdf).
3. **GBA, marzo 2017.**
   - Error: detergente, jabón en pan, lavandina, algodón y champú están corridos una columna en la 105.1. El detergente, por ejemplo, trae el valor del jabón en pan.
   - Corrección: se usó el Cuadro 7 del [informe de marzo 2017](https://sitioanterior.indec.gob.ar/uploads/informesdeprensa/ipc_04_17.pdf). Ahí las columnas impresas son marzo y febrero, y la variación publicada confirma el orden.
4. **GBA, desde enero 2026.**
   - Error: la 105.1 trae cruzados el desodorante y el jabón de tocador. INDEC cambió el orden de las filas y la API asigna por posición.
   - Corrección: se intercambian mientras el desodorante (150 cc) aparezca más barato que el jabón (125 g). Se verificó con el Cuadro 20 de julio 2026 y con la serie regional de jabón de tocador.
5. **Solo afecta al control, GBA, feb-2026.** La serie regional de lavandina trae el valor del detergente. No tiene efecto, porque GBA usa la 105.1.

## Controles en cada actualización (550)

- **GBA, jun y jul 2026:** 59 productos, contra el Cuadro 20 del [informe de julio 2026](https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_2642C82F62AE.pdf).
- **Seis regiones, jul 2026:** 14 productos, contra el Cuadro 19 del mismo informe.
- **Jul 2025:** 11 productos en las seis regiones, y harina, fideos y carne en NEA y NOA.
- **Jun, jul y ago 2023:** 14 productos en las seis regiones.
- **Feb y mar 2017 en GBA:** 11 productos.
- **Además:**
  - la serie regional de GBA tiene que coincidir con la 105.1 (diferencia menor a 0,3%);
  - ninguna región puede repetir un mes entero;
  - los saltos de más de 20% que vuelven al mes siguiente, fuera de frutas y verduras, se avisan.

## Saltos revisados que se dejan como están

- **GBA, agua sin gas, may-2019:** +30,6% y −16,7% al mes siguiente. No se encontró el informe para verificarlo.
- **NEA, pollo, abr-2023:** en abril 2023 el pollo subió en todas las regiones.
