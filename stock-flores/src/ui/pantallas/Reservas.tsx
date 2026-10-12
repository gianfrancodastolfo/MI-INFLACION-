import { useState } from 'react';
import type { Pedido, Producto } from '../../core/tipos';
import { Boton, Campo, Foto, Hoja, MensajeError, Stepper } from '../componentes';
import { useApp, useOperacion } from '../contexto';
import { fechaRelativa, hoyLocal, momento } from '../formato';
import { navegar } from '../ruta';

function ordenar(a: Pedido, b: Pedido): number {
  // Primero las que tienen fecha (la más cercana arriba), después las sin fecha.
  if (a.fechaEntrega && b.fechaEntrega) return a.fechaEntrega.localeCompare(b.fechaEntrega) || a.numero - b.numero;
  if (a.fechaEntrega) return -1;
  if (b.fechaEntrega) return 1;
  return a.numero - b.numero;
}

export function Reservas() {
  const { estado, conectado } = useApp();
  const [vista, setVista] = useState<'pendientes' | 'cerradas'>('pendientes');
  const [entregando, setEntregando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  if (!estado) return <div className="vacio">Cargando…</div>;

  const productos = new Map(estado.productos.map((p) => [p.id, p]));
  const pendientes = estado.pedidos.filter((p) => p.estado === 'pendiente').sort(ordenar);
  const cerradas = estado.pedidos
    .filter((p) => p.estado !== 'pendiente')
    .sort((a, b) => b.cerrado.localeCompare(a.cerrado));
  const lista = vista === 'pendientes' ? pendientes : cerradas;
  const buscar = (id: string | null) => estado.pedidos.find((p) => p.id === id);

  return (
    <>
      <div className="titulo-pantalla">
        <h1>Reservas</h1>
        <Boton variante="primario" onClick={() => navegar('/reservas/nueva')} disabled={!conectado}>
          + Nueva
        </Boton>
      </div>
      <div className="filtros" role="group" aria-label="Ver">
        <button type="button" className="chip" aria-pressed={vista === 'pendientes'} onClick={() => setVista('pendientes')}>
          Pendientes ({pendientes.length})
        </button>
        <button type="button" className="chip" aria-pressed={vista === 'cerradas'} onClick={() => setVista('cerradas')}>
          Entregadas y canceladas
        </button>
      </div>
      {vista === 'cerradas' && <p className="nota-suave">Se muestran las de los últimos 30 días. Todas quedan en la planilla.</p>}
      <div className="tarjetas dos">
        {lista.map((pe) => (
          <TarjetaReserva
            key={pe.id}
            pedido={pe}
            productos={productos}
            alEntregar={() => setEntregando(pe.id)}
            alCancelar={() => setCancelando(pe.id)}
            alEditar={() => setEditando(pe.id)}
            conectado={conectado}
          />
        ))}
      </div>
      {lista.length === 0 && (
        <div className="vacio">{vista === 'pendientes' ? 'No hay reservas pendientes.' : 'No hay reservas cerradas recientes.'}</div>
      )}
      {buscar(entregando)?.estado === 'pendiente' && (
        <HojaEntregar pedido={buscar(entregando)!} productos={productos} alCerrar={() => setEntregando(null)} />
      )}
      {buscar(cancelando)?.estado === 'pendiente' && (
        <HojaCancelar pedido={buscar(cancelando)!} alCerrar={() => setCancelando(null)} />
      )}
      {buscar(editando)?.estado === 'pendiente' && <HojaEditar pedido={buscar(editando)!} alCerrar={() => setEditando(null)} />}
    </>
  );
}

function nombreDe(productos: Map<string, Producto>, id: string): string {
  return productos.get(id)?.nombre ?? '(producto borrado)';
}

function TarjetaReserva({
  pedido: pe,
  productos,
  alEntregar,
  alCancelar,
  alEditar,
  conectado,
}: {
  pedido: Pedido;
  productos: Map<string, Producto>;
  alEntregar: () => void;
  alCancelar: () => void;
  alEditar: () => void;
  conectado: boolean;
}) {
  const hoy = hoyLocal();
  const atrasada = pe.estado === 'pendiente' && pe.fechaEntrega && pe.fechaEntrega < hoy;
  return (
    <article className="tarjeta">
      <div className="reserva-cabecera">
        <span className="nota-suave num">#{pe.numero}</span>
        <span className="reserva-cliente">{pe.cliente}</span>
        {pe.estado === 'pendiente' && pe.fechaEntrega && (
          <span className={`pastilla ${atrasada ? 'vencido' : pe.fechaEntrega === hoy ? 'hoy' : 'fecha'}`}>
            Entrega {fechaRelativa(pe.fechaEntrega, hoy)}
          </span>
        )}
        {pe.estado === 'entregado' && <span className="pastilla ok">Entregada</span>}
        {pe.estado === 'cancelado' && <span className="pastilla neutra">Cancelada</span>}
      </div>
      <ul className="reserva-items">
        {pe.items.map((it) => (
          <li key={it.productoId}>
            <span>{nombreDe(productos, it.productoId)}</span>
            <strong className="num">
              {pe.estado === 'entregado' && it.entregado !== undefined && it.entregado !== it.cantidad
                ? `${it.entregado} de ${it.cantidad}`
                : it.cantidad}
            </strong>
          </li>
        ))}
      </ul>
      {pe.nota && <p className="nota-suave">Nota: {pe.nota}</p>}
      <p className="nota-suave">
        {pe.estado === 'pendiente'
          ? `Reservó ${pe.creadoPorNombre} · ${momento(pe.creado)}`
          : `${pe.estado === 'entregado' ? 'Entregó' : 'Canceló'} ${pe.cerradoPorNombre} · ${momento(pe.cerrado)}${
              pe.cierreNota ? ` · ${pe.cierreNota}` : ''
            }`}
      </p>
      {pe.estado === 'pendiente' && (
        <div className="acciones">
          <Boton variante="verde" onClick={alEntregar} disabled={!conectado}>
            Entregar
          </Boton>
          <Boton variante="borde" onClick={alCancelar} disabled={!conectado}>
            Cancelar
          </Boton>
          <Boton variante="borde" className="completo chico" onClick={alEditar} disabled={!conectado}>
            Editar cliente, fecha o nota
          </Boton>
        </div>
      )}
    </article>
  );
}

function HojaEntregar({ pedido: pe, productos, alCerrar }: { pedido: Pedido; productos: Map<string, Producto>; alCerrar: () => void }) {
  const op = useOperacion();
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(pe.items.map((it) => [it.productoId, it.cantidad])),
  );
  const [nota, setNota] = useState('');
  const liberadas = pe.items.reduce((s, it) => s + it.cantidad - (cantidades[it.productoId] ?? 0), 0);
  const total = pe.items.reduce((s, it) => s + (cantidades[it.productoId] ?? 0), 0);

  async function confirmar() {
    const ok = await op.ejecutar({
      tipo: 'entregar',
      pedidoId: pe.id,
      items: pe.items.map((it) => ({ productoId: it.productoId, cantidad: cantidades[it.productoId] ?? 0 })),
      nota: nota || undefined,
    });
    if (ok) alCerrar();
  }

  return (
    <Hoja titulo={`Entregar #${pe.numero} · ${pe.cliente}`} alCerrar={alCerrar}>
      <p className="nota-suave">Si se lleva menos de lo reservado, bajá la cantidad: lo que no se lleva vuelve a quedar disponible.</p>
      {pe.items.map((it) => {
        const p = productos.get(it.productoId);
        return (
          <div className="renglon" key={it.productoId}>
            {p && <Foto producto={p} />}
            <div className="renglon-info">
              <div className="renglon-titulo">{nombreDe(productos, it.productoId)}</div>
              <div className="nota-suave">Reservadas: {it.cantidad}</div>
            </div>
            <Stepper
              chico
              valor={cantidades[it.productoId] ?? 0}
              min={0}
              max={it.cantidad}
              etiqueta={`Entregadas de ${nombreDe(productos, it.productoId)}`}
              alCambiar={(n) => setCantidades((c) => ({ ...c, [it.productoId]: n }))}
            />
          </div>
        );
      })}
      <Campo etiqueta="Nota (opcional)">
        <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      {liberadas > 0 && total > 0 && (
        <p className="nota-suave">{liberadas === 1 ? 'Se libera 1' : `Se liberan ${liberadas}`} para la venta.</p>
      )}
      <MensajeError>{op.error}</MensajeError>
      <Boton variante="verde" className="ancho" onClick={confirmar} cargando={op.enviando} disabled={total === 0}>
        Confirmar entrega ({total})
      </Boton>
      {total === 0 && <p className="nota-suave">Si no se lleva nada, cancelá la reserva.</p>}
    </Hoja>
  );
}

function HojaCancelar({ pedido: pe, alCerrar }: { pedido: Pedido; alCerrar: () => void }) {
  const op = useOperacion();
  const [motivo, setMotivo] = useState('');
  return (
    <Hoja titulo={`Cancelar #${pe.numero} · ${pe.cliente}`} alCerrar={alCerrar}>
      <p>Las bandejas reservadas vuelven a quedar disponibles para la venta.</p>
      <Campo etiqueta="Motivo (opcional)">
        <input type="text" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <MensajeError>{op.error}</MensajeError>
      <div className="acciones">
        <Boton variante="borde" onClick={alCerrar}>
          No, volver
        </Boton>
        <Boton
          variante="peligro"
          cargando={op.enviando}
          onClick={async () => {
            if (await op.ejecutar({ tipo: 'cancelar', pedidoId: pe.id, motivo: motivo || undefined })) alCerrar();
          }}
        >
          Sí, cancelar
        </Boton>
      </div>
    </Hoja>
  );
}

function HojaEditar({ pedido: pe, alCerrar }: { pedido: Pedido; alCerrar: () => void }) {
  const op = useOperacion();
  const [cliente, setCliente] = useState(pe.cliente);
  const [fecha, setFecha] = useState(pe.fechaEntrega);
  const [nota, setNota] = useState(pe.nota);
  return (
    <Hoja titulo={`Editar reserva #${pe.numero}`} alCerrar={alCerrar}>
      <p className="nota-suave">Para cambiar cantidades, cancelá esta reserva y hacé una nueva.</p>
      <Campo etiqueta="Cliente">
        <input type="text" value={cliente} maxLength={80} onChange={(e) => setCliente(e.target.value)} />
      </Campo>
      <Campo etiqueta="Fecha de entrega (opcional)">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>
      <Campo etiqueta="Nota (opcional)">
        <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <MensajeError>{op.error}</MensajeError>
      <Boton
        variante="primario"
        className="ancho"
        cargando={op.enviando}
        disabled={!cliente.trim()}
        onClick={async () => {
          if (await op.ejecutar({ tipo: 'editar_reserva', pedidoId: pe.id, cliente, fechaEntrega: fecha, nota })) alCerrar();
        }}
      >
        Guardar
      </Boton>
    </Hoja>
  );
}
