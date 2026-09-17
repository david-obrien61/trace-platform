/**
 * LoadList — THE PAGE THE YARD PERSON CARRIES TO THE TRAILER (`/load-list?date=YYYY-MM-DD`).
 *
 * PURPOSE:      Lauren hand-assembles this today from several printouts. The route goes to the
 *               driver digitally; the LOAD goes on paper. This is the load half — **consolidated
 *               is the headline, per-stop breakdown underneath** (David's ruling): the yard person
 *               needs *"14 T-posts"*, and the per-stop detail is what you need when a stop gets
 *               dropped. Special mix is the FIRST line because it loads first, trees on top.
 * DEPENDENCIES: `readStops` (the ONE stop read every delivery surface uses — §6 r8 / STD-017) ·
 *               `readLoadListSettings` (the ladder + the Operations figures, ledger #343) ·
 *               `buildLoadList` (ALL arithmetic and every refusal, PURE and probed) ·
 *               `shipToLine` · `customerDisplayName` · `useBusinessContext`.
 *
 * 🔴 ONE LOCATION, MANY READS (ledger #343). Every size on this page is placed on the nursery's
 * container ladder; every figure it multiplies by is printed in "Figures used". The page computes
 * nothing — and it has its OWN two states for the sizes: "could not read sizes" and "no sizes set
 * up", which are different sentences because only one of them is the owner's to fix.
 * OUTPUTS:      A print-ready page. `window.print()` on the page itself.
 * INSTRUMENTATION (STD-003): [TRACE:LOADLIST] — ON by default (standing owner instruction).
 * STORY:        `user_stories.md` → *The delivery day load list* (5.4, delivery arc).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE PAGE MAY NEVER SILENTLY OMIT SOMETHING IT COULD NOT COMPUTE.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * David, 2026-09-12: *"Blank is indistinguishable from zero, and a yard person cannot tell the
 * difference between 'no T-posts needed' and 'we could not work it out.'"* Every line lands in one
 * of four kinds and every kind is printed — a tree, other goods, a line stating no size, or an
 * UNRESOLVED row carrying the raw text we failed on. Nothing is filtered. On paper this matters
 * more than on a screen: nobody can click a blank to ask what it meant.
 *
 * ⚠️ **DEER FENCE IS NOT IN THE DATA AND THE PAGE SAYS SO.** Measured 2026-09-12 across the whole
 * LAWNS tenant: zero order lines and zero stop notes mention deer, fence, T-post or stake, and
 * `order_service_selections` holds two rows in total. `DF` — *Deer Fencing* — exists as a
 * QuickBooks CATALOGUE item, and nothing on an order or a stop points at it. So every stop reaches
 * the model with `deerFence: null` and the page prints the in-total RULE ONCE, at the top, for the
 * person loading to apply by hand. ✏️ 2026-09-17 (David): it is a rule, not an UNRESOLVED line per stop
 * — the per-stop listing added in #343's first pass is gone; the tested in-total arithmetic stays.
 *
 * ⚠️ **PRINT IS A STYLESHEET ON A REAL ROUTE, NOT A GENERATED WINDOW** — `PositionDescription`'s
 * precedent and its reasoning: `shared/qr/print.ts` interpolates UNESCAPED into `document.write`,
 * which is fine for a SKU and not fine for customer names and typed addresses. Rendering through
 * React escapes by construction, adds no dependency, and print-to-PDF is the download.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, AlertTriangle } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '@trace/shared/supabase/client';
import { customerDisplayName } from '@trace/shared/utils/personName';
import { readStops } from '../lib/stopRead';
import { shipToLine, billingAsShipTo } from '../lib/stopWrites';
import { buildLoadList, LOAD_LIST_COPY, type LoadListModel, type ResolvedLoadItem } from '../lib/loadList';
import { readLoadListSettings, type LoadListSettingsRead } from '../lib/loadListSettingsRead';

const TRACE_LOADLIST = true; // [TRACE:LOADLIST] STD-003 — ON until David owner-proves

/**
 * The print rules. Black on white, no chrome, one stop never split across a page boundary.
 * `.sheet` drops every screen affordance — card, shadow, colour — because ink is not a screen.
 */
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .ll-block { page-break-inside: avoid; }
  .ll-headline { page-break-after: always; }
  /* The figures are REFERENCE, not load instructions — their own page, at the back (David, 2026-09-17). */
  .ll-figures { page-break-before: always; }
  .ll-row, .ll-stop { color: #000 !important; background: #fff !important; }
  .ll-flag { border: 2px solid #000 !important; background: #fff !important; }
}
@page { margin: 14mm; size: portrait; }
`;

const GREEN = '#27500A';
const RED = '#A32D2D';

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A date a person reads, from a `YYYY-MM-DD` with NO timezone shift (`new Date('2026-08-29')`
 *  is parsed as UTC and renders as the 28th west of Greenwich — the defect this avoids). */
function longDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const S = {
  page:   { minHeight: '100vh', background: '#EAF3DE', padding: '1.5rem 1rem' } as const,
  sheet:  { maxWidth: 800, margin: '0 auto', background: '#fff', borderRadius: 8,
            border: '1px solid #d6e3c4', padding: '1.5rem' } as const,
  h1:     { fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#111' } as const,
  h2:     { fontSize: '1.05rem', fontWeight: 800, margin: '1.5rem 0 .5rem', color: '#111',
            borderBottom: '2px solid #111', paddingBottom: '.25rem' } as const,
  big:    { fontSize: '1.35rem', fontWeight: 800, color: '#111' } as const,
  note:   { fontSize: '.8rem', color: '#444', margin: '.15rem 0 0' } as const,
  row:    { display: 'flex', justifyContent: 'space-between', gap: '1rem',
            padding: '.4rem 0', borderBottom: '1px solid #e3e3e3', fontSize: '.95rem' } as const,
  btn:    { display: 'inline-flex', alignItems: 'center', gap: '.5rem', minHeight: 48,
            padding: '0 1.1rem', background: GREEN, color: '#fff', border: 'none',
            borderRadius: 6, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' } as const,
  input:  { minHeight: 48, padding: '0 .75rem', fontSize: '1rem',
            border: '1px solid #b9c9a3', borderRadius: 6 } as const,
  flag:   { border: `2px solid ${RED}`, background: '#FFF6E5', borderRadius: 6,
            padding: '.75rem', margin: '.75rem 0' } as const,
};

/** One printed line. The quantity leads because that is what the yard person counts. */
function ItemRow({ item }: { item: ResolvedLoadItem }) {
  return (
    <div style={S.row} className="ll-row">
      <span>
        <strong>{item.quantity} ×</strong> {item.name}
        {item.sizeText ? <> {item.sizeText}</> : null}
        {item.reason ? <div style={S.note}>{item.reason}</div> : null}
      </span>
      <span style={{ color: '#666', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{item.sku ?? '—'}</span>
    </div>
  );
}

export function LoadList() {
  const [params, setParams] = useSearchParams();
  const { businessId, business, can } = useBusinessContext();
  const date = params.get('date') || todayYmd();

  const [model, setModel] = useState<LoadListModel | null>(null);
  const [settingsRead, setSettingsRead] = useState<LoadListSettingsRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const canReadLines = can('order_items:read');
    const [res, sr] = await Promise.all([
      readStops(supabase, businessId, { kind: 'day', date }, { readLines: canReadLines }),
      readLoadListSettings(businessId),
    ]);
    setSettingsRead(sr);
    if (!res.ok) { setError(res.error); setModel(null); setLoading(false); return; }

    const built = buildLoadList(date, res.value.stops.map(s => ({
      stopId: s.id,
      customerName: customerDisplayName(s.customers ?? {}, 'Customer'),
      address: shipToLine(s) || shipToLine(billingAsShipTo(s.customers)),
      serviceType: s.service_type,
      orderId: s.order_id,
      canReadLines: res.value.canReadLines,
      linesRead: res.value.linesRead,
      items: (s.order_id ? res.value.linesByOrderId.get(s.order_id) : undefined) ?? [],
      // Nothing stored marks a stop as fenced (measured 2026-09-12) — so the data cannot tell.
      deerFence: null,
    })), sr.settings);

    setError(null);
    setModel(built);
    setLoading(false);
    if (TRACE_LOADLIST) console.log('[TRACE:LOADLIST] built', {
      date, stops: built.stopCount, trees: built.treeCount, mixYards: built.mixYards,
      tPosts: built.tPosts, ropeFeet: built.ropeFeet, floors: built.totalsAreFloors,
      unresolved: built.unresolved.length, unreadStops: built.unreadStops,
      offLadderTrees: built.offLadderTreeCount, noVolumeRows: built.noVolumeTrees.length,
      deerFenceUnknownStops: built.deerFenceUnknownStops, sizes: sr.sizes, figures: sr.figures,
      valuesUsed: built.valuesUsed,
    });
  }, [businessId, date, can]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={S.page}>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 1rem',
        display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 700 }}>
          Delivery day{' '}
          <input type="date" value={date} style={S.input}
            onChange={e => setParams({ date: e.target.value })} />
        </label>
        <button type="button" style={S.btn} onClick={() => window.print()}
          disabled={!model || model.stopCount === 0}>
          <Printer size={18} /> Print this day
        </button>
        {model && model.stopCount === 0
          ? <span style={{ color: '#666' }}>Nothing to print — no stops on this day.</span>
          : null}
      </div>

      <div style={S.sheet} className="sheet">
        <h1 style={S.h1}>Load list — {longDate(date)}</h1>
        <p style={{ margin: '.25rem 0 0', color: '#444' }}>
          {business?.name ?? 'This business'}
          {model ? <> · {model.stopCount} stop{model.stopCount === 1 ? '' : 's'}</> : null}
        </p>

        {loading ? <p style={{ marginTop: '2rem' }}>Loading the day…</p> : null}

        {error ? (
          <div style={S.flag} className="ll-flag">
            <strong>Could not read this day.</strong>
            <div style={S.note}>{error} — nothing below is a complete list. Reload before you load the trailer.</div>
          </div>
        ) : null}

        {/* 🔴 THE SIZES' OWN TWO STATES (ledger #343) — above everything, because every tree below
            depends on them. A failed read and "none set up" are different sentences. */}
        {settingsRead?.sizes === 'failed' ? (
          <div style={S.flag} className="ll-flag">
            <strong><AlertTriangle size={16} /> Could not read container sizes.</strong>
            <div style={S.note}>{LOAD_LIST_COPY.sizesFailed}</div>
            {settingsRead.sizesMessage ? <div style={S.note}>{settingsRead.sizesMessage}</div> : null}
          </div>
        ) : null}
        {settingsRead?.sizes === 'none' ? (
          <div style={S.flag} className="ll-flag">
            <strong><AlertTriangle size={16} /> No container sizes set up.</strong>
            <div style={S.note}>{LOAD_LIST_COPY.sizesNone}</div>
          </div>
        ) : null}

        {model && !loading && model.stopCount === 0 ? (
          <p style={{ marginTop: '2rem', fontSize: '1.1rem' }}>{LOAD_LIST_COPY.emptyDay}</p>
        ) : null}

        {model && model.stopCount > 0 ? (
          <>
            {/* ── THE HEADLINE. Consolidated, and it gets its own page. ───────────────── */}
            <div className="ll-headline">
              {model.unreadStops > 0 ? (
                <div style={S.flag} className="ll-flag">
                  <strong><AlertTriangle size={16} /> This list may be short.</strong>
                  <div style={S.note}>
                    {model.unreadStops} stop{model.unreadStops === 1 ? '' : 's'} on this day could not be
                    read, so what they carry is not counted in any total below. They are listed by name.
                  </div>
                </div>
              ) : null}

              <h2 style={S.h2}>1 · Special mix — loads first</h2>
              <div style={S.big}>
                {model.mixYards} yard{model.mixYards === 1 ? '' : 's'} special mix
              </div>
              <p style={S.note}>
                {LOAD_LIST_COPY.mixFirst} {LOAD_LIST_COPY.mixRule(model.valuesUsed.installMixContainerVolumesPerTree)} ({model.mixGallons} gallons
                across the trees whose size is set up, rounded up to the next half yard.)
              </p>
              <p style={S.note}><strong>{LOAD_LIST_COPY.noMulch}</strong></p>

              <h2 style={S.h2}>2 · Trees — {model.treeCount} in total</h2>
              {model.trees.map(t => (
                <div key={`${t.name}|${t.rungLabel}`} style={S.row} className="ll-row">
                  <span><strong>{t.name} {t.sizeText}</strong> × {t.quantity}</span>
                  <span style={{ whiteSpace: 'nowrap', color: '#444' }}>
                    {t.tPosts * t.quantity} T-post{t.tPosts * t.quantity === 1 ? '' : 's'}
                    {' · '}{t.mixGallonsPerTree == null ? 'mix not set' : `${t.mixGallonsPerTree * t.quantity} gal mix`}
                  </span>
                </div>
              ))}
              {model.offLadderTreeCount > 0 ? (
                <div style={S.flag} className="ll-flag">
                  <strong>{LOAD_LIST_COPY.offLadderNote(model.offLadderTreeCount)}</strong>
                </div>
              ) : null}
              {model.noVolumeTrees.length > 0 ? (
                <div style={S.flag} className="ll-flag">
                  <strong>{LOAD_LIST_COPY.noVolumeNote}</strong>
                  {model.noVolumeTrees.map(t => (
                    <div key={`novol|${t.name}|${t.rungLabel}`} style={S.note}>{t.name} {t.sizeText} × {t.quantity}</div>
                  ))}
                </div>
              ) : null}

              <h2 style={S.h2}>3 · Hardware</h2>
              <div style={S.row} className="ll-row">
                <span style={S.big}>{model.tPosts} T-posts</span>
                <span style={S.note}>{LOAD_LIST_COPY.tPostRule}</span>
              </div>
              <div style={S.row} className="ll-row">
                <span style={S.big}>{model.ropeFeet} ft rope</span>
                <span style={S.note}>{LOAD_LIST_COPY.ropeRule(model.valuesUsed.ropeFeetPerTPost)}</span>
              </div>
              <div style={S.row} className="ll-row">
                <span style={S.big}>{model.bubblers} bubblers</span>
                <span style={S.note}>{LOAD_LIST_COPY.bubblerRule(model.valuesUsed.bubblersPerTree)}</span>
              </div>
              {model.trunkProtection > 0 ? (
                <div style={S.row} className="ll-row">
                  <span style={S.big}>{LOAD_LIST_COPY.trunkProtectionLine(model.trunkProtection)}</span>
                  <span style={S.note}>On the orders below — it goes on the trailer.</span>
                </div>
              ) : null}
              {model.deerFencePosts > 0 ? (
                <div style={S.row} className="ll-row">
                  <span style={S.big}>+{model.deerFencePosts} T-posts for deer fence</span>
                  <span style={S.note}>{LOAD_LIST_COPY.deerFenceTotal(model.valuesUsed.deerFenceTPostsPerTree)}</span>
                </div>
              ) : null}

              {model.totalsAreFloors ? (
                <div style={S.flag} className="ll-flag">
                  <strong>Every total above is a FLOOR, not a total.</strong>
                  <div style={S.note}>{LOAD_LIST_COPY.floorsNote}</div>
                  <div style={S.note}>
                    {model.unresolved.length > 0
                      ? `${model.unresolved.length} line${model.unresolved.length === 1 ? '' : 's'} could not be read.`
                      : ''}
                    {model.unreadStops > 0
                      ? ` ${model.unreadStops} stop${model.unreadStops === 1 ? '' : 's'} could not be read.`
                      : ''}
                  </div>
                </div>
              ) : null}

              {model.unresolved.length > 0 ? (
                <div style={S.flag} className="ll-flag">
                  <strong>{LOAD_LIST_COPY.unresolvedHeading} ({model.unresolved.length})</strong>
                  <div style={S.note}>{LOAD_LIST_COPY.unresolvedWhy}</div>
                  {model.unresolved.map((i, n) => <ItemRow key={n} item={i} />)}
                </div>
              ) : null}

              {/* 🔴 DEER FENCE PRINTS NOTHING UNLESS A STOP RECORDS IT (David, 2026-09-17). Until then
                  there is no rule, no ring and no footage on the sheet — the arithmetic is built and
                  tested for the day a stop can say so, and `deerFenceUnknownStops` keeps the count in
                  the trace. */}
              {model.stops.some(st => st.deerFence === 'yes') ? (
              <div style={S.flag} className="ll-flag">
                <strong>Deer fence — add by hand</strong>
                <div style={S.note}>{LOAD_LIST_COPY.deerFenceGap}</div>
                <div style={S.note}>{LOAD_LIST_COPY.ringRule}</div>
                {/* 🔴 R-156: the FEET, per size, so the hand-add is read off rather than worked
                    out on a trailer. Every figure comes from the model — `ringDiameterFeet` is
                    total, so a size we have never sold still prints a number here. */}
                <div style={S.note}><strong>{LOAD_LIST_COPY.deerFenceTotal(model.valuesUsed.deerFenceTPostsPerTree)}</strong></div>
                {model.trees.map(t => (
                  <div key={`fence|${t.name}|${t.rungLabel}`} style={S.row} className="ll-row">
                    <span>{t.name} {t.sizeText} × {t.quantity} · has {t.tPosts} stake post{t.tPosts === 1 ? '' : 's'}</span>
                    <span style={{ whiteSpace: 'nowrap', color: '#444' }}>
                      {t.ringDiameterFeet == null || t.fenceFeetPerTree == null
                        ? 'no volume set — ring not known'
                        : <>{t.ringDiameterFeet.toFixed(1)} ft ring · {Math.ceil(t.fenceFeetPerTree)} ft fence per tree
                          {' · '}{Math.ceil(t.fenceFeetPerTree) * t.quantity} ft if all {t.quantity} fenced</>}
                    </span>
                  </div>
                ))}
              </div>
              ) : null}

            </div>

            {/* ── PER-STOP. What you need when a stop gets dropped. ───────────────────── */}
            <h2 style={S.h2}>Per stop</h2>
            {model.stops.map(s => (
              <div key={s.stopId} style={{ margin: '0 0 1.25rem' }} className="ll-block ll-stop">
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{s.customerName}</div>
                <div style={{ color: '#444', fontSize: '.9rem' }}>{s.address || 'No address recorded'}</div>
                <div style={S.note}>
                  {s.treeCount} tree{s.treeCount === 1 ? '' : 's'} ·{' '}
                  {s.mixYards} yd mix ·{' '}
                  {s.tPosts} T-posts
                  {s.deerFencePosts > 0 ? ` (+${s.deerFencePosts} for deer fence)` : ''}
                  {s.offLadderTreeCount > 0 ? ` · ${s.offLadderTreeCount} tree${s.offLadderTreeCount === 1 ? '' : 's'} not a set-up size` : ''}
                  {s.unresolvedCount > 0
                    ? ` · ${s.unresolvedCount} line${s.unresolvedCount === 1 ? '' : 's'} could not be read`
                    : ''}
                </div>
                {s.problem ? (
                  <div style={S.flag} className="ll-flag"><strong>{s.problem}</strong></div>
                ) : null}
                {/* 🔴 PLANTING WORK ON THIS STOP — a tree already there. David, 2026-09-17: at Chris
                    Dubec it is "8 trees plus 1 extra on site which is (PYT)" — the crew plants NINE. */}
                {s.plantOnSite.length > 0 ? (
                  <div style={S.flag} className="ll-flag">
                    <strong>{LOAD_LIST_COPY.plantOnSite
                      .replace('%n', String(s.plantOnSite.reduce((n, i) => n + i.quantity, 0)))
                      .replace('%s', s.plantOnSite.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's')}</strong>
                  </div>
                ) : null}
                {/* Only what this sheet carries. A line we recognise as a charge, a discount or a
                    delivery option prints NOWHERE (David: "too confusing"). */}
                {s.items.filter(i => i.kind !== 'not_loaded' && i.kind !== 'plant_on_site')
                        .map((i, n) => <ItemRow key={n} item={i} />)}
              </div>
            ))}

              {/* 🔴 THE FIGURES USED (ledger #343) — every number the totals below multiplied by,
                printed, so nobody has to trust a figure they cannot see. */}
            {/* 🔴 ALSO ON THE TRUCK (David, 2026-09-17, second pass): anything physical the customer
                bought is loaded, so it prints — with its quantity, in no tree, mix or post total.
                Money lines still print nowhere. */}
            {model.otherGoods.length > 0 ? (
              <div className="ll-block">
                <h2 style={S.h2}>{LOAD_LIST_COPY.alsoOnTruckHeading}</h2>
                <p style={S.note}>{LOAD_LIST_COPY.alsoOnTruckWhy}</p>
                {model.otherGoods.map((i, n) => <ItemRow key={n} item={i} />)}
              </div>
            ) : null}

            <div className="ll-block ll-figures">
              <h2 style={S.h2}>{LOAD_LIST_COPY.valuesHeading}</h2>
              {settingsRead && settingsRead.figures !== 'stored' ? (
                <div style={S.flag} className="ll-flag">
                  <strong>
                    {settingsRead.figures === 'defaults_withheld'
                      ? 'These are the standard figures — the nursery’s own settings were refused for this login. Ask the owner to check your access.'
                      : settingsRead.figures === 'defaults_read_failed'
                        ? 'Could not read the nursery’s settings — these are the standard figures. Reload before you load.'
                        : 'No figures have been saved for this nursery — these are the standard ones.'}
                  </strong>
                </div>
              ) : null}
              <div style={S.row} className="ll-row"><span>Special mix per gallon of container</span><strong>{model.valuesUsed.installMixContainerVolumesPerTree} gal</strong></div>
              <div style={S.row} className="ll-row"><span>Rope per T-post</span><strong>{model.valuesUsed.ropeFeetPerTPost} ft</strong></div>
              <div style={S.row} className="ll-row"><span>Bubblers per tree</span><strong>{model.valuesUsed.bubblersPerTree}</strong></div>
              <div style={S.row} className="ll-row"><span>T-posts on a deer-fenced tree, in total</span><strong>{model.valuesUsed.deerFenceTPostsPerTree}</strong></div>
              <div style={S.row} className="ll-row"><span>Gallons in a cubic yard</span><strong>{model.valuesUsed.gallonsPerCubicYard.toFixed(3)}</strong></div>
              {model.valuesUsed.rungs.map(r => (
                <div key={`rung|${r.label}`} style={S.row} className="ll-row">
                  <span>{r.label} — {r.volumeGallons == null ? 'no volume set' : `${r.volumeGallons} gal container`}</span>
                  <span style={{ whiteSpace: 'nowrap' }}><strong>{r.tPosts} T-post{r.tPosts === 1 ? '' : 's'}</strong> <span style={S.note}>({r.tPostsBecause})</span></span>
                </div>
              ))}
            </div>

          </>
        ) : null}
      </div>
    </div>
  );
}
