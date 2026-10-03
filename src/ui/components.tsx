import { type ReactNode, useEffect, useId, useState } from 'react';
import { MONTHS_LONG, type Period, comparePeriods, formatPeriod, periodMonth, periodYear } from '../engine';
import { FIRST_PERIOD, LAST_PERIOD } from '../domain/data';
import { formatMoney, formatMoneyInput, parseMoneyInput } from '../domain/format';
import { PROVINCES, REGION_NAMES, type RegionId } from '../domain/regions';

export type SourceKind = 'oficial' | 'calculo' | 'estimacion' | 'externo';
const SOURCE_TEXT: Record<SourceKind, string> = {
  oficial: 'Dato oficial · INDEC',
  calculo: 'Cálculo con datos oficiales',
  estimacion: 'Estimación personal',
  externo: 'Fuente externa a INDEC',
};

export function SourceBadge({ kind, children }: { kind: SourceKind; children?: ReactNode }) {
  return <span className={`badge ${kind}`}>{children ?? SOURCE_TEXT[kind]}</span>;
}

export function Explain({ title = '¿Qué significa?', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="explain">
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

export function InfoIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.2" y="8.5" width="1.6" height="6" rx="0.8" fill="currentColor" />
      <circle cx="10" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={`notice ${tone === 'warn' ? 'warn' : ''}`} role={tone === 'warn' ? 'status' : undefined}>
      <InfoIcon />
      <div>{children}</div>
    </div>
  );
}

export function MoneyInput({
  id, value, onChange, big = false, placeholder, ariaLabel,
}: { id: string; value: number | null | undefined; onChange: (v: number | null) => void; big?: boolean; placeholder?: string; ariaLabel?: string }) {
  const [text, setText] = useState(formatMoneyInput(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(formatMoneyInput(value));
  }, [value, focused]);
  return (
    <div className={`money ${big ? 'big' : ''}`}>
      <input
        id={id}
        className="input"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? '0'}
        aria-label={ariaLabel}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(formatMoneyInput(value)); }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoneyInput(e.target.value));
        }}
      />
    </div>
  );
}

/** Selector de mes y año limitado al rango con datos oficiales. */
export function MonthPicker({
  id, value, onChange, min = FIRST_PERIOD, max = LAST_PERIOD, label,
}: { id: string; value: Period; onChange: (p: Period) => void; min?: Period; max?: Period; label: string }) {
  const y = periodYear(value);
  const m = periodMonth(value);
  const years: number[] = [];
  for (let k = periodYear(max); k >= periodYear(min); k--) years.push(k);
  const monthOk = (year: number, month: number) => {
    const p = `${year}-${String(month).padStart(2, '0')}`;
    return comparePeriods(p, min) >= 0 && comparePeriods(p, max) <= 0;
  };
  const set = (year: number, month: number) => {
    let mm = month;
    if (!monthOk(year, mm)) mm = comparePeriods(`${year}-${String(mm).padStart(2, '0')}`, min) < 0 ? periodMonth(min) : periodMonth(max);
    onChange(`${year}-${String(mm).padStart(2, '0')}`);
  };
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ padding: 0, marginBottom: 6 }}>{label}</legend>
      <div className="month-pick">
        <select id={`${id}-m`} className="select" aria-label={`${label}: mes`} value={m} onChange={(e) => set(y, Number(e.target.value))}>
          {MONTHS_LONG.map((name, k) => (
            <option key={name} value={k + 1} disabled={!monthOk(y, k + 1)}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </option>
          ))}
        </select>
        <select id={`${id}-y`} className="select" aria-label={`${label}: año`} value={y} onChange={(e) => set(Number(e.target.value), m)}>
          {years.map((yy) => (
            <option key={yy} value={yy}>{yy}</option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

export function RegionSelect({ id, value, onChange, includeNational = true }: { id: string; value: RegionId; onChange: (r: RegionId) => void; includeNational?: boolean }) {
  const ids = (Object.keys(REGION_NAMES) as RegionId[]).filter((r) => includeNational || r !== 'nacional');
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as RegionId)}>
      {ids.map((r) => (
        <option key={r} value={r}>{r === 'nacional' ? 'IPC total nacional' : `IPC ${REGION_NAMES[r]}`}</option>
      ))}
    </select>
  );
}

export function ProvinceSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elegí tu provincia</option>
      {PROVINCES.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tile({ label, value, sub, keyKind, children }: { label: ReactNode; value: ReactNode; sub?: ReactNode; keyKind?: 'oficial' | 'personal' | 'sueldo'; children?: ReactNode }) {
  return (
    <div className="tile">
      <div className="t-label">{keyKind && <span className={`key ${keyKind}`} aria-hidden="true" />}{label}</div>
      <div className="t-value">{value}</div>
      {sub && <div className="t-sub">{sub}</div>}
      {children}
    </div>
  );
}

/** El monto de partida como etiqueta de remarcación, tachada debajo del nuevo monto. */
export function Sticker({ amount, period }: { amount: number; period: Period }) {
  return (
    <div className="sticker" aria-label={`Monto de partida: ${formatMoney(amount)} en ${formatPeriod(period, 'long')}`}>
      <s>{formatMoney(amount)}</s>
      <span className="when">{formatPeriod(period)}</span>
    </div>
  );
}

export function useFieldId(prefix: string) {
  const raw = useId();
  return `${prefix}-${raw.replace(/:/g, '')}`;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

/** Fecha diaria nativa (el teclado y el calendario del sistema), limitada a un rango. */
export function DateInput({ id, value, onChange, min, max, label }: { id: string; value: string; onChange: (v: string) => void; min?: string; max?: string; label: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        className="input input-date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
      />
    </div>
  );
}

/** Número con decimales (por ejemplo, la cuota en UVA). */
export function DecimalInput({ id, value, onChange, placeholder, digits = 2 }: { id: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; digits?: number }) {
  const fmt = (n: number | null) => (n == null ? '' : n.toLocaleString('es-AR', { maximumFractionDigits: digits }));
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmt(value)); }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      id={id}
      className="input"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder ?? '0'}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.replace(/\s/g, '');
        const t = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d+\.\d{1,4}$/.test(raw) ? raw : raw.replace(/\./g, '');
        const n = Number(t);
        onChange(t === '' || !Number.isFinite(n) || n < 0 ? null : n);
      }}
    />
  );
}
