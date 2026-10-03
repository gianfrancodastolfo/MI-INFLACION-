import { useMemo, useState } from 'react';
import { type Period, addMonths, comparePeriods, decemberOfPreviousYear, formatPeriod, periodRange, personalIndexSeries } from '../../engine';
import { DIVISION_BY_ID, type DivisionId } from '../../domain/categories';
import { inflation2018 } from '../../domain/basket2018';
import { categoryChanges, compareProfile, describeError } from '../../domain/calculations';
import { FIRST_PERIOD, LAST_PERIOD, getSeries } from '../../domain/data';
import { explainComparison } from '../../domain/explain';
import { formatPct, formatPP } from '../../domain/format';
import { buildBasket, isProfileComplete } from '../../domain/profile';
import { REGION_NAMES, type RegionId } from '../../domain/regions';
import { BarList, Legend, LineChart } from '../charts';
import { Empty, Explain, MonthPicker, Notice, RegionSelect, Segmented, SourceBadge, Tile } from '../components';
import { Link } from '../router';
import { useApp } from '../state';

type Preset = '12m' | 'anio' | '24m' | 'custom';

export function usePeriodPresets(initial: Preset = '12m') {
  const [preset, setPreset] = useState<Preset>(initial);
  const [custom, setCustom] = useState<{ from: Period; to: Period }>({ from: addMonths(LAST_PERIOD, -12), to: LAST_PERIOD });
  const range = useMemo(() => {
    if (preset === '12m') return { from: addMonths(LAST_PERIOD, -12), to: LAST_PERIOD };
    if (preset === '24m') return { from: addMonths(LAST_PERIOD, -24), to: LAST_PERIOD };
    if (preset === 'anio') return { from: decemberOfPreviousYear(LAST_PERIOD), to: LAST_PERIOD };
    return custom;
  }, [preset, custom]);
  return { preset, setPreset, custom, setCustom, ...range };
}

export function PeriodControls({ state }: { state: ReturnType<typeof usePeriodPresets> }) {
  const { preset, setPreset, custom, setCustom } = state;
  return (
    <div className="stack-sm">
      <Segmented
        label="Período"
        value={preset}
        onChange={setPreset}
        options={[
          { value: '12m', label: 'Últimos 12 meses' },
          { value: 'anio', label: `En ${LAST_PERIOD.slice(0, 4)}` },
          { value: '24m', label: 'Últimos 2 años' },
          { value: 'custom', label: 'Elegir fechas' },
        ]}
      />
      {preset === 'custom' && (
        <div className="fields-2">
          <MonthPicker id="cmp-from" label="Desde" value={custom.from} max={addMonths(LAST_PERIOD, -1)} onChange={(v) => setCustom({ ...custom, from: v })} />
          <MonthPicker id="cmp-to" label="Hasta" value={custom.to} min={addMonths(FIRST_PERIOD, 1)} onChange={(v) => setCustom({ ...custom, to: v })} />
        </div>
      )}
    </div>
  );
}

export function Comparar() {
  const { profile } = useApp();
  const period = usePeriodPresets();
  const { from, to } = period;
  const [showTable, setShowTable] = useState(false);
  const has = isProfileComplete(profile);
  const cmp = useMemo(() => (has ? compareProfile(profile!, from, to) : null), [has, profile, from, to]);
  const [regionNoProfile, setRegionNoProfile] = useState<RegionId>('nacional');
  const region: RegionId = cmp?.ok ? cmp.value.region : regionNoProfile;
  const changes = useMemo(() => categoryChanges(region, from, to), [region, from, to]);
  const orderOk = comparePeriods(from, to) < 0;

  const lines = useMemo(() => {
    if (!cmp?.ok || !profile) return null;
    const pb = buildBasket(profile);
    const general = getSeries(cmp.value.region, 'nivel_general');
    if (!pb || !general) return null;
    const pi = personalIndexSeries(pb.basket, pb.indices, from, to, from);
    if (!pi.ok) return null;
    const g0 = general.values[periodRange(general.start, from).length - 1]!;
    const off = periodRange(from, to).map((p) => {
      const v = general.values[periodRange(general.start, p).length - 1];
      return { period: p, value: v != null && g0 ? v / g0 - 1 : null };
    });
    return [
      { id: 'oficial', label: `IPC ${REGION_NAMES[cmp.value.region]}`, color: 'oficial' as const, points: off },
      { id: 'personal', label: 'Mi inflación', color: 'personal' as const, points: pi.value.map((x) => ({ period: x.period, value: x.value / 100 - 1 })) },
    ];
  }, [cmp, profile, from, to]);

  const exp = cmp?.ok ? explainComparison(cmp.value) : null;
  const updated = useMemo(() => (orderOk ? inflation2018(from, to) : null), [from, to, orderOk]);
  const published = cmp?.ok ? cmp.value.published?.inflation ?? cmp.value.official.inflation : 0;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Comparar</span>
        <h1>¿Tu inflación fue igual a la del país?</h1>
        <p className="lede">La inflación que ves en las noticias es un promedio. La tuya depende de en qué gastás.</p>
      </header>

      <PeriodControls state={period} />
      {!orderOk && <Notice tone="warn">La fecha de inicio tiene que ser anterior a la de fin.</Notice>}

      {!has ? (
        <Empty title="Todavía no calculaste tu inflación" action={<Link to="mi-inflacion" className="btn">Calcular mi inflación</Link>}>
          Cargá tu provincia y tus gastos para comparar tu inflación con la del IPC. Mientras tanto, abajo podés ver qué categorías aumentaron más.
        </Empty>
      ) : cmp && !cmp.ok ? (
        <Notice tone="warn">{describeError(cmp.error)}</Notice>
      ) : cmp?.ok && exp ? (
        <>
          <div className="tiles">
            <Tile keyKind="oficial" label={`IPC ${REGION_NAMES[cmp.value.region]}`} value={formatPct(published)} sub={<>Dato oficial · {formatPeriod(from)} → {formatPeriod(to)}</>} />
            <Tile keyKind="personal" label="Tu inflación" value={formatPct(cmp.value.personal.inflation)} sub="Estimación con tu estructura de gastos" />
            <Tile label="Diferencia" value={formatPP(cmp.value.personal.inflation - published)} sub={exp.verdict === 'similar' ? 'Prácticamente igual' : exp.verdict === 'mayor' ? 'Tu inflación fue mayor' : 'Tu inflación fue menor'} />
            {cmp.value.national != null && <Tile keyKind="oficial" label="IPC total nacional" value={formatPct(cmp.value.national)} sub="Referencia: la cifra de las noticias" />}
            {updated?.ok && <Tile label="Nacional con canasta 2017/18" value={formatPct(updated.value.inflation)} sub="Estimación de la app con pesos de gasto actualizados" />}
          </div>

          <section className="card stack" aria-labelledby="why-h">
            <h2 id="why-h" style={{ fontSize: 'var(--step-2)' }}>Por qué</h2>
            {profile!.origin === 'ejemplo' && <Notice tone="warn"><strong>Perfil de ejemplo.</strong> <Link to="mi-inflacion">Cargá tus gastos</Link> para ver tu propia comparación.</Notice>}
            <p style={{ fontSize: 'var(--step-1)' }}>{exp.headline}</p>
            {exp.reasons.length > 0 && <ul className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>{exp.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            {exp.note && <p className="small muted">{exp.note}</p>}
            <p className="small muted">
              Comparamos con el IPC de tu región porque tu canasta se valúa con los índices de esa región. Precisión:{' '}
              {Object.keys(cmp.value.leafNames).some((k) => k.startsWith('propio:'))
                ? `estimación con tus aumentos reales en ${Object.keys(cmp.value.leafNames).filter((k) => k.startsWith('propio:')).map((k) => cmp.value.leafNames[k]!.replace(' (tu precio)', '').toLowerCase()).join(', ')} y los índices de INDEC para el resto.`
                : cmp.value.precision === 'subgrupo' ? 'estimación basada en una estructura de gastos más específica (subgrupos de INDEC).' : 'estimación basada en 12 categorías generales.'}
            </p>
          </section>

          {lines && (
            <section className="card stack" aria-labelledby="ev-h">
              <div className="section-head">
                <h2 id="ev-h" style={{ fontSize: 'var(--step-2)' }}>Inflación acumulada desde {formatPeriod(from, 'long')}</h2>
                <Legend items={lines.map((l) => ({ label: l.label, color: l.color }))} />
              </div>
              <LineChart series={lines} yFormat={(v) => formatPct(v, 0)} tipFormat={(v) => formatPct(v)} ariaLabel="Inflación acumulada: IPC de tu región y tu inflación" />
            </section>
          )}

          <section className="card stack" aria-labelledby="ap-h">
            <div className="section-head">
              <h2 id="ap-h" style={{ fontSize: 'var(--step-2)' }}>Qué explica la diferencia</h2>
              <div className="legend">
                <span><span className="key personal" />Empuja tu inflación hacia arriba</span>
                <span><span className="key oficial" />Hacia abajo</span>
              </div>
            </div>
            <BarList
              diverging
              ariaLabel="Aporte de cada categoría a la diferencia, en puntos porcentuales"
              rows={cmp.value.contributions.filter((c) => Math.abs(c.contribution) >= 0.0005).map((c) => ({
                id: c.category,
                label: DIVISION_BY_ID[c.category as DivisionId]?.short ?? c.category,
                value: c.contribution,
                detail: `Tu peso ${formatPct(c.personalShare)} · IPC ${formatPct(c.officialShare)} · subió ${formatPct(c.categoryInflation)}`,
              }))}
              format={(v) => formatPP(v)}
            />
            {cmp.value.contributions.some((c) => Math.abs(c.contribution) < 0.0005) && (
              <p className="small muted">Las demás categorías aportan menos de 0,05 p.p. cada una (están en la tabla).</p>
            )}
            <button type="button" className="linkbtn small" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>{showTable ? 'Ocultar tabla' : 'Ver tabla'}</button>
            {showTable && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Categoría</th><th className="n">Tu peso</th><th className="n">Peso IPC</th><th className="n">Variación</th>{cmp.value.precision === 'subgrupo' && <><th className="n">Tu variación</th><th className="n">Efecto peso</th><th className="n">Efecto composición</th></>}<th className="n">Aporte</th></tr></thead>
                  <tbody>
                    {cmp.value.contributions.map((c) => (
                      <tr key={c.category}>
                        <td>{DIVISION_BY_ID[c.category as DivisionId]?.name}</td>
                        <td className="n">{formatPct(c.personalShare)}</td>
                        <td className="n">{formatPct(c.officialShare)}</td>
                        <td className="n">{formatPct(c.categoryInflation)}</td>
                        {cmp.value.precision === 'subgrupo' && <><td className="n">{formatPct(c.personalCategoryInflation)}</td><td className="n">{formatPP(c.weightEffect)}</td><td className="n">{formatPP(c.mixEffect)}</td></>}
                        <td className="n">{formatPP(c.contribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Explain>
              <p>El aporte de cada categoría es (tu peso − peso en el IPC) × (variación de la categoría − variación promedio). La suma de los aportes es exactamente la diferencia entre tu inflación y el IPC reconstruido con las mismas categorías.</p>
              <p>Los pesos son los del inicio del período, a precios de ese mes: si una categoría subió mucho, hoy pesa más en tu gasto de lo que pesaba al principio.</p>
              <p>Cuando hay subgrupos (por ejemplo, alquiler dentro de vivienda), el aporte se separa en efecto peso (pesar distinto que en el IPC) y efecto composición (tu mezcla dentro de la categoría subió distinto que la categoría completa).</p>
            </Explain>
          </section>
        </>
      ) : null}

      <section className="card stack" aria-labelledby="cat-h">
        <div className="section-head">
          <h2 id="cat-h" style={{ fontSize: 'var(--step-2)' }}>¿Qué aumentó más?</h2>
          {!has && <div style={{ minWidth: 220 }}><RegionSelect id="cmp-region" value={regionNoProfile} onChange={setRegionNoProfile} /></div>}
        </div>
        <div className="row"><SourceBadge kind="oficial" /><span className="small muted">Variación de precios por división · {REGION_NAMES[region]} · {formatPeriod(from)} → {formatPeriod(to)}</span></div>
        {changes.ok ? (
          <BarList
            ariaLabel="Variación de precios por categoría"
            rows={changes.value.map((c) => ({ id: c.division, label: DIVISION_BY_ID[c.division].short, value: c.inflation, color: 'oficial' }))}
            format={(v) => formatPct(v)}
          />
        ) : (
          <Notice tone="warn">{describeError(changes.error)}</Notice>
        )}
      </section>
    </>
  );
}
