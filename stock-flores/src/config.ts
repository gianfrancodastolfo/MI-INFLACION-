// Dirección del servidor (la URL de la aplicación web de Apps Script).
// Se puede fijar al publicar (variable VITE_API_URL en Netlify) o cargar desde la app.

const CLAVE = 'stockflores:servidor';

export const URL_FIJA: string = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';

export type Servidor = { tipo: 'google'; url: string } | { tipo: 'demo' };

export function servidorGuardado(): Servidor | null {
  try {
    const v = localStorage.getItem(CLAVE);
    if (v === 'demo') return { tipo: 'demo' };
    if (v) return { tipo: 'google', url: v };
  } catch {
    // sin almacenamiento
  }
  return URL_FIJA ? { tipo: 'google', url: URL_FIJA } : null;
}

export function guardarServidor(s: Servidor | null): void {
  try {
    if (!s) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, s.tipo === 'demo' ? 'demo' : s.url);
  } catch {
    // sin almacenamiento
  }
}
