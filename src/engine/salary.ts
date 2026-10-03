/**
 * Cálculos de sueldo y poder adquisitivo.
 * Todos reciben un "factor de precios" (I(t1)/I(t0)) que puede venir del IPC oficial
 * o de la canasta personal: el motor no mezcla las fuentes, las recibe ya resueltas.
 */

/** Monto equivalente en t1 de un monto de t0: monto × factor. */
export function calculateEquivalentSalary(amount: number, priceFactor: number): number {
  return amount * priceFactor;
}

/** Sueldo real: expresa un sueldo nominal de t1 en pesos de t0 (nominal / factor). */
export function calculateRealSalary(nominal: number, priceFactor: number): number {
  return nominal / priceFactor;
}

/**
 * Variación real: (1 + variación nominal) / (1 + inflación) - 1.
 * No es "nominal menos inflación": con +80% de sueldo y +95% de precios,
 * la caída real es 1,80 / 1,95 - 1 = -7,7%, no -15 puntos.
 */
export function calculateRealVariation(nominalFactor: number, priceFactor: number): number {
  return nominalFactor / priceFactor - 1;
}

export interface PurchasingPowerInput {
  salaryThen: number;
  salaryNow: number;
  /** I(t1)/I(t0) del índice que se use (oficial o personal). */
  priceFactor: number;
}

export interface PurchasingPower {
  nominalChange: number;
  inflation: number;
  realChange: number;
  equivalentSalary: number;
  /** Diferencia del sueldo actual contra el equivalente (positivo = por encima). */
  gapAmount: number;
  /** Igual a realChange: sueldo actual / equivalente - 1. */
  gapPct: number;
}

export function calculatePurchasingPower({ salaryThen, salaryNow, priceFactor }: PurchasingPowerInput): PurchasingPower {
  const nominalFactor = salaryNow / salaryThen;
  const equivalentSalary = calculateEquivalentSalary(salaryThen, priceFactor);
  const realChange = calculateRealVariation(nominalFactor, priceFactor);
  return {
    nominalChange: nominalFactor - 1,
    inflation: priceFactor - 1,
    realChange,
    equivalentSalary,
    gapAmount: salaryNow - equivalentSalary,
    gapPct: realChange,
  };
}

export interface RequiredSalaryInput {
  baseSalary: number;
  priceFactor: number;
  /** Objetivo de mejora real (0.2 = 20% más en términos reales). 0 = mantener. */
  realTarget?: number;
}

/** Sueldo necesario hoy para mantener (o mejorar en `realTarget`) el poder adquisitivo del sueldo base. */
export function calculateRequiredSalary({ baseSalary, priceFactor, realTarget = 0 }: RequiredSalaryInput): number {
  return baseSalary * priceFactor * (1 + realTarget);
}

/** Aumento nominal necesario sobre el sueldo actual para alcanzar el sueldo requerido. */
export function calculateRequiredRaise(currentSalary: number, requiredSalary: number): number {
  return requiredSalary / currentSalary - 1;
}
