import { Suspense, lazy } from 'react';
import { formatPeriod } from '../engine';
import { LAST_PERIOD } from '../domain/data';
import { Alquiler } from './pages/Alquiler';
import { Comparar } from './pages/Comparar';
import { Datos } from './pages/Datos';
import { Home } from './pages/Home';
import { Metodologia } from './pages/Metodologia';
import { MiInflacion } from './pages/MiInflacion';
import { MiSueldo } from './pages/MiSueldo';
import { Panel } from './pages/Panel';
import { Provincias } from './pages/Provincias';
import { Uva } from './pages/Uva';
import { Link, ROUTES, type RouteId, useDocumentTitle, useRoute } from './router';

// Los precios traen su propio archivo de datos: se cargan solo al entrar a la página.
const Precios = lazy(() => import('./pages/Precios'));
import { AppProvider, useApp } from './state';

const NAV: RouteId[] = ['inicio', 'mi-inflacion', 'comparar', 'mi-sueldo', 'precios', 'alquiler', 'uva', 'provincias', 'ipc-indec', 'panel', 'metodologia'];

function BrandMark() {
  // Dos etiquetas de precio superpuestas: la remarcación.
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="9" width="20" height="13" rx="2" fill="var(--oficial)" transform="rotate(-8 13 15)" />
      <rect x="9" y="11" width="20" height="13" rx="2" fill="var(--personal)" stroke="var(--paper)" strokeWidth="2" transform="rotate(4 19 17)" />
      <circle cx="13.5" cy="17.6" r="1.6" fill="var(--paper)" />
    </svg>
  );
}

function Shell() {
  const route = useRoute();
  useDocumentTitle(route);
  const { storageOk } = useApp();
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="inicio" className="brand"><BrandMark />Mi Inflación</Link>
          <nav className="nav" aria-label="Secciones">
            {NAV.map((id) => (
              <Link key={id} to={id} aria-current={route === id ? 'page' : undefined}>{ROUTES[id].nav}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="contenido">
        {route === 'inicio' && <Home />}
        {route === 'mi-inflacion' && <MiInflacion />}
        {route === 'comparar' && <Comparar />}
        {route === 'mi-sueldo' && <MiSueldo />}
        {route === 'precios' && (
          <Suspense fallback={<p className="muted" role="status">Cargando precios de INDEC…</p>}>
            <Precios />
          </Suspense>
        )}
        {route === 'alquiler' && <Alquiler />}
        {route === 'uva' && <Uva />}
        {route === 'provincias' && <Provincias />}
        {route === 'panel' && <Panel />}
        {route === 'ipc-indec' && <Datos />}
        {route === 'metodologia' && <Metodologia />}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Datos oficiales: INDEC (IPC base dic-2016, último dato {formatPeriod(LAST_PERIOD, 'long')}, y precios promedio), BCRA (UVA e ICL) e institutos de estadística de CABA y las provincias, siempre identificados.</span>
          <span>La inflación personal es una estimación de la app, no un indicador oficial.{!storageOk && ' Este navegador no permite guardar datos: lo que cargues se pierde al cerrar.'}</span>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
