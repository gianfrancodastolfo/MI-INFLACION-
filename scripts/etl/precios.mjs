/**
 * Precios promedio de productos seleccionados de la canasta del IPC (INDEC), vía API de Series de Tiempo.
 *
 *  - GBA: 59 productos (distribución 101.9, series 105.1_*). Se usan desde dic-2016, la base del IPC.
 *  - Regiones: 14 productos en Pampeana, Noreste, Noroeste, Cuyo y Patagonia (distribución 145.13, series 348.1_*),
 *    desde jun-2017. Las 348.1 de GBA se bajan solo para controlar contra las 105.1.
 *
 * La API tiene errores puntuales (ver PUBLISHED y SWAPS): se corrigen con las cifras que INDEC publicó en sus
 * informes y quedan registrados en meta.corrections. Los mismos informes sirven de control (meta.validation).
 * Ver data-raw/notas/relevamiento-precios-2026-10.md y docs/FUENTES.md.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { addMonths, decodeText, fetchWithRetry, toMonthIndex } from './lib.mjs';
import { apiUrl, parseApiCsvByOrder, toSeries } from './externos.mjs';

export const PRECIOS_GBA_FROM = '2016-12';
export const PRECIOS_REGIONS = ['pampeana', 'nea', 'noa', 'cuyo', 'patagonia'];
export const INDEC_NOTE = 'Se presentan precios promedio para un conjunto de bienes de la canasta, a los efectos de brindar transparencia al proceso de construcción del IPC. De esta manera, se facilita a las personas usuarias hacer un seguimiento de la evolución de precios a través del tiempo. Sin embargo, la comparación de precios a través de las regiones puede no ser válida, ya que no se trata de bienes con especificaciones armonizadas a nivel regional.';

// ---------------------------------------------------------------------------
// Productos. `unit` es la unidad que informa INDEC en el informe de julio 2026 (Cuadro 20 y Cuadro 19).
// `reg` son las series regionales (348.1); `gba` la serie de GBA (105.1). El orden define los archivos del snapshot.
// ---------------------------------------------------------------------------
const R = (gba, pampeana, nea, noa, cuyo, patagonia) => ({ gba, pampeana, nea, noa, cuyo, patagonia });
export const PRODUCTS = [
  { id: 'pan_frances', name: 'Pan francés tipo flauta', unit: 'Kg', group: 'panificados', division: 'alimentos', gba: '105.1_I2PFF_2016_M_27',
    reg: R('348.1_GBA_PAN_FR_KG__18', '348.1_PAMPEANA_P_KG__23', '348.1_NEA_PAN_FR_KG__18', '348.1_NOA_PAN_FR_KG__18', '348.1_CUYO_PAN_F_KG__19', '348.1_PATAGONIA_KG__24') },
  { id: 'pan_mesa', name: 'Pan de mesa', unit: '390 g', group: 'panificados', division: 'alimentos', gba: '105.1_I2PM_2016_M_17' },
  { id: 'galletitas_dulces', name: 'Galletitas dulces envasadas sin relleno', unit: '150 g', group: 'panificados', division: 'alimentos', gba: '105.1_I2GDE_2016_M_36' },
  { id: 'galletitas_agua', name: 'Galletitas de agua envasadas', unit: '250 g', group: 'panificados', division: 'alimentos', gba: '105.1_I2GAE_2016_M_34' },
  { id: 'harina', name: 'Harina de trigo común 000', unit: 'Kg', group: 'panificados', division: 'alimentos', gba: '105.1_I2HTC_2016_M_27',
    reg: R('348.1_GBA_HARINA_KG__32', '348.1_PAMPEANA_H_KG__37', '348.1_NEA_HARINA_KG__32', '348.1_NOA_HARINA_KG__32', '348.1_CUYO_HARIN_KG__33', '348.1_PATAGONIA_KG__38') },
  { id: 'arroz', name: 'Arroz blanco simple', unit: 'Kg', group: 'panificados', division: 'alimentos', gba: '105.1_I2ABS_2016_M_28',
    reg: R('348.1_GBA_ARROZ_KG__26', '348.1_PAMPEANA_A_KG__31', '348.1_NEA_ARROZ_KG__26', '348.1_NOA_ARROZ_KG__26', '348.1_CUYO_ARROZ_KG__27', '348.1_PATAGONIA_KG__32') },
  { id: 'fideos', name: 'Fideos secos tipo guisero', unit: '500 g', group: 'panificados', division: 'alimentos', gba: '105.1_I2FS_2016_M_21',
    reg: R('348.1_GBA_FIDEOS_GR__36', '348.1_PAMPEANA_F_GR__41', '348.1_NEA_FIDEOS_GR__36', '348.1_NOA_FIDEOS_GR__36', '348.1_CUYO_FIDEO_GR__37', '348.1_PATAGONIA_GR__42') },
  { id: 'asado', name: 'Asado', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2A_2016_M_14' },
  { id: 'carne_picada', name: 'Carne picada común', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2CPC_2016_M_27',
    reg: R('348.1_GBA_CARNE_KG__25', '348.1_PAMPEANA_C_KG__30', '348.1_NEA_CARNE_KG__25', '348.1_NOA_CARNE_KG__25', '348.1_CUYO_CARNE_KG__26', '348.1_PATAGONIA_KG__31') },
  { id: 'paleta', name: 'Paleta', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2P_2016_M_15' },
  { id: 'cuadril', name: 'Cuadril', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2C_2016_M_16' },
  { id: 'nalga', name: 'Nalga', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2N_2016_M_14' },
  { id: 'hamburguesas', name: 'Hamburguesas congeladas', unit: 'Env. 4 u', group: 'carnes', division: 'alimentos', gba: '105.1_I2HC_2016_M_32' },
  { id: 'pollo', name: 'Pollo entero', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2PE_2016_M_21',
    reg: R('348.1_GBA_POLLO_KG__19', '348.1_PAMPEANA_P_KG__24', '348.1_NEA_POLLO_KG__19', '348.1_NOA_POLLO_KG__19', '348.1_CUYO_POLLO_KG__20', '348.1_PATAGONIA_KG__25') },
  { id: 'merluza', name: 'Filet de merluza fresco', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2FMF_2016_M_29' },
  { id: 'salchicha', name: 'Salchicha tipo Viena', unit: 'Env. 6 u', group: 'carnes', division: 'alimentos', gba: '105.1_I2SV_2016_M_24' },
  { id: 'jamon', name: 'Jamón cocido', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2JC_2016_M_21' },
  { id: 'salchichon', name: 'Salchichón', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2S_2016_M_19' },
  { id: 'salame', name: 'Salame', unit: 'Kg', group: 'carnes', division: 'alimentos', gba: '105.1_I2S_2016_M_15' },
  { id: 'aceite', name: 'Aceite de girasol', unit: 'Bot. 1,5 litros', group: 'almacen', division: 'alimentos', gba: '105.1_I2AG_2016_M_23',
    reg: R('348.1_GBA_ACEITEDIO__35', '348.1_PAMPEANA_ADIO__40', '348.1_NEA_ACEITEDIO__35', '348.1_NOA_ACEITEDIO__35', '348.1_CUYO_ACEITDIO__36', '348.1_PATAGONIA_DIO__41') },
  { id: 'leche', name: 'Leche fresca entera en sachet', unit: 'Litro', group: 'lacteos', division: 'alimentos', gba: '105.1_I2LFES_2016_M_35',
    reg: R('348.1_GBA_LECHE_TRO__36', '348.1_PAMPEANA_LTRO__41', '348.1_NEA_LECHE_TRO__36', '348.1_NOA_LECHE_TRO__36', '348.1_CUYO_LECHETRO__37', '348.1_PATAGONIA_TRO__42') },
  { id: 'leche_polvo', name: 'Leche en polvo entera', unit: '800 g', group: 'lacteos', division: 'alimentos', gba: '105.1_I2LPE_2016_M_27' },
  { id: 'queso_cremoso', name: 'Queso cremoso', unit: 'Kg', group: 'lacteos', division: 'alimentos', gba: '105.1_I2QC_2016_M_22' },
  { id: 'queso_pategras', name: 'Queso pategrás', unit: 'Kg', group: 'lacteos', division: 'alimentos', gba: '105.1_I2QPG_2016_M_25' },
  { id: 'queso_sardo', name: 'Queso sardo', unit: 'Kg', group: 'lacteos', division: 'alimentos', gba: '105.1_I2QS_2016_M_20' },
  { id: 'manteca', name: 'Manteca', unit: '200 g', group: 'lacteos', division: 'alimentos', gba: '105.1_I2M_2016_M_16' },
  { id: 'yogur', name: 'Yogur firme', unit: '195 cc', group: 'lacteos', division: 'alimentos', gba: '105.1_I2YF_2016_M_20' },
  { id: 'dulce_leche', name: 'Dulce de leche', unit: '400 g', group: 'lacteos', division: 'alimentos', gba: '105.1_I2DL_2016_M_20' },
  { id: 'huevos', name: 'Huevos de gallina', unit: 'Docena', group: 'lacteos', division: 'alimentos', gba: '105.1_I2HG_2016_M_23',
    reg: R('348.1_GBA_HUEVOSENA__28', '348.1_PAMPEANA_HENA__33', '348.1_NEA_HUEVOSENA__28', '348.1_NOA_HUEVOSENA__28', '348.1_CUYO_HUEVOENA__29', '348.1_PATAGONIA_ENA__34') },
  { id: 'manzana', name: 'Manzana deliciosa', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2MD_2016_M_26' },
  { id: 'limon', name: 'Limón', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2L_2016_M_14' },
  { id: 'naranja', name: 'Naranja', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2N_2016_M_16' },
  { id: 'banana', name: 'Banana', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2B_2016_M_15' },
  { id: 'batata', name: 'Batata', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2BAT_2016_M_15' },
  { id: 'papa', name: 'Papa', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2P_2016_M_13',
    reg: R('348.1_GBA_PAPA_K_KG__11', '348.1_PAMPEANA_P_KG__16', '348.1_NEA_PAPA_K_KG__11', '348.1_NOA_PAPA_K_KG__11', '348.1_CUYO_PAPA_KG__12', '348.1_PATAGONIA_KG__17') },
  { id: 'cebolla', name: 'Cebolla', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2CE_2016_M_16' },
  { id: 'lechuga', name: 'Lechuga', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2L_2016_M_16' },
  { id: 'tomate', name: 'Tomate redondo', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2TR_2016_M_23' },
  { id: 'zapallo', name: 'Zapallo anco', unit: 'Kg', group: 'frutas_verduras', division: 'alimentos', gba: '105.1_I2Z_2016_M_16' },
  { id: 'tomate_conserva', name: 'Tomate entero en conserva', unit: 'Lata 230 g', group: 'almacen', division: 'alimentos', gba: '105.1_I2TEC_2016_M_31' },
  { id: 'arvejas', name: 'Arvejas secas remojadas', unit: 'Lata 220 g', group: 'almacen', division: 'alimentos', gba: '105.1_I2ASR_2016_M_32' },
  { id: 'azucar', name: 'Azúcar', unit: 'Kg', group: 'almacen', division: 'alimentos', gba: '105.1_I2A_2016_M_15',
    reg: R('348.1_GBA_AZUCAR_KG__13', '348.1_PAMPEANA_A_KG__18', '348.1_NEA_AZUCAR_KG__13', '348.1_NOA_AZUCAR_KG__13', '348.1_CUYO_AZUCA_KG__14', '348.1_PATAGONIA_KG__19') },
  { id: 'sal', name: 'Sal fina', unit: '500 g', group: 'almacen', division: 'alimentos', gba: '105.1_I2SF_2016_M_17' },
  { id: 'polvo_flan', name: 'Polvo para flan', unit: '8 porciones', group: 'almacen', division: 'alimentos', gba: '105.1_I2PF_2016_M_19' },
  { id: 'gaseosa', name: 'Gaseosa base cola', unit: '1,5 litros', group: 'bebidas', division: 'alimentos', gba: '105.1_I2GBC_2016_M_26' },
  { id: 'agua', name: 'Agua sin gas', unit: '1,5 litros', group: 'bebidas', division: 'alimentos', gba: '105.1_I2ASG_2016_M_21' },
  { id: 'cerveza', name: 'Cerveza en botella', unit: 'Litro', group: 'bebidas', division: 'bebidas_alcoholicas', gba: '105.1_I2CB_2016_M_24' },
  { id: 'vino', name: 'Vino común', unit: 'Litro', group: 'bebidas', division: 'bebidas_alcoholicas', gba: '105.1_I2VC_2016_M_19' },
  { id: 'cafe', name: 'Café molido', unit: '500 g', group: 'almacen', division: 'alimentos', gba: '105.1_I2CM_2016_M_20' },
  { id: 'yerba', name: 'Yerba mate', unit: '500 g', group: 'almacen', division: 'alimentos', gba: '105.1_I2YM_2016_M_19' },
  { id: 'jabon_polvo', name: 'Jabón en polvo para ropa', unit: '800 g', group: 'limpieza', division: 'equipamiento', gba: '105.1_I2JPR_2016_M_25' },
  { id: 'detergente', name: 'Detergente líquido', unit: '750 cc', group: 'limpieza', division: 'equipamiento', gba: '105.1_I2DL_2016_M_27',
    reg: R('348.1_GBA_DETERG_CC__29', '348.1_PAMPEANA_D_CC__34', '348.1_NEA_DETERG_CC__29', '348.1_NOA_DETERG_CC__29', '348.1_CUYO_DETER_CC__30', '348.1_PATAGONIA_CC__35') },
  { id: 'jabon_pan', name: 'Jabón en pan', unit: '200 g', group: 'limpieza', division: 'equipamiento', gba: '105.1_I2JP_2016_M_18' },
  { id: 'lavandina', name: 'Lavandina', unit: '1.000 cc', group: 'limpieza', division: 'equipamiento', gba: '105.1_I2L_2016_M_18',
    reg: R('348.1_GBA_LAVAND_CC__21', '348.1_PAMPEANA_L_CC__26', '348.1_NEA_LAVAND_CC__21', '348.1_NOA_LAVAND_CC__21', '348.1_CUYO_LAVAN_CC__22', '348.1_PATAGONIA_CC__27') },
  { id: 'algodon', name: 'Algodón', unit: '100 g', group: 'cuidado', division: 'varios', gba: '105.1_I2A_2016_M_16' },
  { id: 'champu', name: 'Champú', unit: '400 cc', group: 'cuidado', division: 'varios', gba: '105.1_I2C_2016_M_15' },
  { id: 'desodorante', name: 'Desodorante', unit: '150 cc', group: 'cuidado', division: 'varios', gba: '105.1_I2D_2016_M_20' },
  { id: 'jabon_tocador', name: 'Jabón de tocador', unit: '125 g', group: 'cuidado', division: 'varios', gba: '105.1_I2JT_2016_M_22',
    reg: R('348.1_GBA_JABON_GR__27', '348.1_PAMPEANA_J_GR__32', '348.1_NEA_JABON_GR__27', '348.1_NOA_JABON_GR__27', '348.1_CUYO_JABON_GR__28', '348.1_PATAGONIA_GR__33') },
  { id: 'paniales', name: 'Pañales descartables', unit: '10 u', group: 'cuidado', division: 'varios', gba: '105.1_I2PD_2016_M_30' },
];

export const REGIONAL_PRODUCTS = PRODUCTS.filter((p) => p.reg);

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** Manifiesto de consultas: tres series por consulta, en el mismo orden que los archivos del snapshot. */
export const PRECIOS_QUERIES = [
  ...chunk(PRODUCTS, 3).map((ps, i) => ({
    file: `precios/gba_g${String(i + 1).padStart(2, '0')}.csv`, start: '2016-04-01', ids: ps.map((p) => [p.gba, `gba.${p.id}`]),
  })),
  ...['gba', ...PRECIOS_REGIONS].flatMap((r) => chunk(REGIONAL_PRODUCTS, 3).map((ps, i) => ({
    file: `precios/reg_${r}_${i + 1}.csv`, start: '2017-06-01', ids: ps.map((p) => [p.reg[r], `${r === 'gba' ? 'control.gba' : r}.${p.id}`]),
  }))),
];

// ---------------------------------------------------------------------------
// Cifras publicadas por INDEC en sus informes del IPC. `fix: true` corrige la API si difiere;
// el resto son controles: si la API no coincide, la validación da error.
// ---------------------------------------------------------------------------
const SRC = {
  mar17: 'https://sitioanterior.indec.gob.ar/uploads/informesdeprensa/ipc_04_17.pdf',
  jun23: 'https://www.indec.gob.ar/uploads/informesdeprensa/ipc_07_23C94E54F825.pdf',
  jul23: 'https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_23ED301034A4.pdf',
  ago23: 'https://www.eltucumano.com/adjunto/2023/09/13/indec.pdf',
  jul25: 'https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_25B0A3ACE622.pdf',
  jul26: 'https://www.indec.gob.ar/uploads/informesdeprensa/ipc_08_2642C82F62AE.pdf',
};
const REG_ORDER = ['gba', 'pampeana', 'nea', 'noa', 'cuyo', 'patagonia'];
/** Filas del Cuadro 19 (precios por región): [producto, GBA, Pampeana, NEA, NOA, Cuyo, Patagonia]. */
const C19 = {
  '2023-06': [
    ['pan_frances', 698.16, 561.86, 505.39, 495.66, 473.83, 586.62], ['harina', 196.65, 227.08, 241.83, 228.67, 208.52, 228.18],
    ['arroz', 358.85, 426.58, 477.92, 438.90, 433.65, 420.36], ['fideos', 308.03, 300.04, 255.72, 258.04, 277.84, 314.99],
    ['carne_picada', 1172.34, 1289.23, 1192.07, 1267.02, 1151.60, 1632.55], ['pollo', 687.76, 735.41, 639.12, 682.49, 745.08, 780.44],
    ['aceite', 950.10, 1063.64, 1213.47, 1080.99, 1016.96, 924.12], ['leche', 309.63, 345.83, 372.59, 348.59, 369.73, 351.89],
    ['huevos', 856.34, 824.91, 749.97, 764.31, 884.10, 943.79], ['papa', 313.80, 315.42, 299.99, 269.38, 330.17, 397.92],
    ['azucar', 614.94, 596.22, 613.79, 553.08, 585.41, 574.81], ['detergente', 292.53, 342.35, 322.87, 340.64, 322.10, 548.97],
    ['lavandina', 219.20, 220.98, 243.47, 237.17, 226.17, 227.34], ['jabon_tocador', 234.40, 237.24, 240.31, 230.59, 235.89, 241.43],
  ],
  '2023-07': [
    ['pan_frances', 756.05, 598.07, 531.95, 521.77, 500.31, 614.63], ['harina', 207.44, 240.02, 250.94, 241.17, 218.73, 241.76],
    ['arroz', 403.18, 476.92, 509.05, 485.66, 483.15, 510.02], ['fideos', 327.01, 322.41, 274.05, 281.51, 307.80, 355.24],
    ['carne_picada', 1221.66, 1353.23, 1242.52, 1311.37, 1179.42, 1713.09], ['pollo', 696.94, 723.94, 647.62, 680.52, 749.02, 789.27],
    ['aceite', 964.80, 1086.79, 1252.77, 1105.33, 1041.45, 920.41], ['leche', 330.57, 368.89, 391.46, 373.51, 386.02, 381.25],
    ['huevos', 890.31, 863.16, 784.19, 790.46, 936.41, 999.45], ['papa', 420.69, 409.93, 371.24, 350.66, 423.31, 497.57],
    ['azucar', 719.94, 659.84, 657.83, 605.25, 664.10, 714.13], ['detergente', 306.16, 366.04, 342.13, 362.79, 356.03, 694.67],
    ['lavandina', 236.34, 237.03, 263.48, 251.72, 235.95, 255.06], ['jabon_tocador', 246.20, 248.49, 245.95, 238.21, 248.16, 255.59],
  ],
  '2023-08': [
    ['pan_frances', 861.81, 671.81, 597.68, 605.62, 587.77, 705.83], ['harina', 222.91, 258.46, 273.29, 260.28, 235.34, 258.13],
    ['arroz', 460.40, 550.68, 573.79, 555.57, 550.52, 586.37], ['fideos', 347.03, 355.70, 310.15, 318.17, 347.68, 387.25],
    ['carne_picada', 1702.55, 1781.09, 1582.72, 1714.84, 1614.30, 2013.59], ['pollo', 840.37, 868.69, 775.01, 823.32, 853.29, 895.54],
    ['aceite', 1026.00, 1151.87, 1358.07, 1170.53, 1100.35, 989.23], ['leche', 357.21, 397.44, 427.90, 401.44, 411.59, 401.63],
    ['huevos', 1050.63, 971.76, 866.91, 930.03, 1028.31, 1183.15], ['papa', 539.83, 524.72, 508.23, 439.58, 560.16, 638.07],
    ['azucar', 761.15, 755.39, 804.03, 713.19, 748.13, 811.35], ['detergente', 319.49, 395.62, 406.79, 409.75, 370.15, 706.92],
    ['lavandina', 257.14, 255.06, 292.05, 284.01, 249.70, 276.40], ['jabon_tocador', 260.56, 266.09, 279.08, 256.36, 264.81, 278.89],
  ],
  // Julio 2025: filas completas de 11 productos; harina, fideos y carne solo de NEA y NOA (null = sin dato en el informe leído).
  '2025-07': [
    ['pan_frances', 3661.28, 2860.65, 2102.32, 2341.16, 2151.88, 3391.83], ['harina', null, null, 854.62, 883.39, null, null],
    ['arroz', 1848.08, 2122.61, 1805.41, 1865.56, 1960.32, 2741.50], ['fideos', null, null, 1153.67, 1217.72, null, null],
    ['carne_picada', 6875.89, 7508.85, 6845.61, 8012.37, null, null], ['pollo', 3910.04, 4130.87, 3753.16, 3839.99, 4141.27, 4197.07],
    ['aceite', 4449.60, 4769.16, 4498.30, 4550.82, 4632.50, 4950.98], ['leche', 1584.36, 1664.11, 1692.30, 1582.35, 1667.33, 1797.51],
    ['huevos', 4032.30, 4033.04, 3457.05, 3433.35, 3825.80, 4651.54], ['papa', 870.54, 819.46, 709.07, 633.47, 783.63, 1308.64],
    ['azucar', 1140.81, 1185.86, 1043.65, 1015.66, 1152.81, 1399.28], ['detergente', 1638.77, 2038.59, 1806.76, 1889.60, 1654.93, 3543.89],
    ['lavandina', 1164.07, 1201.79, 1190.93, 1188.72, 1184.38, 1321.15], ['jabon_tocador', 1071.03, 1104.74, 1046.71, 1040.01, 1114.63, 1221.91],
  ],
  '2026-07': [
    ['pan_frances', 4732.35, 3566.06, 2521.79, 2950.75, 2638.51, 4188.96], ['harina', 1019.68, 1106.37, 1050.36, 1012.96, 989.05, 1268.38],
    ['arroz', 1838.91, 2090.90, 1695.77, 1872.43, 2013.04, 2722.67], ['fideos', 1694.83, 1580.42, 1227.22, 1333.43, 1523.96, 1879.40],
    ['carne_picada', 10554.13, 11368.62, 10954.80, 12412.74, 9939.58, 13137.77], ['pollo', 4806.12, 5063.60, 4630.58, 4687.66, 5016.96, 5218.79],
    ['aceite', 6685.30, 6981.73, 6831.17, 6556.49, 6623.20, 7319.87], ['leche', 1998.81, 2102.81, 2132.68, 2012.20, 2110.58, 2283.50],
    ['huevos', 3858.25, 3923.07, 3361.44, 3361.30, 3737.21, 4847.22], ['papa', 1865.66, 1791.42, 1686.03, 1531.68, 1881.51, 2426.91],
    ['azucar', 1550.72, 1548.54, 1513.84, 1386.01, 1525.20, 1794.09], ['detergente', 2168.57, 2605.19, 2380.98, 2457.45, 2244.71, 4766.17],
    ['lavandina', 1385.16, 1419.07, 1408.38, 1393.07, 1377.93, 1508.30], ['jabon_tocador', 1519.85, 1522.86, 1411.27, 1402.17, 1531.46, 1644.95],
  ],
};
/** Cuadro 20 del informe de julio 2026 (GBA): [producto, junio, julio]. */
const C20_JUL26 = [
  ['pan_frances', 4652.79, 4732.35], ['pan_mesa', 3682.44, 3714.63], ['galletitas_dulces', 1481.16, 1500.66], ['galletitas_agua', 1537.47, 1584.49],
  ['harina', 991.11, 1019.68], ['arroz', 1783.17, 1838.91], ['fideos', 1685.05, 1694.83], ['asado', 16929.32, 16708.23],
  ['carne_picada', 10623.71, 10554.13], ['paleta', 17207.39, 17186.26], ['cuadril', 21053.20, 21005.06], ['nalga', 21611.61, 21447.80],
  ['hamburguesas', 7932.54, 8192.31], ['pollo', 4820.82, 4806.12], ['merluza', 13861.77, 14200.12], ['salchicha', 2801.42, 2834.21],
  ['jamon', 19983.19, 20216.83], ['salchichon', 10897.02, 11343.19], ['salame', 25275.20, 25425.88], ['aceite', 6628.02, 6685.30],
  ['leche', 1926.42, 1998.81], ['leche_polvo', 12998.60, 13176.39], ['queso_cremoso', 13419.82, 14003.61], ['queso_pategras', 26206.17, 27226.68],
  ['queso_sardo', 25908.46, 27261.57], ['manteca', 4345.95, 4505.26], ['yogur', 2636.10, 2773.37], ['dulce_leche', 3717.64, 3825.06],
  ['huevos', 3881.27, 3858.25], ['manzana', 3982.34, 4065.34], ['limon', 1541.85, 1457.42], ['naranja', 1279.85, 1181.63],
  ['banana', 2523.89, 2715.14], ['batata', 1994.14, 2048.32], ['papa', 1544.25, 1865.66], ['cebolla', 1295.49, 1516.61],
  ['lechuga', 4560.16, 5057.45], ['tomate', 3400.05, 3649.65], ['zapallo', 1192.04, 1848.45], ['tomate_conserva', 1401.88, 1436.70],
  ['arvejas', 916.12, 965.43], ['azucar', 1516.46, 1550.72], ['sal', 1484.44, 1499.04], ['polvo_flan', 1260.61, 1318.89],
  ['gaseosa', 3562.91, 3681.13], ['agua', 1725.46, 1648.89], ['cerveza', 4236.06, 4377.02], ['vino', 2311.51, 2329.00],
  ['cafe', 13574.10, 13418.16], ['yerba', 2605.29, 2589.71], ['jabon_polvo', 3331.00, 3399.79], ['detergente', 2094.51, 2168.57],
  ['jabon_pan', 1470.68, 1494.88], ['lavandina', 1411.30, 1385.16], ['algodon', 1788.47, 1828.32], ['champu', 6948.41, 7309.01],
  ['desodorante', 4272.47, 4413.17], ['jabon_tocador', 1469.35, 1519.85], ['paniales', 4702.49, 4757.79],
];
/** Cuadro 7 del informe de marzo 2017 (GBA): [producto, febrero, marzo]. */
const C7_MAR17 = [
  ['detergente', 17.62, 18.24], ['jabon_pan', 11.99, 12.04], ['lavandina', 14.42, 14.68], ['algodon', 17.44, 17.82],
  ['champu', 67.24, 67.95], ['desodorante', 41.14, 42.79], ['jabon_tocador', 13.19, 13.32], ['paniales', 44.49, 45.11],
  ['jabon_polvo', 42.69, 43.91], ['aceite', 49.64, 49.82], ['gaseosa', 34.66, 35.80],
];

/** Lista plana de cifras publicadas: { region, product, period, value, fix, source }. */
export const PUBLISHED = (() => {
  const out = [];
  const fixRegional = { '2023-06': true, '2023-07': true, '2023-08': true };
  for (const [period, rows] of Object.entries(C19)) {
    for (const [product, ...vals] of rows) {
      vals.forEach((value, i) => {
        if (value == null) return;
        const region = REG_ORDER[i];
        // GBA se toma de las series 105.1: el Cuadro 19 sirve de control.
        const fix = region !== 'gba' && (fixRegional[period] || (period === '2025-07' && (region === 'nea' || region === 'noa')));
        out.push({ region, product, period, value, fix, source: SRC[{ '2023-06': 'jun23', '2023-07': 'jul23', '2023-08': 'ago23', '2025-07': 'jul25', '2026-07': 'jul26' }[period]] });
      });
    }
  }
  for (const [product, jun, jul] of C20_JUL26) {
    out.push({ region: 'gba', product, period: '2026-06', value: jun, fix: false, source: SRC.jul26 });
    out.push({ region: 'gba', product, period: '2026-07', value: jul, fix: false, source: SRC.jul26 });
  }
  const fixMar17 = new Set(['detergente', 'jabon_pan', 'lavandina', 'algodon', 'champu']);
  for (const [product, feb, mar] of C7_MAR17) {
    out.push({ region: 'gba', product, period: '2017-02', value: feb, fix: false, source: SRC.mar17 });
    out.push({ region: 'gba', product, period: '2017-03', value: mar, fix: fixMar17.has(product), source: SRC.mar17 });
  }
  return out;
})();

/**
 * Intercambios condicionados: en 2026 INDEC cambió el orden de las filas y la API asigna por posición,
 * así que desodorante y jabón de tocador quedaron cruzados. Se corrigen solo mientras siga pasando
 * (el desodorante de 150 cc cuesta varias veces más que el jabón de 125 g).
 */
export const SWAPS = [
  { a: 'gba.desodorante', b: 'gba.jabon_tocador', from: '2026-01', when: (va, vb) => va < vb,
    why: 'La API trae cruzados desodorante y jabón de tocador desde ene-2026 (INDEC cambió el orden de las filas). Verificado con el Cuadro 20 de julio 2026 y con la serie regional de jabón de tocador.', source: SRC.jul26 },
];

/** Saltos revisados que son de la fuente y no tienen un informe que los contradiga: se dejan como están. */
export const KNOWN_JUMPS = [
  { region: 'gba', product: 'agua', period: '2019-05', why: 'Dato atípico de INDEC (+30,6% y −16,7% al mes siguiente). No se encontró el informe para verificarlo; no se corrige.' },
  { region: 'nea', product: 'pollo', period: '2023-04', why: 'En abril 2023 el pollo subió en todas las regiones (GBA +26%); en NEA bajó más al mes siguiente. Dato de la fuente.' },
];

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------
function mergeInto(acc, part) {
  for (const [target, values] of Object.entries(part)) acc[target] = { ...(acc[target] ?? {}), ...values };
  return acc;
}

export async function readPreciosFromApi() {
  const raw = {};
  for (const q of PRECIOS_QUERIES) mergeInto(raw, parseApiCsvByOrder(decodeText(await fetchWithRetry(apiUrl(q))), q.ids));
  return { via: 'api', raw };
}

export async function readPreciosFromDir(dir) {
  const raw = {};
  for (const q of PRECIOS_QUERIES) mergeInto(raw, parseApiCsvByOrder(await readFile(path.join(dir, q.file), 'utf8'), q.ids));
  return { via: 'api-offline', raw };
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------
const round2 = (v) => Math.round(v * 100) / 100;
const TOL = 0.006; // la API trae algunos meses sin redondear; INDEC publica con dos decimales

/** Aplica intercambios y cifras publicadas (`fix`). Devuelve las correcciones agrupadas. */
export function applyPreciosCorrections(raw) {
  const corrections = [];
  for (const s of SWAPS) {
    const A = raw[s.a] ?? {};
    const B = raw[s.b] ?? {};
    const months = Object.keys(A).filter((p) => p >= s.from && B[p] != null && A[p] != null && s.when(A[p], B[p])).sort();
    for (const p of months) [A[p], B[p]] = [B[p], A[p]];
    if (months.length) corrections.push({ kind: 'swap', series: [s.a, s.b], periods: [months[0], months[months.length - 1]], months: months.length, why: s.why, source: s.source });
  }
  const groups = new Map();
  for (const f of PUBLISHED.filter((x) => x.fix)) {
    const key = f.region === 'gba' ? `gba.${f.product}` : `${f.region}.${f.product}`;
    const map = (raw[key] ??= {});
    const was = map[f.period];
    if (was != null && Math.abs(was - f.value) <= TOL) continue;
    map[f.period] = f.value;
    const g = `${f.region}|${f.period}|${f.source}`;
    if (!groups.has(g)) groups.set(g, { kind: 'published', region: f.region, period: f.period, source: f.source, products: [] });
    groups.get(g).products.push({ product: f.product, api: was ?? null, published: f.value });
  }
  for (const g of groups.values()) corrections.push(g);
  return corrections;
}

/** Series continuas desde `from`, redondeadas a centavos. */
function seriesFrom(map, from) {
  const s = toSeries(map ?? {}, { from });
  if (!s) return null;
  return { start: s.start, values: s.values.map((v) => (v == null ? null : round2(v))) };
}

export function buildPrecios({ via, raw: rawIn }) {
  const raw = structuredClone(rawIn);
  const errors = [];
  const warnings = [];
  const corrections = applyPreciosCorrections(raw);

  const series = { gba: {} };
  for (const p of PRODUCTS) {
    const s = seriesFrom(raw[`gba.${p.id}`], PRECIOS_GBA_FROM);
    if (!s) { errors.push(`GBA ${p.id}: sin datos`); continue; }
    series.gba[p.id] = s;
  }
  for (const r of PRECIOS_REGIONS) {
    series[r] = {};
    for (const p of REGIONAL_PRODUCTS) {
      const s = seriesFrom(raw[`${r}.${p.id}`], '2017-06');
      if (!s) { errors.push(`${r} ${p.id}: sin datos`); continue; }
      series[r][p.id] = s;
    }
  }

  // --- Controles contra cifras publicadas (después de corregir) ---------------
  const valueAt = (s, p) => {
    if (!s) return undefined;
    const k = toMonthIndex(p) - toMonthIndex(s.start);
    return k >= 0 && k < s.values.length ? s.values[k] ?? undefined : undefined;
  };
  let checks = 0;
  for (const f of PUBLISHED) {
    const s = series[f.region]?.[f.product];
    if (!s || f.period < s.start) continue;
    const v = valueAt(s, f.period);
    checks++;
    if (v == null || Math.abs(v - f.value) > TOL) errors.push(`${f.region} ${f.product} ${f.period}: la serie da ${v ?? 'sin dato'} y INDEC publicó ${f.value}`);
  }

  // GBA: la serie regional (348.1) tiene que coincidir con la 105.1 fuera de los meses ya corregidos.
  const known = new Set(['2023-06', '2023-07']);
  for (const p of REGIONAL_PRODUCTS) {
    const ctl = raw[`control.gba.${p.id}`] ?? {};
    const main = raw[`gba.${p.id}`] ?? {};
    const bad = Object.keys(ctl).filter((m) => ctl[m] != null && main[m] != null && !known.has(m) && Math.abs(ctl[m] / main[m] - 1) > 0.003);
    // La serie regional de lavandina de feb-2026 trae el valor del detergente (error de la API, sin efecto: GBA usa la 105.1).
    const unexplained = bad.filter((m) => !(p.id === 'lavandina' && m === '2026-02'));
    if (unexplained.length) warnings.push(`GBA ${p.id}: la serie regional difiere de la 105.1 en ${unexplained.join(', ')}`);
  }

  // Un mes que repite los valores de otro en casi todos los productos de una región es una fila duplicada.
  for (const r of PRECIOS_REGIONS) {
    const ref = series[r].pan_frances;
    if (!ref) continue;
    for (let i = 1; i < ref.values.length; i++) {
      const m = addMonths(ref.start, i);
      for (const lag of [1, 2]) {
        const m2 = addMonths(m, -lag);
        const same = REGIONAL_PRODUCTS.filter((p) => { const a = valueAt(series[r][p.id], m); return a != null && a === valueAt(series[r][p.id], m2); }).length;
        if (same >= 10) errors.push(`${r}: ${m} repite los valores de ${m2} en ${same} productos`);
      }
    }
  }

  // Saltos extremos fuera de frutas y verduras (aviso para revisar). Los ya revisados están en KNOWN_JUMPS.
  for (const [r, byProduct] of Object.entries(series)) {
    for (const [id, s] of Object.entries(byProduct)) {
      const meta = PRODUCTS.find((p) => p.id === id);
      if (meta.group === 'frutas_verduras') continue;
      for (let i = 1; i < s.values.length - 1; i++) {
        const a = s.values[i - 1]; const b = s.values[i]; const c = s.values[i + 1];
        if (!(a > 0 && b > 0 && c > 0)) continue;
        const d1 = b / a - 1; const d2 = c / b - 1;
        const m = addMonths(s.start, i);
        if (KNOWN_JUMPS.some((k) => k.region === r && k.product === id && k.period === m)) continue;
        if (Math.abs(d1) > 0.2 && Math.abs(d2) > 0.12 && Math.sign(d1) !== Math.sign(d2)) warnings.push(`${r} ${id}: salto y vuelta en ${m} (${(d1 * 100).toFixed(1)}% y ${(d2 * 100).toFixed(1)}%)`);
      }
    }
  }

  const lasts = Object.values(series).flatMap((by) => Object.values(by).map((s) => addMonths(s.start, s.values.length - 1)));
  const last = lasts.sort().at(-1);
  const status = errors.length ? 'error' : warnings.length ? 'warning' : 'ok';
  return {
    schema: 1,
    meta: {
      via, generatedAt: new Date().toISOString(), producer: 'INDEC',
      title: 'Precios promedio de productos seleccionados de la canasta del IPC',
      note: INDEC_NOTE, last,
      sources: { gba: 'API de Series de Tiempo, distribución 101.9 (series 105.1)', regiones: 'API de Series de Tiempo, distribución 145.13 (series 348.1)' },
      corrections,
      validation: { status, errors, warnings, checks },
    },
    products: PRODUCTS.map(({ id, name, unit, group, division, reg }) => ({ id, name, unit, group, division, regional: Boolean(reg) })),
    series,
  };
}
