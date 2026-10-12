import type { Producto, Unidad } from './tipos';

/** Para buscar sin importar tildes ni mayúsculas. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function slug(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function disponible(p: Pick<Producto, 'fisico' | 'reservado'>): number {
  return p.fisico - p.reservado;
}

export function unidades(n: number, unidad: Unidad): string {
  const palabra = unidad === 'envase' ? (Math.abs(n) === 1 ? 'envase' : 'envases') : Math.abs(n) === 1 ? 'bandeja' : 'bandejas';
  return `${n} ${palabra}`;
}

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaValida(s: string): boolean {
  if (!FECHA_RE.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}
