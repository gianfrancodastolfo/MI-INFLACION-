/** Formatos numéricos para Argentina. */
const money0 = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const num0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const MINUS = '−';

export function formatMoney(n: number): string {
  return money0.format(Math.round(n)).replace('-', MINUS);
}

/** Monto compacto para ejes: $ 1,2 M, $ 850 mil. */
export function formatMoneyCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (a >= 1e9) return `${sign}$ ${num1.format(a / 1e9)} mil M`;
  if (a >= 1e6) return `${sign}$ ${num1.format(a / 1e6)} M`;
  if (a >= 1e3) return `${sign}$ ${num0.format(a / 1e3)} mil`;
  return `${sign}$ ${num0.format(a)}`;
}

export function formatNumber(n: number, digits = 1): string {
  const f = digits === 0 ? num0 : digits === 2 ? num2 : num1;
  const p = Math.pow(10, digits === 0 ? 0 : digits === 2 ? 2 : 1);
  const rounded = Math.round(n * p) / p;
  return f.format(rounded === 0 ? 0 : rounded).replace('-', MINUS);
}

/** Tanto por uno → "33,5%". */
export function formatPct(x: number, digits = 1): string {
  return `${formatNumber(x * 100, digits)}%`;
}

/** Con signo explícito: "+1,3%" / "−2,1%". */
export function formatSignedPct(x: number, digits = 1): string {
  const f = Math.pow(10, digits);
  const rounded = Math.round(x * 100 * f) / f;
  const body = `${formatNumber(Math.abs(rounded), digits)}%`;
  if (rounded === 0) return body;
  return rounded > 0 ? `+${body}` : `${MINUS}${body}`;
}

/** Diferencia en puntos porcentuales (tanto por uno → "+2,3 p.p."). */
export function formatPP(x: number, signed = true): string {
  const rounded = Math.round(x * 1000) / 10;
  const body = `${num1.format(Math.abs(rounded))} p.p.`;
  if (!signed || rounded === 0) return body;
  return rounded > 0 ? `+${body}` : `${MINUS}${body}`;
}

/** Parsea montos escritos a mano: "800.000", "800000", "$ 1.200.000,50". */
export function parseMoneyInput(s: string): number | null {
  const clean = s.replace(/[^\d,.-]/g, '');
  if (!clean) return null;
  let t = clean;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatMoneyInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return num0.format(Math.round(n));
}
