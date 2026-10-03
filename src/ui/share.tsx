/**
 * "Compartir como imagen": arma un PNG con porcentajes (nunca montos) y lo comparte
 * con el menú del sistema; si el navegador no lo permite, lo descarga.
 */
import { useEffect, useState } from 'react';
import { IS_PREVIEW } from './router';

export interface ShareLine {
  label: string;
  value: string;
  /** Color de la marca: oficial, personal, sueldo o ninguno. */
  key?: 'oficial' | 'personal' | 'sueldo';
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareImage(title: string, lines: ShareLine[], footer: string): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  try { await document.fonts?.load?.('700 64px Archivo'); await document.fonts?.load?.('400 32px "Chivo Mono"'); } catch { /* sin fuentes: se usa la del sistema */ }
  const paper = '#fbfaf7';
  const ink = '#1d232b';
  const muted = '#5b6672';
  const colors = { oficial: cssVar('--oficial', '#2a78d6'), personal: cssVar('--personal', '#eb6834'), sueldo: cssVar('--sueldo', '#1baf7a') };
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  // Marca: dos etiquetas de precio.
  ctx.save();
  ctx.translate(80, 70);
  ctx.rotate(-0.14); ctx.fillStyle = colors.oficial; ctx.fillRect(0, 10, 70, 46);
  ctx.rotate(0.21); ctx.fillStyle = colors.personal; ctx.fillRect(22, 4, 70, 46);
  ctx.restore();
  ctx.fillStyle = ink;
  ctx.font = '700 40px Archivo, system-ui, sans-serif';
  ctx.fillText('Mi Inflación', 190, 112);
  ctx.font = '800 76px Archivo, system-ui, sans-serif';
  let y = 260;
  for (const l of wrap(ctx, title, W - 160)) { ctx.fillText(l, 80, y); y += 88; }
  y += 30;
  for (const line of lines) {
    if (line.key) { ctx.fillStyle = colors[line.key]; ctx.fillRect(80, y - 30, 24, 24); }
    ctx.fillStyle = muted;
    ctx.font = '500 36px Archivo, system-ui, sans-serif';
    const labelLines = wrap(ctx, line.label, W - 200);
    labelLines.forEach((l, i) => ctx.fillText(l, line.key ? 120 : 80, y + i * 44));
    y += labelLines.length * 44;
    if (line.value) {
      ctx.fillStyle = ink;
      ctx.font = '800 92px Archivo, system-ui, sans-serif';
      ctx.fillText(line.value, 80, y + 80);
      y += 120;
    }
    y += 26;
    if (y > H - 170) break;
  }
  ctx.fillStyle = muted;
  ctx.font = '400 28px "Chivo Mono", ui-monospace, monospace';
  for (const [i, l] of wrap(ctx, footer, W - 160).entries()) ctx.fillText(l, 80, H - 110 + i * 36);
  ctx.fillText('Solo porcentajes: la imagen no incluye montos.', 80, H - 50);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}

export function ShareButton({ title, lines, footer, label = 'Compartir como imagen' }: { title: string; lines: ShareLine[]; footer: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error' | 'copied'>('idle');
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => () => { if (img) URL.revokeObjectURL(img); }, [img]);
  const text = [title, ...lines.map((l) => (l.value ? `${l.label}: ${l.value}` : l.label)), footer].join('\n');
  const onClick = async () => {
    setState('busy');
    try {
      const blob = await renderShareImage(title, lines, footer);
      const file = new File([blob], 'mi-inflacion.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (IS_PREVIEW) {
        // En la vista previa no se puede descargar ni abrir el menú del sistema: se muestra la imagen.
        setImg(URL.createObjectURL(blob));
      } else if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Mi Inflación' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mi-inflacion.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setState('done');
    } catch (e) {
      // Cancelar el menú de compartir no es un error.
      setState(e instanceof DOMException && e.name === 'AbortError' ? 'idle' : 'error');
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState('copied'); } catch { setState('error'); }
  };
  return (
    <>
      <button type="button" className="btn secondary small" onClick={onClick} disabled={state === 'busy'}>{state === 'busy' ? 'Preparando…' : label}</button>
      <button type="button" className="linkbtn small" onClick={copy}>Copiar el resumen</button>
      {state === 'done' && !img && <span className="small muted">Listo.</span>}
      {state === 'copied' && <span className="small muted">Resumen copiado.</span>}
      {state === 'error' && <span className="small muted">No se pudo en este navegador. Probá con "Copiar el resumen".</span>}
      {img && (
        <figure className="share-preview">
          <img src={img} alt={`Imagen para compartir: ${text.replace(/\n/g, '. ')}`} />
          <figcaption className="small muted">En la versión publicada esta imagen se descarga o se comparte directo. Acá podés hacerle una captura.</figcaption>
        </figure>
      )}
    </>
  );
}
