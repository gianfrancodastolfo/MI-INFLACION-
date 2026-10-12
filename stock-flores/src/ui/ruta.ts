import { useEffect, useState } from 'react';

// Rutas con "#" (funcionan en cualquier hosting y con el botón atrás del celular).

export interface Ruta {
  partes: string[];
  params: URLSearchParams;
}

function leer(): Ruta {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [camino, consulta = ''] = h.split('?');
  return { partes: camino.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(consulta) };
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const cambio = () => setRuta(leer());
    window.addEventListener('hashchange', cambio);
    return () => window.removeEventListener('hashchange', cambio);
  }, []);
  return ruta;
}

export function navegar(ruta: string): void {
  window.location.hash = ruta.startsWith('#') ? ruta : `#${ruta}`;
}

export function volver(alternativa: string): void {
  if (window.history.length > 1) window.history.back();
  else navegar(alternativa);
}
