/**
 * Calendario de difusión de INDEC (segundo semestre 2026) y archivo .ics para agendar los avisos.
 * Fuente: https://www.indec.gob.ar/ftp/cuadros/publicaciones/calendario_2sem2026.pdf
 * INDEC difunde a las 16 h (hora argentina, UTC−3).
 */
import { type ISODate, type Period, formatISODate, formatPeriod } from '../engine';

export type ReleaseKind = 'ipc' | 'salarios';

export interface Release {
  date: ISODate;
  kind: ReleaseKind;
  /** Mes al que corresponde el dato. */
  ref: Period;
}

export const CALENDAR_SOURCE = 'https://www.indec.gob.ar/ftp/cuadros/publicaciones/calendario_2sem2026.pdf';

export const RELEASES: Release[] = [
  { date: '2026-10-13', kind: 'ipc', ref: '2026-09' },
  { date: '2026-11-12', kind: 'ipc', ref: '2026-10' },
  { date: '2026-12-15', kind: 'ipc', ref: '2026-11' },
  { date: '2026-10-21', kind: 'salarios', ref: '2026-08' },
  { date: '2026-11-13', kind: 'salarios', ref: '2026-09' },
  { date: '2026-12-16', kind: 'salarios', ref: '2026-10' },
];

export function releaseTitle(r: Release): string {
  return r.kind === 'ipc'
    ? `INDEC publica la inflación de ${formatPeriod(r.ref, 'long')}`
    : `INDEC publica el índice de salarios de ${formatPeriod(r.ref, 'long')}`;
}

/** Rótulo corto para listas. */
export function releaseShort(r: Release): string {
  return `${r.kind === 'ipc' ? 'Inflación' : 'Índice de salarios'} · ${formatPeriod(r.ref)}`;
}

/** Fecha de publicación del IPC de un mes, si está en el calendario. */
export function ipcReleaseDate(ref: Period): ISODate | undefined {
  return RELEASES.find((r) => r.kind === 'ipc' && r.ref === ref)?.date;
}

export function upcomingReleases(today: ISODate, kind?: ReleaseKind): Release[] {
  return RELEASES.filter((r) => r.date >= today && (!kind || r.kind === kind)).sort((a, b) => a.date.localeCompare(b.date));
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Pliega líneas a 75 octetos, como pide RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

/** Archivo .ics con las próximas publicaciones (a las 16 h de Argentina = 19 h UTC). */
export function buildIcs(releases: Release[], stamp: Date = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mi Inflacion//Calendario INDEC//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Mi Inflación · datos de INDEC'];
  for (const r of releases) {
    const d = r.date.replace(/-/g, '');
    const title = releaseTitle(r);
    const desc = r.kind === 'ipc'
      ? `Sale el IPC de ${formatPeriod(r.ref, 'long')} (16 h). Entrá a Mi Inflación para ver tu sueldo y tu alquiler actualizados.`
      : `Sale el índice de salarios de ${formatPeriod(r.ref, 'long')}. Entrá a Mi Inflación para ver si le ganaste al promedio.`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.kind}-${r.ref}@mi-inflacion`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${d}T190000Z`,
      `DTEND:${d}T193000Z`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(`${desc} Fuente: calendario de difusión de INDEC del ${formatISODate(r.date)}.`)}`,
      'BEGIN:VALARM',
      'TRIGGER:PT0M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Descarga un texto como archivo (el navegador lo ofrece para abrir con el calendario). */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
