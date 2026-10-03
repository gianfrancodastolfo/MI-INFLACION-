/**
 * Guardado local (solo en este navegador). Ningún dato personal sale del dispositivo en la Fase 1.
 * Todas las operaciones toleran que el almacenamiento no esté disponible (modo privado, bloqueos).
 */
const PREFIX = 'mi-inflacion:v1:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Borra todo lo que la app guardó en este navegador. */
export function clearAll(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Exporta todo lo guardado como JSON (para respaldo o para migrar a una cuenta en la Fase 2). */
export function exportAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(window.localStorage.getItem(k) ?? 'null');
    }
  } catch {
    /* sin almacenamiento disponible */
  }
  return out;
}
