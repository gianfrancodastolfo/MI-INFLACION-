/**
 * Unidades de adulto equivalente (INDEC): convierten un hogar en "adultos varones de 30 a 60 años"
 * para valuar la canasta básica de ese hogar.
 */
export type Sexo = 'mujer' | 'varon';

export interface Member {
  sexo: Sexo;
  /** Edad en años cumplidos. */
  edad: number;
}

export interface AdultEquivalentRow {
  desde: number;
  /** Inclusive. `null` = sin tope. */
  hasta: number | null;
  mujer: number;
  varon: number;
}

export function adultEquivalent(member: Member, table: ReadonlyArray<AdultEquivalentRow>): number | undefined {
  if (!(member.edad >= 0)) return undefined;
  const edad = Math.floor(member.edad);
  const row = table.find((r) => edad >= r.desde && (r.hasta == null || edad <= r.hasta));
  return row ? row[member.sexo] : undefined;
}

/** Suma de unidades del hogar (redondeada a 2 decimales, como los hogares tipo de INDEC). */
export function householdUnits(members: ReadonlyArray<Member>, table: ReadonlyArray<AdultEquivalentRow>): number | undefined {
  let total = 0;
  for (const m of members) {
    const u = adultEquivalent(m, table);
    if (u == null) return undefined;
    total += u;
  }
  return Math.round(total * 100) / 100;
}
