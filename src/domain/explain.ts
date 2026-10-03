/**
 * Explicaciones en lenguaje simple. Solo usan números calculados: si los datos no alcanzan para
 * atribuir la diferencia a categorías concretas, se dice explícitamente.
 */
import { formatPeriod } from '../engine';
import { DIVISION_BY_ID, type DivisionId } from './categories';
import type { ProfileComparison } from './calculations';
import { formatPct, formatPP } from './format';
import { REGION_NAMES } from './regions';

export interface Explanation {
  verdict: 'mayor' | 'menor' | 'similar';
  headline: string;
  reasons: string[];
  note?: string;
}

const label = (id: string) => (DIVISION_BY_ID[id as DivisionId]?.short ?? id).toLowerCase();

export function explainComparison(c: ProfileComparison): Explanation {
  const published = c.published?.inflation ?? c.official.inflation;
  const gap = c.personal.inflation - published;
  const region = REGION_NAMES[c.region];
  const period = `entre ${formatPeriod(c.from, 'long')} y ${formatPeriod(c.to, 'long')}`;
  const similarBand = Math.max(0.005, Math.abs(published) * 0.02);

  if (Math.abs(gap) < similarBand) {
    return {
      verdict: 'similar',
      headline: `Tu inflación estimada fue prácticamente igual a la del IPC de ${region} ${period}.`,
      reasons: [],
      note: c.precision === 'promedio'
        ? 'Todavía estás usando la estructura promedio de tu región. Cargá tus gastos reales para ver tu diferencia.'
        : undefined,
    };
  }

  const verdict = gap > 0 ? 'mayor' : 'menor';
  const sameSign = c.contributions.filter((x) => Math.sign(x.contribution) === Math.sign(c.gap) && Math.abs(x.contribution) > 0.0005);
  const reasons: string[] = [];
  let explained = 0;
  for (const x of sameSign) {
    if (reasons.length >= 3 || Math.abs(explained) >= Math.abs(c.gap) * 0.75) break;
    explained += x.contribution;
    const mix = 'mixEffect' in x ? (x as { mixEffect: number }).mixEffect : 0;
    const leaves = 'leaves' in x ? (x as { leaves: Array<{ category: string; share: number; inflation: number }> }).leaves : [];
    const sub = leaves.filter((l) => l.category.startsWith('apertura:') || l.category.startsWith('propio:')).sort((a, b) => b.share - a.share);
    if (Math.abs(mix) > Math.abs(x.contribution - mix) && sub.length > 0) {
      const names = sub.slice(0, 2).map((l) => c.leafNames?.[l.category] ?? l.category).join(' y ').toLowerCase();
      const pci = (x as { personalCategoryInflation: number }).personalCategoryInflation;
      reasons.push(
        `Dentro de ${label(x.category)}, tu gasto se concentra en ${names}: tu parte de esa categoría subió ${formatPct(pci)} ` +
          `contra ${formatPct(x.categoryInflation)} de toda la división. Aporta ${formatPP(x.contribution)}`,
      );
      continue;
    }
    const weight = x.personalShare > x.officialShare ? 'tiene más peso' : 'tiene menos peso';
    const rise = x.categoryInflation > c.official.inflation ? 'subió más' : 'subió menos';
    reasons.push(
      `${capitalize(label(x.category))} ${weight} en tu canasta que en la del IPC ` +
        `(${formatPct(x.personalShare, 0)} contra ${formatPct(x.officialShare, 0)}, a precios de ${formatPeriod(c.from)}) ` +
        `y ${rise} que el promedio (${formatPct(x.categoryInflation)} contra ${formatPct(c.official.inflation)}): aporta ${formatPP(x.contribution)}`,
    );
  }

  const offset = c.contributions.find((x) => Math.sign(x.contribution) === -Math.sign(c.gap) && Math.abs(x.contribution) >= Math.abs(c.gap) * 0.25);
  if (offset) {
    reasons.push(`En sentido contrario empujó ${label(offset.category)} (${formatPP(offset.contribution)}).`);
  }

  const top = sameSign[0];
  let headline: string;
  if (top && Math.abs(top.contribution) >= Math.abs(c.gap) * 0.3) {
    headline = `Tu inflación estimada fue ${formatPP(Math.abs(gap), false)} ${verdict} que la del IPC de ${region} ${period}, sobre todo por ${label(top.category)}.`;
  } else {
    headline = `Tu inflación estimada fue ${formatPP(Math.abs(gap), false)} ${verdict} que la del IPC de ${region} ${period}. La diferencia se reparte entre varias categorías y ninguna la explica por sí sola.`;
  }

  const note =
    c.adjustment != null && Math.abs(c.adjustment) >= 0.0005
      ? `La diferencia incluye ${formatPP(c.adjustment)} por el redondeo de las ponderaciones oficiales, que INDEC publica con un decimal.`
      : undefined;

  return { verdict, headline, reasons, note };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
