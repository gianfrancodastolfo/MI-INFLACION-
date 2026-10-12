import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { alertaVencimiento, nivel, type Nivel } from '../core/estado';
import type { Producto } from '../core/tipos';
import { disponible } from '../core/util';
import { fechaRelativa } from './formato';

// ---------- Hoja: panel que sube desde abajo (diálogo en la compu) ----------

export function Hoja({
  titulo,
  alCerrar,
  children,
  icono,
}: {
  titulo: ReactNode;
  alCerrar: () => void;
  children: ReactNode;
  icono?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, []);
  return (
    <div className="fondo" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <div className="hoja-cabecera">
          {icono}
          <h2 id={id}>{titulo}</h2>
          <button type="button" className="cerrar" onClick={alCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Botón con estado de carga ----------

export function Boton({
  children,
  variante = '',
  cargando = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: string; cargando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`boton ${variante} ${className}`}
      disabled={props.disabled || cargando}
      aria-busy={cargando || undefined}
    >
      {cargando && <span className="girando" aria-hidden="true" />}
      {children}
    </button>
  );
}

// ---------- Selector de cantidad ----------

export function Stepper({
  valor,
  alCambiar,
  min = 0,
  max = 9999,
  chico = false,
  etiqueta,
}: {
  valor: number;
  alCambiar: (n: number) => void;
  min?: number;
  max?: number;
  chico?: boolean;
  etiqueta: string;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  const fijar = (n: number) => alCambiar(Math.min(max, Math.max(min, n)));
  return (
    <div className={`stepper ${chico ? 'chico' : ''}`}>
      <button type="button" onClick={() => fijar(valor - 1)} disabled={valor <= min} aria-label={`Restar uno a ${etiqueta}`}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="num"
        aria-label={etiqueta}
        min={min}
        max={max}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) fijar(n);
        }}
        onBlur={() => setTexto(String(valor))}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" onClick={() => fijar(valor + 1)} disabled={valor >= max} aria-label={`Sumar uno a ${etiqueta}`}>
        +
      </button>
    </div>
  );
}

// ---------- Foto del producto ----------

export function Foto({ producto, className = 'foto' }: { producto: Pick<Producto, 'foto' | 'nombre'>; className?: string }) {
  const [fallo, setFallo] = useState(false);
  if (!producto.foto || fallo) {
    return (
      <div className={`${className} foto-vacia`} aria-hidden="true">
        {producto.nombre.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return <img className={className} src={producto.foto} alt="" loading="lazy" onError={() => setFallo(true)} />;
}

// ---------- Indicadores ----------

const TEXTO_NIVEL: Record<Nivel, string> = {
  ok: 'Hay stock',
  bajo: 'Stock bajo',
  agotado: 'Agotado',
  faltante: 'Faltan para reservas',
  pendiente: 'Sin cargar',
};

export function Pastillas({ producto, hoy, conOk = false }: { producto: Producto; hoy: string; conOk?: boolean }) {
  const n = nivel(producto);
  const v = alertaVencimiento(producto, hoy);
  const textoVenc =
    v === 'vencido'
      ? 'Vencido'
      : v === 'hoy'
        ? 'Vence hoy'
        : v === 'manana'
          ? 'Vence mañana'
          : v === 'fecha'
            ? `Vence ${fechaRelativa(producto.vencimiento, hoy)}`
            : '';
  return (
    <div className="pastillas">
      {(n !== 'ok' || conOk) && <span className={`pastilla ${n}`}>{TEXTO_NIVEL[n]}</span>}
      {v && <span className={`pastilla ${v}`}>{textoVenc}</span>}
      {!producto.activo && <span className="pastilla neutra">Inactivo</span>}
    </div>
  );
}

/** Número grande: disponible (o "—" si falta cargar el stock). */
export function Disponible({ producto }: { producto: Producto }) {
  if (!producto.stockCargado) {
    return (
      <>
        <div className="grande num" aria-hidden="true">
          —
        </div>
      </>
    );
  }
  const d = disponible(producto);
  return (
    <>
      <div className="grande num">{d}</div>
      <div className="grande-etiqueta">{d === 1 ? 'disponible' : 'disponibles'}</div>
    </>
  );
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}

export function MensajeError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="mensaje-error" role="alert">
      {children}
    </div>
  );
}

// ---------- Íconos (trazos simples) ----------

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Iconos = {
  stock: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...trazo}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
    </svg>
  ),
  reservas: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...trazo}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4" />
    </svg>
  ),
  historial: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...trazo}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5M12 7v5l3 2" />
    </svg>
  ),
  mas: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...trazo}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  ),
};
