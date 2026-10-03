# Hoja de ruta

## Fase 1: MVP público (hecho, salvo lo marcado)

- [x] Calculadora "¿Cuánto debería ganar hoy?" con IPC nacional o regional
- [x] Datos reales de INDEC (94 series, dic-2016 → ago-2026) con validación y correcciones documentadas
- [x] Historial del IPC: mensual, interanual, por división, núcleo/regulados/estacionales
- [x] Perfil básico de inflación personal (12 rubros con detalle opcional, inicio desde el promedio regional o con un ejemplo)
- [x] Comparación con el IPC de la región, explicación y descomposición exacta por categoría
- [x] Mi situación (dashboard) y Mi sueldo (historial local, poder adquisitivo)
- [x] Responsive y tema claro/oscuro; guardado local con exportar y borrar
- [x] Motor de cálculo con tests (137 tests en total, con datos reales y proceso de datos)
- [x] Proceso de datos con fuente principal (INDEC) y alternativa (API), validación y escritura atómica
- [x] GitHub Actions: actualización diaria y CI; configuración de Netlify
- [x] "IPC con canasta 2017/18" (estimación de la app) en calculadora, comparación y Datos de Argentina
- [x] Servicios contra bienes y regulados contra núcleo (gráficos con dato oficial)
- [x] Precio propio: aumento real de alquiler, expensas, luz/gas/agua, prepaga, colegio, universidad, internet y streaming
- [x] IPC de la Ciudad (IPCBA, desde 2012) y de 7 provincias (fuente externa): en la calculadora y en "Provincias", con detalle por división de CABA
- [x] Calculadora de alquiler por IPC (variaciones publicadas, rezago configurable) y por ICL (diario oficial del BCRA)
- [x] Cuota UVA: valor diario con la regla del BCRA (validada desde 2017), cuota en pesos mes a mes y contra el IPC
- [x] "¿Le ganaste al promedio?" con el índice de salarios de INDEC (total, registrados, privados, públicos, no registrados)
- [x] Canasta básica del hogar (INDEC, GBA) con unidades de adulto equivalente; salario mínimo, jubilación mínima y RIPTE
- [x] Compartir el resultado como imagen (solo porcentajes) y aviso de publicaciones de INDEC con archivo .ics
- [x] "¿Cuánto aumentó?": precios promedio de INDEC (59 productos en GBA, 14 por región) contra el IPC de la región, con las correcciones de la API verificadas contra los informes (550 controles)
- [x] Jubilación mínima del mes siguiente con la regla de movilidad (validada al centavo desde may-2024) y bono de octubre (Decreto 1108/2026)
- [x] Actualización automática a prueba del mes nuevo: tests sin meses fijos (simulado con sep y oct 2026) y sin commits cuando no hay datos nuevos
- [ ] Reemplazar los pesos 2017/18 provisorios por la tabla completa de INDEC
- [ ] **Bajar los archivos directo de INDEC y confirmar el formato del lector** (ver HANDOFF, tarea 2)
- [x] Subgrupos (aperturas), código listo: lector, validación, canasta por subgrupo y descomposición en dos niveles (efecto peso + efecto composición) en la interfaz, con tests sobre datos de prueba
- [ ] **Correr los subgrupos con `serie_ipc_aperturas.csv` real** y ajustar nombres si difieren (HANDOFF, tarea 3)
- [ ] Publicar: repo en GitHub, deploy en Netlify, dominio (HANDOFF, tareas 4 y 5)
- [ ] Prerender de las páginas para SEO y `meta` por ruta
- [ ] Política de privacidad y página "Acerca de"
- [ ] Métricas sin cookies (Plausible, Umami o Cloudflare), sin montos

## Fase 2: cuentas e historial

- [ ] Supabase: Auth (email y Google), tablas y RLS (ver ARQUITECTURA.md); migración desde localStorage
- [ ] Historial de gastos por mes con "variación de tu gasto" (separada de la inflación)
- [ ] Aviso por notificación o mail el día del IPC con tu inflación actualizada (hoy: archivo .ics sin cuenta)
- [ ] Informe mensual ("Mi resumen de octubre"), disponible cuando INDEC publica el mes
- [ ] Objetivo salarial: "quiero +20% real" (el motor ya tiene `calculateRequiredSalary`)
- [ ] Borrar la cuenta (Edge Function) y exportar datos

## Fase 3: avanzadas

- [ ] Importar CSV, Excel y JSON con vista previa y reconocimiento de categorías
- [ ] Exportar CSV y Excel; resumen en PDF
- [ ] Simulador de sueldo (el motor ya tiene `calculateFutureScenario`); precarga opcional con el REM, marcado como expectativa
- [ ] "Preguntale a tus datos": IA como traductor hacia el motor, nunca como fuente de números
- [ ] PWA completa: service worker y uso sin conexión (el manifest ya está)
- [ ] Dólar oficial (BCRA, fuente externa) como sección aparte
- [ ] Preparación para la canasta nueva del IPC (13 divisiones, otra base) cuando INDEC la publique

## Ideas investigadas (próximas, por impacto)

Hechas en oct-2026: alquiler (IPC e ICL), ¿le ganaste al promedio?, canasta básica, SMVM y jubilación mínima, cuota UVA, compartir como imagen, aviso con .ics y precios promedio ("¿cuánto aumentó?").

1. **Tu changuito**: elegir cantidades de los 59 productos de GBA y ver cuánto aumentó el total (cálculo de la app con precios de INDEC; mismo aviso de INDEC sobre comparar regiones).
2. **Canasta básica por región** (INDEC, semestral) para quienes no viven en GBA.
3. **IPC de Río Negro y Jujuy** (publican, pero no están en la API): conseguir la serie en cada dirección de estadística.
4. **Inflación personal con divisiones del IPCBA** para quien vive en CABA (13 divisiones COICOP 2018).
5. **Revisar "Mi propio IPC" de INDEC** (calculadora oficial, dic-2024) para diferenciarse y enlazarla.
6. **Dividir el resto del código por ruta**: /precios ya carga aparte; el bundle principal pesa unos 172 KB comprimido.
