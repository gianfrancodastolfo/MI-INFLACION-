import { useMemo } from 'react';
import { addMonths, comparePeriods, diffMonths, formatPeriod, periodOfDate } from '../../engine';
import { inflation2018 } from '../../domain/basket2018';
import { compareProfile, describeError, officialEquivalent, personalEquivalent } from '../../domain/calculations';
import { FIRST_PERIOD, LAST_PERIOD } from '../../domain/data';
import { explainComparison } from '../../domain/explain';
import { formatMoney, formatNumber, formatPct, formatSignedPct } from '../../domain/format';
import { isProfileComplete, profileRegion } from '../../domain/profile';
import { EXTERNAL_IDS, EXTERNOS, type ExternalId, externalEquivalent, externalForProvince } from '../../domain/externos';
import { REGION_NAMES, type RegionId } from '../../domain/regions';
import { Explain, MoneyInput, MonthPicker, Notice, SourceBadge, Sticker } from '../components';
import { Link } from '../router';
import { ShareButton, type ShareLine } from '../share';
import { newId, useApp } from '../state';

/** Selector de índice: regiones de INDEC y, aparte, los índices propios de CABA y provincias. */
function IndexSelect({ id, region, ext, onChange }: { id: string; region: RegionId; ext?: ExternalId; onChange: (v: { region: RegionId; ext?: ExternalId }) => void }) {
  const value = ext ? `ext:${ext}` : region;
  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v.startsWith('ext:')) onChange({ region, ext: v.slice(4) as ExternalId });
        else onChange({ region: v as RegionId, ext: undefined });
      }}
    >
      <optgroup label="INDEC (oficial)">
        {(Object.keys(REGION_NAMES) as RegionId[]).map((r) => (
          <option key={r} value={r}>{r === 'nacional' ? 'IPC total nacional' : `IPC ${REGION_NAMES[r]}`}</option>
        ))}
      </optgroup>
      <optgroup label="Índices propios (fuente externa)">
        {EXTERNAL_IDS.map((x) => (
          <option key={x} value={`ext:${x}`}>{EXTERNOS.indices[x].indicator} · desde {formatPeriod(EXTERNOS.indices[x].start)}</option>
        ))}
      </optgroup>
    </select>
  );
}

export function Home() {
  const { calc, setCalc, profile, salaries, setSalaries } = useApp();
  const update = (patch: Partial<typeof calc>) => setCalc({ ...calc, ...patch, example: false });
  const orderOk = comparePeriods(calc.from, calc.to) < 0;
  const ext = calc.ext ? EXTERNOS.indices[calc.ext] : undefined;
  const minFrom = ext ? ext.start : FIRST_PERIOD;
  const maxTo = ext ? ext.last : LAST_PERIOD;
  const official = useMemo(
    () => (calc.ext ? externalEquivalent(calc.amount, calc.from, calc.to, calc.ext) : officialEquivalent(calc.amount, calc.from, calc.to, calc.region)),
    [calc],
  );
  const chooseIndex = (v: { region: RegionId; ext?: ExternalId }) => {
    const ix = v.ext ? EXTERNOS.indices[v.ext] : undefined;
    const lo = ix ? ix.start : FIRST_PERIOD;
    const hi = ix ? ix.last : LAST_PERIOD;
    let from = comparePeriods(calc.from, lo) < 0 ? lo : calc.from;
    let to = comparePeriods(calc.to, hi) > 0 || calc.to === maxTo ? hi : calc.to;
    if (comparePeriods(from, to) >= 0) { from = addMonths(to, -12) < lo ? lo : addMonths(to, -12); }
    if (comparePeriods(to, lo) <= 0) to = hi;
    update({ region: v.region, ext: v.ext, from, to });
  };
  const provinceExt = hasProfileExt(profile);
  const hasProfile = isProfileComplete(profile);
  const personal = useMemo(
    () => (hasProfile && orderOk ? personalEquivalent(calc.amount, calc.from, calc.to, profile!) : null),
    [calc, profile, hasProfile, orderOk],
  );
  const region = hasProfile ? profileRegion(profile!) : undefined;
  const regional = useMemo(
    () => (region && region !== calc.region && orderOk ? officialEquivalent(calc.amount, calc.from, calc.to, region) : null),
    [calc, region, orderOk],
  );
  const comparison = useMemo(
    () => (hasProfile && orderOk ? compareProfile(profile!, calc.from, calc.to) : null),
    [calc.from, calc.to, profile, hasProfile, orderOk],
  );
  // Estimación con la canasta 2017/18 (total nacional): referencia para ver cuánto cambia con pesos actualizados.
  const updated = useMemo(() => (orderOk ? inflation2018(calc.from, calc.to) : null), [calc.from, calc.to, orderOk]);
  const today = periodOfDate(new Date());
  const lagMonths = Math.max(0, diffMonths(LAST_PERIOD, today));
  const indexName = ext
    ? `del ${ext.indicator}`
    : calc.region === 'nacional' ? 'del IPC de INDEC (total nacional)' : `del IPC de INDEC para ${REGION_NAMES[calc.region]}`;
  const indexShort = ext ? ext.indicator : `IPC ${calc.region === 'nacional' ? 'nacional' : REGION_NAMES[calc.region]}`;
  const gapInRange = !!ext?.gapNote && !official.ok && official.error.code === 'MISSING_VALUE';

  const current = calc.current ?? null;
  const ppOfficial = official.ok && current ? current / official.value.equivalent - 1 : null;
  const ppPersonal = personal?.ok && current ? current / personal.value.equivalent - 1 : null;

  const saveToSalary = () => {
    const add = [{ id: newId(), period: calc.from, net: calc.amount, note: 'Desde la calculadora' }];
    if (current) add.push({ id: newId(), period: calc.to, net: current, note: 'Desde la calculadora' });
    const keep = salaries.filter((s) => !add.some((a) => a.period === s.period));
    setSalaries([...keep, ...add]);
  };

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Calculadora · datos de INDEC hasta {formatPeriod(LAST_PERIOD, 'long')}</span>
        <h1>¿Cuánto deberías ganar hoy para vivir como vivías antes?</h1>
        <p className="lede">Ingresá un sueldo y la fecha en que lo cobrabas. Te mostramos cuánto necesitarías hoy para comprar lo mismo, según la inflación oficial y según tu propia forma de gastar.</p>
      </header>

      <section className="grid-2 calc-grid" aria-label="Calculadora">
        <form className="card stack" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="calc-amount">Sueldo</label>
            <MoneyInput id="calc-amount" big value={calc.amount} onChange={(v) => update({ amount: v ?? 0 })} />
            <span className="help">Usá el sueldo de bolsillo (neto) si querés comparar poder de compra.</span>
          </div>
          <MonthPicker id="calc-from" label="Cuándo lo cobrabas" value={calc.from} min={minFrom} max={addMonths(maxTo, -1)} onChange={(p) => update({ from: p })} />
          <div className="stack-sm">
            <MonthPicker id="calc-to" label="Compararlo con" value={calc.to} min={addMonths(minFrom, 1)} max={maxTo} onChange={(p) => update({ to: p })} />
            {calc.to !== maxTo && (
              <button type="button" className="linkbtn small" onClick={() => update({ to: maxTo })}>Usar el último dato disponible ({formatPeriod(maxTo)})</button>
            )}
          </div>
          <div className="field">
            <label htmlFor="calc-region">Índice</label>
            <IndexSelect id="calc-region" region={calc.region} ext={calc.ext} onChange={chooseIndex} />
            {!ext && provinceExt && (
              <span className="help">Tu provincia tiene índice propio: <button type="button" className="linkbtn small" onClick={() => chooseIndex({ region: calc.region, ext: provinceExt.id })}>usar el {provinceExt.indicator}</button>.</span>
            )}
          </div>
          {ext ? (
            <Notice>
              <strong>{ext.indicator}</strong>. Fuente: {ext.producer}. Cubre: {ext.coverage}. No es un dato de INDEC.
              Disponible de {formatPeriod(ext.start, 'long')} a {formatPeriod(ext.last, 'long')}.{ext.gapNote ? ` ${ext.gapNote}` : ''}{ext.stale ? ` ${ext.stale}` : ''} <Link to="provincias">Ver todos</Link>.
            </Notice>
          ) : (
            <Notice>
              El último dato oficial disponible corresponde a <strong>{formatPeriod(LAST_PERIOD, 'long')}</strong>
              {lagMonths > 1 ? `. INDEC publica el IPC de cada mes a mediados del mes siguiente.` : '.'} La serie nacional comparable empieza en {formatPeriod(FIRST_PERIOD, 'long')}. Para fechas anteriores podés elegir el IPC de la Ciudad (desde 2012) o el de algunas provincias.
            </Notice>
          )}
        </form>

        <div className="card result" aria-live="polite">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">{ext ? `Según el ${ext.indicator}` : 'Según INDEC'}</span>
            {ext ? <SourceBadge kind="externo">Cálculo con {ext.indicator}</SourceBadge> : <SourceBadge kind="calculo" />}
          </div>
          {!orderOk ? (
            <Notice tone="warn">La fecha del sueldo tiene que ser anterior a la fecha de comparación.</Notice>
          ) : official.ok ? (
            <>
              <div className="result-figure">
                <Sticker amount={calc.amount} period={calc.from} />
                <div className="hero-figure animate" key={official.value.equivalent.toFixed(0)}>{formatMoney(official.value.equivalent)}</div>
                <p className="hero-caption">
                  Los {formatMoney(calc.amount)} de {formatPeriod(calc.from, 'long')} equivalen aproximadamente a este monto en {formatPeriod(calc.to, 'long')}, según la evolución {indexName}.
                </p>
              </div>
              <div className="tiles">
                <div className="tile">
                  <div className="t-label"><span className="key oficial" aria-hidden="true" />Inflación acumulada del período</div>
                  <div className="t-value">{formatPct(official.value.inflation)}</div>
                  <div className="t-sub">Los precios se multiplicaron por {formatNumber(official.value.factor, 2)}</div>
                </div>
                {updated?.ok && calc.region === 'nacional' && !ext && (
                  <div className="tile">
                    <div className="t-label">Con la canasta 2017/18</div>
                    <div className="t-value">{formatMoney(calc.amount * updated.value.factor)}</div>
                    <div className="t-sub">Inflación {formatPct(updated.value.inflation)} · estimación de la app con pesos de gasto actualizados</div>
                  </div>
                )}
              </div>
              {calc.example && <p className="small muted">Es un ejemplo. Cambiá el monto y las fechas para calcular el tuyo.</p>}
              <Explain>
                <p><strong>Inflación:</strong> la variación promedio de los precios de los bienes y servicios que considera el índice.</p>
                <p><strong>Sueldo equivalente:</strong> sueldo de partida × (IPC del mes de comparación ÷ IPC del mes de partida). Se usan los índices publicados, que ya están compuestos: no se suman las inflaciones mensuales.</p>
                <p><strong>Canasta 2017/18:</strong> el IPC oficial pondera los gastos como en 2004/05, cuando los servicios pesaban menos. INDEC preparó una canasta nueva con la encuesta 2017/18 y la postergó. Esta estimación valúa esos pesos con los índices oficiales; no es un dato de INDEC. <Link to="ipc-indec">Ver detalle</Link>.</p>
              </Explain>
            </>
          ) : (
            <Notice tone="warn">{gapInRange ? `${ext!.name}: ${ext!.gapNote} Elegí otras fechas u otro índice.` : describeError(official.error)}</Notice>
          )}
          {official.ok && orderOk && (
            <div className="share-row">
              <ShareButton title={`De ${formatPeriod(calc.from)} a ${formatPeriod(calc.to)}`} lines={shareLines(official.value.inflation, indexShort, personal?.ok ? personal.value.inflation : undefined, ppOfficial)} footer={`${ext ? ext.producer : 'INDEC'} · cálculo de Mi Inflación`} />
            </div>
          )}
        </div>
      </section>

      <section className="grid-2 even" aria-label="Comparación con tu inflación">
        <div className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 'var(--step-2)' }}>Según tu inflación personal</h2>
            <SourceBadge kind="estimacion" />
          </div>
          {!hasProfile ? (
            <>
              <p className="muted">La inflación no impacta igual en todos: depende de en qué gastás. Si alquilás, viajás en colectivo o pagás prepaga, tu canasta no es la del promedio.</p>
              <div><Link to="mi-inflacion" className="btn">Calcular mi inflación</Link></div>
              <p className="small muted">Toma unos dos minutos. Tus datos quedan guardados solo en este dispositivo.</p>
            </>
          ) : personal && personal.ok && official.ok ? (
            <>
              {profile!.origin === 'ejemplo' && <Notice tone="warn"><strong>Perfil de ejemplo</strong> (alquila en CABA). <Link to="mi-inflacion">Cargá tus gastos</Link> para ver el tuyo.</Notice>}
              <p className="muted">Para mantener aproximadamente el mismo poder adquisitivo con tu estructura de gastos, necesitarías:</p>
              <div className="hero-figure" style={{ fontSize: 'var(--step-4)' }}>{formatMoney(personal.value.equivalent)}</div>
              <div className="table-wrap">
                <table className="compare-table">
                  <thead><tr><th>Método</th><th className="n">Sueldo equivalente</th></tr></thead>
                  <tbody>
                    <tr><td><span className="m"><span className="key oficial" />{ext ? `${ext.indicator} (fuente externa)` : `IPC INDEC (${calc.region === 'nacional' ? 'nacional' : REGION_NAMES[calc.region]})`}</span><span className="sub">Inflación {formatPct(official.value.inflation)}</span></td><td className="n">{formatMoney(official.value.equivalent)}</td></tr>
                    {regional?.ok && (
                      <tr><td><span className="m"><span className="key oficial" />IPC INDEC ({REGION_NAMES[region!]}, tu región)</span><span className="sub">Inflación {formatPct(regional.value.inflation)}</span></td><td className="n">{formatMoney(regional.value.equivalent)}</td></tr>
                    )}
                    {updated?.ok && (
                      <tr><td><span className="m"><span className="key oficial" />IPC con canasta 2017/18</span><span className="sub">Inflación {formatPct(updated.value.inflation)} · estimación de la app</span></td><td className="n">{formatMoney(calc.amount * updated.value.factor)}</td></tr>
                    )}
                    <tr><td><span className="m"><span className="key personal" />Mi inflación</span><span className="sub">Inflación {formatPct(personal.value.inflation)} · estimación</span></td><td className="n">{formatMoney(personal.value.equivalent)}</td></tr>
                  </tbody>
                </table>
              </div>
              {comparison?.ok && <p>{explainComparison(comparison.value).headline}</p>}
              <p className="small muted">Tu cálculo es distinto porque tu estructura de consumo no coincide exactamente con la canasta del IPC. Ninguno de los dos es "el correcto": miden canastas diferentes.</p>
              <div className="row">
                <Link to="comparar" className="btn secondary small">Ver por qué</Link>
                <Link to="mi-inflacion" className="btn secondary small">Editar mis gastos</Link>
              </div>
            </>
          ) : (
            <Notice tone="warn">{personal && !personal.ok ? describeError(personal.error) : 'Necesitamos información adicional para calcular este indicador.'}</Notice>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ fontSize: 'var(--step-2)' }}>¿Y cuánto cobrás hoy?</h2>
          <div className="field">
            <label htmlFor="calc-current">Tu sueldo en {formatPeriod(calc.to, 'long')}</label>
            <MoneyInput id="calc-current" value={current} placeholder="Opcional" onChange={(v) => setCalc({ ...calc, current: v ?? undefined, example: false })} />
          </div>
          {current && official.ok ? (
            <div className="stack-sm">
              <PowerLine label={`Según el ${indexShort}`} pct={ppOfficial!} need={official.value.equivalent} current={current} from={calc.from} />
              {ppPersonal != null && personal?.ok && (
                <PowerLine label="Según tu inflación" pct={ppPersonal} need={personal.value.equivalent} current={current} from={calc.from} />
              )}
              <div className="row" style={{ marginTop: 6 }}>
                <button type="button" className="btn secondary small" onClick={saveToSalary}>Guardar en Mi sueldo</button>
                <Link to="mi-sueldo" className="linkbtn small">Ver Mi sueldo</Link>
              </div>
            </div>
          ) : (
            <p className="muted">Si cargás tu sueldo actual, te decimos si está por encima o por debajo del monto necesario para mantener el poder adquisitivo.</p>
          )}
          <Explain>
            <p><strong>Poder adquisitivo:</strong> cuánto podés comprar con tus ingresos en comparación con otro momento.</p>
            <p>La variación real se calcula como (sueldo actual ÷ sueldo equivalente) − 1. No es "aumento menos inflación": con +80% de sueldo y +95% de precios, la caída real es 1,80 ÷ 1,95 − 1 = −7,7%.</p>
          </Explain>
        </div>
      </section>
    </>
  );
}

function hasProfileExt(profile: ReturnType<typeof useApp>['profile']) {
  return profile?.provinceId ? externalForProvince(profile.provinceId) : undefined;
}

/** Líneas de la imagen para compartir: solo porcentajes. */
function shareLines(inflation: number, indexShort: string, personal?: number, real?: number | null): ShareLine[] {
  const out: ShareLine[] = [{ label: `Los precios subieron (${indexShort})`, value: formatPct(inflation), key: 'oficial' }];
  if (personal != null) out.push({ label: 'Mi inflación (estimación con mis gastos)', value: formatPct(personal), key: 'personal' });
  if (real != null) out.push({ label: 'Mi sueldo contra la inflación', value: formatSignedPct(real), key: 'sueldo' });
  return out;
}

function PowerLine({ label, pct, need, current, from }: { label: string; pct: number; need: number; current: number; from: string }) {
  const above = pct >= 0;
  return (
    <div className="stack-sm" style={{ gap: 4 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label">{label}</span>
        <span className={`pill ${Math.abs(pct) < 0.005 ? 'neutral' : above ? 'good' : 'bad'}`}>{above ? '▲' : '▼'} {formatSignedPct(pct)}</span>
      </div>
      <p className="small">
        Tu sueldo está aproximadamente <strong>{formatPct(Math.abs(pct))} {above ? 'por encima' : 'por debajo'}</strong> del monto necesario para mantener el poder adquisitivo de {formatPeriod(from, 'long')} ({formatMoney(need)}).
        {!above && ` Te faltan ${formatMoney(need - current)} por mes.`}
      </p>
    </div>
  );
}
