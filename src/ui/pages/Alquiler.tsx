import { useMemo, useState } from 'react';
import {
  type ISODate, type Period, addDays, addMonths, addMonthsISO, comparePeriods, formatISODate, formatPeriod, periodOfDate, todayISO,
} from '../../engine';
import { RENT_FREQUENCIES, rentIcl, rentIpc } from '../../domain/alquiler';
import { ICL_FIRST, ICL_LAST } from '../../domain/bcra';
import { ipcReleaseDate } from '../../domain/calendario';
import { LAST_PERIOD } from '../../domain/data';
import { formatMoney, formatNumber, formatPct } from '../../domain/format';
import { DateInput, Explain, MoneyInput, MonthPicker, Notice, Segmented, SourceBadge, Tile } from '../components';
import { ShareButton } from '../share';

type Index = 'ipc' | 'icl';
const DURATIONS = [12, 24, 36] as const;

function rateList(months: Period[], rates: Array<number | undefined>): string {
  return months.map((p, i) => `${formatPeriod(p)} ${rates[i] == null ? '…' : `${formatNumber(rates[i]!, 1)}%`}`).join(' · ');
}

export function Alquiler() {
  const today = todayISO();
  const thisMonth = periodOfDate(new Date());
  const [index, setIndex] = useState<Index>('ipc');
  const [amount, setAmount] = useState<number | null>(650_000);
  const [start, setStart] = useState<Period>(addMonths(thisMonth, -6));
  const [startDate, setStartDate] = useState<ISODate>(addMonthsISO(ICL_LAST, -12));
  const [every, setEvery] = useState<number>(3);
  const [lag, setLag] = useState<number>(2);
  const [duration, setDuration] = useState<number>(24);

  const ipcUpdates = useMemo(
    () => (index === 'ipc' && amount ? rentIpc(amount, start, every, lag, addMonths(start, duration - 1)) : []),
    [index, amount, start, every, lag, duration],
  );
  const iclUpdates = useMemo(
    // El contrato termina el día anterior a cumplir la duración: un ajuste en esa fecha ya no corre.
    () => (index === 'icl' && amount ? rentIcl(amount, startDate, every, addDays(addMonthsISO(startDate, duration), -1)) : []),
    [index, amount, startDate, every, duration],
  );

  // Monto vigente hoy y próximo ajuste.
  const ipcCurrent = ipcUpdates.filter((u) => comparePeriods(u.at, thisMonth) <= 0);
  const ipcNow = [...ipcCurrent].reverse().find((u) => u.status === 'ok')?.amount ?? (ipcCurrent.some((u) => u.status === 'pendiente') ? undefined : amount ?? undefined);
  const ipcNext = ipcUpdates.find((u) => comparePeriods(u.at, thisMonth) > 0);
  const iclPast = iclUpdates.filter((u) => u.date <= today);
  const iclNow = [...iclPast].reverse().find((u) => u.status === 'ok')?.amount ?? (iclPast.some((u) => u.status === 'pendiente') ? undefined : amount ?? undefined);
  const iclNext = iclUpdates.find((u) => u.date > today);
  // Se muestran los ajustes calculados y el primero pendiente; el resto se resume.
  const firstPendingIpc = ipcUpdates.findIndex((u) => u.status === 'pendiente');
  const ipcShown = firstPendingIpc >= 0 ? ipcUpdates.slice(0, firstPendingIpc + 1) : ipcUpdates;
  const firstPendingIcl = iclUpdates.findIndex((u) => u.status === 'pendiente');
  const iclShown = firstPendingIcl >= 0 ? iclUpdates.slice(0, firstPendingIcl + 1) : iclUpdates;
  const later = index === 'ipc' ? ipcUpdates.slice(ipcShown.length).map((u) => formatPeriod(u.at)) : iclUpdates.slice(iclShown.length).map((u) => formatISODate(u.date));
  const hiddenLater = later.length;
  const laterList = later.join(', ');
  const lastOk = index === 'ipc' ? [...ipcUpdates].reverse().find((u) => u.status === 'ok') : [...iclUpdates].reverse().find((u) => u.status === 'ok');
  const totalPct = lastOk?.amount && amount ? lastOk.amount / amount - 1 : undefined;

  const shareLines = totalPct != null
    ? [
        { label: index === 'ipc' ? `Alquiler por IPC, ajuste cada ${every} meses` : `Alquiler por ICL, ajuste cada ${every} meses`, value: '' },
        { label: `Aumento acumulado desde ${index === 'ipc' ? formatPeriod(start) : formatISODate(startDate)}`, value: formatPct(totalPct) },
        ...(index === 'ipc' && ipcNext?.factor ? [{ label: `Próximo ajuste (${formatPeriod(ipcNext.at)})`, value: formatPct(ipcNext.factor - 1) }] : []),
      ]
    : [];

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Calculadora de alquiler · IPC de INDEC e ICL del BCRA</span>
        <h1>¿Cuánto vas a pagar de alquiler?</h1>
        <p className="lede">Cargá el monto del contrato, cuándo empezó y cada cuánto se ajusta. Te mostramos cada aumento con los meses de inflación que se usan, y cuándo se conoce el próximo.</p>
      </header>

      <section className="grid-2 calc-grid" aria-label="Calculadora de alquiler">
        <form className="card stack" onSubmit={(e) => e.preventDefault()}>
          <Segmented label="Índice del contrato" value={index} onChange={(v) => { setIndex(v); setEvery(v === 'icl' ? 12 : 3); }} options={[
            { value: 'ipc', label: 'IPC (INDEC)' }, { value: 'icl', label: 'ICL (BCRA, Ley 27.551)' },
          ]} />
          <div className="field">
            <label htmlFor="rent-amount">Alquiler inicial (el monto del contrato)</label>
            <MoneyInput id="rent-amount" big value={amount} onChange={setAmount} />
          </div>
          {index === 'ipc' ? (
            <MonthPicker id="rent-start" label="Mes de inicio del contrato" value={start} min="2017-04" max={thisMonth > LAST_PERIOD ? thisMonth : LAST_PERIOD} onChange={setStart} />
          ) : (
            <DateInput id="rent-date" label="Fecha de inicio del contrato" value={startDate} min={ICL_FIRST} max={ICL_LAST} onChange={setStartDate} />
          )}
          <div className="fields-2">
            <div className="field">
              <label htmlFor="rent-every">Ajuste</label>
              <select id="rent-every" className="select" value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {RENT_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rent-dur">Duración</label>
              <select id="rent-dur" className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d / 12 === 1 ? '1 año' : `${d / 12} años`}</option>)}
              </select>
            </div>
          </div>
          {index === 'ipc' && (
            <div className="field">
              <label htmlFor="rent-lag">Qué inflación se toma en cada ajuste</label>
              <select id="rent-lag" className="select" value={lag} onChange={(e) => setLag(Number(e.target.value))}>
                <option value={2}>La última publicada al día 1 del mes del ajuste (lo más habitual)</option>
                <option value={1}>Hasta el mes anterior al ajuste (si se ajusta después del día 15)</option>
              </select>
              <span className="help">Revisá la cláusula de tu contrato. Las variaciones mensuales se multiplican, no se suman.</span>
            </div>
          )}
        </form>

        <div className="card result" aria-live="polite">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">{index === 'ipc' ? 'Con el IPC de INDEC' : 'Con el ICL del BCRA'}</span>
            <SourceBadge kind="calculo" />
          </div>
          {!amount ? (
            <Notice tone="warn">Ingresá el monto del alquiler.</Notice>
          ) : (
            <>
              <div className="tiles">
                <Tile label="Alquiler de este mes" value={(index === 'ipc' ? ipcNow : iclNow) != null ? formatMoney((index === 'ipc' ? ipcNow : iclNow)!) : 'pendiente'} sub={totalPct != null ? `Aumento acumulado: ${formatPct(totalPct)}` : 'Todavía no hubo ajustes'} />
                {index === 'ipc' && ipcNext && (
                  <Tile
                    label={`Próximo ajuste: ${formatPeriod(ipcNext.at, 'long')}`}
                    value={ipcNext.status === 'ok' ? formatMoney(ipcNext.amount!) : 'Pendiente'}
                    sub={ipcNext.status === 'ok'
                      ? `+${formatPct(ipcNext.factor! - 1)} (${rateList(ipcNext.months, ipcNext.rates)})`
                      : ipcNext.missing ? `Falta el IPC de ${formatPeriod(ipcNext.missing, 'long')}${ipcReleaseDate(ipcNext.missing) ? `, que INDEC publica el ${formatISODate(ipcReleaseDate(ipcNext.missing)!)}` : ''}.` : undefined}
                  />
                )}
                {index === 'icl' && iclNext && (
                  <Tile
                    label={`Próximo ajuste: ${formatISODate(iclNext.date)}`}
                    value={iclNext.status === 'ok' ? formatMoney(iclNext.amount!) : 'Pendiente'}
                    sub={iclNext.status === 'ok' ? `+${formatPct(iclNext.factor! - 1)}` : `El BCRA publica el ICL hasta el ${formatISODate(ICL_LAST)}.`}
                  />
                )}
              </div>
              <ol className="steps" aria-label="Ajustes del contrato">
                {index === 'ipc'
                  ? ipcShown.map((u) => (
                      <li key={u.at}>
                        <span className="when">{formatPeriod(u.at)}</span>
                        <span className="what small">
                          {u.status === 'ok' ? <>+{formatPct(u.factor! - 1)} · {rateList(u.months, u.rates)}</> : <span className="muted">Pendiente{u.missing ? `: falta el IPC de ${formatPeriod(u.missing)}` : ''}</span>}
                        </span>
                        <span className="amount">{u.amount != null ? formatMoney(u.amount) : '—'}</span>
                      </li>
                    ))
                  : iclShown.map((u) => (
                      <li key={u.date}>
                        <span className="when">{formatISODate(u.date)}</span>
                        <span className="what small">
                          {u.status === 'ok' ? <>+{formatPct(u.factor! - 1)} · ICL {formatNumber(u.iclFrom!, 2)} → {formatNumber(u.iclTo!, 2)}</> : <span className="muted">Pendiente: el ICL de esa fecha todavía no se publicó</span>}
                        </span>
                        <span className="amount">{u.amount != null ? formatMoney(u.amount) : '—'}</span>
                      </li>
                    ))}
              </ol>
              {hiddenLater > 0 && (
                <p className="small muted">Los {hiddenLater} ajustes siguientes ({laterList}) se calculan cuando se publiquen los índices de esos meses.</p>
              )}
              {shareLines.length > 0 && (
                <div className="share-row">
                  <ShareButton title="Mi alquiler" lines={shareLines} footer={index === 'ipc' ? 'IPC de INDEC · cálculo de la app' : 'ICL del BCRA · cálculo de la app'} />
                </div>
              )}
              <p className="small muted">
                {index === 'ipc'
                  ? `IPC nacional de INDEC, variación mensual con un decimal, como se publica. Último dato: ${formatPeriod(LAST_PERIOD, 'long')}.`
                  : `ICL diario oficial del BCRA (base 30/6/2020 = 1), publicado hasta el ${formatISODate(ICL_LAST)}.`}
              </p>
            </>
          )}
        </div>
      </section>

      <Explain title="¿Cómo se calcula?">
        <p><strong>Por IPC:</strong> en cada ajuste se multiplican las variaciones mensuales de los últimos meses publicados. Si el ajuste es cuatrimestral y toca en agosto de 2026, se usan marzo, abril, mayo y junio (3,4% · 2,6% · 2,1% · 1,9%): $650.000 × 1,034 × 1,026 × 1,021 × 1,019. Sumar las variaciones da un resultado menor y es un error.</p>
        <p><strong>Por ICL:</strong> el aumento es el ICL del día del ajuste dividido por el ICL del día de inicio (o del ajuste anterior). Es el índice de la Ley 27.551, que el BCRA sigue publicando. Combina la inflación y los salarios (RIPTE) en partes iguales.</p>
        <p><strong>Contratos desde el DNU 70/2023:</strong> el índice y la frecuencia se pactan libremente. Esta calculadora cubre los casos más comunes; lo que vale es lo que dice tu contrato. No es asesoramiento legal.</p>
        <p>La inflación usada es la nacional de INDEC. Si tu contrato dice otro índice (por ejemplo, el de tu provincia o el IPCBA), el resultado puede variar.</p>
      </Explain>
    </>
  );
}

