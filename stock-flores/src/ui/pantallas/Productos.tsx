import { useState } from 'react';
import { NOMBRE_CATEGORIA } from '../../core/catalogo';
import type { Categoria, DatosProducto, Producto, Unidad } from '../../core/tipos';
import { Boton, Campo, Foto, Hoja, MensajeError, Pastillas } from '../componentes';
import { useApp, useOperacion } from '../contexto';
import { hoyLocal } from '../formato';

// Administración del catálogo. Editar datos nunca cambia cantidades ni el historial.

export function Productos() {
  const { estado, esAdmin } = useApp();
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  if (!estado) return <div className="vacio">Cargando…</div>;
  if (!esAdmin) return <div className="vacio">Esta sección es solo para administradores.</div>;
  const hoy = hoyLocal();
  const producto = estado.productos.find((p) => p.id === editando);

  return (
    <>
      <div className="titulo-pantalla">
        <h1>Productos</h1>
        <Boton variante="primario" onClick={() => setEditando('nuevo')}>
          + Nuevo
        </Boton>
      </div>
      <p className="nota-suave">
        Acá se editan nombres, descripciones, stock mínimo y datos opcionales. Las cantidades solo cambian con ventas, ingresos y
        ajustes.
      </p>
      {(['flores', 'hojas'] as Categoria[]).map((cat) => (
        <section key={cat} className={`seccion seccion-${cat}`}>
          <h2 className="seccion-titulo">{NOMBRE_CATEGORIA[cat]}</h2>
          <div className="tarjeta">
            {estado.productos
              .filter((p) => p.categoria === cat)
              .sort((a, b) => Number(b.activo) - Number(a.activo) || a.orden - b.orden)
              .map((p) => (
                <button key={p.id} type="button" className="renglon opcion-producto" onClick={() => setEditando(p.id)}>
                  <Foto producto={p} />
                  <span className="renglon-info">
                    <span className="renglon-titulo">{p.nombre}</span>
                    <Pastillas producto={p} hoy={hoy} />
                  </span>
                  <span className="nota-suave">Editar</span>
                </button>
              ))}
          </div>
        </section>
      ))}
      {(producto || editando === 'nuevo') && <EditorProducto producto={producto} alCerrar={() => setEditando(null)} />}
    </>
  );
}

const VACIO: DatosProducto = {
  nombre: '',
  categoria: 'flores',
  unidad: 'bandeja',
  descripcion: '',
  minimo: 0,
  activo: true,
  orden: 0,
  notas: '',
  proveedor: '',
  sku: '',
  calidad: '',
  fechaIngreso: '',
  vencimiento: '',
  foto: '',
};

/** El orden de un producto nuevo lo asigna el sistema (al final de su categoría). */
function sinOrden(d: DatosProducto): Partial<DatosProducto> & Pick<DatosProducto, 'nombre' | 'categoria'> {
  const copia: Partial<DatosProducto> = { ...d };
  delete copia.orden;
  return { ...copia, nombre: d.nombre, categoria: d.categoria };
}

function EditorProducto({ producto, alCerrar }: { producto?: Producto; alCerrar: () => void }) {
  const op = useOperacion();
  const [d, setD] = useState<DatosProducto>(() => {
    if (!producto) return VACIO;
    const { nombre, categoria, unidad, descripcion, minimo, activo, orden, notas, proveedor, sku, calidad, fechaIngreso, vencimiento, foto } =
      producto;
    return { nombre, categoria, unidad, descripcion, minimo, activo, orden, notas, proveedor, sku, calidad, fechaIngreso, vencimiento, foto };
  });
  const poner = <K extends keyof DatosProducto>(k: K, v: DatosProducto[K]) => setD((x) => ({ ...x, [k]: v }));

  async function guardar() {
    const ok = producto
      ? await op.ejecutar({ tipo: 'editar_producto', productoId: producto.id, datos: d })
      : await op.ejecutar({ tipo: 'crear_producto', datos: sinOrden(d) });
    if (ok) alCerrar();
  }

  return (
    <Hoja titulo={producto ? `Editar ${producto.nombre}` : 'Nuevo producto'} alCerrar={alCerrar}>
      <Campo etiqueta="Nombre comercial">
        <input type="text" value={d.nombre} maxLength={60} onChange={(e) => poner('nombre', e.target.value)} />
      </Campo>
      <div className="acciones" style={{ marginTop: 0 }}>
        <Campo etiqueta="Categoría">
          <select value={d.categoria} onChange={(e) => poner('categoria', e.target.value as Categoria)}>
            <option value="flores">Flores comestibles</option>
            <option value="hojas">Hojas y verdes</option>
          </select>
        </Campo>
        <Campo etiqueta="Se vende por">
          <select value={d.unidad} onChange={(e) => poner('unidad', e.target.value as Unidad)}>
            <option value="bandeja">Bandeja</option>
            <option value="envase">Envase</option>
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Stock mínimo" ayuda="Con esta cantidad disponible o menos, se marca “Stock bajo”. 0 = sin aviso.">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={d.minimo}
          onChange={(e) => poner('minimo', Math.max(0, parseInt(e.target.value, 10) || 0))}
        />
      </Campo>
      <label className="check">
        <input type="checkbox" checked={d.activo} onChange={(e) => poner('activo', e.target.checked)} />
        Activo (aparece en la pantalla de stock)
      </label>
      <Campo etiqueta="Descripción breve" ayuda="Solo información confirmada.">
        <textarea value={d.descripcion} maxLength={300} onChange={(e) => poner('descripcion', e.target.value)} />
      </Campo>
      <details className="desplegable">
        <summary>Datos opcionales</summary>
        <Campo etiqueta="Notas internas">
          <textarea value={d.notas} maxLength={500} onChange={(e) => poner('notas', e.target.value)} />
        </Campo>
        <Campo etiqueta="Observaciones de calidad">
          <textarea value={d.calidad} maxLength={300} onChange={(e) => poner('calidad', e.target.value)} />
        </Campo>
        <Campo etiqueta="Proveedor">
          <input type="text" value={d.proveedor} maxLength={80} onChange={(e) => poner('proveedor', e.target.value)} />
        </Campo>
        <Campo etiqueta="Código interno / SKU">
          <input type="text" value={d.sku} maxLength={40} onChange={(e) => poner('sku', e.target.value)} />
        </Campo>
        <Campo etiqueta="Fecha del último ingreso">
          <input type="date" value={d.fechaIngreso} onChange={(e) => poner('fechaIngreso', e.target.value)} />
        </Campo>
        <Campo etiqueta="Vencimiento o consumo preferente" ayuda="Solo si se conoce. Se borra solo cuando el stock físico llega a 0.">
          <input type="date" value={d.vencimiento} onChange={(e) => poner('vencimiento', e.target.value)} />
        </Campo>
        <Campo etiqueta="Foto (enlace https)" ayuda="Opcional. Dejalo como está para usar la foto de la lámina.">
          <input type="url" value={d.foto} maxLength={500} onChange={(e) => poner('foto', e.target.value)} />
        </Campo>
      </details>
      <MensajeError>{op.error}</MensajeError>
      <Boton variante="primario" className="ancho" onClick={guardar} cargando={op.enviando} disabled={!d.nombre.trim()}>
        {producto ? 'Guardar cambios' : 'Crear producto'}
      </Boton>
    </Hoja>
  );
}
