/**
 * "¿Cuánto aumentó?": precio promedio de INDEC de un producto entre dos meses, contra la inflación de su región.
 * Se carga aparte (React.lazy) porque trae su propio archivo de datos.
 */
import { useMemo, useState } from 'react';
import { type Period, addMonths, comparePeriods, formatPeriod, maxPeriod, minPeriod, periodRange, priceFactor } from '../../engine';
import { LAST_PERIOD, getSeries } from '../../domain/data';
import { formatMoney, formatPct, formatSignedPct } from '../../domain/format';
import {
  PRECIOS, PRECIOS_NOTE, PRODUCT_GROUPS, correctionsSummary, priceAt, priceChange, priceRanking, productsFor, regionRange, unitPhrase,
} from '../../domain/precios';
import { DIVISION_BY_ID } from '../../domain/categories';
import { profileRegion } from '../../domain/profile';
import { REGION_NAMES, type ProvinceRegion } from '../../domain/regions';
import { BarList, Legend, LineChart, type LineSeries } from '../charts';
import { Explain, MonthPicker, Notice, Segmented, SourceBadge, Tile } from '../components';
import { Link } from '../router';
import { ShareButton } from '../share';
import { useApp } from '../state';

const REGIONS: ProvinceRegion[] = ['gba', 'pampeana', 'nea', 'noa', 'cuyo', 'patagonia'];
type Preset = 'mes' | '12m' | 'dic23' | 'inicio' | 'otro';
const RANK_SHORT = 12;

function presetRange(preset: Exclude<Preset, 'otro'>, first: Period, last: Period): { from: Period; to: Period } {
  if (preset === 'mes') return { from: addMonths(last, -1), to: last };
  if (preset === '12m') return { from: maxPeriod(first, addMonths(last, -12)), to: last };
  if (preset === 'dic23') return { from: maxPeriod(first, '2023-12'), to: last };
  return { from: first, to: last };
}

export default function Precios() {
  const { profile } = useApp();
  const initialRegion = (profile && profileRegion(profile)) || 'gba';
  const [region, setRegionState] = useState<ProvinceRegion>(initialRegion);
  const [productId, setProductId] = useState('pan_frances');
  const range = regionRange(region);
  const last = minPeriod(range.last, LAST_PERIOD);
  const [from, setFrom] = useState<Period>(addMonths(last, -12));
  const [to, setTo] = useState<Period>(last);
  const [showAll, setShowAll] = useState(false);

  const products = productsFor(region);
  // pan_frances está en todas las regiones: siempre hay un producto válido.
  const product = products.find((p) => p.id === productId) ?? products[0]!;

  const setRegion = (r: ProvinceRegion) => {
    setRegionState(r);
    const rr = regionRange(r);
    if (!productsFor(r).some((p) => p.id === productId)) setProductId('pan_frances');
    setFrom((f) => maxPeriod(f, rr.first));
    setTo((t) => minPeriod(t, minPeriod(rr.last, LAST_PERIOD)));
  };
  const applyPreset = (p: Preset) => {
    if (p === 'otro') return;
    const r = presetRange(p, range.first, last);
    setFrom(r.from);
    setTo(r.to);
  };
  const preset: Preset = (['mes', '12m', 'dic23', 'inicio'] as const).find((p) => { const r = presetRange(p, range.first, last); return r.from === from && r.to === to; }) ?? 'otro';

  const result = priceChange(region, product.id, from, to);
  const ch = result.ok ? result.value : null;

  const chart: LineSeries[] = useMemo(() => {
    if (!ch) return [];
    const months = periodRange(from, to);
    const ipc = getSeries(region, 'nivel_general')!;
    return [
      { id: 'precio', label: `Precio promedio (${product.unit})`, color: 'personal', points: months.map((p) => ({ period: p, value: priceAt(region, product.id, p) ?? null })) },
      {
        id: 'ipc', label: 'Si hubiera subido como la inflación', color: 'oficial',
        points: months.map((p) => { const f = comparePeriods(p, LAST_PERIOD) <= 0 ? priceFactor(ipc, from, p) : null; return { period: p, value: f?.ok ? ch.priceFrom * f.value : null }; }),
      },
    ];
  }, [ch, from, to, region, product]);

  const ranking = useMemo(() => (comparePeriods(from, to) < 0 ? priceRanking(region, from, to) : []), [region, from, to]);
  const ipcRank = ranking[0]?.ipc;
  const above = ranking.filter((r) => r.real != null && r.real > 0).length;
  const shown = showAll ? ranking : ranking.slice(0, RANK_SHORT);

  const errorText = !result.ok
    ? result.error === 'BAD_RANGE' ? 'Elegí un mes inicial anterior al final.'
      : result.error === 'NO_PRICE_FROM' ? `INDEC no publicó el precio de ${product.name.toLowerCase()} en ${REGION_NAMES[region]} para ${formatPeriod(from, 'long')}.`
        : result.error === 'NO_PRICE_TO' ? `INDEC no publicó el precio de ${product.name.toLowerCase()} en ${REGION_NAMES[region]} para ${formatPeriod(to, 'long')}.`
          : 'Ese producto no está en la región elegida.'
    : null;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Precios promedio de INDEC · {PRECIOS.products.length} productos en GBA, {productsFor('nea').length} en cada región</span>
        <h1>¿Cuánto aumentó?</h1>
        <p className="lede">Para armar el IPC, INDEC releva precios en comercios de todo el país y publica el promedio de una selección de productos. Elegí uno y dos meses, y te mostramos cuánto subió y si le ganó a la inflación.</p>
      </header>

      <section className="grid-2 calc-grid" aria-label="Precio de un producto">
        <form className="card stack" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="pr-region">Región de INDEC</label>
            <select id="pr-region" className="select" value={region} onChange={(e) => setRegion(e.target.value as ProvinceRegion)}>
              {REGIONS.map((r) => <option key={r} value={r}>{REGION_NAMES[r]}</option>)}
            </select>
            <span className="help">En GBA hay {productsFor('gba').length} productos; en las otras regiones, {productsFor('nea').length}.</span>
          </div>
          <div className="field">
            <label htmlFor="pr-product">Producto</label>
            <select id="pr-product" className="select" value={product.id} onChange={(e) => setProductId(e.target.value)}>
              {PRODUCT_GROUPS.map((g) => {
                const items = products.filter((p) => p.group === g.id);
                return items.length ? (
                  <optgroup key={g.id} label={g.name}>
                    {items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          </div>
          <Segmented<Preset> label="Período" value={preset} onChange={applyPreset} options={[
            { value: 'mes', label: 'Último mes' }, { value: '12m', label: 'Últimos 12 meses' }, { value: 'dic23', label: 'Desde dic-2023' }, { value: 'inicio', label: `Desde ${formatPeriod(range.first)}` },
          ]} />
          <MonthPicker id="pr-from" label="Desde" value={from} min={range.first} max={addMonths(last, -1)} onChange={setFrom} />
          <MonthPicker id="pr-to" label="Hasta" value={to} min={addMonths(range.first, 1)} max={last} onChange={setTo} />
          <p className="small muted">Último dato: {formatPeriod(PRECIOS.meta.last, 'long')}. Son promedios de INDEC, no los precios de un comercio en particular.</p>
        </form>

        <div className="card result" aria-live="polite">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">{product.name} · {REGION_NAMES[region]}</span>
            <SourceBadge kind="oficial">Precios: INDEC</SourceBadge>
          </div>
          {!ch ? (
            <Notice tone="warn">{errorText}</Notice>
          ) : (
            <>
              <div className="result-figure">
                <div className="hero-figure animate" key={`${product.id}-${from}-${to}-${region}`}>{formatSignedPct(ch.change)}</div>
                <p className="hero-caption">
                  {capitalize(unitPhrase(product))} pasó de <strong>{formatMoney(ch.priceFrom)}</strong> en {formatPeriod(from, 'long')} a <strong>{formatMoney(ch.priceTo)}</strong> en {formatPeriod(to, 'long')}.
                </p>
              </div>
              <div className="tiles">
                <Tile keyKind="oficial" label={`Inflación ${REGION_NAMES[region]}`} value={ch.ipc != null ? formatPct(ch.ipc) : 'sin dato'}
                  sub={ch.division ? `IPC de INDEC. ${DIVISION_BY_ID[ch.division.id].short}: ${formatPct(ch.division.change)}` : 'IPC de INDEC, mismo período'} />
                <Tile label="Contra la inflación" value={ch.real != null ? formatSignedPct(ch.real) : '—'} sub={ch.real == null ? undefined : verdict(ch.real, ch.change)} />
              </div>
              {ch.priceFromAdjusted != null && (
                <p>Si hubiera subido como la inflación, en {formatPeriod(to, 'long')} costaría <strong>{formatMoney(ch.priceFromAdjusted)}</strong>: {ch.priceTo >= ch.priceFromAdjusted ? 'quedó más caro' : 'quedó más barato'} que en {formatPeriod(from, 'long')}, descontada la inflación.</p>
              )}
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <SourceBadge kind="calculo">Variaciones: cálculo de la app</SourceBadge>
                <ShareButton title={`¿Cuánto aumentó ${product.name.toLowerCase()}?`} lines={[
                  { label: `${product.name} (${REGION_NAMES[region]})`, value: formatSignedPct(ch.change), key: 'personal' },
                  ...(ch.ipc != null ? [{ label: 'Inflación (IPC de INDEC)', value: formatPct(ch.ipc), key: 'oficial' as const }] : []),
                  ...(ch.real != null ? [{ label: 'Contra la inflación', value: formatSignedPct(ch.real) }] : []),
                ]} footer={`Precios promedio de INDEC · ${formatPeriod(from)} a ${formatPeriod(to)}`} />
              </div>
            </>
          )}
        </div>
      </section>

      {ch && chart.length > 0 && chart[0]!.points.length >= 3 && (
        <section className="card stack" aria-labelledby="pr-ch">
          <h2 id="pr-ch" style={{ fontSize: 'var(--step-2)' }}>{product.name}: precio mes a mes</h2>
          <Legend items={chart.map((s) => ({ label: s.label, color: s.color }))} />
          <LineChart series={chart} endLabels={false} yFormat={(v) => formatMoney(v)} tipFormat={(v) => formatMoney(v)} ariaLabel={`Precio promedio de ${product.name} en ${REGION_NAMES[region]} y el mismo precio actualizado por inflación`} />
          <p className="small muted">La línea azul parte del precio de {formatPeriod(from, 'long')} y lo actualiza con el IPC de {REGION_NAMES[region]}. Cuando el precio queda arriba, el producto subió más que la inflación.</p>
        </section>
      )}

      {ranking.length > 0 && (
        <section className="card stack" aria-labelledby="pr-rank">
          <div className="section-head">
            <h2 id="pr-rank" style={{ fontSize: 'var(--step-2)' }}>Qué aumentó más en {REGION_NAMES[region]}</h2>
            <span className="small muted">{formatPeriod(from)} → {formatPeriod(to)}</span>
          </div>
          {ipcRank != null && (
            <p>En el período la inflación de la región fue <strong>{formatPct(ipcRank)}</strong>. {above} de {ranking.length} productos subieron más que eso (en naranja); el resto, menos (en azul).</p>
          )}
          <BarList
            ariaLabel={`Variación del precio de cada producto en ${REGION_NAMES[region]}`}
            rows={shown.map((r) => ({
              id: r.product.id, label: r.product.name, value: r.change,
              color: r.real != null && r.real > 0 ? 'personal' : 'oficial',
              detail: `${r.product.name} (${r.product.unit})${r.real != null ? ` · contra la inflación: ${formatSignedPct(r.real)}` : ''}`,
            }))}
            format={(v) => formatSignedPct(v)}
          />
          {ranking.length > RANK_SHORT && (
            <button type="button" className="btn secondary small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Ver menos' : `Ver los ${ranking.length} productos`}
            </button>
          )}
        </section>
      )}

      <Explain title="¿De dónde salen estos precios?">
        <p><strong>Son precios promedio de INDEC.</strong> Para calcular el IPC, INDEC releva precios todos los meses y publica el promedio de una selección: {productsFor('gba').length} productos del Gran Buenos Aires desde 2016 y {productsFor('nea').length} productos de cada región desde junio de 2017. No son los precios de tu almacén: cambian según el comercio, la marca y la variedad.</p>
        <p><strong>Advertencia de INDEC:</strong> “{PRECIOS_NOTE}” Por eso acá cada producto se compara consigo mismo en el tiempo, nunca entre regiones.</p>
        <p><strong>Cómo se calcula.</strong> Variación = precio final ÷ precio inicial − 1. Contra la inflación = (1 + variación) ÷ (1 + IPC de la región) − 1: si da positivo, el producto subió más que el promedio de los precios. “Si hubiera subido como la inflación” es el precio inicial multiplicado por la inflación del período.</p>
        <p><strong>Correcciones a la fuente.</strong> Los datos vienen de la API de Series de Tiempo del Ministerio de Economía, que tiene algunos errores de carga. Los corregimos con las cifras de los informes mensuales de INDEC:</p>
        <ul>{correctionsSummary().map((c) => <li key={c}>{c}</li>)}</ul>
        <p>Las unidades son las del último informe de INDEC. Más detalle en <Link to="metodologia">Metodología</Link>.</p>
      </Explain>
    </>
  );
}

function verdict(real: number, change: number): string {
  if (change < 0) return 'Bajó de precio aunque hubo inflación';
  if (Math.abs(real) < 0.005) return 'Subió casi lo mismo que la inflación';
  return real > 0 ? 'Subió más que la inflación' : 'Subió menos que la inflación';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
