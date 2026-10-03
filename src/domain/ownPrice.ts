/**
 * "Precio propio": cuando el usuario sabe cuánto pagaba antes por un contrato o factura
 * (alquiler, prepaga, luz y gas, colegio…), se usa su propia variación en lugar del índice.
 *
 * Serie sintética para el ítem:
 *  - entre la fecha anterior y el mes de referencia: interpolación geométrica entre los dos montos;
 *  - antes y después: se extiende con el índice oficial que le correspondería (subgrupo o división).
 * Así, entre esas dos fechas el ítem varía exactamente lo que pagó el usuario.
 */
import { type IndexSeries, type Period, addMonths, diffMonths, valueAt } from '../engine';

export interface OwnPriceObservation {
  period: Period;
  amount: number;
}

export function ownPriceSeries(base: IndexSeries, before: OwnPriceObservation, now: OwnPriceObservation): IndexSeries | undefined {
  const span = diffMonths(before.period, now.period);
  if (!(span > 0) || !(before.amount > 0) || !(now.amount > 0)) return undefined;
  const b0 = valueAt(base, before.period);
  const b1 = valueAt(base, now.period);
  if (!b0.ok || !b1.ok) return undefined;
  const ratio = now.amount / before.amount;
  const values = base.values.map((v, k) => {
    const t = addMonths(base.start, k);
    const fromBefore = diffMonths(before.period, t);
    if (fromBefore < 0) return v == null ? null : before.amount * (v / b0.value);
    if (fromBefore <= span) return before.amount * Math.pow(ratio, fromBefore / span);
    return v == null ? null : now.amount * (v / b1.value);
  });
  const first = values.find((v) => v != null);
  if (!first) return undefined;
  return { start: base.start, values: values.map((v) => (v == null ? null : (v / first) * 100)) };
}
