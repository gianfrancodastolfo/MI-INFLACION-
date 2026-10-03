/**
 * Configuración del proceso de datos oficiales.
 * Todo identificador de este archivo fue verificado contra la fuente (ver docs/FUENTES.md).
 */

export const BASE_PERIOD = '2016-12';

export const REGIONS = ['nacional', 'gba', 'pampeana', 'nea', 'noa', 'cuyo', 'patagonia'];

/** Nivel general + 12 divisiones COICOP del IPC (base dic-2016, canasta ENGHo 2004/05). */
export const DIVISIONS = [
  'alimentos', 'bebidas_alcoholicas', 'prendas', 'vivienda', 'equipamiento', 'salud',
  'transporte', 'comunicacion', 'recreacion', 'educacion', 'restaurantes', 'varios',
];
export const CORE_CATEGORIES = ['nivel_general', ...DIVISIONS];

/** Categorías analíticas (solo se publican a nivel nacional en este dataset). */
export const EXTRA_CATEGORIES_NATIONAL = ['nucleo', 'regulados', 'estacionales', 'bienes', 'servicios'];

// ---------------------------------------------------------------------------
// Fuente principal: archivos de INDEC
// ---------------------------------------------------------------------------
export const INDEC_SOURCES = {
  divisiones: 'https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv',
  aperturas: 'https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_aperturas.csv',
  pagina: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31',
};

// ---------------------------------------------------------------------------
// Fuente alternativa: API de Series de Tiempo (datos.gob.ar). Reproduce las series de INDEC.
// IDs verificados uno por uno contra la API (oct-2026).
// ---------------------------------------------------------------------------
export const API_BASE = 'https://apis.datos.gob.ar/series/api/series';

const REGION_CODE = { nacional: 'NAL', gba: 'GBA', pampeana: 'ANA', nea: 'NEA', noa: 'NOA', cuyo: 'UYO', patagonia: 'NIA' };
const REGION_FIELD = { nacional: 'nacional', gba: 'gba', pampeana: 'pampeana', nea: 'nea', noa: 'noa', cuyo: 'cuyo', patagonia: 'patagonia' };
// [distribución, código, largo del nombre de campo sin región]
const SERIES_PARTS = {
  nivel_general: ['148.3', 'NIVEL', 17],
  alimentos: ['146.3', 'ALIMEN', 36],
  bebidas_alcoholicas: ['146.3', 'BEBIDA', 30],
  prendas: ['146.3', 'PRENDA', 26],
  vivienda: ['146.3', 'VIVIEN', 43],
  equipamiento: ['146.3', 'EQUIPA', 37],
  salud: ['146.3', 'SALUD', 9],
  transporte: ['146.3', 'TRANSP', 14],
  comunicacion: ['146.3', 'COMUNI', 18],
  recreacion: ['146.3', 'RECREA', 22],
  educacion: ['146.3', 'EDUCAC', 13],
  restaurantes: ['146.3', 'RESTAU', 24],
  varios: ['146.3', 'BIENES', 27],
  nucleo: ['148.3', 'NUCLEO', 10],
  regulados: ['148.3', 'REGULA', 13],
  estacionales: ['148.3', 'ESTACI', 16],
  // Bienes y servicios: series mensuales cuyo identificador lleva "T" (así figuran en el catálogo).
  bienes: ['147.3', 'BIENES', 10, 'T'],
  servicios: ['147.3', 'SERVIC', 13, 'T'],
};

/** ID de la API para (categoría, región). Patrón del catálogo: {dist}_I{código}{región}_DICI_M_{largo}. */
export function apiSeriesId(category, region) {
  const parts = SERIES_PARTS[category];
  if (!parts) throw new Error(`Categoría sin ID de API: ${category}`);
  const [dist, code, len, freq = 'M'] = parts;
  const field = REGION_FIELD[region];
  return `${dist}_I${code}${REGION_CODE[region]}_DICI_${freq}_${len + 1 + field.length}`;
}

/** Nombre de columna que devuelve la API en formato CSV → [categoría, región]. */
export const API_FIELD_PREFIX = {
  ipc_nivel_general_: 'nivel_general',
  ipc_alimentos_bebidas_no_alcoholicas_: 'alimentos',
  ipc_bebidas_alcoholicas_tabaco_: 'bebidas_alcoholicas',
  ipc_prendas_vestir_calzado_: 'prendas',
  ipc_vivienda_agua_electricidad_combustibles_: 'vivienda',
  ipc_equipamiento_mantenimientos_hogar_: 'equipamiento',
  ipc_salud_: 'salud',
  ipc_transporte_: 'transporte',
  ipc_comunicaciones_: 'comunicacion',
  ipc_recreacion_cultura_: 'recreacion',
  ipc_educacion_: 'educacion',
  ipc_restaurantes_hoteles_: 'restaurantes',
  ipc_bienes_servicios_varios_: 'varios',
  ipc_nucleo_: 'nucleo',
  ipc_regulados_: 'regulados',
  ipc_estacionales_: 'estacionales',
  ipc_bienes_: 'bienes',
  ipc_servicios_: 'servicios',
};

// ---------------------------------------------------------------------------
// Ponderaciones oficiales (%) por región, base dic-2016 (ENGHo 2004/05).
// Fuente: INDEC, Informe técnico IPC (sección metodológica), publicado 10/09/2026.
// ---------------------------------------------------------------------------
export const OFFICIAL_WEIGHTS = {
  gba:       { alimentos: 23.4, bebidas_alcoholicas: 3.3, prendas: 8.5,  vivienda: 10.5, equipamiento: 6.3, salud: 8.8, transporte: 11.6, comunicacion: 2.8, recreacion: 7.5, educacion: 3.0, restaurantes: 10.8, varios: 3.6 },
  pampeana:  { alimentos: 28.6, bebidas_alcoholicas: 3.8, prendas: 10.4, vivienda: 8.7,  equipamiento: 6.3, salud: 8.2, transporte: 10.4, comunicacion: 2.9, recreacion: 7.4, educacion: 1.6, restaurantes: 8.1,  varios: 3.6 },
  nea:       { alimentos: 35.3, bebidas_alcoholicas: 3.6, prendas: 11.6, vivienda: 8.1,  equipamiento: 7.8, salud: 5.3, transporte: 9.6,  comunicacion: 2.8, recreacion: 6.2, educacion: 1.4, restaurantes: 5.0,  varios: 3.3 },
  noa:       { alimentos: 34.7, bebidas_alcoholicas: 3.1, prendas: 12.4, vivienda: 7.0,  equipamiento: 6.1, salud: 6.3, transporte: 8.4,  comunicacion: 2.6, recreacion: 5.9, educacion: 2.0, restaurantes: 8.0,  varios: 3.4 },
  cuyo:      { alimentos: 28.4, bebidas_alcoholicas: 3.6, prendas: 11.4, vivienda: 8.9,  equipamiento: 6.3, salud: 7.4, transporte: 12.1, comunicacion: 2.5, recreacion: 6.7, educacion: 2.2, restaurantes: 6.8,  varios: 3.6 },
  patagonia: { alimentos: 27.4, bebidas_alcoholicas: 3.5, prendas: 12.8, vivienda: 10.1, equipamiento: 6.5, salud: 5.0, transporte: 13.4, comunicacion: 3.2, recreacion: 7.8, educacion: 2.1, restaurantes: 5.1,  varios: 3.1 },
};

/** Participación de cada región en el gasto de consumo total (%), misma fuente. */
export const REGION_SHARES = { gba: 44.7, pampeana: 34.2, nea: 4.5, noa: 6.9, cuyo: 5.2, patagonia: 4.6 };

// ---------------------------------------------------------------------------
// Subgrupos ("aperturas") del IPC. División a la que pertenece cada uno, por nombre publicado
// (informe técnico IPC, sep-2026). Si el CSV trae códigos COICOP (p. ej. 01.1.1), se usan los dos primeros dígitos.
// ---------------------------------------------------------------------------
export const DIVISION_BY_CODE = {
  '01': 'alimentos', '02': 'bebidas_alcoholicas', '03': 'prendas', '04': 'vivienda', '05': 'equipamiento', '06': 'salud',
  '07': 'transporte', '08': 'comunicacion', '09': 'recreacion', '10': 'educacion', '11': 'restaurantes', '12': 'varios',
};
export const APERTURA_PARENT_BY_NAME = {
  'Alimentos': 'alimentos',
  'Pan y cereales': 'alimentos',
  'Carnes y derivados': 'alimentos',
  'Leche, productos lácteos y huevos': 'alimentos',
  'Aceites, grasas y manteca': 'alimentos',
  'Frutas': 'alimentos',
  'Verduras, tubérculos y legumbres': 'alimentos',
  'Azúcar, dulces, chocolate, golosinas, etc.': 'alimentos',
  'Bebidas no alcohólicas': 'alimentos',
  'Café, té, yerba y cacao': 'alimentos',
  'Aguas minerales, bebidas gaseosas y jugos': 'alimentos',
  'Bebidas alcohólicas': 'bebidas_alcoholicas',
  'Tabaco': 'bebidas_alcoholicas',
  'Prendas de vestir y materiales': 'prendas',
  'Calzado': 'prendas',
  'Alquiler de la vivienda y gastos conexos': 'vivienda',
  'Alquiler de la vivienda': 'vivienda',
  'Electricidad, gas y otros combustibles': 'vivienda',
  'Bienes y servicios para la conservación del hogar': 'equipamiento',
  'Productos medicinales, artefactos y equipos para la salud': 'salud',
  'Gastos de prepagas': 'salud',
  'Adquisición de vehículos': 'transporte',
  'Funcionamiento de equipos de transporte personal': 'transporte',
  'Combustibles y lubricantes para vehículos de uso del hogar': 'transporte',
  'Transporte público': 'transporte',
  'Servicios de telefonía e internet': 'comunicacion',
  'Equipos audiovisuales, fotográficos y de procesamiento de la información': 'recreacion',
  'Servicios recreativos y culturales': 'recreacion',
  'Periódicos, diarios, revistas, libros y artículos de papelería': 'recreacion',
  'Restaurantes y comidas fuera del hogar': 'restaurantes',
  'Cuidado personal': 'varios',
};

// ---------------------------------------------------------------------------
// Correcciones conocidas de la API de Series de Tiempo (no aplican a los archivos de INDEC).
// ---------------------------------------------------------------------------
export const API_CORRECTIONS = [
  {
    region: 'nacional',
    category: 'bienes',
    period: '2018-08',
    sourceValue: 184.8322,
    value: 148.7022,
    reason:
      'El valor de la API es inconsistente con julio y septiembre. Se reconstruyó con las variaciones publicadas por INDEC ' +
      '(bienes: ago-2018 3,2%, sep-2018 8,7%); el error posible es menor a 0,01%.',
  },
  {
    region: 'nacional',
    category: 'servicios',
    period: '2018-08',
    sourceValue: 191.667,
    value: 167.9606,
    reason:
      'El valor de la API es inconsistente con julio y septiembre. Se reconstruyó con las variaciones publicadas por INDEC ' +
      '(servicios: ago-2018 5,0%, sep-2018 3,0%); el error posible es menor a 0,05%.',
  },
  {
    region: 'nea',
    category: 'nivel_general',
    period: '2022-07',
    sourceValue: 861.702,
    value: 887.9576,
    reason:
      'El valor de la API coincide con el de la región Pampeana para ese mes. Se reconstruyó agregando las 12 divisiones de NEA ' +
      'con ponderaciones fijas; reproduce las variaciones publicadas por INDEC (jul-2022: 7,4%; ago-2022: 7,6%).',
  },
];

/** Desvíos menores ya analizados: se informan como advertencia, no como error. */
export const KNOWN_QUIRKS = [
  { period: '2019-04', category: 'nivel_general', note: 'En la fuente, el nivel general de abr-2019 está encadenado desde una variación redondeada.' },
  { region: 'noa', period: '2021-06', category: 'nivel_general', note: 'Desvío de ~0,15% entre nivel general y divisiones en la fuente.' },
  { region: 'cuyo', period: '2021-06', category: 'nivel_general', note: 'Desvío de ~0,04% entre nivel general y divisiones en la fuente.' },
  { region: 'patagonia', period: '2017-06', category: 'nivel_general', note: 'Nivel general encadenado desde una variación redondeada.' },
];

/** Umbrales de validación del nivel general contra Σ ponderación × división. */
export const CONSISTENCY_WARN = 0.001; // 0,1%
export const CONSISTENCY_ERROR = 0.005; // 0,5%
