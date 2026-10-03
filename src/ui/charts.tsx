/**
 * Gráficos SVG livianos (sin dependencias): líneas con cursor y lista de barras.
 * Reglas: líneas de 2px, punto final con anillo, grilla tenue, etiquetas finales selectivas,
 * el texto siempre en tinta (nunca del color de la serie) y tooltip que no reemplaza la tabla.
 */
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { type Period, diffMonths, formatPeriod, fromMonthIndex, toMonthIndex } from '../engine';

export type SeriesColor = 'oficial' | 'personal' | 'sueldo' | 'ink';
const STROKE: Record<SeriesColor, string> = { oficial: 'var(--oficial)', personal: 'var(--personal)', sueldo: 'var(--sueldo)', ink: 'var(--ink-2)' };

export interface LineSeries {
  id: string;
  label: string;
  color: SeriesColor;
  points: Array<{ period: Period; value: number | null }>;
}

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { if (e) setW(Math.max(260, Math.round(e.contentRect.width))); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) { const d = Math.abs(max) || 1; min -= d * 0.1; max += d * 0.1; }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 2 ? 2.5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

export function LineChart({
  series, height = 260, yFormat, tipFormat, ariaLabel, startAtZero = false, reference, endLabels = true,
}: {
  series: LineSeries[];
  height?: number;
  yFormat: (v: number) => string;
  tipFormat?: (v: number) => string;
  ariaLabel: string;
  startAtZero?: boolean;
  reference?: { value: number; label: string };
  endLabels?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmtTip = tipFormat ?? yFormat;

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return null;
    const i0 = Math.min(...all.map((p) => toMonthIndex(p.period)));
    const i1 = Math.max(...all.map((p) => toMonthIndex(p.period)));
    const vals = all.map((p) => p.value).filter((v): v is number => v != null && Number.isFinite(v));
    if (reference) vals.push(reference.value);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (startAtZero) lo = Math.min(0, lo);
    const ticks = niceTicks(lo, hi, height < 200 ? 3 : 4);
    lo = Math.min(lo, ticks[0]!);
    hi = Math.max(hi, ticks[ticks.length - 1]!);
    const labelW = Math.max(...ticks.map((t) => yFormat(t).length)) * 6.6 + 10;
    return { i0, i1, lo, hi, ticks, labelW };
  }, [series, reference, startAtZero, height, yFormat]);

  if (!model) return null;
  const { i0, i1, lo, hi, ticks, labelW } = model;
  const narrow = width < 520;
  // Las etiquetas finales usan el ancho de la más larga; si ocuparían más de un 30% del gráfico, queda solo la leyenda.
  const endW = Math.max(0, ...series.map((s) => s.label.length)) * 6.9 + 18;
  const showEnd = endLabels && series.length <= 3 && !narrow && endW <= width * 0.3;
  const m = { top: 12, right: showEnd ? endW : 14, bottom: 28, left: labelW };
  const pw = Math.max(40, width - m.left - m.right);
  const ph = height - m.top - m.bottom;
  const x = (i: number) => m.left + (i1 === i0 ? pw / 2 : ((i - i0) / (i1 - i0)) * pw);
  const y = (v: number) => m.top + ph - ((v - lo) / (hi - lo || 1)) * ph;

  // Marcas del eje X: años si el período es largo; si no, cada 1, 3 o 6 meses.
  const span = i1 - i0;
  const step = span > 36 ? 12 : span > 18 ? 6 : span > 8 ? 3 : 1;
  const xt: number[] = [];
  for (let i = i0; i <= i1; i++) {
    const month = (i % 12) + 1;
    if (step === 12 ? month === 1 : (month - 1) % step === 0) xt.push(i);
  }
  if (xt.length === 0) xt.push(i0);
  const xLabel = (i: number) => {
    const p = fromMonthIndex(i);
    return step === 12 ? p.slice(0, 4) : formatPeriod(p).replace(' 20', ' ');
  };

  const paths = series.map((s) => {
    let d = '';
    let pen = false;
    for (const p of s.points) {
      if (p.value == null) { pen = false; continue; }
      const px = x(toMonthIndex(p.period)).toFixed(1);
      const py = y(p.value).toFixed(1);
      d += `${pen ? 'L' : 'M'}${px},${py}`;
      pen = true;
    }
    const last = [...s.points].reverse().find((p) => p.value != null);
    return { s, d, last };
  });

  // Etiquetas finales sin superposición: si dos quedan a menos de 14px, se omite la segunda (queda la leyenda).
  const ends = paths
    .filter((p) => p.last)
    .map((p) => ({ id: p.s.id, label: p.s.label, value: p.last!.value!, y: y(p.last!.value!) }))
    .sort((a, b) => a.y - b.y);
  const placed: typeof ends = [];
  for (const e of ends) if (!placed.some((q) => Math.abs(q.y - e.y) < 14)) placed.push(e);

  const onMove = (ev: PointerEvent<SVGSVGElement>) => {
    const box = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * width;
    const i = Math.round(i0 + ((px - m.left) / pw) * (i1 - i0));
    setHover(Math.max(i0, Math.min(i1, i)));
  };
  const onKey = (ev: KeyboardEvent<SVGSVGElement>) => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      const cur = hover ?? i1;
      setHover(Math.max(i0, Math.min(i1, cur + (ev.key === 'ArrowLeft' ? -1 : 1))));
    } else if (ev.key === 'Escape') setHover(null);
  };

  const hp = hover != null ? fromMonthIndex(hover) : null;
  const tipRows = hp
    ? series.map((s) => ({ s, v: s.points.find((p) => p.period === hp)?.value ?? null }))
    : [];
  const tipLeft = hover != null ? Math.min(Math.max(x(hover) + 12, 0), width - 170) : 0;
  const tipFlip = hover != null && x(hover) > width - 190;

  return (
    <div className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        style={{ touchAction: 'pan-y' }}
      >
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={m.left} x2={m.left + pw} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={m.left - 8} y={y(t) + 4} textAnchor="end">{yFormat(t)}</text>
          ))}
          {xt.map((i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === i0 && xt.length > 1 ? 'start' : 'middle'}>{xLabel(i)}</text>
          ))}
        </g>
        {reference && (
          <g>
            <line className="baseline" x1={m.left} x2={m.left + pw} y1={y(reference.value)} y2={y(reference.value)} />
            <text className="label" x={m.left + 4} y={y(reference.value) - 5}>{reference.label}</text>
          </g>
        )}
        {paths.map(({ s, d }) => (
          <path key={s.id} d={d} fill="none" stroke={STROKE[s.color]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {paths.map(({ s, last }) =>
          last ? (
            <circle key={s.id} cx={x(toMonthIndex(last.period))} cy={y(last.value!)} r={4} fill={STROKE[s.color]} stroke="var(--surface)" strokeWidth={2} />
          ) : null,
        )}
        {showEnd &&
          placed.map((e) => (
            <text key={e.id} className="endlabel" x={m.left + pw + 10} y={e.y + 4}>
              {e.label}
            </text>
          ))}
        {hover != null && (
          <g>
            <line className="cross" x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ph} />
            {tipRows.map(({ s, v }) =>
              v != null ? <circle key={s.id} cx={x(hover)} cy={y(v)} r={4} fill={STROKE[s.color]} stroke="var(--surface)" strokeWidth={2} /> : null,
            )}
          </g>
        )}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: tipFlip ? Math.max(0, x(hover!) - 182) : tipLeft, top: 8 }} aria-hidden="true">
          <div className="tip-when">{formatPeriod(hp, 'long')}</div>
          {tipRows.map(({ s, v }) => (
            <div key={s.id} className="tip-row">
              <span className="tip-name"><span className="key" style={{ background: STROKE[s.color] }} />{s.label}</span>
              <strong>{v == null ? 'sin dato' : fmtTip(v)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: SeriesColor }> }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}><span className="key" style={{ background: STROKE[it.color] }} aria-hidden="true" />{it.label}</span>
      ))}
    </div>
  );
}

export interface BarRow {
  id: string;
  label: string;
  value: number;
  color?: SeriesColor;
  detail?: string;
}

/** Barras horizontales. `diverging` centra el cero (para aportes positivos y negativos). */
export function BarList({ rows, format, diverging: div = false, ariaLabel }: { rows: BarRow[]; format: (v: number) => string; diverging?: boolean; ariaLabel: string }) {
  const diverging = div || rows.some((r) => r.value < 0);
  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="bars" role="list" aria-label={ariaLabel}>
      {rows.map((r) => {
        const frac = Math.abs(r.value) / maxAbs;
        const color = STROKE[r.color ?? (diverging ? (r.value >= 0 ? 'personal' : 'oficial') : 'oficial')];
        const style = diverging
          ? r.value >= 0
            ? { left: '50%', width: `${frac * 50}%`, background: color }
            : { right: '50%', width: `${frac * 50}%`, background: color }
          : { left: 0, width: `${Math.max(frac * 100, r.value > 0 ? 1 : 0)}%`, background: color };
        return (
          <div className="bar-row" role="listitem" key={r.id} title={r.detail}>
            <span className="bar-name">{r.label}</span>
            <span className="bar-track" aria-hidden="true">
              {diverging && <span className="bar-zero" style={{ left: '50%' }} />}
              <span className={`bar-fill ${diverging && r.value < 0 ? 'neg' : ''}`} style={style} />
            </span>
            <span className="bar-val">{format(r.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Dos barras finitas: tu participación y la del IPC, en la misma escala. */
export function SharePair({ mine, official, max }: { mine: number; official: number; max: number }) {
  const w = (v: number) => `${Math.min(100, (v / (max || 1)) * 100)}%`;
  return (
    <div className="share-pair" aria-hidden="true">
      <span className="bar-track"><span className="bar-fill" style={{ left: 0, width: w(mine), background: 'var(--personal)' }} /></span>
      <span className="bar-track"><span className="bar-fill" style={{ left: 0, width: w(official), background: 'var(--oficial)' }} /></span>
    </div>
  );
}

export function monthsBetween(a: Period, b: Period): number {
  return diffMonths(a, b);
}
