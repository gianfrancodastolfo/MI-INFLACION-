/**
 * Regiones estadísticas del IPC de INDEC y su correspondencia con las provincias.
 * INDEC no publica IPC por ciudad ni por barrio: la ubicación solo sirve para elegir la región.
 */
export type RegionId = 'nacional' | 'gba' | 'pampeana' | 'nea' | 'noa' | 'cuyo' | 'patagonia';
export type ProvinceRegion = Exclude<RegionId, 'nacional'>;

export const REGION_NAMES: Record<RegionId, string> = {
  nacional: 'Total nacional',
  gba: 'GBA',
  pampeana: 'Pampeana',
  nea: 'Noreste (NEA)',
  noa: 'Noroeste (NOA)',
  cuyo: 'Cuyo',
  patagonia: 'Patagonia',
};

export const REGION_LONG_NAMES: Record<RegionId, string> = {
  nacional: 'Total nacional',
  gba: 'Gran Buenos Aires (CABA y 24 partidos del conurbano)',
  pampeana: 'Región Pampeana',
  nea: 'Región Noreste',
  noa: 'Región Noroeste',
  cuyo: 'Región Cuyo',
  patagonia: 'Región Patagonia',
};

export interface Province {
  id: string;
  name: string;
  /** Región del IPC. `null` para Buenos Aires: depende de si es conurbano o interior. */
  region: ProvinceRegion | null;
}

export const PROVINCES: Province[] = [
  { id: 'caba', name: 'Ciudad Autónoma de Buenos Aires', region: 'gba' },
  { id: 'buenos-aires', name: 'Buenos Aires', region: null },
  { id: 'catamarca', name: 'Catamarca', region: 'noa' },
  { id: 'chaco', name: 'Chaco', region: 'nea' },
  { id: 'chubut', name: 'Chubut', region: 'patagonia' },
  { id: 'cordoba', name: 'Córdoba', region: 'pampeana' },
  { id: 'corrientes', name: 'Corrientes', region: 'nea' },
  { id: 'entre-rios', name: 'Entre Ríos', region: 'pampeana' },
  { id: 'formosa', name: 'Formosa', region: 'nea' },
  { id: 'jujuy', name: 'Jujuy', region: 'noa' },
  { id: 'la-pampa', name: 'La Pampa', region: 'pampeana' },
  { id: 'la-rioja', name: 'La Rioja', region: 'noa' },
  { id: 'mendoza', name: 'Mendoza', region: 'cuyo' },
  { id: 'misiones', name: 'Misiones', region: 'nea' },
  { id: 'neuquen', name: 'Neuquén', region: 'patagonia' },
  { id: 'rio-negro', name: 'Río Negro', region: 'patagonia' },
  { id: 'salta', name: 'Salta', region: 'noa' },
  { id: 'san-juan', name: 'San Juan', region: 'cuyo' },
  { id: 'san-luis', name: 'San Luis', region: 'cuyo' },
  { id: 'santa-cruz', name: 'Santa Cruz', region: 'patagonia' },
  { id: 'santa-fe', name: 'Santa Fe', region: 'pampeana' },
  { id: 'santiago-del-estero', name: 'Santiago del Estero', region: 'noa' },
  { id: 'tierra-del-fuego', name: 'Tierra del Fuego', region: 'patagonia' },
  { id: 'tucuman', name: 'Tucumán', region: 'noa' },
];

/** Los 24 partidos que, junto con CABA, forman la región GBA del IPC. */
export const GBA_PARTIDOS = [
  'Almirante Brown', 'Avellaneda', 'Berazategui', 'Esteban Echeverría', 'Ezeiza', 'Florencio Varela',
  'General San Martín', 'Hurlingham', 'Ituzaingó', 'José C. Paz', 'La Matanza', 'Lanús', 'Lomas de Zamora',
  'Malvinas Argentinas', 'Merlo', 'Moreno', 'Morón', 'Quilmes', 'San Fernando', 'San Isidro', 'San Miguel',
  'Tigre', 'Tres de Febrero', 'Vicente López',
];

/** Región del IPC para una provincia. En Buenos Aires hace falta saber si es conurbano. */
export function regionForProvince(provinceId: string, conurbano?: boolean): ProvinceRegion | undefined {
  const p = PROVINCES.find((x) => x.id === provinceId);
  if (!p) return undefined;
  if (p.region) return p.region;
  if (conurbano === undefined) return undefined;
  return conurbano ? 'gba' : 'pampeana';
}
