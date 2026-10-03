import { useMemo, useState } from 'react';
import { addMonths, formatPeriod, periodRange, personalIndexSeries } from '../../engine';
import { DIVISION_BY_ID, RUBROS } from '../../domain/categories';
import { categoryChanges, compareProfile } from '../../domain/calculations';
import { LAST_PERIOD, getSeries } from '../../domain/data';
import { formatMoney, formatMoneyCompact, formatPct, formatPP, formatSignedPct } from '../../domain/format';
import { buildBasket, isProfileComplete, rubroAmount, totalSpending } from '../../domain/profile';
import { REGION_NAMES } from '../../domain/regions';
import { exportAll } from '../../domain/storage';
import { BarList, Legend, LineChart } from '../charts';
import { Empty, Notice, SourceBadge, Tile } from '../components';
import { Link } from '../router';
import { useApp } from '../state';
import { salaryChartSeries, useSalaryModel } from './MiSueldo';

declare const __ROUTER_MODE__: 'history' | 'hash' | undefined;

export function Panel() {
  const { profile, salaries, resetAll } = useApp();
  const has = isProfileComplete(profile);
  const from = addMonths(LAST_PERIOD, -12);
  const cmp = useMemo(() => (has ? compareProfile(profile!, from, LAST_PERIOD) : null), [has, profile, from]);
  const model = useSalaryModel(salaries);
  const salarySeries = useMemo(() => salaryChartSeries(salaries, model, 'all'), [salaries, model]);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const latest = salaries[salaries.length - 1];
  const latestWithData = [...salaries].reverse().find((s) => model.officialFactor(s.period) != null);
  const eqO = latestWithData && model.base ? model.base.net * model.officialFactor(latestWithData.period)! : null;
  const fp = latestWithData ? model.personalFactor(latestWithData.period) : null;
  const eqP = fp != null && model.base ? model.base.net * fp : null;
  const region = cmp?.ok ? cmp.value.region : 'nacional';
  const published = cmp?.ok ? cmp.value.published?.inflation ?? cmp.value.official.inflation : null;

  const lines = useMemo(() => {
    if (!cmp?.ok || !profile) return null;
    const pb = buildBasket(profile);
    const g = getSeries(cmp.value.region, 'nivel_general');
    if (!pb || !g) return null;
    const pi = personalIndexSeries(pb.basket, pb.indices, from, LAST_PERIOD, from);
    if (!pi.ok) return null;
    const idx = (p: string) => g.values[periodRange(g.start, p).length - 1] ?? null;
    const g0 = idx(from)!;
    return [
      { id: 'o', label: `IPC ${REGION_NAMES[cmp.value.region]}`, color: 'oficial' as const, points: periodRange(from, LAST_PERIOD).map((p) => ({ period: p, value: (idx(p) ?? NaN) / g0 - 1 })) },
      { id: 'p', label: 'Mi inflación', color: 'personal' as const, points: pi.value.map((x) => ({ period: x.period, value: x.value / 100 - 1 })) },
    ];
  }, [cmp, profile, from]);

  const changes = useMemo(() => categoryChanges(region, from, LAST_PERIOD), [region, from]);
  const total = profile ? totalSpending(profile) : 0;

  const copyData = async () => {
    const text = JSON.stringify(exportAll(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copiado. Pegalo en un archivo de texto para guardarlo.');
    } catch {
      setCopied(text);
    }
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mi-inflacion-datos.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const canDownload = typeof __ROUTER_MODE__ === 'undefined' || __ROUTER_MODE__ !== 'hash';

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Panel · últimos 12 meses ({formatPeriod(from)} → {formatPeriod(LAST_PERIOD)})</span>
        <h1>Mi situación</h1>
      </header>

      {!has && salaries.length === 0 ? (
        <div className="grid-2 even">
          <Empty title="1. Calculá tu inflación" action={<Link to="mi-inflacion" className="btn">Cargar mis gastos</Link>}>Tu provincia y cuánto gastás por mes en cada rubro.</Empty>
          <Empty title="2. Cargá tu sueldo" action={<Link to="mi-sueldo" className="btn secondary">Cargar sueldos</Link>}>Al menos dos meses para ver si le ganaste a la inflación.</Empty>
        </div>
      ) : (
        <div className="stack">
          {latest && (
            <section className="section" aria-label="Mi sueldo">
              <span className="eyebrow">Mi sueldo</span>
              <div className="tiles">
                <Tile keyKind="sueldo" label="Sueldo actual" value={formatMoney(latest.net)} sub={formatPeriod(latest.period, 'long')} />
                {eqO != null && model.base && <Tile keyKind="oficial" label="Sueldo equivalente IPC" value={formatMoney(eqO)} sub={`Para vivir como en ${formatPeriod(model.base.period)}`} />}
                {eqP != null && <Tile keyKind="personal" label="Sueldo equivalente personal" value={formatMoney(eqP)} sub={`Para vivir como en ${formatPeriod(model.base!.period)}`} />}
                {latestWithData && eqO && model.base && latestWithData.id !== model.base.id && (() => {
                  const pp = latestWithData.net / (eqP ?? eqO) - 1;
                  return <Tile label="Poder adquisitivo" value={<span className={pp >= 0 ? 'delta-good' : 'delta-bad'}>{pp >= 0 ? '▲' : '▼'} {formatSignedPct(pp)}</span>} sub={eqP ? 'Contra tu inflación' : 'Contra el IPC'} />;
                })()}
              </div>
            </section>
          )}
          {cmp?.ok && published != null && (
            <section className="section" aria-label="Mi inflación">
              <span className="eyebrow">Inflación · últimos 12 meses</span>
              <div className="tiles">
                <Tile keyKind="personal" label="Inflación personal" value={formatPct(cmp.value.personal.inflation)} sub="Estimación con tus gastos" />
                <Tile keyKind="oficial" label={`IPC ${REGION_NAMES[region]}`} value={formatPct(published)} sub="Dato oficial de INDEC" />
                <Tile label="Diferencia" value={formatPP(cmp.value.personal.inflation - published)} sub="Tu inflación menos el IPC" />
              </div>
            </section>
          )}
        </div>
      )}

      <div className="grid-2 even">
        <section className="card stack" aria-labelledby="p-sal">
          <h2 id="p-sal" style={{ fontSize: 'var(--step-2)' }}>Evolución de mi sueldo</h2>
          {salarySeries.length > 0 && salaries.length > 1 ? (
            <>
              <Legend items={salarySeries.map((s) => ({ label: s.label, color: s.color }))} />
              <LineChart series={salarySeries} height={220} endLabels={false} yFormat={formatMoneyCompact} tipFormat={formatMoney} ariaLabel="Evolución de mi sueldo y sueldos equivalentes" />
            </>
          ) : (
            <p className="muted small">Cargá al menos dos sueldos en <Link to="mi-sueldo">Mi sueldo</Link>.</p>
          )}
        </section>

        <section className="card stack" aria-labelledby="p-inf">
          <h2 id="p-inf" style={{ fontSize: 'var(--step-2)' }}>Mi inflación vs INDEC</h2>
          {lines ? (
            <>
              <Legend items={lines.map((l) => ({ label: l.label, color: l.color }))} />
              <LineChart series={lines} height={220} endLabels={false} yFormat={(v) => formatPct(v, 0)} tipFormat={(v) => formatPct(v)} ariaLabel="Inflación acumulada en 12 meses" />
            </>
          ) : (
            <p className="muted small"><Link to="mi-inflacion">Calculá tu inflación</Link> para comparar.</p>
          )}
        </section>

        <section className="card stack" aria-labelledby="p-gas">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="p-gas" style={{ fontSize: 'var(--step-2)' }}>¿En qué gasto mi sueldo?</h2>
            <SourceBadge kind="estimacion">Tus datos</SourceBadge>
          </div>
          {has && total > 0 ? (
            <>
              <BarList
                ariaLabel="Participación de cada rubro en tu gasto"
                rows={RUBROS.map((r) => ({ id: r.id, label: DIVISION_BY_ID[r.id].short, value: rubroAmount(profile!, r.id) / total, color: 'personal' as const }))
                  .filter((r) => r.value > 0).sort((a, b) => b.value - a.value)}
                format={(v) => formatPct(v)}
              />
              {latest && <p className="small muted">Tu gasto cargado ({formatMoney(total)}) equivale al {formatPct(total / latest.net, 0)} de tu último sueldo.</p>}
            </>
          ) : (
            <p className="muted small">Sin perfil de gastos todavía.</p>
          )}
        </section>

        <section className="card stack" aria-labelledby="p-mas">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="p-mas" style={{ fontSize: 'var(--step-2)' }}>¿Qué aumentó más?</h2>
            <SourceBadge kind="oficial" />
          </div>
          {changes.ok && (
            <BarList ariaLabel="Variación por categoría, últimos 12 meses" rows={changes.value.slice(0, 6).map((c) => ({ id: c.division, label: DIVISION_BY_ID[c.division].short, value: c.inflation, color: 'oficial' }))} format={(v) => formatPct(v)} />
          )}
          <p className="small muted">{REGION_NAMES[region]} · 6 categorías con mayor suba en 12 meses.</p>
        </section>
      </div>

      <section className="card stack" aria-labelledby="p-data">
        <h2 id="p-data" style={{ fontSize: 'var(--step-2)' }}>Mis datos</h2>
        <p className="small muted">Todo lo que cargaste está guardado solo en este navegador. Podés copiarlo o borrarlo cuando quieras.</p>
        <div className="row">
          <button type="button" className="btn secondary small" onClick={copyData}>Copiar mis datos</button>
          {canDownload && <button type="button" className="btn secondary small" onClick={download}>Descargar JSON</button>}
          {!confirm ? (
            <button type="button" className="btn danger small" onClick={() => setConfirm(true)}>Borrar todos mis datos</button>
          ) : (
            <span className="row">
              <span className="small">Se borran perfil, sueldos y cálculos de este navegador.</span>
              <button type="button" className="btn danger small" onClick={() => { resetAll(); setConfirm(false); }}>Sí, borrar todo</button>
              <button type="button" className="btn secondary small" onClick={() => setConfirm(false)}>Cancelar</button>
            </span>
          )}
        </div>
        {copied && (copied.startsWith('{') ? <textarea className="input" readOnly rows={6} value={copied} aria-label="Tus datos en formato JSON" /> : <Notice>{copied}</Notice>)}
      </section>
    </>
  );
}
