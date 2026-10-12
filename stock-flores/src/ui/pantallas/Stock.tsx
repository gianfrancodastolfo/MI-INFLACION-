import { useMemo, useState } from 'react';
import { NOMBRE_CATEGORIA } from '../../core/catalogo';
import { nivel } from '../../core/estado';
import type { Categoria, Producto } from '../../core/tipos';
import { normalizar, unidades } from '../../core/util';
import { Disponible, Foto, Pastillas } from '../componentes';
import { useApp } from '../contexto';
import { hoyLocal } from '../formato';
import { HojaProducto } from './HojaProducto';

type Filtro = 'todos' | 'alerta' | 'agotado' | 'pendiente';

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'alerta', texto: 'Bajos' },
  { id: 'agotado', texto: 'Agotados' },
  { id: 'pendiente', texto: 'Sin cargar' },
];

function pasa(p: Producto, f: Filtro): boolean {
  const n = nivel(p);
  if (f === 'alerta') return n === 'bajo';
  if (f === 'agotado') return n === 'agotado' || n === 'faltante';
  if (f === 'pendiente') return n === 'pendiente';
  return true;
}

export function Stock() {
  const { estado } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const hoy = hoyLocal();

  const activos = useMemo(() => (estado?.productos ?? []).filter((p) => p.activo), [estado]);
  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { todos: activos.length, alerta: 0, agotado: 0, pendiente: 0 };
    for (const p of activos) for (const f of ['alerta', 'agotado', 'pendiente'] as Filtro[]) if (pasa(p, f)) c[f]++;
    return c;
  }, [activos]);

  if (!estado) return <div className="vacio">Cargando el stock…</div>;

  const q = normalizar(busqueda);
  const visibles = activos.filter((p) => pasa(p, filtro) && (!q || normalizar(p.nombre).includes(q)));
  const producto = abierto ? estado.productos.find((p) => p.id === abierto) : undefined;

  return (
    <>
      <div className="buscador">
        <input
          type="search"
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      <div className="filtros" role="group" aria-label="Filtrar">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.texto} {f.id !== 'todos' && conteo[f.id] > 0 ? `(${conteo[f.id]})` : ''}
          </button>
        ))}
      </div>

      {(['flores', 'hojas'] as Categoria[]).map((cat) => {
        const lista = visibles.filter((p) => p.categoria === cat).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
        if (lista.length === 0) return null;
        return (
          <section key={cat} className={`seccion seccion-${cat}`} aria-label={NOMBRE_CATEGORIA[cat]}>
            <h2 className="seccion-titulo">
              {NOMBRE_CATEGORIA[cat]} <small>{lista.length}</small>
            </h2>
            <div className="lista">
              {lista.map((p) => (
                <FilaProducto key={p.id} producto={p} hoy={hoy} alAbrir={() => setAbierto(p.id)} />
              ))}
            </div>
          </section>
        );
      })}
      {visibles.length === 0 && <div className="vacio">No hay productos que coincidan.</div>}

      {producto && <HojaProducto producto={producto} alCerrar={() => setAbierto(null)} />}
    </>
  );
}

function FilaProducto({ producto: p, hoy, alAbrir }: { producto: Producto; hoy: string; alAbrir: () => void }) {
  return (
    <button type="button" className={`producto nivel-${nivel(p)}`} onClick={alAbrir}>
      <Foto producto={p} />
      <div className="producto-info">
        <div className="producto-nombre">{p.nombre}</div>
        <Pastillas producto={p} hoy={hoy} />
        {p.stockCargado && p.reservado > 0 && (
          <div className="producto-detalle num">
            {unidades(p.fisico, p.unidad)} en total · {p.reservado} reservada{p.reservado === 1 ? '' : 's'}
          </div>
        )}
      </div>
      <div className="producto-cantidad">
        <Disponible producto={p} />
      </div>
    </button>
  );
}
