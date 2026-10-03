/**
 * Router mínimo. En producción usa rutas reales (/mi-inflacion); en la vista previa autocontenida
 * usa anclas simples (#mi-inflacion), que funcionan dentro de un iframe sin servidor.
 */
import { type AnchorHTMLAttributes, type ReactNode, useEffect, useSyncExternalStore } from 'react';

declare const __ROUTER_MODE__: 'history' | 'hash' | undefined;
const MODE: 'history' | 'hash' = typeof __ROUTER_MODE__ !== 'undefined' && __ROUTER_MODE__ ? __ROUTER_MODE__ : 'history';

/** Vista previa autocontenida: corre en un marco que bloquea descargas y el menú de compartir del sistema. */
export const IS_PREVIEW = MODE === 'hash';

export type RouteId = 'inicio' | 'mi-inflacion' | 'comparar' | 'mi-sueldo' | 'precios' | 'alquiler' | 'uva' | 'provincias' | 'panel' | 'ipc-indec' | 'metodologia';

export const ROUTES: Record<RouteId, { path: string; title: string; nav: string }> = {
  inicio: { path: '/', title: '¿Cuánto debería ganar hoy?', nav: 'Calculadora' },
  'mi-inflacion': { path: '/mi-inflacion', title: 'Calculá tu inflación', nav: 'Mi inflación' },
  comparar: { path: '/comparar', title: '¿Tu inflación fue igual a la del país?', nav: 'Comparar' },
  'mi-sueldo': { path: '/mi-sueldo', title: 'Mi sueldo en el tiempo', nav: 'Mi sueldo' },
  precios: { path: '/precios', title: '¿Cuánto aumentó? Precios promedio de INDEC', nav: 'Precios' },
  alquiler: { path: '/alquiler', title: 'Calculadora de alquiler por IPC e ICL', nav: 'Alquiler' },
  uva: { path: '/cuota-uva', title: 'Cuota UVA: cuánto te sube', nav: 'Cuota UVA' },
  provincias: { path: '/inflacion-provincias', title: 'Inflación en CABA y en las provincias', nav: 'Provincias' },
  panel: { path: '/panel', title: 'Mi situación', nav: 'Mi situación' },
  'ipc-indec': { path: '/ipc-indec', title: 'Inflación en Argentina: IPC de INDEC', nav: 'Datos INDEC' },
  metodologia: { path: '/metodologia', title: 'Cómo calculamos', nav: 'Metodología' },
};

const IDS = Object.keys(ROUTES) as RouteId[];

function read(): RouteId {
  if (typeof window === 'undefined') return 'inicio';
  if (MODE === 'hash') {
    const h = window.location.hash.replace(/^#\/?/, '');
    return (IDS.find((id) => id === h) ?? 'inicio') as RouteId;
  }
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return IDS.find((id) => ROUTES[id].path === path) ?? 'inicio';
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  window.addEventListener('hashchange', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
    window.removeEventListener('hashchange', cb);
  };
}

export function useRoute(): RouteId {
  return useSyncExternalStore(subscribe, read, () => 'inicio');
}

export function href(to: RouteId): string {
  if (MODE === 'hash') return to === 'inicio' ? '#inicio' : `#${to}`;
  return ROUTES[to].path;
}

export function navigate(to: RouteId): void {
  if (MODE === 'hash') {
    window.location.hash = to === 'inicio' ? 'inicio' : to;
  } else {
    window.history.pushState({}, '', ROUTES[to].path);
  }
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
}

export function Link({ to, children, ...rest }: { to: RouteId; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href(to)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** Título de la pestaña por ruta. */
export function useDocumentTitle(route: RouteId) {
  useEffect(() => {
    document.title = route === 'inicio' ? 'Mi Inflación · ¿Cuánto debería ganar hoy?' : `${ROUTES[route].title} · Mi Inflación`;
  }, [route]);
}
