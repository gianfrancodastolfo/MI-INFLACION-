import { useMemo, useState } from 'react';
import {
  type Period, addMonths, basketCost, calculateRealVariation, comparePeriods, diffMonths, formatPeriod, maxPeriod, minPeriod, periodOfDate,
  periodRange, valueAt,
} from '../../engine';
import { FIRST_PERIOD, LAST_PERIOD, getSeries } from '../../domain/data';
import { formatMoney, formatMoneyCompact, formatPct, formatSignedPct } from '../../domain/format';
import { buildBasket, isProfileComplete } from '../../domain/profile';
import { REGION_NAMES, type RegionId } from '../../domain/regions';
import { Legend, LineChart, type LineSeries } from '../charts';
import { Empty, Explain, MoneyInput, MonthPicker, Notice, Segmented, SourceBadge, Tile } from '../components';
import { Link } from '../router';
import { type SalaryEntry, newId, useApp } from '../state';
import { CanastaSection, ReferenciasSection, WageIndexSection } from './MiSueldoExtras';

type Range = '3' | '6' | '12' | '24' | '60' | 'all';

/** Índices para valuar sueldos: IPC (región del perfil o nacional) y canasta personal si existe. */
export function useSalaryModel(entries: SalaryEntry[], baseId?: string) {
  const { profile } = useApp();
  const has = isProfileComplete(profile);
  const pb = has ? buildBasket(profile!) : undefined;
  const region: RegionId = pb?.region ?? 'nacional';
  const general = getSeries(region, 'nivel_general')!;
  const base = entries.find((e) => e.id === baseId) ?? entries[0];

  const officialFactor = (p: Period): number | null => {
    if (!base) return null;
    const a = valueAt(general, base.period);
    const b = valueAt(general, p);
    return a.ok && b.ok ? b.value / a.value : null;
  };
  const personalFactor = (p: Period): number | null => {
    if (!base || !pb) return null;
    const a = basketCost(pb.basket, pb.indices, base.period);
    const b = basketCost(pb.basket, pb.indices, p);
    return a.ok && b.ok ? b.value / a.value : null;
  };
  return { base, region, hasPersonal: !!pb, officialFactor, personalFactor };
}

export function salaryChartSeries(entries: SalaryEntry[], model: ReturnType<typeof useSalaryModel>, range: Range = 'all'): LineSeries[] {
  const { base } = model;
  if (!base || entries.length === 0) return [];
  const last = entries[entries.length - 1]!.period;
  const end = maxPeriod(last, base.period);
  let start = base.period;
  if (range !== 'all') start = maxPeriod(base.period, addMonths(end, -Number(range)));
  const months = periodRange(start, end);
  // Sueldo nominal: se mantiene el último monto cargado hasta el siguiente.
  const nominal = months.map((p) => {
    const e = [...entries].reverse().find((x) => comparePeriods(x.period, p) <= 0);
    return { period: p, value: e ? e.net : null };
  });
  const out: LineSeries[] = [
    { id: 'sueldo', label: 'Mi sueldo', color: 'sueldo', points: nominal },
    {
      id: 'oficial', label: `Equivalente IPC ${model.region === 'nacional' ? 'nacional' : REGION_NAMES[model.region]}`, color: 'oficial',
      points: months.map((p) => { const f = model.officialFactor(p); return { period: p, value: f == null ? null : base.net * f }; }),
    },
  ];
  if (model.hasPersonal) {
    out.push({
      id: 'personal', label: 'Equivalente con mi inflación', color: 'personal',
      points: months.map((p) => { const f = model.personalFactor(p); return { period: p, value: f == null ? null : base.net * f }; }),
    });
  }
  return out;
}

export function MiSueldo() {
  const { salaries, setSalaries } = useApp();
  const [period, setPeriod] = useState<Period>(minPeriod(LAST_PERIOD, periodOfDate(new Date())));
  const [net, setNet] = useState<number | null>(null);
  const [gross, setGross] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [baseId, setBaseId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<Range>('all');
  const model = useSalaryModel(salaries, baseId);
  const series = useMemo(() => salaryChartSeries(salaries, model, range), [salaries, model, range]);
  const maxEntry = periodOfDate(new Date());

  const add = () => {
    if (!net) return;
    const rest = salaries.filter((s) => s.period !== period);
    setSalaries([...rest, { id: newId(), period, net, gross: gross ?? undefined, note: note.trim() || undefined }]);
    setNet(null); setGross(null); setNote('');
  };

  const latest = [...salaries].reverse().find((s) => model.officialFactor(s.period) != null);
  const base = model.base;
  const summary = latest && base && latest.id !== base.id ? (() => {
    const fo = model.officialFactor(latest.period)!;
    const fp = model.personalFactor(latest.period);
    const nominal = latest.net / base.net;
    return { fo, fp, nominal, realO: calculateRealVariation(nominal, fo), realP: fp ? calculateRealVariation(nominal, fp) : null };
  })() : null;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Mi sueldo</span>
        <h1>Mi sueldo en el tiempo</h1>
        <p className="lede">Cargá lo que cobraste en distintos momentos. Vas a ver cuánto deberías cobrar para mantener el poder adquisitivo, según el IPC y según tu inflación.</p>
      </header>

      <div className="grid-2">
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <h2 style={{ fontSize: 'var(--step-2)' }}>Agregar un sueldo</h2>
          <MonthPicker id="sal-period" label="Mes" value={period} min={FIRST_PERIOD} max={maxEntry} onChange={setPeriod} />
          <div className="fields-2">
            <div className="field">
              <label htmlFor="sal-net">Sueldo neto (de bolsillo)</label>
              <MoneyInput id="sal-net" value={net} onChange={setNet} />
            </div>
            <div className="field">
              <label htmlFor="sal-gross">Sueldo bruto (opcional)</label>
              <MoneyInput id="sal-gross" value={gross} onChange={setGross} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="sal-note">Observación (opcional)</label>
            <input id="sal-note" className="input" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: aumento por paritaria" />
          </div>
          <div><button type="submit" className="btn" disabled={!net}>Agregar</button></div>
          <p className="small muted">Moneda: pesos. Si ya hay un sueldo en ese mes, se reemplaza. Se guarda solo en este navegador.</p>
          {comparePeriods(period, LAST_PERIOD) > 0 && <Notice>Para {formatPeriod(period, 'long')} todavía no hay dato oficial: el sueldo se guarda, pero el equivalente aparece cuando INDEC publique ese mes.</Notice>}
        </form>

        <div className="stack">
          {salaries.length === 0 ? (
            <Empty title="Todavía no cargaste sueldos">
              Por ejemplo: enero 2024 → $500.000, junio 2024 → $650.000, enero 2025 → $900.000. Con dos o más sueldos ya ves si le ganaste a la inflación.
            </Empty>
          ) : (
            <>
              {summary && base && latest && (
                <div className="tiles">
                  <Tile keyKind="sueldo" label="Aumento de tu sueldo" value={formatSignedPct(summary.nominal - 1)} sub={`${formatPeriod(base.period)} → ${formatPeriod(latest.period)}`} />
                  <Tile keyKind="oficial" label="Inflación (IPC)" value={formatPct(summary.fo - 1)} sub={`Poder adquisitivo: ${formatSignedPct(summary.realO)}`} />
                  {summary.fp != null && summary.realP != null && <Tile keyKind="personal" label="Tu inflación" value={formatPct(summary.fp - 1)} sub={`Poder adquisitivo: ${formatSignedPct(summary.realP)}`} />}
                </div>
              )}
              {summary && (
                <p>
                  Tu sueldo aumentó {formatPct(summary.nominal - 1)}, pero los precios {summary.fp != null ? 'relevantes para tu perfil' : 'del IPC'} aumentaron {formatPct((summary.fp ?? summary.fo) - 1)}.
                  En términos reales, tu poder adquisitivo {(summary.realP ?? summary.realO) >= 0 ? 'aumentó' : 'disminuyó'} aproximadamente {formatPct(Math.abs(summary.realP ?? summary.realO))}.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {salaries.length > 0 && (
        <>
          <section className="card stack" aria-labelledby="sal-ch">
            <div className="section-head">
              <h2 id="sal-ch" style={{ fontSize: 'var(--step-2)' }}>Sueldo nominal y sueldo necesario</h2>
              <Segmented label="Rango" value={range} onChange={setRange} options={[
                { value: '3', label: '3 meses' }, { value: '6', label: '6 meses' }, { value: '12', label: '1 año' },
                { value: '24', label: '2 años' }, { value: '60', label: '5 años' }, { value: 'all', label: 'Todo' },
              ]} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
              {salaries.length > 1 && (
                <label className="small row" htmlFor="sal-base" style={{ gap: 6 }}>
                  Comparar contra
                  <select id="sal-base" className="select" style={{ minHeight: 34, width: 'auto', fontSize: 'var(--step--1)' }} value={base?.id} onChange={(e) => setBaseId(e.target.value)}>
                    {salaries.map((s) => <option key={s.id} value={s.id}>{formatPeriod(s.period)} · {formatMoney(s.net)}</option>)}
                  </select>
                </label>
              )}
            </div>
            {series.length > 0 && diffMonths(series[0]!.points[0]!.period, series[0]!.points[series[0]!.points.length - 1]!.period) > 0 ? (
              <LineChart series={series} yFormat={formatMoneyCompact} tipFormat={formatMoney} ariaLabel="Sueldo nominal y sueldos equivalentes" />
            ) : (
              <p className="small muted">Agregá un sueldo de otro mes para ver la evolución.</p>
            )}
            <p className="small muted">El sueldo necesario parte del sueldo de {base ? formatPeriod(base.period, 'long') : '—'} y lo actualiza mes a mes con cada índice. Entre un sueldo cargado y el siguiente se toma el último monto.</p>
          </section>

          <section className="card stack" aria-labelledby="sal-tb">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="sal-tb" style={{ fontSize: 'var(--step-2)' }}>Tus sueldos</h2>
              <SourceBadge kind="calculo" />
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th className="n">Sueldo</th><th className="n">Equivalente IPC</th>{model.hasPersonal && <th className="n">Equivalente personal</th>}<th className="n">Poder adquisitivo</th><th>Nota</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {salaries.map((s) => {
                    const fo = model.officialFactor(s.period);
                    const fp = model.personalFactor(s.period);
                    const eqO = fo != null && base ? base.net * fo : null;
                    const eqP = fp != null && base ? base.net * fp : null;
                    const real = eqO ? s.net / eqO - 1 : null;
                    return (
                      <tr key={s.id}>
                        <td>{formatPeriod(s.period)}</td>
                        <td className="n">{formatMoney(s.net)}{s.gross ? <span className="muted"> · bruto {formatMoney(s.gross)}</span> : null}</td>
                        <td className="n">{eqO ? formatMoney(eqO) : 'sin dato'}</td>
                        {model.hasPersonal && <td className="n">{eqP ? formatMoney(eqP) : 'sin dato'}</td>}
                        <td className="n">{s.id === base?.id ? 'base' : real == null ? '—' : <span className={real >= 0 ? 'delta-good' : 'delta-bad'}>{formatSignedPct(real)}</span>}</td>
                        <td>{s.note ?? ''}</td>
                        <td><button type="button" className="linkbtn small" onClick={() => setSalaries(salaries.filter((x) => x.id !== s.id))}>Quitar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Explain>
              <p><strong>Sueldo nominal:</strong> lo que cobrabas en pesos de cada momento.</p>
              <p><strong>Sueldo equivalente:</strong> el sueldo base actualizado por la inflación hasta cada fecha. Si tu sueldo está por encima, ganaste poder adquisitivo.</p>
              <p><strong>Poder adquisitivo:</strong> (sueldo ÷ sueldo equivalente) − 1, usando el IPC {model.region === 'nacional' ? 'nacional' : `de ${REGION_NAMES[model.region]}`}. {!model.hasPersonal && <>Para verlo con tu inflación, <Link to="mi-inflacion">calculá tu perfil</Link>.</>}</p>
            </Explain>
          </section>
        </>
      )}
      <WageIndexSection key={`w-${salaries.length}`} salaries={salaries} />
      <CanastaSection key={`c-${salaries.length}`} salaries={salaries} />
      <ReferenciasSection salaries={salaries} />
    </>
  );
}
