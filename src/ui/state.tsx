/**
 * Estado de la app guardado en este navegador (Fase 1: sin cuentas ni servidor).
 */
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Period } from '../engine';
import { LAST_PERIOD } from '../domain/data';
import { EXTERNOS, type ExternalId } from '../domain/externos';
import type { Profile } from '../domain/profile';
import type { RegionId } from '../domain/regions';
import { clearAll, load, remove, save } from '../domain/storage';

export interface SalaryEntry {
  id: string;
  period: Period;
  /** Sueldo neto (de bolsillo), en pesos. */
  net: number;
  gross?: number;
  note?: string;
}

export interface CalcInput {
  amount: number;
  from: Period;
  to: Period;
  region: RegionId;
  /** Índice propio de CABA o de una provincia (fuente externa). Si está, reemplaza al IPC de INDEC. */
  ext?: ExternalId;
  current?: number;
  /** true mientras se muestra el ejemplo inicial sin modificar. */
  example: boolean;
}

export const DEFAULT_CALC: CalcInput = { amount: 800_000, from: '2024-01', to: LAST_PERIOD, region: 'nacional', example: true };

interface AppState {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  salaries: SalaryEntry[];
  setSalaries: (s: SalaryEntry[]) => void;
  calc: CalcInput;
  setCalc: (c: CalcInput) => void;
  resetAll: () => void;
  storageOk: boolean;
}

const Ctx = createContext<AppState | null>(null);

function sanitizeCalc(c: CalcInput): CalcInput {
  // Si ya se publicó un dato nuevo, el "hasta" que estaba en el último mes avanza solo.
  const ext = c.ext && EXTERNOS.indices[c.ext] ? c.ext : undefined;
  const last = ext ? EXTERNOS.indices[ext].last : LAST_PERIOD;
  return { ...DEFAULT_CALC, ...c, ext, to: c.to && c.to <= last ? c.to : last };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(() => load<Profile | null>('profile', null));
  const [salaries, setSalariesState] = useState<SalaryEntry[]>(() => load<SalaryEntry[]>('salaries', []));
  const [calc, setCalcState] = useState<CalcInput>(() => sanitizeCalc(load<CalcInput>('calc', DEFAULT_CALC)));
  const [storageOk] = useState(() => { const okSave = save('probe', 1); remove('probe'); return okSave; });

  useEffect(() => { if (profile) save('profile', profile); else remove('profile'); }, [profile]);
  // Lo vacío o el ejemplo inicial no se guarda: después de "Borrar todos mis datos" no queda nada.
  useEffect(() => { if (salaries.length) save('salaries', salaries); else remove('salaries'); }, [salaries]);
  useEffect(() => { if (calc.example && calc.current == null) remove('calc'); else save('calc', calc); }, [calc]);

  const setProfile = useCallback((p: Profile | null) => setProfileState(p ? { ...p, updatedAt: new Date().toISOString() } : null), []);
  const setSalaries = useCallback((s: SalaryEntry[]) => setSalariesState([...s].sort((a, b) => a.period.localeCompare(b.period))), []);
  const setCalc = useCallback((c: CalcInput) => setCalcState(c), []);
  const resetAll = useCallback(() => {
    clearAll();
    setProfileState(null);
    setSalariesState([]);
    setCalcState(DEFAULT_CALC);
  }, []);

  const value = useMemo(
    () => ({ profile, setProfile, salaries, setSalaries, calc, setCalc, resetAll, storageOk }),
    [profile, setProfile, salaries, setSalaries, calc, setCalc, resetAll, storageOk],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuera de AppProvider');
  return v;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
