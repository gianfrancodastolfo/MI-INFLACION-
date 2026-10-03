import { useMemo, useState } from 'react';
import { calculateInflation, type Period, comparePeriods } from '../../engine';
import type { OwnPriceObservation } from '../../domain/ownPrice';
import { getSeries } from '../../domain/data';
import type { ProvinceRegion } from '../../domain/regions';
import { addMonths, formatPeriod } from '../../engine';
import { DIVISION_BY_ID, RUBROS, type DivisionId } from '../../domain/categories';
import { compareProfile } from '../../domain/calculations';
import { DATASET, LAST_PERIOD, aperturaKey } from '../../domain/data';
import { formatMoney, formatPct, formatPP } from '../../domain/format';
import {
  type Profile, averageProfile, emptyProfile, exampleProfile, isProfileComplete, itemsTotal, officialSharesAt, profileRegion, rubroAmount, totalSpending,
} from '../../domain/profile';
import { GBA_PARTIDOS, REGION_LONG_NAMES, REGION_NAMES } from '../../domain/regions';
import { SharePair } from '../charts';
import { Explain, MoneyInput, MonthPicker, Notice, ProvinceSelect, Segmented, SourceBadge } from '../components';
import { Link } from '../router';
import { useApp } from '../state';

export function MiInflacion() {
  const { profile, setProfile } = useApp();
  const p: Profile = profile ?? emptyProfile();
  const region = profileRegion(p);
  const total = totalSpending(p);
  const [startTotal, setStartTotal] = useState<number | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const edit = (patch: Partial<Profile>) =>
    setProfile({ ...p, ...patch, origin: p.origin === 'ejemplo' ? 'manual' : p.origin, edited: p.origin === 'promedio' || p.origin === 'ejemplo' ? true : p.edited });
  const setAmount = (id: DivisionId, v: number | null) => edit({ amounts: { ...p.amounts, [id]: v ?? 0 } });
  const setItem = (id: string, v: number | null) => edit({ items: { ...p.items, [id]: v ?? 0 } });

  const ipcShares = useMemo(() => (region ? officialSharesAt(region, LAST_PERIOD) : undefined), [region]);
  const maxShare = useMemo(() => {
    const mine = RUBROS.map((r) => (total > 0 ? rubroAmount(p, r.id) / total : 0));
    const off = ipcShares ? Object.values(ipcShares) : [];
    return Math.max(0.05, ...mine, ...off);
  }, [p, total, ipcShares]);

  const quick = useMemo(() => (isProfileComplete(p) ? compareProfile(p, addMonths(LAST_PERIOD, -12), LAST_PERIOD) : null), [p]);
  const top = RUBROS.map((r) => ({ r, v: rubroAmount(p, r.id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);

  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Calculá tu inflación</span>
        <h1>Tu canasta, con los precios oficiales de tu región</h1>
        <p className="lede">Contanos dónde vivís y cuánto gastás por mes en cada rubro. Con eso estimamos cómo cambió el costo de tu forma de vivir, usando los índices de INDEC de cada categoría.</p>
      </header>

      <div className="grid-2">
        <div className="stack">
          <section className="card stack" aria-labelledby="loc-h">
            <h2 id="loc-h" style={{ fontSize: 'var(--step-2)' }}>¿Dónde vivís?</h2>
            <div className="field">
              <label htmlFor="prof-province">Provincia</label>
              <ProvinceSelect id="prof-province" value={p.provinceId} onChange={(v) => setProfile({ ...p, provinceId: v, conurbano: v === 'buenos-aires' ? p.conurbano : undefined })} />
            </div>
            {p.provinceId === 'buenos-aires' && (
              <div className="stack-sm">
                <span className="label">¿Vivís en el conurbano?</span>
                <Segmented
                  label="Conurbano o interior"
                  value={p.conurbano === undefined ? '' : p.conurbano ? 'si' : 'no'}
                  options={[{ value: 'si', label: 'Sí, en el conurbano' }, { value: 'no', label: 'No, en el interior de la provincia' }]}
                  onChange={(v) => setProfile({ ...p, conurbano: v === 'si' })}
                />
                <Explain title="¿Qué partidos son conurbano?">
                  <p>Para INDEC, la región GBA es la Ciudad de Buenos Aires más 24 partidos: {GBA_PARTIDOS.join(', ')}. El resto de la provincia (incluidas La Plata, Mar del Plata y Bahía Blanca) está en la región Pampeana.</p>
                </Explain>
              </div>
            )}
            {region && (
              <div className="row">
                <SourceBadge kind="oficial">IPC región {REGION_NAMES[region]}</SourceBadge>
                <span className="small muted">{REGION_LONG_NAMES[region]}. INDEC no publica inflación por ciudad ni por barrio.</span>
              </div>
            )}
          </section>

          {region && total === 0 && (
            <section className="card stack" aria-labelledby="start-h">
              <h2 id="start-h" style={{ fontSize: 'var(--step-2)' }}>¿Cómo querés empezar?</h2>
              <div className="fields-2">
                <div className="stack-sm">
                  <span className="label">Partir del promedio de tu región</span>
                  <p className="small muted">Ingresá cuánto gastás en total por mes y lo repartimos como la canasta del IPC. Después cambiás los rubros que en tu caso son distintos.</p>
                  <MoneyInput id="prof-start-total" value={startTotal} placeholder="Gasto mensual total" onChange={setStartTotal} ariaLabel="Gasto mensual total" />
                  <div>
                    <button type="button" className="btn" disabled={!startTotal} onClick={() => { const a = averageProfile(p, startTotal ?? 0); if (a) setProfile(a); }}>
                      Usar el promedio
                    </button>
                  </div>
                </div>
                <div className="stack-sm">
                  <span className="label">Cargar tus gastos desde cero</span>
                  <p className="small muted">Completá los rubros de abajo con montos aproximados. Los que dejes vacíos cuentan como cero.</p>
                </div>
              </div>
            </section>
          )}

          {region && (
            <section className="card" aria-labelledby="rub-h">
              <div className="section-head">
                <h2 id="rub-h" style={{ fontSize: 'var(--step-2)' }}>Tus gastos por mes</h2>
                <div className="legend">
                  <span><span className="key personal" />Tu peso</span>
                  <span><span className="key oficial" />Peso en el IPC de {REGION_NAMES[region]}</span>
                </div>
              </div>
              {RUBROS.map((r) => {
                const amount = rubroAmount(p, r.id);
                const fromItems = itemsTotal(p, r.id) != null;
                const mine = total > 0 ? amount / total : 0;
                const off = ipcShares?.[r.id] ?? 0;
                const isOpen = open[r.id] ?? fromItems;
                return (
                  <div className="rubro" key={r.id}>
                    <div className="rubro-head">
                      <div>
                        <div className="rubro-title">{r.label}</div>
                        <div className="rubro-hint">{r.hint}</div>
                      </div>
                      <button type="button" className="linkbtn small" aria-expanded={isOpen} aria-controls={`items-${r.id}`} onClick={() => setOpen({ ...open, [r.id]: !isOpen })}>
                        {isOpen ? 'Ocultar detalle' : 'Detallar'}
                      </button>
                    </div>
                    <div className="rubro-body">
                      {fromItems ? (
                        <div className="small"><strong>{formatMoney(amount)}</strong> <span className="muted">(suma del detalle)</span></div>
                      ) : (
                        <MoneyInput id={`rub-${r.id}`} value={p.amounts[r.id] ?? null} onChange={(v) => setAmount(r.id, v)} ariaLabel={`${r.label}, monto mensual`} />
                      )}
                      <div className="stack-sm" style={{ gap: 4 }}>
                        <SharePair mine={mine} official={off} max={maxShare} />
                        <span className="small muted">Tu peso {formatPct(mine, 0)} · IPC {formatPct(off, 0)} <span className="sr-only">Índice usado: {DIVISION_BY_ID[r.id].name}</span></span>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="items" id={`items-${r.id}`}>
                        {r.items.map((it) => (
                          <div className="field" key={it.id}>
                            <label htmlFor={`item-${it.id}`}>{it.label}</label>
                            <MoneyInput id={`item-${it.id}`} value={p.items[it.id] ?? null} onChange={(v) => setItem(it.id, v)} />
                            {it.ownPrice && (p.items[it.id] ?? 0) > 0 && (
                              <OwnPriceEditor
                                itemId={it.id}
                                label={it.label}
                                now={p.items[it.id]!}
                                weightsPeriod={p.weightsPeriod}
                                value={p.ownPrices?.[it.id]}
                                indexChange={(from) => divisionChange(region, r.id, from, p.weightsPeriod)}
                                onChange={(obs) => {
                                  const next = { ...(p.ownPrices ?? {}) };
                                  if (obs) next[it.id] = obs; else delete next[it.id];
                                  edit({ ownPrices: next });
                                }}
                              />
                            )}
                          </div>
                        ))}
                        <p className="note">
                          {(() => {
                            const avail = r.items.filter((it) => it.apertura && DATASET.aperturas?.[region]?.[aperturaKey(it.apertura)]);
                            return avail.length > 0
                              ? `Con subgrupos de INDEC: ${avail.map((it) => `${it.label.toLowerCase()} → «${it.apertura}»`).join('; ')}. El resto del rubro se valúa con la división «${DIVISION_BY_ID[r.id].name}».`
                              : `Con los datos actuales, todo el rubro se valúa con el índice de la división «${DIVISION_BY_ID[r.id].name}» de tu región. El detalle te ayuda a estimar y queda listo para usar subgrupos de INDEC (por ejemplo, alquiler o prepagas) cuando se incorporen.`;
                          })()}
                          {r.items.filter((it) => it.note).map((it) => ` ${it.note}`).join('')}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <aside className="stack sticky-col" aria-label="Resumen de tu perfil">
          <div className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="eyebrow">Tu perfil</span>
              <SourceBadge kind="estimacion" />
            </div>
            {!region ? (
              <>
                <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Elegí tu provincia: define qué región del IPC usamos.</li>
                  <li>Cargá cuánto gastás por mes en cada rubro (montos aproximados alcanzan).</li>
                  <li>Ves tu inflación, la del IPC de tu región y qué explica la diferencia.</li>
                </ol>
                <div><button type="button" className="btn secondary small" onClick={() => setProfile(exampleProfile())}>Ver un ejemplo</button></div>
                <p className="small muted">El ejemplo es una persona que alquila en CABA, viaja en transporte público y tiene prepaga.</p>
              </>
            ) : total === 0 ? (
              <p className="muted">Cargá al menos un gasto para calcular tu inflación.</p>
            ) : (
              <>
                {p.origin === 'ejemplo' && (
                  <Notice tone="warn"><strong>Perfil de ejemplo.</strong> No son tus datos: cambiá cualquier monto para empezar el tuyo, o borralo abajo.</Notice>
                )}
                <div>
                  <div className="label">Gasto mensual total</div>
                  <div className="hero-figure" style={{ fontSize: 'var(--step-4)' }}>{formatMoney(total)}</div>
                </div>
                {top.length > 0 && (
                  <p className="small">Tus rubros principales: {top.map((x) => `${x.r.label.toLowerCase()} (${formatPct(x.v / total, 0)})`).join(', ')}.</p>
                )}
                {quick?.ok && (
                  <div className="tiles">
                    <div className="tile">
                      <div className="t-label"><span className="key personal" />Tu inflación, últimos 12 meses</div>
                      <div className="t-value">{formatPct(quick.value.personal.inflation)}</div>
                    </div>
                    <div className="tile">
                      <div className="t-label"><span className="key oficial" />IPC {REGION_NAMES[region]}</div>
                      <div className="t-value">{formatPct(quick.value.published?.inflation ?? quick.value.official.inflation)}</div>
                      <div className="t-sub">Diferencia: {formatPP(quick.value.personal.inflation - (quick.value.published?.inflation ?? quick.value.official.inflation))}</div>
                    </div>
                  </div>
                )}
                <p className="small muted">
                  {p.origin === 'promedio' && !p.edited
                    ? 'Es el promedio de tu región: todavía no refleja tus gastos. Cambiá los rubros que en tu caso son distintos.'
                    : Object.values(p.ownPrices ?? {}).some((o) => (o?.amount ?? 0) > 0)
                      ? `Precisión: incluye tus aumentos reales en ${Object.entries(p.ownPrices ?? {}).filter(([, o]) => (o?.amount ?? 0) > 0).length} ítem(s); el resto se valúa con índices de INDEC. No es una medición oficial.`
                    : DATASET.aperturas && Object.values(p.items).some((v) => (v ?? 0) > 0)
                      ? 'Precisión: estimación basada en una estructura de gastos más específica (subgrupos de INDEC donde existen). No es una medición oficial.'
                      : 'Precisión: estimación basada en 12 categorías generales del IPC. No es una medición oficial.'}
                </p>
                <div className="row">
                  <Link to="comparar" className="btn">Ver la comparación</Link>
                  <Link to="inicio" className="btn secondary">Calcular mi sueldo</Link>
                </div>
              </>
            )}
          </div>

          {region && total > 0 && (
            <div className="card stack">
              <MonthPicker id="prof-ref" label="¿De qué mes son estos montos?" value={p.weightsPeriod} onChange={(v) => edit({ weightsPeriod: v })} />
              <p className="small muted">Usamos el último mes con datos ({formatPeriod(LAST_PERIOD)}) si no elegís otro. Importa porque tus montos ya incluyen las subas hasta ese mes.</p>
              <hr className="divider" />
              <p className="small muted">Se guarda automáticamente en este navegador. No se envía a ningún servidor.</p>
              {!confirmReset ? (
                <div><button type="button" className="btn danger small" onClick={() => setConfirmReset(true)}>Borrar mi perfil</button></div>
              ) : (
                <div className="row">
                  <span className="small">¿Borrar tus gastos y tu ubicación?</span>
                  <button type="button" className="btn danger small" onClick={() => { setProfile(null); setConfirmReset(false); }}>Sí, borrar</button>
                  <button type="button" className="btn secondary small" onClick={() => setConfirmReset(false)}>Cancelar</button>
                </div>
              )}
            </div>
          )}

          <Notice>
            La inflación personal es una estimación de la app con tus datos y los índices oficiales de cada categoría. El IPC es el indicador estadístico oficial.
          </Notice>
        </aside>
      </div>
    </>
  );
}

function divisionChange(region: ProvinceRegion, division: DivisionId, from: Period, to: Period): number | null {
  const s = getSeries(region, division);
  if (!s) return null;
  const r = calculateInflation(s, from, to);
  return r.ok ? r.value : null;
}

/** "¿Cuánto pagabas antes?": precio propio para contratos y facturas. */
function OwnPriceEditor({
  itemId, label, now, weightsPeriod, value, indexChange, onChange,
}: {
  itemId: string; label: string; now: number; weightsPeriod: Period; value?: OwnPriceObservation;
  indexChange: (from: Period) => number | null; onChange: (obs: OwnPriceObservation | null) => void;
}) {
  const [open, setOpen] = useState(!!value);
  const defaultPeriod = addMonths(weightsPeriod, -12);
  if (!open) {
    return (
      <button type="button" className="linkbtn small" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        ¿Sabés cuánto pagabas antes? Usá tu aumento real
      </button>
    );
  }
  const period = value?.period ?? defaultPeriod;
  const own = value && value.amount > 0 ? now / value.amount - 1 : null;
  const idx = indexChange(period);
  return (
    <div className="stack-sm own-price">
      <MonthPicker id={`own-${itemId}`} label={`${label}: ¿en qué mes?`} value={period} max={addMonths(weightsPeriod, -1)}
        onChange={(pp) => onChange({ period: pp, amount: value?.amount ?? 0 })} />
      <div className="field">
        <label htmlFor={`own-${itemId}-amt`}>¿Cuánto pagabas?</label>
        <MoneyInput id={`own-${itemId}-amt`} value={value?.amount ?? null} onChange={(v) => onChange(v ? { period, amount: v } : null)} />
      </div>
      {own != null && comparePeriods(period, weightsPeriod) < 0 && (
        <span className="small">
          Tu aumento: <strong>{formatPct(own)}</strong>{idx != null ? <> · índice de la categoría en tu región: {formatPct(idx)}</> : null}. Se usa tu aumento real para este ítem.
        </span>
      )}
      <button type="button" className="linkbtn small" style={{ alignSelf: 'flex-start' }} onClick={() => { onChange(null); setOpen(false); }}>Quitar</button>
    </div>
  );
}
