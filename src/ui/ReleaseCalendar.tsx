import { useState } from 'react';
import { formatISODate, todayISO } from '../engine';
import { CALENDAR_SOURCE, buildIcs, downloadText, releaseShort, releaseTitle, upcomingReleases } from '../domain/calendario';
import { IS_PREVIEW } from './router';

/** Próximas publicaciones de INDEC y descarga del .ics para recibir el aviso en el calendario del teléfono. */
export function ReleaseCalendar({ compact = false }: { compact?: boolean }) {
  const next = upcomingReleases(todayISO());
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null);
  if (!next.length) return null;
  const copy = async () => {
    const text = next.map((r) => `${formatISODate(r.date)} 16 h · ${releaseTitle(r)}`).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied('ok'); } catch { setCopied('error'); }
  };
  return (
    <section className="card stack" aria-labelledby="cal-h">
      <h2 id="cal-h" style={{ fontSize: 'var(--step-2)' }}>Avisame cuando salga el dato</h2>
      {!compact && <p className="small muted">{IS_PREVIEW ? 'En la versión publicada, un botón agrega estas fechas a tu calendario con aviso a las 16 h. Acá podés copiarlas.' : 'Agregá las fechas de INDEC a tu calendario: te avisa a las 16 h, cuando se publica. No hace falta cuenta ni darnos tu mail.'}</p>}
      <ul className="cal-list small">
        {next.slice(0, compact ? 2 : 6).map((r) => (
          <li key={`${r.kind}${r.ref}`}><span>{releaseShort(r)}</span><span className="d">{formatISODate(r.date)} · 16 h</span></li>
        ))}
      </ul>
      <div className="share-row">
        {IS_PREVIEW ? (
          <button type="button" className="btn secondary small" onClick={copy}>Copiar las fechas</button>
        ) : (
          <button type="button" className="btn secondary small" onClick={() => downloadText('mi-inflacion-indec.ics', buildIcs(next), 'text/calendar;charset=utf-8')}>Agregar al calendario (.ics)</button>
        )}
        {copied === 'ok' && <span className="small muted">Fechas copiadas.</span>}
        {copied === 'error' && <span className="small muted">No se pudieron copiar: anotalas de la lista.</span>}
        <a className="small" href={CALENDAR_SOURCE} target="_blank" rel="noreferrer">Calendario de INDEC</a>
      </div>
    </section>
  );
}
