import { useMemo, useState } from 'react';
import { type Period, addMonths, calculateInflation, decemberOfPreviousYear, formatPeriod, monthlyInflation, periodRange, valueAt, yearOverYearInflation, yearToDateInflation } from '../../engine';
import { BASKET_2018_SOURCES, KNOWN_2018, inflation2018, prorated2018, weights2018 } from '../../domain/basket2018';
import { DIVISION_BY_ID } from '../../domain/categories';
import { DIVISIONS } from '../../domain/categories';
import { DATASET, LAST_PERIOD, getSeries } from '../../domain/data';
import { formatNumber, formatPct, formatPP } from '../../domain/format';
import { REGION_NAMES, type RegionId } from '../../domain/regions';
import { BarList, Legend, LineChart, type LineSeries } from '../charts';
import { Explain, Notice, RegionSelect, Segmented, SourceBadge, Tile } from '../components';
import { ReleaseCalendar } from '../ReleaseCalendar';
import { Link } from '../router';

type Span = '12' | '36' | 'all';
type Base = '12m' | 'dic23' | 'all';

/** Inflación acumulada desde `from` para una serie nacional, mes a mes. */
function accumulated(cat: 'bienes' | 'servicios' | 'regulados' | 'nucleo' | 'nivel_general', from: Period, to: Period): Array<{ period: Period; value: number | null }> {
  const s = getSeries('nacional', cat);
  if (!s) return [];
  return periodRange(from, to).map((p) => {
    const r = calculateInflation(s, from, p);
    return { period: p, value: r.ok ? r.value : null };
  });
}

function pick<T>(r: { ok: true; value: T } | { ok: false }): T | null {
  return r.ok ? r.value : null;
}

export function Datos() {
  const [region, setRegion] = useState<RegionId>('nacional');
  const [span, setSpan] = useState<Span>('36');
  const [showTable, setShowTable] = useState(false);
  const s = getSeries(region, 'nivel_general')!;
  const last = LAST_PERIOD;
  const m = pick(monthlyInflation(s, last));
  const y = pick(yearOverYearInflation(s, last));
  const a = pick(yearToDateInflation(s, last));
  const level = pick(valueAt(s, last));

  const from: Period = span === 'all' ? '2017-01' : addMonths(last, -Number(span) + 1);
  const monthly = useMemo(() => periodRange(from, last).map((p) => ({ period: p, value: pick(monthlyInflation(s, p)) })), [s, from, last]);
  const yoyFrom: Period = span === 'all' ? '2017-12' : addMonths(last, -Number(span) + 1);
  const yoy = useMemo(() => periodRange(yoyFrom, last).map((p) => ({ period: p, value: pick(yearOverYearInflation(s, p)) })), [s, yoyFrom, last]);

  const divRows = DIVISIONS.map((d) => {
    const ds = getSeries(region, d.id)!;
    return { d, m: pick(monthlyInflation(ds, last)), y: pick(yearOverYearInflation(ds, last)) };
  });
  const cats = (['nucleo', 'regulados', 'estacionales'] as const).map((c) => {
    const cs = getSeries('nacional', c);
    return { c, m: cs ? pick(monthlyInflation(cs, last)) : null, y: cs ? pick(yearOverYearInflation(cs, last)) : null };
  });
  const tableRows = periodRange(addMonths(last, -23), last).reverse();
  const meta = DATASET.meta;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Datos de Argentina</span>
        <h1>Inflación en Argentina según el IPC de INDEC</h1>
        <p className="lede">Índice de precios al consumidor, base diciembre 2016 = 100. Último dato publicado: {formatPeriod(last, 'long')}.</p>
      </header>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div style={{ minWidth: 240 }}><RegionSelect id="datos-region" value={region} onChange={setRegion} /></div>
        <SourceBadge kind="oficial" />
      </div>

      <div className="tiles">
        <Tile keyKind="oficial" label={`Mensual · ${formatPeriod(last)}`} value={m != null ? formatPct(m) : '—'} sub={REGION_NAMES[region]} />
        <Tile keyKind="oficial" label="Interanual" value={y != null ? formatPct(y) : '—'} sub={`${formatPeriod(addMonths(last, -12))} → ${formatPeriod(last)}`} />
        <Tile keyKind="oficial" label={`Acumulada en ${last.slice(0, 4)}`} value={a != null ? formatPct(a) : '—'} sub={`Desde diciembre ${Number(last.slice(0, 4)) - 1}`} />
        <Tile label="Nivel del índice" value={level != null ? formatNumber(level, 1) : '—'} sub="Dic-2016 = 100" />
      </div>

      <section className="card stack" aria-labelledby="d-m">
        <div className="section-head">
          <h2 id="d-m" style={{ fontSize: 'var(--step-2)' }}>Variación mensual</h2>
          <Segmented label="Rango" value={span} onChange={setSpan} options={[{ value: '12', label: '12 meses' }, { value: '36', label: '3 años' }, { value: 'all', label: 'Desde 2017' }]} />
        </div>
        <LineChart series={[{ id: 'm', label: 'Mensual', color: 'oficial', points: monthly }]} endLabels={false} startAtZero yFormat={(v) => formatPct(v, 0)} tipFormat={(v) => formatPct(v)} ariaLabel={`Variación mensual del IPC, ${REGION_NAMES[region]}`} />
      </section>

      <section className="card stack" aria-labelledby="d-y">
        <h2 id="d-y" style={{ fontSize: 'var(--step-2)' }}>Variación interanual</h2>
        <LineChart series={[{ id: 'y', label: 'Interanual', color: 'oficial', points: yoy }]} endLabels={false} startAtZero yFormat={(v) => formatPct(v, 0)} tipFormat={(v) => formatPct(v)} ariaLabel={`Variación interanual del IPC, ${REGION_NAMES[region]}`} />
        <button type="button" className="linkbtn small" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>{showTable ? 'Ocultar tabla' : 'Ver tabla de los últimos 24 meses'}</button>
        {showTable && (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Mes</th><th className="n">Índice</th><th className="n">Mensual</th><th className="n">Interanual</th><th className="n">Acumulada en el año</th></tr></thead>
              <tbody>
                {tableRows.map((p) => {
                  const v = pick(valueAt(s, p));
                  const mm = pick(monthlyInflation(s, p));
                  const yy = pick(yearOverYearInflation(s, p));
                  const aa = pick(yearToDateInflation(s, p));
                  return (
                    <tr key={p}>
                      <td>{formatPeriod(p)}</td>
                      <td className="n">{v != null ? formatNumber(v, 1) : '—'}</td>
                      <td className="n">{mm != null ? formatPct(mm) : '—'}</td>
                      <td className="n">{yy != null ? formatPct(yy) : '—'}</td>
                      <td className="n">{aa != null ? formatPct(aa) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ServicesVsGoods />
      <UpdatedBasket />

      <div className="grid-2 even">
        <section className="card stack" aria-labelledby="d-div">
          <h2 id="d-div" style={{ fontSize: 'var(--step-2)' }}>Por división · {formatPeriod(last)}</h2>
          <BarList ariaLabel="Variación mensual por división" rows={divRows.filter((r) => r.m != null).sort((p, q) => q.m! - p.m!).map((r) => ({ id: r.d.id, label: r.d.short, value: r.m!, color: 'oficial', detail: r.d.name }))} format={(v) => formatPct(v)} />
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>División</th><th className="n">Mensual</th><th className="n">Interanual</th></tr></thead>
              <tbody>
                {divRows.map((r) => (
                  <tr key={r.d.id}><td>{r.d.name}</td><td className="n">{r.m != null ? formatPct(r.m) : '—'}</td><td className="n">{r.y != null ? formatPct(r.y) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="card stack" aria-labelledby="d-cat">
            <h2 id="d-cat" style={{ fontSize: 'var(--step-2)' }}>Núcleo, regulados y estacionales</h2>
            <p className="small muted">Total nacional · {formatPeriod(last)}</p>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Categoría</th><th className="n">Mensual</th><th className="n">Interanual</th></tr></thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={c.c}><td>{c.c === 'nucleo' ? 'Núcleo' : c.c === 'regulados' ? 'Regulados' : 'Estacionales'}</td><td className="n">{c.m != null ? formatPct(c.m) : '—'}</td><td className="n">{c.y != null ? formatPct(c.y) : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Explain>
              <p><strong>Estacionales:</strong> bienes y servicios con comportamiento estacional, como frutas, verduras, ropa exterior, turismo y alojamiento.</p>
              <p><strong>Regulados:</strong> precios sujetos a regulación o con alto componente impositivo, como combustibles, electricidad, agua, gas, transporte público, prepagas, educación formal, telefonía y cigarrillos.</p>
              <p><strong>Núcleo:</strong> el resto de la canasta. Se usa para ver la tendencia sin los saltos de estacionales y regulados.</p>
            </Explain>
          </section>

          <section className="card stack" aria-labelledby="d-src">
            <h2 id="d-src" style={{ fontSize: 'var(--step-2)' }}>Fuente y actualización</h2>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Productor: INDEC. {meta.title}.</li>
              <li>Canasta: {meta.basket}.</li>
              <li>Descarga: {meta.via.startsWith('api') ? 'API de Series de Tiempo (datos.gob.ar), que publica las series de INDEC' : 'archivos de INDEC'}.</li>
              <li>Última actualización de la app: {new Date(meta.generatedAt).toLocaleDateString('es-AR')} · estado de validación: {meta.validation.status === 'ok' ? 'sin observaciones' : meta.validation.status === 'warning' ? 'con advertencias menores' : 'con errores'}.</li>
              <li>INDEC publica el IPC de cada mes a mediados del mes siguiente.</li>
            </ul>
            {meta.corrections.length > 0 && (
              <Notice>
                <span>Correcciones aplicadas a la fuente:</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {meta.corrections.map((c) => (
                    <li key={`${c.region}${c.category}${c.period}`}>{REGION_NAMES[c.region as RegionId] ?? c.region}, {c.category === 'nivel_general' ? 'nivel general' : c.category}, {formatPeriod(c.period)}: {c.reason}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <p className="small"><a href="https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31" target="_blank" rel="noreferrer">Ver el IPC en el sitio de INDEC</a> · <Link to="provincias">IPC de CABA y de las provincias</Link> · <Link to="precios">Precios promedio de productos</Link></p>
          </section>
          <ReleaseCalendar />
        </div>
      </div>
    </>
  );
}

function ServicesVsGoods() {
  const [base, setBase] = useState<Base>('dic23');
  const from: Period = base === '12m' ? addMonths(LAST_PERIOD, -12) : base === 'dic23' ? '2023-12' : '2016-12';
  const bs: LineSeries[] = useMemo(() => [
    { id: 'servicios', label: 'Servicios', color: 'oficial', points: accumulated('servicios', from, LAST_PERIOD) },
    { id: 'bienes', label: 'Bienes', color: 'ink', points: accumulated('bienes', from, LAST_PERIOD) },
  ], [from]);
  const rn: LineSeries[] = useMemo(() => [
    { id: 'regulados', label: 'Regulados', color: 'oficial', points: accumulated('regulados', from, LAST_PERIOD) },
    { id: 'nucleo', label: 'Núcleo', color: 'ink', points: accumulated('nucleo', from, LAST_PERIOD) },
  ], [from]);
  const last = (xs: LineSeries[], id: string) => { const pts = xs.find((x) => x.id === id)?.points ?? []; return pts.length ? pts[pts.length - 1]!.value : null; };
  const sv = last(bs, 'servicios');
  const bi = last(bs, 'bienes');
  const pctFmt = (v: number) => formatPct(v, Math.abs(v) >= 0.1 ? 0 : 1);
  return (
    <section className="card stack" aria-labelledby="d-bs">
      <div className="section-head">
        <h2 id="d-bs" style={{ fontSize: 'var(--step-2)' }}>Servicios contra bienes</h2>
        <Segmented label="Desde" value={base} onChange={setBase} options={[{ value: '12m', label: 'Últimos 12 meses' }, { value: 'dic23', label: 'Desde dic-2023' }, { value: 'all', label: 'Desde 2017' }]} />
      </div>
      {sv != null && bi != null && (
        <p>
          Desde {formatPeriod(from, 'long')}, los servicios subieron <strong>{formatPct(sv)}</strong> y los bienes <strong>{formatPct(bi)}</strong> (total nacional).
          {sv > bi ? ' Si tu gasto se concentra en servicios (alquiler, tarifas, prepaga, transporte, educación), tu inflación probablemente fue mayor que el promedio.' : ''}
        </p>
      )}
      <div className="grid-2 even">
        <div className="stack-sm">
          <Legend items={bs.map((x) => ({ label: x.label, color: x.color }))} />
          <LineChart series={bs} height={220} startAtZero yFormat={pctFmt} tipFormat={(v) => formatPct(v)} ariaLabel="Inflación acumulada de bienes y de servicios" />
        </div>
        <div className="stack-sm">
          <Legend items={rn.map((x) => ({ label: x.label, color: x.color }))} />
          <LineChart series={rn} height={220} startAtZero yFormat={pctFmt} tipFormat={(v) => formatPct(v)} ariaLabel="Inflación acumulada de precios regulados y núcleo" />
        </div>
      </div>
      <p className="small muted">Dato oficial de INDEC (clasificación bienes/servicios y categorías). Los regulados incluyen tarifas de luz, gas y agua, transporte público, combustibles, prepagas, educación formal y telefonía.</p>
    </section>
  );
}

function UpdatedBasket() {
  const nat = getSeries('nacional', 'nivel_general')!;
  const y = Number(LAST_PERIOD.slice(0, 4));
  const rows: Array<{ label: string; from: Period; to: Period }> = [
    { label: String(y - 2), from: `${y - 3}-12`, to: `${y - 2}-12` },
    { label: String(y - 1), from: `${y - 2}-12`, to: `${y - 1}-12` },
    { label: `En ${y} (hasta ${formatPeriod(LAST_PERIOD)})`, from: decemberOfPreviousYear(LAST_PERIOD), to: LAST_PERIOD },
    { label: 'Últimos 12 meses', from: addMonths(LAST_PERIOD, -12), to: LAST_PERIOD },
    { label: `Desde dic-2023`, from: '2023-12', to: LAST_PERIOD },
  ];
  const w = weights2018();
  const pror = prorated2018();
  return (
    <section className="card stack" aria-labelledby="d-new">
      <div className="section-head">
        <h2 id="d-new" style={{ fontSize: 'var(--step-2)' }}>¿Y con la canasta nueva?</h2>
        <span className="badge calculo">Estimación de la app</span>
      </div>
      <p>El IPC oficial pondera los gastos como en 2004/05. INDEC preparó una canasta con la encuesta 2017/18, donde los servicios pesan más, y la postergó en febrero de 2026. Esta tabla valúa esos pesos con los índices oficiales de cada división.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Período</th><th className="n">IPC oficial</th><th className="n">Con canasta 2017/18</th><th className="n">Diferencia</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const o = calculateInflation(nat, r.from, r.to);
              const n = inflation2018(r.from, r.to);
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="n">{o.ok ? formatPct(o.value) : '—'}</td>
                  <td className="n">{n.ok ? formatPct(n.value.inflation) : '—'}</td>
                  <td className="n">{o.ok && n.ok ? formatPP(n.value.inflation - o.value) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Explain title="¿Cómo se calcula?">
        <p>Pesos de la canasta nueva publicados en prensa: {Object.entries(KNOWN_2018).map(([k, v]) => `${DIVISION_BY_ID[k as keyof typeof DIVISION_BY_ID].short.toLowerCase()} ${formatNumber(v ?? 0, 1)}%`).join(', ')}.</p>
        <p>No se publicaron los de {pror.map((k) => DIVISION_BY_ID[k].short.toLowerCase()).join(', ')}: se reparte el resto en proporción a sus pesos actuales ({pror.map((k) => `${formatNumber(w[k], 1)}%`).join(', ')}). La canasta nueva además reorganiza rubros (13 divisiones) que acá se aproximan con las 12 vigentes.</p>
        <p>Es una canasta fija valuada a precios de mayo de 2018 (mitad del período de la encuesta). Por eso es una estimación: el IPC que publique INDEC puede dar otro número. Para comparar, estimaciones privadas para 2025 dieron entre 32,1% y 33,6%, contra 31,5% oficial.</p>
        <p>Fuentes de los pesos: {BASKET_2018_SOURCES.map((s, i) => <span key={s.url}>{i > 0 ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>)}.</p>
      </Explain>
    </section>
  );
}
