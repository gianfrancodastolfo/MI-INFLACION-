import { useMemo, useState } from 'react';
import { type Period, addMonths, comparePeriods, formatPeriod, maxPeriod, minPeriod, periodRange, priceFactor } from '../../engine';
import { LAST_PERIOD, getSeries } from '../../domain/data';
import {
  CABA_GROUPS, EXTERNAL_IDS, EXTERNOS, type ExternalId, OTHER_PROVINCIAL_INDICES, cabaDetail, externalSeries, externalSummary,
} from '../../domain/externos';
import { formatPct, formatSignedPct } from '../../domain/format';
import { PROVINCES, REGION_NAMES, type ProvinceRegion } from '../../domain/regions';
import { BarList, Legend, LineChart, type LineSeries } from '../charts';
import { Explain, Notice, Segmented, SourceBadge } from '../components';
import { Link } from '../router';

/** Región de INDEC de cada índice propio (para compararlo con el dato oficial más cercano). */
const INDEC_REGION: Record<ExternalId, ProvinceRegion> = {
  caba: 'gba', cordoba: 'pampeana', mendoza: 'cuyo', neuquen: 'patagonia', san_luis: 'cuyo', santa_fe: 'pampeana', tucuman: 'noa', chaco: 'nea',
};

type Preset = '12m' | 'dic23' | '2017' | 'max';

function pctBetween(values: { start: Period; values: ReadonlyArray<number | null> }, from: Period, to: Period): number | undefined {
  const f = priceFactor(values, from, to);
  return f.ok ? f.value - 1 : undefined;
}

export function Provincias() {
  const [sel, setSel] = useState<ExternalId>('caba');
  const [preset, setPreset] = useState<Preset>('dic23');
  const ix = EXTERNOS.indices[sel];
  const region = INDEC_REGION[sel];
  const indec = getSeries(region, 'nivel_general')!;

  const range = useMemo(() => {
    const to = minPeriod(ix.last, LAST_PERIOD);
    const from = preset === '12m' ? addMonths(to, -12) : preset === 'dic23' ? '2023-12' : preset === '2017' ? '2016-12' : ix.start;
    return { from: maxPeriod(from, ix.start), to };
  }, [ix, preset]);

  const lines: LineSeries[] = useMemo(() => {
    const months = periodRange(range.from, range.to);
    const ext = externalSeries(sel);
    const rebased = (s: { start: Period; values: ReadonlyArray<number | null> }) => {
      const base = priceFactor(s, range.from, range.from).ok ? range.from : null;
      return months.map((p) => {
        if (!base) return { period: p, value: null };
        const f = priceFactor(s, base, p);
        return { period: p, value: f.ok ? f.value - 1 : null };
      });
    };
    const out: LineSeries[] = [{ id: 'ext', label: ix.indicator, color: 'ink', points: rebased(ext) }];
    if (comparePeriods(range.from, indec.start) >= 0) out.push({ id: 'indec', label: `IPC INDEC ${REGION_NAMES[region]}`, color: 'oficial', points: rebased(indec) });
    return out;
  }, [sel, range, ix, indec, region]);

  const extTotal = pctBetween(externalSeries(sel), range.from, range.to);
  const indecTotal = comparePeriods(range.from, indec.start) >= 0 ? pctBetween(indec, range.from, range.to) : undefined;
  const rows = EXTERNAL_IDS.map((id) => ({ id, ix: EXTERNOS.indices[id], s: externalSummary(id) }));
  const cabaRows = cabaDetail();
  const cabaLast = EXTERNOS.cabaDetalle.last;
  const div = cabaRows.filter((r) => (CABA_GROUPS.divisiones as readonly string[]).includes(r.key) && r.monthly != null);
  const cats = cabaRows.filter((r) => (CABA_GROUPS.categorias as readonly string[]).includes(r.key));
  const ng = cabaRows.find((r) => r.key === 'nivel_general');

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Fuentes provinciales · siempre separadas de INDEC</span>
        <h1>Inflación en CABA y en las provincias</h1>
        <p className="lede">INDEC mide 6 regiones. La Ciudad de Buenos Aires y algunas provincias calculan su propio índice, con su canasta y su cobertura. Acá están los que se pueden bajar como serie completa.</p>
      </header>

      <section className="card stack" aria-labelledby="prov-tabla">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="prov-tabla" style={{ fontSize: 'var(--step-2)' }}>Último dato de cada índice</h2>
          <SourceBadge kind="externo" />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Jurisdicción</th><th>Último dato</th><th className="n">Mensual</th><th className="n">En el año</th><th className="n">Interanual</th><th className="n">INDEC región, interanual</th></tr>
            </thead>
            <tbody>
              {rows.map(({ id, ix: r, s }) => {
                const reg = INDEC_REGION[id];
                const indecYoY = comparePeriods(s.last, LAST_PERIOD) <= 0 ? pctBetween(getSeries(reg, 'nivel_general')!, addMonths(s.last, -12), s.last) : undefined;
                return (
                  <tr key={id}>
                    <td><strong>{r.name}</strong><div className="small muted">{r.indicator} · {r.coverage}</div></td>
                    <td>{formatPeriod(s.last)}{r.stale && <div className="small muted">serie demorada</div>}</td>
                    <td className="n">{s.monthly != null ? formatPct(s.monthly) : '—'}</td>
                    <td className="n">{s.ytd != null ? formatPct(s.ytd) : '—'}</td>
                    <td className="n">{s.yoy != null ? formatPct(s.yoy) : '—'}</td>
                    <td className="n">{indecYoY != null ? <>{formatPct(indecYoY)}<div className="small muted">{REGION_NAMES[reg]}</div></> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          También publican índice propio {OTHER_PROVINCIAL_INDICES.map((o) => `${o.name} (${o.note.toLowerCase()})`).join(' y ')}, pero no están en la API de datos abiertos y no hay una serie para calcular.
          En las demás provincias no hay índice propio: se usa la región de INDEC.
        </p>
        {rows.some((r) => r.ix.stale || r.ix.gapNote) && (
          <Notice>
            {rows.filter((r) => r.ix.stale).map((r) => <span key={r.id}><strong>{r.ix.name}:</strong> {r.ix.stale} </span>)}
            {rows.filter((r) => r.ix.gapNote).map((r) => <span key={r.id}><strong>{r.ix.name}:</strong> {r.ix.gapNote} </span>)}
          </Notice>
        )}
      </section>

      <section className="card stack" aria-labelledby="prov-graf">
        <div className="section-head">
          <h2 id="prov-graf" style={{ fontSize: 'var(--step-2)' }}>Comparar con INDEC</h2>
          <select className="select" style={{ width: 'auto' }} value={sel} onChange={(e) => setSel(e.target.value as ExternalId)} aria-label="Índice">
            {EXTERNAL_IDS.map((id) => <option key={id} value={id}>{EXTERNOS.indices[id].name}</option>)}
          </select>
        </div>
        <Segmented label="Período" value={preset} onChange={setPreset} options={[
          { value: '12m', label: 'Últimos 12 meses' }, { value: 'dic23', label: 'Desde dic-2023' }, { value: '2017', label: 'Desde dic-2016' }, { value: 'max', label: 'Toda la serie' },
        ]} />
        <div className="tiles">
          <div className="tile">
            <div className="t-label"><span className="key" style={{ background: 'var(--ink-2)' }} aria-hidden="true" />{ix.indicator}</div>
            <div className="t-value">{extTotal != null ? formatPct(extTotal) : 'sin dato'}</div>
            <div className="t-sub">{formatPeriod(range.from)} → {formatPeriod(range.to)} · {ix.producer}</div>
          </div>
          <div className="tile">
            <div className="t-label"><span className="key oficial" aria-hidden="true" />IPC INDEC {REGION_NAMES[region]}</div>
            <div className="t-value">{indecTotal != null ? formatPct(indecTotal) : 'sin dato'}</div>
            <div className="t-sub">{indecTotal != null ? 'Dato oficial, misma región y período' : `INDEC empieza en ${formatPeriod(indec.start)}`}</div>
          </div>
          {extTotal != null && indecTotal != null && (
            <div className="tile">
              <div className="t-label">Diferencia</div>
              <div className="t-value">{formatSignedPct((1 + extTotal) / (1 + indecTotal) - 1)}</div>
              <div className="t-sub">Precios del índice propio contra INDEC (cociente, no resta)</div>
            </div>
          )}
        </div>
        <Legend items={lines.map((l) => ({ label: l.label, color: l.color }))} />
        <LineChart series={lines} yFormat={(v) => formatPct(v, 0)} tipFormat={(v) => formatPct(v)} ariaLabel={`Inflación acumulada: ${ix.indicator} contra INDEC`} startAtZero />
        <p className="small muted">Inflación acumulada desde {formatPeriod(range.from, 'long')}. {ix.gapNote ?? ''} Cobertura del índice propio: {ix.coverage}. Base: {ix.base}.</p>
      </section>

      <section className="card stack" aria-labelledby="caba-det">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="caba-det" style={{ fontSize: 'var(--step-2)' }}>Ciudad de Buenos Aires: qué subió en {formatPeriod(cabaLast, 'long')}</h2>
          <SourceBadge kind="externo">IPCBA · Estadística Ciudad</SourceBadge>
        </div>
        {ng?.monthly != null && <p>El IPCBA subió <strong>{formatPct(ng.monthly)}</strong> en el mes y <strong>{formatPct(ng.yoy ?? 0)}</strong> en los últimos 12 meses. Usa 13 divisiones (clasificación COICOP 2018) y base 2021 = 100.</p>}
        <BarList
          ariaLabel="Variación mensual por división del IPCBA"
          rows={div.map((r) => ({ id: r.key, label: r.name, value: r.monthly!, color: 'ink', detail: r.yoy != null ? `Interanual ${formatPct(r.yoy)}` : undefined }))}
          format={(v) => formatSignedPct(v)}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Categoría</th><th className="n">Mensual</th><th className="n">Interanual</th></tr></thead>
            <tbody>
              {[...div, ...cats].map((r) => (
                <tr key={r.key}><td>{r.name}</td><td className="n">{r.monthly != null ? formatSignedPct(r.monthly) : '—'}</td><td className="n">{r.yoy != null ? formatPct(r.yoy) : 'sin dato'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {EXTERNOS.meta.corrections.length > 0 && (
          <p className="small muted">
            Correcciones a la fuente: la API repite el nivel general en "estacionales" entre feb-2022 y sep-2023 (esos meses quedan sin dato) y el valor de educación en "recreación" en ene-2026 (se reconstruyó con la variación publicada, +7,4%).
          </p>
        )}
      </section>

      <Explain title="¿Cómo leer estos índices?">
        <p><strong>No son el IPC de INDEC.</strong> Cada organismo usa su propia canasta, sus ponderaciones y, en general, mide solo la capital o el aglomerado principal. Sirven como referencia local, no para reemplazar al índice nacional.</p>
        <p><strong>El IPCBA</strong> (Ciudad de Buenos Aires) tiene base 2021 = 100 desde 2022. La serie anterior (base jul-2011/jun-2012) se empalma en febrero de 2022: así se reproducen las cifras anuales publicadas (2022: 93,4%; 2023: 198,4%; 2025: 31,8%). Como empieza en julio de 2012, permite calcular sueldos de antes de 2016, cuando no hay serie nacional comparable de INDEC.</p>
        <p><strong>Las series provinciales</strong> se toman de la API de Series de Tiempo del Ministerio de Economía, que las recopila de cada dirección de estadística. Algunas se actualizan con demora: la tabla muestra el último mes disponible.</p>
        <p>Hay serie de índice propio en {EXTERNAL_IDS.length} de las {PROVINCES.length} jurisdicciones. En la <Link to="inicio">calculadora</Link> podés elegir cualquiera de estos índices en lugar del IPC de INDEC.</p>
      </Explain>
    </>
  );
}
