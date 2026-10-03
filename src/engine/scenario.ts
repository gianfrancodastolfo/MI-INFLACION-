/**
 * Simulaciones con supuestos que define el usuario. No son predicciones.
 */
export interface ScenarioInput {
  salary: number;
  /** Aumentos nominales previstos, en tanto por uno, con el mes (1..months) en que se cobran. */
  raises: ReadonlyArray<{ month: number; rate: number }>;
  /** Inflación mensual hipotética, constante (tanto por uno). */
  monthlyInflation: number;
  months: number;
}

export interface ScenarioMonth {
  month: number;
  nominalSalary: number;
  priceFactor: number;
  /** Sueldo necesario para mantener el poder adquisitivo inicial. */
  requiredSalary: number;
  /** Sueldo de ese mes en pesos de hoy. */
  realSalary: number;
}

export interface ScenarioResult {
  months: ScenarioMonth[];
  finalNominalSalary: number;
  accumulatedInflation: number;
  requiredSalary: number;
  /** Poder adquisitivo al final contra hoy. */
  finalRealChange: number;
  /** Poder adquisitivo promedio del período contra hoy (lo que efectivamente se vive mes a mes). */
  averageRealChange: number;
}

export function calculateFutureScenario({ salary, raises, monthlyInflation, months }: ScenarioInput): ScenarioResult {
  const out: ScenarioMonth[] = [];
  let nominal = salary;
  let realSum = 0;
  for (let m = 1; m <= months; m++) {
    for (const r of raises) if (r.month === m) nominal *= 1 + r.rate;
    const priceFactor = Math.pow(1 + monthlyInflation, m);
    const realSalary = nominal / priceFactor;
    realSum += realSalary;
    out.push({ month: m, nominalSalary: nominal, priceFactor, requiredSalary: salary * priceFactor, realSalary });
  }
  const last = out[out.length - 1];
  const finalFactor = last ? last.priceFactor : 1;
  return {
    months: out,
    finalNominalSalary: nominal,
    accumulatedInflation: finalFactor - 1,
    requiredSalary: salary * finalFactor,
    finalRealChange: last ? last.realSalary / salary - 1 : 0,
    averageRealChange: months > 0 ? realSum / months / salary - 1 : 0,
  };
}
