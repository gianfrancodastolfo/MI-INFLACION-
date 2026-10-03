/**
 * Secciones de "Mi sueldo" con referencias oficiales: índice de salarios, canasta básica, salario mínimo,
 * jubilación mínima y RIPTE. Las cuentas con tu sueldo se hacen en el navegador y no se guardan aparte.
 */
import { useMemo, useState } from 'react';
import { type Member, type Period, addMonths, comparePeriods, formatPeriod, maxPeriod, minPeriod, periodOfDate, periodRange, priceFactor } from '../../engine';
import { LAST_PERIOD, getSeries } from '../../domain/data';
import { formatMoney, formatNumber, formatPct, formatSignedPct } from '../../domain/format';
import {
  BONO_PREVISIONAL, CANASTA_LAST, HABER_MINIMO_LAST, HABER_MINIMO_NEXT, HABER_RULE_MISSES, HOGARES_TIPO, INGRESOS, SMVM_NORMA, WAGE_FIRST, WAGE_INDEX_NAMES,
  WAGE_INDEX_SHORT, WAGE_LAST, type WageIndexId, bonoFor, compareRaise, haberMinimoAt, householdCanasta, ripteAt, smvmAt,
} from '../../domain/ingresos';
import { Legend, LineChart, type LineSeries } from '../charts';
import { Explain, MoneyInput, MonthPicker, Notice, SourceBadge, Tile } from '../components';
import type { SalaryEntry } from '../state';

const IPC = getSeries('nacional', 'nivel_general')!;

function ipcBetween(from: Period, to: Period): number | undefined {
  const f = priceFactor(IPC, from, minPeriod(to, LAST_PERIOD));
  return f.ok ? f.value - 1 : undefined;
}

/** "¿Le ganaste al promedio?" */
export function WageIndexSection({ salaries }: { salaries: SalaryEntry[] }) {
  const inRange = salaries.filter((s) => comparePeriods(s.period, WAGE_FIRST) >= 0);
  const firstS = inRange[0];
  const lastS = inRange[inRange.length - 1];
  const [from, setFrom] = useState<Period>(firstS ? minPeriod(firstS.period, addMonths(WAGE_LAST, -1)) : addMonths(WAGE_LAST, -12));
  const [to, setTo] = useState<Period>(lastS && lastS !== firstS ? minPeriod(lastS.period, WAGE_LAST) : WAGE_LAST);
  const [s0, setS0] = useState<number | null>(firstS?.net ?? null);
  const [s1, setS1] = useState<number | null>(lastS && lastS !== firstS ? lastS.net : null);
  const [id, setId] = useState<WageIndexId>('privado_registrado');
  const cmp = s0 && s1 ? compareRaise(s0, s1, from, to, id) : undefined;
  const all = s0 && s1 ? (Object.keys(WAGE_INDEX_NAMES) as WageIndexId[]).map((k) => ({ k, c: compareRaise(s0, s1, from, to, k) })) : [];
  const infl = ipcBetween(from, to);

  return (
    <section className="card stack" aria-labelledby="wage-h">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="wage-h" style={{ fontSize: 'var(--step-2)' }}>¿Le ganaste al promedio?</h2>
        <SourceBadge kind="oficial">Índice de salarios · INDEC</SourceBadge>
      </div>
      <p className="muted">Compará tu aumento con el de los salarios en general. INDEC mide cuánto subieron los sueldos de privados registrados, públicos y no registrados.</p>
      <div className="fields-2">
        <MonthPicker id="wage-from" label="Desde" value={from} min={WAGE_FIRST} max={addMonths(WAGE_LAST, -1)} onChange={setFrom} />
        <MonthPicker id="wage-to" label="Hasta" value={to} min={addMonths(WAGE_FIRST, 1)} max={WAGE_LAST} onChange={setTo} />
      </div>
      <div className="fields-2">
        <div className="field"><label htmlFor="wage-s0">Tu sueldo en {formatPeriod(from)}</label><MoneyInput id="wage-s0" value={s0} onChange={setS0} /></div>
        <div className="field"><label htmlFor="wage-s1">Tu sueldo en {formatPeriod(to)}</label><MoneyInput id="wage-s1" value={s1} onChange={setS1} /></div>
      </div>
      <div className="field">
        <label htmlFor="wage-id">Comparar con</label>
        <select id="wage-id" className="select" value={id} onChange={(e) => setId(e.target.value as WageIndexId)}>
          {(Object.keys(WAGE_INDEX_NAMES) as WageIndexId[]).map((k) => <option key={k} value={k}>{WAGE_INDEX_NAMES[k]}</option>)}
        </select>
      </div>
      {comparePeriods(from, to) >= 0 ? (
        <Notice tone="warn">El mes "desde" tiene que ser anterior al mes "hasta".</Notice>
      ) : cmp ? (
        <>
          <div className="tiles">
            <Tile keyKind="sueldo" label="Tu aumento" value={formatPct(cmp.mine)} sub={`${formatPeriod(from)} → ${formatPeriod(to)}`} />
            <Tile label={`Promedio: ${WAGE_INDEX_SHORT[id].toLowerCase()}`} value={formatPct(cmp.index)} sub="Índice de salarios de INDEC" />
            <Tile label="Contra el promedio" value={formatSignedPct(cmp.relative)} sub={cmp.relative >= 0 ? 'Te fue mejor que al promedio' : 'Te fue peor que al promedio'} />
            {infl != null && <Tile keyKind="oficial" label="Inflación del período" value={formatPct(infl)} sub={`Poder adquisitivo: ${formatSignedPct((1 + cmp.mine) / (1 + infl) - 1)}`} />}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Grupo</th><th className="n">Aumento</th><th className="n">Tu sueldo contra ese grupo</th></tr></thead>
              <tbody>
                {all.map(({ k, c }) => c && (
                  <tr key={k}><td>{WAGE_INDEX_NAMES[k]}</td><td className="n">{formatPct(c.index)}</td><td className="n"><span className={c.relative >= 0 ? 'delta-good' : 'delta-bad'}>{formatSignedPct(c.relative)}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="small muted">Cargá los dos sueldos para comparar.{!salaries.length && ' Si los agregás arriba, se completan solos.'}</p>
      )}
      <Explain>
        <p><strong>Índice de salarios (INDEC, base octubre 2016 = 100):</strong> mide cómo cambian los salarios de un mismo puesto. El último dato es de {formatPeriod(WAGE_LAST, 'long')}; INDEC lo publica con unos dos meses de demora.</p>
        <p>El dato de <strong>no registrados</strong> tiene cinco meses de rezago según INDEC: lo que figura para un mes refleja salarios de meses anteriores.</p>
        <p>"Contra el promedio" = (1 + tu aumento) ÷ (1 + aumento del grupo) − 1. Si da positivo, tu sueldo subió más que el de ese grupo.</p>
      </Explain>
    </section>
  );
}

const PRESETS: Array<{ id: string; label: string; members: Member[] }> = [
  { id: 'solo', label: 'Solo yo (adulto de 30 a 45)', members: [{ sexo: 'varon', edad: 35 }] },
  ...HOGARES_TIPO.map((h) => ({ id: h.id, label: h.label, members: h.members })),
];

/** "¿Cuántas canastas cubre tu sueldo?" */
export function CanastaSection({ salaries }: { salaries: SalaryEntry[] }) {
  const latest = salaries[salaries.length - 1];
  const [members, setMembers] = useState<Member[]>(HOGARES_TIPO[1]!.members);
  const [income, setIncome] = useState<number | null>(latest?.net ?? null);
  const hc = householdCanasta(members, CANASTA_LAST);
  const cover = income && hc ? income / hc.cbt : undefined;
  const setMember = (i: number, patch: Partial<Member>) => setMembers(members.map((m, k) => (k === i ? { ...m, ...patch } : m)));

  return (
    <section className="card stack" aria-labelledby="cba-h">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="cba-h" style={{ fontSize: 'var(--step-2)' }}>¿Cuántas canastas básicas cubre tu ingreso?</h2>
        <SourceBadge kind="oficial">Canasta básica · INDEC</SourceBadge>
      </div>
      <p className="muted">La canasta básica total (CBT) es lo que INDEC usa como línea de pobreza. Depende de quiénes viven en el hogar: un chico de 6 años "cuenta" 0,64 de un adulto.</p>
      <div className="row" role="group" aria-label="Hogares de ejemplo">
        {PRESETS.map((p) => <button key={p.id} type="button" className="btn secondary small" onClick={() => setMembers(p.members)}>{p.label}</button>)}
      </div>
      <div className="members">
        {members.map((m, i) => (
          <div className="member" key={i}>
            <div className="field">
              <label htmlFor={`mem-s-${i}`}>Integrante {i + 1}</label>
              <select id={`mem-s-${i}`} className="select" value={m.sexo} onChange={(e) => setMember(i, { sexo: e.target.value as Member['sexo'] })}>
                <option value="mujer">Mujer</option><option value="varon">Varón</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`mem-e-${i}`}>Edad</label>
              <input id={`mem-e-${i}`} className="input" inputMode="numeric" value={m.edad} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); setMember(i, { edad: Number.isFinite(n) ? Math.min(110, n) : 0 }); }} />
            </div>
            {members.length > 1 && <button type="button" className="linkbtn small" onClick={() => setMembers(members.filter((_, k) => k !== i))}>Quitar</button>}
          </div>
        ))}
        <div><button type="button" className="linkbtn small" onClick={() => setMembers([...members, { sexo: 'mujer', edad: 30 }])}>+ Agregar integrante</button></div>
      </div>
      <div className="field">
        <label htmlFor="cba-income">Ingreso total del hogar en {formatPeriod(CANASTA_LAST, 'long')}</label>
        <MoneyInput id="cba-income" value={income} onChange={setIncome} />
      </div>
      {hc && (
        <div className="tiles">
          <Tile label="Canasta básica total del hogar" value={formatMoney(hc.cbt)} sub={`${formatNumber(hc.units, 2)} adultos equivalentes · ${formatPeriod(hc.period)}`} />
          <Tile label="Canasta alimentaria (indigencia)" value={formatMoney(hc.cba)} sub="Solo alimentos" />
          {cover != null && <Tile keyKind="sueldo" label="Tu ingreso cubre" value={`${formatNumber(cover, 2)} canastas`} sub={cover >= 1 ? `Sobran ${formatMoney(income! - hc.cbt)}` : `Faltan ${formatMoney(hc.cbt - income!)} para la línea de pobreza`} />}
        </div>
      )}
      <Explain>
        <p><strong>Valores de Gran Buenos Aires.</strong> INDEC publica todos los meses la canasta de GBA, por adulto equivalente (CBT {formatMoney(hc ? hc.cbt / hc.units : 0)} en {formatPeriod(CANASTA_LAST, 'long')}). Para otras regiones los valores son distintos y se publican con menos frecuencia.</p>
        <p>Las unidades de adulto equivalente son las del cuadro de INDEC (por sexo y edad). Con ellas se reproducen exactamente los hogares tipo de sus informes.</p>
        <p>La comparación es con el ingreso total del hogar, no solo con tu sueldo.</p>
      </Explain>
    </section>
  );
}

/** Texto del bono bajo la jubilación mínima: se suma solo en el mes que tiene decreto. */
function bonoSub(h: { period: Period; amount: number }): string {
  const b = bonoFor(h.period);
  return b != null
    ? `Con el bono de ${formatMoney(b)}: ${formatMoney(h.amount + b)}`
    : `Más el bono del mes (el de ${formatPeriod(BONO_PREVISIONAL.period)}: ${formatMoney(BONO_PREVISIONAL.amount)})`;
}

/** Salario mínimo, jubilación mínima y RIPTE. */
export function ReferenciasSection({ salaries }: { salaries: SalaryEntry[] }) {
  const thisMonth = periodOfDate(new Date());
  const smvmNow = smvmAt(thisMonth) ?? smvmAt(LAST_PERIOD);
  const latest = salaries[salaries.length - 1];
  const haber = haberMinimoAt(HABER_MINIMO_LAST);
  // Mes siguiente calculado con la regla; si no se puede, el último dato oficial.
  const haberShown = HABER_MINIMO_NEXT ?? (haber ? { period: HABER_MINIMO_LAST, amount: haber } : undefined);
  const ripteLast = (() => { let p = thisMonth; for (let k = 0; k < 6; k++, p = addMonths(p, -1)) if (ripteAt(p)) return p; return undefined; })();
  const base: Period = '2023-11';
  const upTo = LAST_PERIOD;
  const realSmvm = (() => { const a = smvmAt(base); const b = smvmAt(upTo); const i = ipcBetween(base, upTo); return a && b && i != null ? (b / a) / (1 + i) - 1 : undefined; })();
  const realHaber = (() => { const a = haberMinimoAt(base); const b = haberMinimoAt(minPeriod(upTo, HABER_MINIMO_LAST)); const i = ipcBetween(base, minPeriod(upTo, HABER_MINIMO_LAST)); return a && b && i != null ? (b / a) / (1 + i) - 1 : undefined; })();
  const schedule = periodRange(maxPeriod(thisMonth, '2026-09'), INGRESOS.smvm.start ? addMonths(INGRESOS.smvm.start, INGRESOS.smvm.values.length - 1) : thisMonth);

  const lines: LineSeries[] = useMemo(() => {
    const months = periodRange('2016-12', LAST_PERIOD);
    const real = (get: (p: Period) => number | undefined) => {
      const a = get('2016-12');
      return months.map((p) => { const v = get(p); const i = ipcBetween('2016-12', p); return { period: p, value: a && v && i != null ? (v / a / (1 + i)) * 100 : null }; });
    };
    return [
      { id: 'smvm', label: 'Salario mínimo', color: 'sueldo', points: real(smvmAt) },
      { id: 'haber', label: 'Jubilación mínima (sin bono)', color: 'ink', points: real(haberMinimoAt) },
    ];
  }, []);

  return (
    <section className="card stack" aria-labelledby="ref-h">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="ref-h" style={{ fontSize: 'var(--step-2)' }}>Salario mínimo, jubilación mínima y sueldo promedio</h2>
        <SourceBadge kind="oficial">Datos oficiales</SourceBadge>
      </div>
      <div className="tiles">
        {smvmNow && <Tile label={`Salario mínimo (${formatPeriod(smvmAt(thisMonth) ? thisMonth : LAST_PERIOD)})`} value={formatMoney(smvmNow)} sub={latest ? `Tu sueldo equivale a ${formatNumber(latest.net / smvmNow, 1)} salarios mínimos` : 'Jornada completa, por mes'} />}
        {haberShown && <Tile label={`Jubilación mínima (${formatPeriod(haberShown.period)})`} value={formatMoney(haberShown.amount)} sub={bonoSub(haberShown)} />}
        {ripteLast && <Tile label={`Sueldo promedio registrado, RIPTE (${formatPeriod(ripteLast)})`} value={formatMoney(ripteAt(ripteLast)!)} sub="Bruto, trabajadores estables" />}
      </div>
      {(realSmvm != null || realHaber != null) && (
        <p>
          Desde noviembre de 2023 y descontando la inflación, el salario mínimo {realSmvm != null && <>varió <strong>{formatSignedPct(realSmvm)}</strong></>} y la jubilación mínima sin bono {realHaber != null && <><strong>{formatSignedPct(realHaber)}</strong></>}.
          {' '}El bono es fijo en pesos: <a href="https://chequeado.com/nota/las-jubilaciones-aumentaran-17-en-octubre-de-2026-la-minima-con-bono-pierde-94-frente-a-noviembre-de-2023" target="_blank" rel="noreferrer">según Chequeado</a>, en octubre de 2026 la mínima con bono pierde 9,4% frente a noviembre de 2023.
        </p>
      )}
      <Legend items={lines.map((l) => ({ label: l.label, color: l.color }))} />
      <LineChart series={lines} yFormat={(v) => formatNumber(v, 0)} ariaLabel="Poder de compra del salario mínimo y la jubilación mínima, base diciembre 2016 = 100" reference={{ value: 100, label: 'dic-2016' }} />
      <p className="small muted">Poder de compra con base diciembre 2016 = 100, descontando el IPC nacional de INDEC (cálculo de la app). Por debajo de 100, compra menos que entonces.</p>
      {schedule.length > 1 && (
        <Explain title="Cronograma del salario mínimo">
          <p>{SMVM_NORMA.name}:</p>
          <ul>{schedule.map((p) => smvmAt(p) && <li key={p}>{formatPeriod(p, 'long')}: {formatMoney(smvmAt(p)!)}</li>)}</ul>
        </Explain>
      )}
      <Notice>
        <span>
          {HABER_MINIMO_NEXT && haber
            ? <>La jubilación mínima de {formatPeriod(HABER_MINIMO_NEXT.period, 'long')} es un cálculo de la app con la regla de movilidad (Decreto 274/2024): el haber de {formatPeriod(HABER_MINIMO_LAST, 'long')} ({formatMoney(haber)}, dato oficial) más {formatNumber(HABER_MINIMO_NEXT.rate, 2)}%, la inflación de {formatPeriod(HABER_MINIMO_NEXT.ipcPeriod, 'long')}. {HABER_RULE_MISSES.length === 0 ? 'La regla da al centavo todos los meses publicados desde mayo de 2024.' : 'La regla da al centavo el último dato oficial.'} </>
            : HABER_RULE_MISSES.includes(HABER_MINIMO_LAST)
              ? <>El dato oficial de {formatPeriod(HABER_MINIMO_LAST, 'long')} no coincide con la regla de movilidad (Decreto 274/2024), así que la app no calcula el mes siguiente. </>
              : <>Cada mes la jubilación sube por movilidad la inflación de dos meses antes (Decreto 274/2024). </>}
          {BONO_PREVISIONAL.note}{' '}
          <a href={BONO_PREVISIONAL.source} target="_blank" rel="noreferrer">Fuente del bono</a>.
        </span>
      </Notice>
    </section>
  );
}
