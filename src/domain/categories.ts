/**
 * Categorías oficiales del IPC (12 divisiones COICOP) y rubros que ve el usuario.
 *
 * Regla: cada rubro del usuario se valúa con un índice que INDEC publica.
 * Si en el futuro hay subgrupos ("aperturas") disponibles para la región, se usa el subgrupo;
 * si no, la división que lo contiene. Nunca se inventa un índice.
 */
export type DivisionId =
  | 'alimentos' | 'bebidas_alcoholicas' | 'prendas' | 'vivienda' | 'equipamiento' | 'salud'
  | 'transporte' | 'comunicacion' | 'recreacion' | 'educacion' | 'restaurantes' | 'varios';

export interface Division {
  id: DivisionId;
  code: string;
  name: string;
  short: string;
}

export const DIVISIONS: Division[] = [
  { id: 'alimentos', code: '01', name: 'Alimentos y bebidas no alcohólicas', short: 'Alimentos' },
  { id: 'bebidas_alcoholicas', code: '02', name: 'Bebidas alcohólicas y tabaco', short: 'Alcohol y tabaco' },
  { id: 'prendas', code: '03', name: 'Prendas de vestir y calzado', short: 'Ropa y calzado' },
  { id: 'vivienda', code: '04', name: 'Vivienda, agua, electricidad, gas y otros combustibles', short: 'Vivienda y servicios' },
  { id: 'equipamiento', code: '05', name: 'Equipamiento y mantenimiento del hogar', short: 'Hogar' },
  { id: 'salud', code: '06', name: 'Salud', short: 'Salud' },
  { id: 'transporte', code: '07', name: 'Transporte', short: 'Transporte' },
  { id: 'comunicacion', code: '08', name: 'Comunicación', short: 'Comunicación' },
  { id: 'recreacion', code: '09', name: 'Recreación y cultura', short: 'Recreación' },
  { id: 'educacion', code: '10', name: 'Educación', short: 'Educación' },
  { id: 'restaurantes', code: '11', name: 'Restaurantes y hoteles', short: 'Restaurantes' },
  { id: 'varios', code: '12', name: 'Bienes y servicios varios', short: 'Cuidado personal y otros' },
];

export const DIVISION_BY_ID = Object.fromEntries(DIVISIONS.map((d) => [d.id, d])) as Record<DivisionId, Division>;

export interface SubItem {
  id: string;
  label: string;
  /** Subgrupo oficial de INDEC (nombre publicado) para cuando haya aperturas disponibles. */
  apertura?: string;
  /** Aclaración de cómo se clasifica, cuando no hay una correspondencia exacta. */
  note?: string;
  /** Precio de contrato o factura: el usuario puede cargar cuánto pagaba antes y se usa su variación real. */
  ownPrice?: boolean;
}

export interface Rubro {
  id: DivisionId;
  label: string;
  hint: string;
  items: SubItem[];
}

/** Rubros del formulario. Uno por división; los ítems ayudan a estimar y a mapear a subgrupos. */
export const RUBROS: Rubro[] = [
  {
    id: 'alimentos',
    label: 'Supermercado y almacén',
    hint: 'Comida y bebidas sin alcohol para consumir en casa.',
    items: [
      { id: 'carnes', label: 'Carnes, pollo y pescado', apertura: 'Carnes y derivados' },
      { id: 'lacteos', label: 'Lácteos y huevos', apertura: 'Leche, productos lácteos y huevos' },
      { id: 'verduras', label: 'Verduras y legumbres', apertura: 'Verduras, tubérculos y legumbres' },
      { id: 'frutas', label: 'Frutas', apertura: 'Frutas' },
      { id: 'panificados', label: 'Pan, cereales y pastas', apertura: 'Pan y cereales' },
      {
        id: 'vegetales_proteicos', label: 'Tofu, soja texturizada y similares', apertura: 'Verduras, tubérculos y legumbres',
        note: 'INDEC no publica un índice específico; se valúan con verduras, tubérculos y legumbres (o con la división si no hay subgrupos).',
      },
      { id: 'bebidas_sin_alcohol', label: 'Bebidas sin alcohol, café y yerba', apertura: 'Bebidas no alcohólicas' },
      { id: 'otros_alimentos', label: 'Aceites, azúcar, dulces y otros' },
    ],
  },
  {
    id: 'bebidas_alcoholicas',
    label: 'Bebidas alcohólicas y cigarrillos',
    hint: 'Cerveza, vino, otras bebidas con alcohol y tabaco.',
    items: [
      { id: 'alcohol', label: 'Bebidas alcohólicas', apertura: 'Bebidas alcohólicas' },
      { id: 'tabaco', label: 'Cigarrillos y tabaco', apertura: 'Tabaco' },
    ],
  },
  {
    id: 'prendas',
    label: 'Ropa y calzado',
    hint: 'Promedio mensual (si comprás de vez en cuando, dividí el gasto del año por 12).',
    items: [
      { id: 'ropa', label: 'Ropa', apertura: 'Prendas de vestir y materiales' },
      { id: 'calzado', label: 'Calzado', apertura: 'Calzado' },
    ],
  },
  {
    id: 'vivienda',
    label: 'Vivienda y servicios',
    hint: 'Alquiler, expensas, luz, gas y agua.',
    items: [
      { id: 'alquiler', label: 'Alquiler', apertura: 'Alquiler de la vivienda', ownPrice: true },
      { id: 'expensas', label: 'Expensas', apertura: 'Alquiler de la vivienda y gastos conexos', ownPrice: true },
      { id: 'servicios', label: 'Luz, gas y agua', apertura: 'Electricidad, gas y otros combustibles', ownPrice: true },
    ],
  },
  {
    id: 'equipamiento',
    label: 'Hogar',
    hint: 'Limpieza, artículos y arreglos del hogar, electrodomésticos, servicio doméstico.',
    items: [
      { id: 'limpieza', label: 'Limpieza y artículos del hogar', apertura: 'Bienes y servicios para la conservación del hogar' },
      { id: 'servicio_domestico', label: 'Servicio doméstico y cuidado' },
      { id: 'muebles', label: 'Muebles y electrodomésticos' },
    ],
  },
  {
    id: 'salud',
    label: 'Salud',
    hint: 'Prepaga o adicional de obra social, medicamentos, consultas y tratamientos.',
    items: [
      { id: 'prepaga', label: 'Prepaga o plan adicional', apertura: 'Gastos de prepagas', ownPrice: true },
      { id: 'medicamentos', label: 'Medicamentos', apertura: 'Productos medicinales, artefactos y equipos para la salud' },
      { id: 'consultas', label: 'Consultas y tratamientos' },
    ],
  },
  {
    id: 'transporte',
    label: 'Transporte',
    hint: 'Colectivo, tren, subte, taxi o apps; si tenés auto o moto: combustible, seguro, patente y mantenimiento.',
    items: [
      { id: 'transporte_publico', label: 'Colectivo, tren, subte, taxi y apps', apertura: 'Transporte público' },
      { id: 'combustible', label: 'Combustible', apertura: 'Combustibles y lubricantes para vehículos de uso del hogar' },
      {
        id: 'auto', label: 'Seguro, patente, cochera y mantenimiento', apertura: 'Funcionamiento de equipos de transporte personal',
        note: 'Seguro y patente se clasifican en transporte por practicidad; en la metodología COICOP los seguros van en bienes y servicios varios.',
      },
    ],
  },
  {
    id: 'comunicacion',
    label: 'Celular e internet',
    hint: 'Abono o cargas de celular, internet y teléfono fijo.',
    items: [{ id: 'telefonia', label: 'Celular, internet y teléfono', apertura: 'Servicios de telefonía e internet', ownPrice: true }],
  },
  {
    id: 'recreacion',
    label: 'Entretenimiento, cultura y mascotas',
    hint: 'Streaming, salidas, cine, deportes, gimnasio, viajes, libros y mascotas.',
    items: [
      { id: 'streaming', label: 'Streaming y suscripciones', ownPrice: true },
      { id: 'salidas', label: 'Salidas, cine, deportes y gimnasio', apertura: 'Servicios recreativos y culturales' },
      { id: 'viajes', label: 'Viajes y turismo', note: 'Los paquetes turísticos están en recreación; el alojamiento suelto, en restaurantes y hoteles.' },
      { id: 'mascotas', label: 'Mascotas: alimento, veterinaria y accesorios', note: 'En la clasificación del IPC, mascotas y veterinaria forman parte de recreación y cultura.' },
      { id: 'libros', label: 'Libros, diarios y útiles', apertura: 'Periódicos, diarios, revistas, libros y artículos de papelería' },
    ],
  },
  {
    id: 'educacion',
    label: 'Educación',
    hint: 'Cuota del colegio, universidad, cursos e idiomas.',
    items: [
      { id: 'colegio', label: 'Colegio o jardín', ownPrice: true },
      { id: 'universidad', label: 'Universidad o terciario', ownPrice: true },
      { id: 'cursos', label: 'Cursos e idiomas' },
    ],
  },
  {
    id: 'restaurantes',
    label: 'Restaurantes, bares y delivery',
    hint: 'Comidas fuera de casa y pedidos de comida hecha.',
    items: [{ id: 'comidas_afuera', label: 'Restaurantes, bares y delivery', apertura: 'Restaurantes y comidas fuera del hogar' }],
  },
  {
    id: 'varios',
    label: 'Cuidado personal y otros',
    hint: 'Peluquería, perfumería, higiene personal, seguros y otros gastos.',
    items: [
      { id: 'cuidado_personal', label: 'Peluquería, higiene y perfumería', apertura: 'Cuidado personal' },
      { id: 'otros_varios', label: 'Seguros y otros' },
    ],
  },
];

export const RUBRO_BY_ID = Object.fromEntries(RUBROS.map((r) => [r.id, r])) as Record<DivisionId, Rubro>;
