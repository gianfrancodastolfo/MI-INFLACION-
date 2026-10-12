import { useMemo, useState } from 'react';
import { NOMBRE_CATEGORIA } from '../../core/catalogo';
import type { Categoria, Producto } from '../../core/tipos';
import { disponible, normalizar } from '../../core/util';
import { Boton, Campo, Foto, Hoja, MensajeError, Stepper } from '../componentes';
import { useApp, useOperacion } from '../contexto';
import { hoyLocal } from '../formato';
import { navegar, type Ruta } from '../ruta';

interface Renglon {
  productoId: string;
  cantidad: number;
}

export function NuevaReserva({ ruta }: { ruta: Ruta }) {
  const { estado, conectado } = useApp();
  const op = useOperacion();
  const [cliente, setCliente] = useState('');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [renglones, setRenglones] = useState<Renglon[]>(() => {
    const p = ruta.params.get('p');
    const n = parseInt(ruta.params.get('n') ?? '1', 10);
    return p ? [{ productoId: p, cantidad: Number.isFinite(n) && n > 0 ? n : 1 }] : [];
  });
  const [eligiendo, setEligiendo] = useState(false);

  const productos = useMemo(() => new Map((estado?.productos ?? []).map((p) => [p.id, p])), [estado]);
  if (!estado) return <div className="vacio">Cargando…</div>;

  const problemas = renglones.filter((r) => {
    const p = productos.get(r.productoId);
    return !p || disponible(p) < r.cantidad;
  });

  async function guardar() {
    const ok = await op.ejecutar({ tipo: 'reservar', cliente, fechaEntrega: fecha || undefined, nota: nota || undefined, items: renglones });
    if (ok) navegar('/reservas');
  }

  return (
    <>
      <div className="titulo-pantalla">
        <h1>Nueva reserva</h1>
        <Boton variante="borde" className="chico" onClick={() => navegar('/reservas')}>
          Cancelar
        </Boton>
      </div>
      <div className="tarjeta">
        <Campo etiqueta="Cliente">
          <input
            type="text"
            value={cliente}
            maxLength={80}
            placeholder="Nombre de la persona o del local"
            autoComplete="off"
            onChange={(e) => setCliente(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Fecha de entrega (opcional)">
          <input type="date" value={fecha} min={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
        </Campo>

        <h2 style={{ fontSize: 18, margin: '16px 0 4px' }}>Productos</h2>
        {renglones.map((r) => {
          const p = productos.get(r.productoId);
          if (!p) return null;
          const d = disponible(p);
          return (
            <div className="renglon" key={r.productoId}>
              <Foto producto={p} />
              <div className="renglon-info">
                <div className="renglon-titulo">{p.nombre}</div>
                <div className="nota-suave">Disponibles: {Math.max(d, 0)}</div>
                {d < r.cantidad && <div className="texto-error">No alcanza el stock</div>}
              </div>
              <Stepper
                chico
                valor={r.cantidad}
                min={1}
                max={Math.max(d, 1)}
                etiqueta={`Cantidad de ${p.nombre}`}
                alCambiar={(n) => setRenglones((rs) => rs.map((x) => (x.productoId === r.productoId ? { ...x, cantidad: n } : x)))}
              />
              <button
                type="button"
                className="cerrar"
                aria-label={`Quitar ${p.nombre}`}
                onClick={() => setRenglones((rs) => rs.filter((x) => x.productoId !== r.productoId))}
              >
                ×
              </button>
            </div>
          );
        })}
        <Boton variante="borde" className="ancho" onClick={() => setEligiendo(true)} style={{ marginTop: 8 }}>
          + Agregar producto
        </Boton>

        <div style={{ height: 12 }} />
        <Campo etiqueta="Nota (opcional)">
          <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <MensajeError>{op.error}</MensajeError>
        <Boton
          variante="primario"
          className="ancho"
          onClick={guardar}
          cargando={op.enviando}
          disabled={!conectado || !cliente.trim() || renglones.length === 0 || problemas.length > 0}
        >
          Guardar reserva
        </Boton>
        {!cliente.trim() && renglones.length > 0 && <p className="nota-suave">Falta el nombre del cliente.</p>}
      </div>

      {eligiendo && (
        <SelectorProducto
          productos={estado.productos}
          yaElegidos={new Set(renglones.map((r) => r.productoId))}
          alElegir={(id) => {
            setRenglones((rs) => [...rs, { productoId: id, cantidad: 1 }]);
            setEligiendo(false);
          }}
          alCerrar={() => setEligiendo(false)}
        />
      )}
    </>
  );
}

function SelectorProducto({
  productos,
  yaElegidos,
  alElegir,
  alCerrar,
}: {
  productos: Producto[];
  yaElegidos: Set<string>;
  alElegir: (id: string) => void;
  alCerrar: () => void;
}) {
  const [q, setQ] = useState('');
  const nq = normalizar(q);
  const lista = productos
    .filter((p) => p.activo && !yaElegidos.has(p.id) && (!nq || normalizar(p.nombre).includes(nq)))
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.orden - b.orden);
  return (
    <Hoja titulo="Elegí un producto" alCerrar={alCerrar}>
      <input type="search" placeholder="Buscar…" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="selector-productos">
        {(['flores', 'hojas'] as Categoria[]).map((cat) => {
          const items = lista.filter((p) => p.categoria === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <h3 className="nota-suave" style={{ margin: '12px 0 0' }}>
                {NOMBRE_CATEGORIA[cat]}
              </h3>
              {items.map((p) => {
                const d = p.stockCargado ? disponible(p) : null;
                const puede = d !== null && d > 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="renglon opcion-producto"
                    disabled={!puede}
                    onClick={() => alElegir(p.id)}
                  >
                    <Foto producto={p} />
                    <span className="renglon-info renglon-titulo">{p.nombre}</span>
                    <span className="num" style={{ fontWeight: 800, fontSize: 20 }}>
                      {d === null ? 'sin cargar' : Math.max(d, 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {lista.length === 0 && <div className="vacio">No hay productos para agregar.</div>}
      </div>
    </Hoja>
  );
}
