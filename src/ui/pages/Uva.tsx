import { useMemo, useState } from 'react';
import {
  type Period, addMonths, comparePeriods, formatISODate, formatPeriod, isoInPeriod, periodOfDate, periodOfISO, priceFactor, todayISO,
} from '../../engine';
import { BCRA, UVA_DAILY_FIRST, UVA_LAST, uvaAt, uvaMonthly, uvaToday } from '../../domain/bcra';
import { LAST_PERIOD, getSeries } from '../../domain/data';
import { formatMoney, formatMoneyCompact, formatNumber, formatPct, formatSignedPct } from '../../domain/format';
import { Legend, LineChart, type LineSeries } from '../charts';
import { DecimalInput, Explain, MoneyInput, MonthPicker, Notice, Segmented, SourceBadge, Tile } from '../components';
import { ShareButton } from '../share';

type Mode = 'uva' | 'pesos';

export function Uva() {
  const today = todayISO();
  const thisMonth = periodOfDate(new Date());
  const lastMonth = periodOfISO(UVA_LAST);
  const [mode, setMode] = useState<Mode>('uva');
  const [cuotaUva, setCuotaUva] = useState<number | null>(250);
  const [firstPesos, setFirstPesos] = useState<number | null>(null);
  const [first, setFirst] = useState<Period>('2023-06');
  const [day, setDay] = useState<number>(10);
  const [salaryThen, setSalaryThen] = useState<number | null>(null);
  const [salaryNow, setSalaryNow] = useState<number | null>(null);

  const firstDate = isoInPeriod(first, day);
  const uvaFirst = uvaAt(firstDate);
  const units = mode === 'uva' ? cuotaUva : firstPesos && uvaFirst ? firstPesos / uvaFirst : null;

  const now = uvaToday(today);
  const payThisMonth = isoInPeriod(thisMonth, day);
  const uvaPay = uvaAt(payThisMonth);
  // Si la cuota de este mes todavía no se puede calcular, se muestra la última posible.
  const lastPayMonth = uvaPay != null ? thisMonth : isoInPeriod(lastMonth, day) <= UVA_LAST ? lastMonth : addMonths(lastMonth, -1);
  const lastPayDate = isoInPeriod(lastPayMonth, day);
  const uvaLastPay = uvaAt(lastPayDate);

  const monthly = useMemo(() => (units ? uvaMonthly(first, lastPayMonth, day) : []), [units, first, lastPayMonth, day]);
  const ipc = getSeries('nacional', 'nivel_general')!;
  // La UVA del día de pago refleja la inflación con rezago: hasta el IPC de 2 meses antes (1 si se paga del 17 en adelante).
  const lag = day >= 17 ? 1 : 2;
  const series: LineSeries[] = useMemo(() => {
    if (!units || !uvaFirst) return [];
    const cuota0 = units * uvaFirst;
    return [
      { id: 'cuota', label: 'Tu cuota en pesos', color: 'ink', points: monthly.map((m) => ({ period: m.period, value: m.value != null ? units * m.value : null })) },
      {
        id: 'ipc', label: `Primera cuota actualizada por IPC (con ${lag} meses de rezago)`, color: 'oficial',
        points: monthly.map((m) => { const f = priceFactor(ipc, addMonths(first, -lag), addMonths(m.period, -lag)); return { period: m.period, value: f.ok ? cuota0 * f.value : null }; }),
      },
    ];
  }, [units, uvaFirst, monthly, ipc, first, lag]);

  const cuotaFirst = units && uvaFirst ? units * uvaFirst : undefined;
  const cuotaLast = units && uvaLastPay ? units * uvaLastPay : undefined;
  const rise = cuotaFirst && cuotaLast ? cuotaLast / cuotaFirst - 1 : undefined;
  const ipcFrom = addMonths(first, -lag);
  const ipcTo = comparePeriods(addMonths(lastPayMonth, -lag), LAST_PERIOD) <= 0 ? addMonths(lastPayMonth, -lag) : LAST_PERIOD;
  const ipcF = priceFactor(ipc, ipcFrom, ipcTo);
  const shareOther = salaryThen && salaryNow && cuotaFirst && cuotaLast ? { then: cuotaFirst / salaryThen, now: cuotaLast / salaryNow } : null;

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Créditos UVA · coeficiente del BCRA</span>
        <h1>¿Cuánto te sube la cuota UVA?</h1>
        <p className="lede">La cuota en UVA es fija; lo que cambia es el valor de la UVA, que sigue a la inflación con un mes y medio de demora. Cargá tu cuota y te mostramos cuánto pagás en pesos, mes a mes.</p>
      </header>

      <section className="grid-2 calc-grid" aria-label="Cuota UVA">
        <form className="card stack" onSubmit={(e) => e.preventDefault()}>
          <Segmented label="Qué dato tenés" value={mode} onChange={setMode} options={[
            { value: 'uva', label: 'Mi cuota en UVA' }, { value: 'pesos', label: 'Mi primera cuota en pesos' },
          ]} />
          {mode === 'uva' ? (
            <div className="field">
              <label htmlFor="uva-units">Cuota en UVA (figura en el resumen del banco)</label>
              <DecimalInput id="uva-units" value={cuotaUva} onChange={setCuotaUva} placeholder="Ej.: 250,35" />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="uva-pesos">Primera cuota en pesos</label>
              <MoneyInput id="uva-pesos" value={firstPesos} onChange={setFirstPesos} />
            </div>
          )}
          <div className="fields-2">
            <MonthPicker id="uva-first" label="Mes de la primera cuota" value={first} min={periodOfISO(UVA_DAILY_FIRST)} max={lastMonth} onChange={setFirst} />
            <div className="field">
              <label htmlFor="uva-day">Día de pago</label>
              <select id="uva-day" className="select" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <details className="explain">
            <summary>Comparar con tu sueldo (opcional)</summary>
            <div className="body stack-sm">
              <div className="fields-2">
                <div className="field"><label htmlFor="uva-s0">Sueldo neto en {formatPeriod(first)}</label><MoneyInput id="uva-s0" value={salaryThen} onChange={setSalaryThen} /></div>
                <div className="field"><label htmlFor="uva-s1">Sueldo neto hoy</label><MoneyInput id="uva-s1" value={salaryNow} onChange={setSalaryNow} /></div>
              </div>
            </div>
          </details>
        </form>

        <div className="card result" aria-live="polite">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">UVA del BCRA</span>
            <SourceBadge kind="calculo" />
          </div>
          {!units ? (
            <Notice tone="warn">{mode === 'uva' ? 'Ingresá tu cuota en UVA.' : uvaFirst ? 'Ingresá tu primera cuota.' : 'No hay valor de UVA para esa fecha.'}</Notice>
          ) : (
            <>
              <div className="tiles">
                <Tile label={`Tu cuota ${lastPayMonth === thisMonth ? 'de este mes' : `de ${formatPeriod(lastPayMonth)}`}`} value={cuotaLast ? formatMoney(cuotaLast) : 'sin dato'} sub={`UVA del ${formatISODate(lastPayDate)}: ${uvaLastPay ? formatNumber(uvaLastPay, 2) : '—'}`} />
                <Tile label="Aumento desde la primera cuota" value={rise != null ? formatPct(rise) : '—'} sub={cuotaFirst ? `Primera cuota: ${formatMoney(cuotaFirst)} (${formatPeriod(first)})` : undefined} />
                <Tile keyKind="oficial" label={`Inflación ${formatPeriod(ipcFrom)} → ${formatPeriod(ipcTo)}`} value={ipcF.ok ? formatPct(ipcF.value - 1) : '—'} sub="IPC de INDEC, con el mismo rezago que la UVA" />
              </div>
              {uvaPay == null && <Notice>La cuota de {formatPeriod(thisMonth, 'long')} (día {day}) todavía no se puede calcular: la UVA se conoce hasta el {formatISODate(UVA_LAST)}. Depende del IPC que INDEC publica a mediados de mes.</Notice>}
              {shareOther && (
                <p>Tu cuota era el <strong>{formatPct(shareOther.then)}</strong> de tu sueldo al principio y hoy es el <strong>{formatPct(shareOther.now)}</strong> ({formatSignedPct(shareOther.now / shareOther.then - 1)}).</p>
              )}
              <p className="small muted">UVA hoy ({formatISODate(now.date)}): {now.value ? formatNumber(now.value, 2) : '—'}. Se calcula con la regla del BCRA a partir del valor oficial del {formatISODate(BCRA.uva.anchor.date)}; reproduce los valores publicados desde 2017 (diferencia máxima: un centavo).</p>
              {rise != null && (
                <div className="share-row">
                  <ShareButton title={`Mi cuota UVA desde ${formatPeriod(first)}`} lines={[
                    { label: 'Aumento de la cuota en pesos', value: formatPct(rise) },
                    ...(ipcF.ok ? [{ label: 'Inflación del período (IPC INDEC)', value: formatPct(ipcF.value - 1), key: 'oficial' as const }] : []),
                  ]} footer="UVA del BCRA e IPC de INDEC · cálculo de la app" />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {units && series.length > 0 && (
        <section className="card stack" aria-labelledby="uva-ch">
          <h2 id="uva-ch" style={{ fontSize: 'var(--step-2)' }}>Tu cuota en pesos, mes a mes</h2>
          <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
          <LineChart series={series} yFormat={formatMoneyCompact} tipFormat={formatMoney} ariaLabel="Cuota UVA en pesos y primera cuota actualizada por IPC" />
          <p className="small muted">La cuota sigue al IPC con demora: la UVA de cada día usa la inflación publicada del mes anterior al tramo (del 17 al 16). Por eso la línea del IPC se dibuja con {lag} meses de rezago: así las dos casi coinciden.</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Mes</th><th className="n">UVA (día {day})</th><th className="n">Cuota</th><th className="n">Variación</th></tr></thead>
              <tbody>
                {monthly.slice(-12).reverse().map((m, i, arr) => {
                  const prev = arr[i + 1]?.value ?? monthly[monthly.length - 13]?.value;
                  return (
                    <tr key={m.period}>
                      <td>{formatPeriod(m.period)}</td>
                      <td className="n">{m.value ? formatNumber(m.value, 2) : '—'}</td>
                      <td className="n">{m.value ? formatMoney(units * m.value) : '—'}</td>
                      <td className="n">{m.value && prev ? formatSignedPct(m.value / prev - 1) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Explain title="¿Cómo se calcula?">
        <p><strong>Cuota en pesos = cuota en UVA × valor de la UVA del día de pago.</strong> Con tasa fija y sistema francés, la cuota en UVA no cambia (salvo que precancelés). No incluye seguros ni otros cargos del banco.</p>
        <p><strong>Valor de la UVA:</strong> del día 17 de un mes al 16 del siguiente, sube todos los días lo mismo, de forma que en el tramo acumula la inflación del mes anterior publicada por INDEC. Con esa regla calculamos cada día a partir de un valor oficial del BCRA; comparada con los 113 cierres de mes publicados desde 2017, la diferencia máxima es de un centavo, por redondeo.</p>
        <p>Antes de marzo de 2017 la UVA usaba otros índices de precios, por eso la calculadora arranca ahí.</p>
      </Explain>
    </>
  );
}


