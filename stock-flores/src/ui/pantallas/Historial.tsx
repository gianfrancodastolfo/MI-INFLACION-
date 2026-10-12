import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../../api/tipos';
import type { Movimiento, TipoMovimiento } from '../../core/tipos';
import { Boton, MensajeError } from '../componentes';
import { useApp } from '../contexto';
import { conSigno, momento, NOMBRE_MOVIMIENTO } from '../formato';

const GRUPOS: { id: string; texto: string; tipos?: TipoMovimiento[] }[] = [
  { id: 'todo', texto: 'Todo' },
  { id: 'ventas', texto: 'Ventas y entregas', tipos: ['venta', 'entrega'] },
  { id: 'reservas', texto: 'Reservas', tipos: ['reserva', 'cancelacion', 'entrega'] },
  { id: 'ingresos', texto: 'Ingresos', tipos: ['ingreso', 'stock_inicial'] },
  { id: 'ajustes', texto: 'Ajustes', tipos: ['descarte', 'conteo', 'ajuste'] },
  { id: 'productos', texto: 'Cambios de datos', tipos: ['producto'] },
];

export function Historial() {
  const { backend, sesion, estado, cerrarSesion } = useApp();
  const [productoId, setProductoId] = useState('');
  const [grupo, setGrupo] = useState('todo');
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const version = estado?.version;

  const cargar = useCallback(
    async (desde: number | null) => {
      setCargando(true);
      setError('');
      try {
        const r = await backend.historial(sesion.token, {
          productoId: productoId || undefined,
          tipos: GRUPOS.find((g) => g.id === grupo)?.tipos,
          limite: 100,
          cursor: desde,
        });
        setMovs((m) => (desde === null ? r.movimientos : m.concat(r.movimientos)));
        setCursor(r.cursor);
      } catch (e) {
        const err = e instanceof ErrorApi ? e : new ErrorApi('No se pudo cargar el historial.');
        if (err.codigo === 'sesion') cerrarSesion(err.message);
        setError(err.message);
      } finally {
        setCargando(false);
      }
    },
    [backend, sesion.token, productoId, grupo, cerrarSesion],
  );

  // Recarga al cambiar los filtros o cuando hay movimientos nuevos.
  useEffect(() => {
    void cargar(null);
  }, [cargar, version]);

  const nombres = new Map((estado?.productos ?? []).map((p) => [p.id, p.nombre]));
  const productosOrdenados = (estado?.productos ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      <div className="titulo-pantalla">
        <h1>Historial</h1>
      </div>
      <label className="campo">
        <span className="oculto">Producto</span>
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} aria-label="Producto">
          <option value="">Todos los productos</option>
          {productosOrdenados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="filtros" role="group" aria-label="Tipo de movimiento">
        {GRUPOS.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={grupo === g.id} onClick={() => setGrupo(g.id)}>
            {g.texto}
          </button>
        ))}
      </div>
      <MensajeError>{error}</MensajeError>
      <div className="tarjeta">
        {movs.map((m) => (
          <FilaMovimiento key={m.id} m={m} nombreActual={nombres.get(m.productoId)} />
        ))}
        {!cargando && movs.length === 0 && !error && <div className="vacio">Todavía no hay movimientos.</div>}
        {cargando && <div className="vacio">Cargando…</div>}
      </div>
      {cursor !== null && !cargando && (
        <Boton variante="borde" className="ancho" style={{ marginTop: 12 }} onClick={() => cargar(cursor)}>
          Ver más antiguos
        </Boton>
      )}
    </>
  );
}

function FilaMovimiento({ m, nombreActual }: { m: Movimiento; nombreActual?: string }) {
  const nombre = nombreActual ?? m.productoNombre;
  const renombrado = nombreActual && nombreActual !== m.productoNombre;
  // Las reservas y cancelaciones no tocan lo físico: muestran cuántas se reservaron o liberaron.
  const deReserva = m.tipo === 'reserva' || m.tipo === 'cancelacion';
  const delta = deReserva ? Math.abs(m.dReservado) : m.dFisico;
  return (
    <div className="movimiento">
      <div>
        <span className="movimiento-tipo">{NOMBRE_MOVIMIENTO[m.tipo]}</span> · {nombre}
        {renombrado && <span className="nota-suave"> (antes {m.productoNombre})</span>}
        {m.pedidoNumero > 0 && <span className="nota-suave"> · reserva #{m.pedidoNumero}</span>}
      </div>
      {m.tipo !== 'producto' ? (
        <div className={`delta num ${deReserva ? '' : delta > 0 ? 'mas' : delta < 0 ? 'menos' : ''}`}>
          {deReserva ? `${delta} ${m.tipo === 'reserva' ? 'reserv.' : 'liber.'}` : conSigno(delta)}
        </div>
      ) : (
        <div />
      )}
      <div className="nota-suave">
        {momento(m.fecha)} · {m.usuarioNombre}
        {m.nota ? ` · ${m.nota}` : ''}
      </div>
      {m.tipo !== 'producto' && (
        <div className="nota-suave num" style={{ textAlign: 'right' }}>
          quedan {m.fisico - m.reservado} disp.
        </div>
      )}
    </div>
  );
}
