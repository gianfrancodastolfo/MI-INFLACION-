import type { Categoria, Producto } from './tipos';

// Catálogo inicial. Las descripciones son las de la lámina del negocio, sin agregados.
// No incluye cantidades: el stock arranca "pendiente de cargar".

interface Semilla {
  id: string;
  nombre: string;
  categoria: Categoria;
  descripcion: string;
  notas?: string;
}

const A_CONFIRMAR = 'Variedad a confirmar con el proveedor.';

export const CATALOGO_INICIAL: Semilla[] = [
  // Flores comestibles
  { id: 'flores-c-tallo', nombre: 'Flores c/tallo', categoria: 'flores', descripcion: 'Mix de flores comestibles con tallo. Usos: decoración de platos, ensaladas y tragos.', notas: A_CONFIRMAR },
  { id: 'pensamiento', nombre: 'Pensamiento', categoria: 'flores', descripcion: 'Sabor suave y textura delicada. Usos: tortas, cupcakes, ensaladas y postres.' },
  { id: 'calendula-naranja', nombre: 'Caléndula naranja', categoria: 'flores', descripcion: 'Pétalos de sabor suave, color intenso. Usos: decoración, infusiones, ensaladas y platos salados.' },
  { id: 'violitas', nombre: 'Violitas', categoria: 'flores', descripcion: 'Flores pequeñas y delicadas. Usos: postres, cocktails, ensaladas y decoración fina.' },
  { id: 'primavera', nombre: 'Primavera', categoria: 'flores', descripcion: 'Flores de colores intensos. Usos: decoración de tortas, postres y ensaladas.', notas: A_CONFIRMAR },
  { id: 'aleli', nombre: 'Alelí', categoria: 'flores', descripcion: 'Flores aromáticas y coloridas. Usos: decoración de tortas, postres y platos gourmet.' },
  { id: 'violas', nombre: 'Violas', categoria: 'flores', descripcion: 'Variedad similar al pensamiento, de sabor suave. Usos: postres, ensaladas y decoración.' },
  { id: 'coqueta', nombre: 'Coqueta', categoria: 'flores', descripcion: 'Pétalos finos y delicados. Usos: decoración de postres y platos gourmet.', notas: A_CONFIRMAR },
  { id: 'clavelina', nombre: 'Clavelina', categoria: 'flores', descripcion: 'Flores pequeñas y con bordes dentados. Usos: decoración de pastelería, cócteles y ensaladas.' },
  { id: 'conejito', nombre: 'Conejito', categoria: 'flores', descripcion: 'Flores de forma particular y color llamativo. Usos: decoración de tortas, postres y ensaladas.', notas: A_CONFIRMAR },
  { id: 'calendula-amarilla', nombre: 'Caléndula amarilla', categoria: 'flores', descripcion: 'Pétalos de sabor suave, color vibrante. Usos: decoración, infusiones, ensaladas y platos salados.' },
  // Hojas y verdes comestibles
  { id: 'rucula-selvatica', nombre: 'Rúcula selvática', categoria: 'hojas', descripcion: 'Sabor intenso y ligeramente picante. Usos: ensaladas, pizzas, sándwiches y decoración.' },
  { id: 'mizuna-rojo', nombre: 'Mizuna rojo', categoria: 'hojas', descripcion: 'Hoja fina y rizada, sabor suave. Usos: ensaladas y decoración de platos.' },
  { id: 'mizuna-lima', nombre: 'Mizuna lima', categoria: 'hojas', descripcion: 'Hoja fina y rizada, sabor suave. Usos: ensaladas y decoración.' },
  { id: 'acedera-roja', nombre: 'Acedera roja', categoria: 'hojas', descripcion: 'Sabor ácido y refrescante. Usos: ensaladas, salsas y decoración.' },
  { id: 'mizuna-verde', nombre: 'Mizuna verde', categoria: 'hojas', descripcion: 'Hoja fina y rizada, sabor suave. Usos: ensaladas y decoración.' },
  { id: 'coclearia-berro', nombre: 'Coclearia berro', categoria: 'hojas', descripcion: 'Sabor fresco y ligeramente picante. Usos: ensaladas, sándwiches y decoración.' },
  { id: 'espinaca', nombre: 'Espinaca', categoria: 'hojas', descripcion: 'Sabor suave. Usos: ensaladas, salteados, tartas y guarniciones.' },
  { id: 'pacchoi', nombre: 'Pacchoi', categoria: 'hojas', descripcion: 'Sabor suave y crujiente. Usos: salteados, sopas y bowls.' },
  { id: 'capiqui', nombre: 'Capiquí', categoria: 'hojas', descripcion: 'Hoja tierna y suave. Usos: ensaladas y decoración.' },
  { id: 'kale-blanco', nombre: 'Kale blanco', categoria: 'hojas', descripcion: 'Sabor suave. Usos: ensaladas y decoración.' },
  { id: 'acelga-roja', nombre: 'Acelga roja', categoria: 'hojas', descripcion: 'Sabor suave. Usos: ensaladas, salteados y tartas.' },
  { id: 'tatsoi', nombre: 'Tatsoi', categoria: 'hojas', descripcion: 'Sabor suave. Usos: salteados, sopas y ensaladas.' },
  { id: 'taco-de-reina', nombre: 'Taco de reina', categoria: 'hojas', descripcion: 'Hoja tierna y decorativa. Usos: ensaladas y decoración.' },
  { id: 'kale-violeta', nombre: 'Kale violeta', categoria: 'hojas', descripcion: 'Sabor suave. Usos: ensaladas y decoración.' },
];

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  flores: 'Flores comestibles',
  hojas: 'Hojas y verdes comestibles',
};

/** Productos del catálogo inicial, con stock pendiente de cargar. */
export function productosIniciales(ahora: string): Producto[] {
  const orden: Record<Categoria, number> = { flores: 0, hojas: 0 };
  return CATALOGO_INICIAL.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    categoria: s.categoria,
    unidad: 'bandeja',
    descripcion: s.descripcion,
    fisico: 0,
    reservado: 0,
    minimo: 0,
    stockCargado: false,
    activo: true,
    orden: ++orden[s.categoria],
    notas: s.notas ?? '',
    proveedor: '',
    sku: '',
    calidad: '',
    fechaIngreso: '',
    vencimiento: '',
    foto: `/fotos/${s.id}.webp`,
    actualizado: ahora,
  }));
}
