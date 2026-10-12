import { useState } from 'react';
import { NOMBRE_CATEGORIA } from '../../core/catalogo';
import type { Comando, Producto } from '../../core/tipos';
import { disponible, unidades } from '../../core/util';
import { Boton, Campo, Foto, Hoja, MensajeError, Pastillas, Stepper } from '../componentes';
import { useApp, useOperacion } from '../contexto';
import { fechaCorta, hoyLocal } from '../formato';
import { navegar } from '../ruta';

export function HojaProducto({ producto: p, alCerrar }: { producto: Producto; alCerrar: () => void }) {
  const [elegido, setModo] = useState<'principal' | 'ajuste'>('principal');
  const modo = p.stockCargado ? elegido : 'inicial';
  return (
    <Hoja titulo={p.nombre} alCerrar={alCerrar} icono={<Foto producto={p} className="foto" />}>
      <div className="nota-suave" style={{ marginTop: -4 }}>
        {NOMBRE_CATEGORIA[p.categoria]} · por {p.unidad}
      </div>
      {modo === 'inicial' && <StockInicial producto={p} />}
      {modo === 'principal' && <Principal producto={p} alAjustar={() => setModo('ajuste')} alCerrar={alCerrar} />}
      {modo === 'ajuste' && <Ajuste producto={p} alVolver={() => setModo('principal')} />}
      <Ficha producto={p} />
    </Hoja>
  );
}

function Cifras({ producto: p }: { producto: Producto }) {
  return (
    <div className="tres">
      <div className="cifra">
        <div className="grande num">{p.fisico}</div>
        <div className="cifra-etiqueta">Físico</div>
      </div>
      <div className="cifra">
        <div className="grande num">{p.reservado}</div>
        <div className="cifra-etiqueta">Reservado</div>
      </div>
      <div className="cifra destacada">
        <div className="grande num">{disponible(p)}</div>
        <div className="cifra-etiqueta">Disponible</div>
      </div>
    </div>
  );
}

function Principal({ producto: p, alAjustar, alCerrar }: { producto: Producto; alAjustar: () => void; alCerrar: () => void }) {
  const { esAdmin, conectado } = useApp();
  const op = useOperacion();
  const [cantidad, setCantidad] = useState(1);
  const [vencimiento, setVencimiento] = useState('');
  const [nota, setNota] = useState('');
  const [accion, setAccion] = useState<'venta' | 'ingreso' | null>(null);
  const d = disponible(p);
  const hoy = hoyLocal();

  async function hacer(tipo: 'venta' | 'ingreso') {
    setAccion(tipo);
    const cmd: Comando =
      tipo === 'venta'
        ? { tipo, productoId: p.id, cantidad, nota: nota || undefined }
        : { tipo, productoId: p.id, cantidad, fechaIngreso: hoy, vencimiento: vencimiento || undefined, nota: nota || undefined };
    if (await op.ejecutar(cmd)) {
      setCantidad(1);
      setNota('');
      setVencimiento('');
    }
  }

  return (
    <>
      <Pastillas producto={p} hoy={hoy} conOk />
      <Cifras producto={p} />
      <Campo etiqueta={`Cantidad (${p.unidad === 'envase' ? 'envases' : 'bandejas'})`}>
        <Stepper valor={cantidad} alCambiar={setCantidad} min={1} etiqueta="Cantidad" />
      </Campo>
      <details className="desplegable">
        <summary>Agregar nota o vencimiento (opcional)</summary>
        <Campo etiqueta="Nota">
          <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <Campo etiqueta="Vencimiento de la mercadería que ingresa" ayuda="Solo si lo informa el proveedor. Se usa al registrar un ingreso.">
          <input type="date" value={vencimiento} min={hoy} onChange={(e) => setVencimiento(e.target.value)} />
        </Campo>
      </details>
      <MensajeError>{op.error}</MensajeError>
      {!conectado && <MensajeError>Sin conexión: no se pueden registrar operaciones.</MensajeError>}
      <div className="acciones">
        <Boton
          variante="primario"
          onClick={() => hacer('venta')}
          disabled={!conectado || cantidad > d}
          cargando={op.enviando && accion === 'venta'}
        >
          Vender {cantidad}
        </Boton>
        <Boton variante="verde" onClick={() => hacer('ingreso')} disabled={!conectado} cargando={op.enviando && accion === 'ingreso'}>
          Ingresar {cantidad}
        </Boton>
        <Boton
          variante="borde"
          className="completo"
          disabled={!conectado || d < 1}
          onClick={() => {
            alCerrar();
            navegar(`/reservas/nueva?p=${encodeURIComponent(p.id)}&n=${Math.min(cantidad, Math.max(d, 1))}`);
          }}
        >
          Reservar para un cliente…
        </Boton>
        {esAdmin && (
          <Boton variante="borde" className="completo" onClick={alAjustar} disabled={!conectado}>
            Descarte, conteo o corrección…
          </Boton>
        )}
      </div>
      {cantidad > d && d >= 0 && (
        <p className="nota-suave">
          Para vender hay {unidades(Math.max(d, 0), p.unidad)} disponible{d === 1 ? '' : 's'}
          {p.reservado > 0 ? ` (las otras ${p.reservado} están reservadas)` : ''}.
        </p>
      )}
    </>
  );
}

function StockInicial({ producto: p }: { producto: Producto }) {
  const { conectado } = useApp();
  const op = useOperacion();
  const [cantidad, setCantidad] = useState(0);
  const [vencimiento, setVencimiento] = useState('');
  return (
    <>
      <Pastillas producto={p} hoy={hoyLocal()} />
      <p>
        Todavía no se cargó cuántas {p.unidad === 'envase' ? 'envases' : 'bandejas'} hay. Contalas y cargá el número (puede ser 0).
      </p>
      <Campo etiqueta="Cantidad que hay ahora">
        <Stepper valor={cantidad} alCambiar={setCantidad} min={0} etiqueta="Cantidad inicial" />
      </Campo>
      <Campo etiqueta="Vencimiento (opcional)" ayuda="Solo si se conoce.">
        <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
      </Campo>
      <MensajeError>{op.error}</MensajeError>
      <Boton
        variante="primario"
        className="ancho"
        disabled={!conectado}
        cargando={op.enviando}
        onClick={() =>
          op.ejecutar({
            tipo: 'stock_inicial',
            productoId: p.id,
            cantidad,
            fechaIngreso: cantidad > 0 ? hoyLocal() : undefined,
            vencimiento: vencimiento || undefined,
          })
        }
      >
        Cargar stock inicial: {cantidad}
      </Boton>
    </>
  );
}

type TipoAjuste = 'descarte' | 'conteo' | 'correccion';

function Ajuste({ producto: p, alVolver }: { producto: Producto; alVolver: () => void }) {
  const { conectado } = useApp();
  const op = useOperacion();
  const [tipo, setTipo] = useState<TipoAjuste>('descarte');
  const [cantidad, setCantidad] = useState(1);
  const [contado, setContado] = useState(p.fisico);
  const [diferencia, setDiferencia] = useState(0);
  const [nota, setNota] = useState('');

  async function confirmar() {
    const cmd: Comando =
      tipo === 'descarte'
        ? { tipo, productoId: p.id, cantidad, nota: nota || undefined }
        : tipo === 'conteo'
          ? { tipo, productoId: p.id, contado, nota: nota || undefined }
          : { tipo, productoId: p.id, diferencia, nota };
    if (await op.ejecutar(cmd)) alVolver();
  }

  return (
    <>
      <Cifras producto={p} />
      <div className="filtros" role="group" aria-label="Tipo de ajuste">
        {(
          [
            ['descarte', 'Descarte'],
            ['conteo', 'Conteo'],
            ['correccion', 'Corrección'],
          ] as [TipoAjuste, string][]
        ).map(([id, texto]) => (
          <button key={id} type="button" className="chip" aria-pressed={tipo === id} onClick={() => setTipo(id)}>
            {texto}
          </button>
        ))}
      </div>
      {tipo === 'descarte' && (
        <Campo etiqueta="Cuántas se tiran" ayuda="Mercadería que no se puede vender (se marchitó, se rompió…).">
          <Stepper valor={cantidad} alCambiar={setCantidad} min={1} max={Math.max(p.fisico, 1)} etiqueta="Cantidad a descartar" />
        </Campo>
      )}
      {tipo === 'conteo' && (
        <Campo etiqueta="Cuántas hay físicamente" ayuda={`El sistema dice ${p.fisico}. Se registra la diferencia.`}>
          <Stepper valor={contado} alCambiar={setContado} min={0} etiqueta="Cantidad contada" />
        </Campo>
      )}
      {tipo === 'correccion' && (
        <Campo etiqueta="Diferencia a corregir" ayuda="Positivo suma, negativo resta. Por ejemplo, −2 si se cargó un ingreso de más.">
          <Stepper valor={diferencia} alCambiar={setDiferencia} min={-p.fisico} etiqueta="Diferencia" />
        </Campo>
      )}
      <Campo etiqueta={tipo === 'correccion' ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}>
        <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <MensajeError>{op.error}</MensajeError>
      <div className="acciones">
        <Boton variante="borde" onClick={alVolver}>
          Volver
        </Boton>
        <Boton
          variante={tipo === 'descarte' ? 'peligro' : 'primario'}
          onClick={confirmar}
          cargando={op.enviando}
          disabled={!conectado || (tipo === 'correccion' && (diferencia === 0 || !nota.trim()))}
        >
          Confirmar
        </Boton>
      </div>
    </>
  );
}

function Ficha({ producto: p }: { producto: Producto }) {
  const filas: [string, string][] = [
    ['Último ingreso', p.fechaIngreso ? fechaCorta(p.fechaIngreso) : ''],
    ['Vencimiento', p.vencimiento ? fechaCorta(p.vencimiento) : ''],
    ['Stock mínimo', p.minimo > 0 ? String(p.minimo) : ''],
    ['Descripción', p.descripcion],
    ['Notas internas', p.notas],
    ['Observaciones de calidad', p.calidad],
    ['Proveedor', p.proveedor],
    ['Código', p.sku],
  ].filter(([, v]) => v) as [string, string][];
  if (filas.length === 0) return null;
  return (
    <dl className="ficha">
      {filas.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
