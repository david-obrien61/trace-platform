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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, AlertTriangle } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '@trace/shared/supabase/client';
import { customerDisplayName } from '@trace/shared/utils/personName';
import { readStops, type StopRow, type StopRead } from '../lib/stopRead';
import { parseStopsParam, pickStops, stopsParamFor, groupStopsByTeam, sheetIsSectioned, type TeamSection } from '../lib/loadListSubset';
import { stopChecks, CHECKS_COPY, type LoadCheck } from '../lib/loadListChecks';
import { readTeams, teamLabel, type Team } from '../lib/teams';
import { routeOrderLine, dayRoutedAt } from '../lib/routeOrder';
import { buildLoadList, LOAD_LIST_COPY, type LoadListModel, type ResolvedLoadItem } from '../lib/loadList';
import { readLoadListSettings, type LoadListSettingsRead } from '../lib/loadListSettingsRead';
import { loadInputFor } from '../lib/loadStopInput';

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
  /* 🔴 A TEAM'S SECTION STARTS ON ITS OWN PAGE (ledger #373) — a crew is handed ITS pages, and a
     section that begins halfway down another team's sheet gets loaded onto the wrong trailer. */
  .ll-team { page-break-before: always; }
  .ll-team:first-of-type { page-break-before: auto; }
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

/**
 * ── THE SHEET BODY — the bulk, the trees to pull, the stops, and the figures used. ───────────
 *
 * 🔴 EXTRACTED VERBATIM, NOT REWRITTEN (ledger #373, teams piece 4). This is the body the page has
 *    always rendered, moved into a component so it can be rendered ONCE PER TEAM without a second
 *    copy of it existing. A per-team sheet that re-stated any of this would be two representations
 *    of one layout (STD-011) and the copy that drifts is always the one nobody prints.
 * 🔴 IT TAKES A MODEL AND RENDERS IT — it does no arithmetic and reads no team. That is what makes a
 *    section's totals correct by construction: the caller hands it `buildLoadList` over THAT team's
 *    stops, so the allow-list and every roll-up rule are inherited rather than re-applied.
 */

/**
 * PAGE 4 — CHECK BEFORE YOU LOAD (David, 2026-09-25).
 *
 * 🔴 TWO SECTIONS, AND THE SECOND ONE IS THE POINT. (a) anything unreadable, each as
 *    `<stop> — <line as written> — why`; (b) INCONSISTENCIES, each naming the stop and what
 *    disagrees. David: *"these are good for identification of broken/inconsistent processes."*
 *    The sheet is not only telling a crew what to load — it is telling the office which orders were
 *    written wrong, on the morning somebody can still fix them.
 *
 * ⚠️ AN EMPTY PAGE 4 SAYS SO IN ONE LINE. A page that renders nothing is indistinguishable from a
 *    page that failed to render, and "nothing to check" is a real answer worth reading.
 */
function CheckPage({ checks }: { checks: LoadCheck[] }) {
  const unreadable = checks.filter(c => c.kind === 'unreadable');
  const inconsistent = checks.filter(c => c.kind === 'inconsistency');
  return (
    <div className="ll-block ll-figures">
      <h2 style={S.h2}>Check before you load</h2>
      {checks.length === 0 ? (
        <div style={S.note}>{CHECKS_COPY.nothingToCheck}</div>
      ) : (
        <>
          <div style={{ marginTop: 8 }}>
            <strong>Could not be read ({unreadable.length})</strong>
            {unreadable.length === 0
              ? <div style={S.note}>Nothing — every line read cleanly.</div>
              : unreadable.map((c, n) => (
                  <div key={`u${n}`} style={S.note}>
                    <strong>{c.customerName}</strong>{c.asWritten ? <> — “{c.asWritten}”</> : null} — {c.why}
                  </div>
                ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>Does not agree with itself ({inconsistent.length})</strong>
            <div style={S.note}>
              These are not problems with this sheet. They are orders written two ways, and this is
              where they are easiest to fix.
            </div>
            {inconsistent.length === 0
              ? <div style={S.note}>Nothing — no stop disagrees with its own order.</div>
              : inconsistent.map((c, n) => (
                  <div key={`i${n}`} style={S.note}>
                    <strong>{c.customerName}</strong>{c.asWritten ? <> — “{c.asWritten}”</> : null} — {c.why}
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  );
}

function SheetBody({ model, planNo, isSubset, settingsRead }: {
  model: LoadListModel;
  planNo: Map<string, number | null>;
  isSubset: boolean;
  settingsRead: LoadListSettingsRead | null;
  // Where the per-tree figures came from — the same sentence on every section, because it is a fact
  // about the NURSERY's settings, not about a team.
}) {
  const pick = { isSubset };
  return (
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

              {/* 🔴 THE SHEET READS THE WAY THE TRAILER IS LOADED (David, 2026-09-18, ledger #355): the
                  bulk goes on first, so page 1 is the bulk — mix, posts, rope, bubblers, kits, trunk
                  protection — and the stops, each with its own trees, start on page 2. */}
              <h2 style={S.h2}>{LOAD_LIST_COPY.bulkHeading}</h2>
              <div style={S.big}>
                {model.mixYards} yard{model.mixYards === 1 ? '' : 's'} special mix
              </div>
              <p style={S.note}>
                {LOAD_LIST_COPY.mixFirst} {LOAD_LIST_COPY.mixRule(model.valuesUsed.installMixContainerVolumesPerTree)} ({model.mixGallons} gallons
                across the trees whose size is set up, rounded up to the next half yard.)
              </p>
              <p style={S.note}><strong>{LOAD_LIST_COPY.noMulch}</strong></p>
              <div style={S.row} className="ll-row">
                <span style={S.big}>{model.tPosts} T-posts</span>
                <span style={S.note}>{LOAD_LIST_COPY.tPostRule}</span>
              </div>
              <div style={S.row} className="ll-row">
                <span style={S.big}>{model.ropeFeet} ft rope</span>
                <span style={S.note}>{LOAD_LIST_COPY.ropeRule(model.valuesUsed.ropeFeetPerTPost)}</span>
              </div>
              {/* 🔴 BUBBLERS ARE THE ONES BILLED (David, 2026-09-18) — and zero is printed in words,
                  never as a bare 0, because a 0 in a quantity column reads as an omission. */}
              <div style={S.row} className="ll-row">
                <span style={S.big}>
                  {model.bubblers > 0 ? `${model.bubblers} bubblers` : `Bubblers — ${LOAD_LIST_COPY.bubblersNoneSpecified}`}
                </span>
                <span style={S.note}>{LOAD_LIST_COPY.bubblerRule(model.valuesUsed.bubblersPerTree)}</span>
              </div>
              {/* Prebuilt, on the shelf: a COUNT only — never the parts. */}
              <div style={S.row} className="ll-row">
                <span style={S.big}>
                  {model.waterMonitors > 0 ? `${model.waterMonitors} water monitor kits` : 'Water monitor kits — none'}
                </span>
                <span style={S.note}>
                  {model.waterMonitors > 0 ? LOAD_LIST_COPY.waterMonitorRule : LOAD_LIST_COPY.waterMonitorNone}
                </span>
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

              {/* 🔴 THE PULL LIST (ledger #358, David 2026-09-20 with Lauren's answer). The yard pulls BY
                  VARIETY, stages, then checks names — so the roll-up is not a second copy of the stops,
                  it is the step before them, and it sits directly under the bulk because both are
                  "go and fetch this". ✏️ This REVERSES ledger #355's one-line version (2026-09-18), which
                  cut it on the belief that nothing is loaded by variety. Lauren: they pull by variety. */}
              {/* 🔴 RESTORED TO PAGE 1 AFTER I BROKE IT — and the way I broke it is the lesson.
                  Removing the "Figures used for this list" page took this warning with it, and the
                  comment I left in its place CLAIMED the warning "still prints on page 1". It did
                  not. `loadListPage.test.ts` S6 caught it; I had asserted it in prose instead of
                  checking, which is [[R-26]] in my own diff.
                  ⚠️ IT BELONGS AT THE TOP, NOT WHERE IT WAS. On the deleted page it sat behind the
                  whole load; a person who is using the WRONG FIGURES needs to know before they pick
                  anything, not after. D-9: a sheet built on standard figures must never read as one
                  built on the nursery's own. */}
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
              <h2 style={S.h2}>{LOAD_LIST_COPY.pullHeading(model.treeCount, model.stopCount)}</h2>
              <p style={S.note}>{LOAD_LIST_COPY.pullWhy}</p>
              {model.trees.map(t => (
                <div key={`pull|${t.name}|${t.rungLabel}`} style={S.row} className="ll-row">
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

              {/* 🔴 THE "EVERY TOTAL ABOVE IS A FLOOR" BANNER IS GONE — David, 2026-09-25.
                  It sat above every total on every sheet and said the same thing whatever the day
                  held, so it stopped being read — a warning that is always on is wallpaper.
                  ⚠️ WHAT IT WARNED ABOUT IS NOT DROPPED, IT IS MOVED AND MADE SPECIFIC: every
                  unreadable line now appears on PAGE 4 as "<stop> — <line as written> — why", which
                  names the stop a person has to go and look at. Nothing unreadable may vanish
                  (David, 2026-09-12) — page 4 is the guarantee, not this banner. */}

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

            {/* ── THE STOPS, from page 2 — each customer with their trees and quantities. ─── */}
            <h2 style={S.h2}>{LOAD_LIST_COPY.stopsHeading}</h2>
            {/* 🔴 THE NAME CHECK AT STAGING (ledger #358): a tree's tag carries the CUSTOMER'S name, and
                the yard matches tags to these names. The sheet is the other half of a check they already run. */}
            <p style={S.note}>{LOAD_LIST_COPY.stopsWhy}</p>
            {model.stops.map(s => (
              <div key={s.stopId} style={{ margin: '0 0 1.25rem' }} className="ll-block ll-stop">
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  {/* On a partial sheet each stop carries its number in the DAY's plan, so a crew can
                      match its paper to the phone, which lists the whole day (ledger #354). */}
                  {pick?.isSubset && planNo.get(s.stopId) != null ? `${planNo.get(s.stopId)}. ` : ''}{s.customerName}
                </div>
                <div style={{ color: '#444', fontSize: '.9rem' }}>{s.address || 'No address recorded'}</div>
                <div style={S.note}>
                  {s.treeCount} tree{s.treeCount === 1 ? '' : 's'} ·{' '}
                  {s.mixYards} yd mix ·{' '}
                  {s.tPosts} T-posts
                  {s.deerFencePosts > 0 ? ` (+${s.deerFencePosts} for deer fence)` : ''}
                  {s.bubblers > 0 ? ` · ${s.bubblers} bubbler${s.bubblers === 1 ? '' : 's'}` : ''}
                  {s.waterMonitors > 0 ? ` · ${s.waterMonitors} water monitor kit${s.waterMonitors === 1 ? '' : 's'}` : ''}
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

            {/* 🔴 "FIGURES USED FOR THIS LIST" IS GONE — David, 2026-09-25. It was a whole
                printed page of settings on a sheet a crew carries into a yard. What a figure
                came from now travels WITH the figure (each line says its own basis), so the
                page was a second representation of one fact (STD-011) and the one nobody read.
                ⚠️ Nothing it reported has been lost: the per-rung T-post note still prints
                beside its rung, and a withheld-settings warning still prints on page 1. */}

    </>
  );
}

export function LoadList() {
  const [params, setParams] = useSearchParams();
  const { businessId, business, can } = useBusinessContext();
  const date = params.get('date') || todayYmd();
  // 🔴 ONE SHEET PER CREW (ledger #354). `stops=` absent = the whole day; present = only those stops.
  const stopsParam = params.get('stops');
  const requested = useMemo(() => parseStopsParam(stopsParam), [stopsParam]);

  // The day as read — every stop on the date, whatever this sheet carries.
  const [dayRead, setDayRead] = useState<StopRead | null>(null);
  // 🔴 NAMES ONLY (ledger #373). The stop carries `team_id`; the team's NAME lives in the team
  // list, so the sheet reads it to LABEL a section. A failed team read never hides a stop — the
  // sections are built from the stops themselves, and an unnamed team still prints its stops.
  const [teams, setTeams] = useState<Team[]>([]);
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
    if (!res.ok) { setError(res.error); setDayRead(null); setLoading(false); return; }
    setError(null);
    setDayRead(res.value);
    setLoading(false);
  }, [businessId, date, can]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!businessId) return;
    void readTeams(supabase, businessId).then(r => { if (r.ok) setTeams(r.teams); });
  }, [businessId]);

  // Which of the day's stops this sheet carries. Ticking re-picks from the day already read — no re-fetch.
  const pick = useMemo(() => (dayRead ? pickStops(dayRead.stops, requested) : null), [dayRead, requested]);
  // The day's stops as read — kept only to say whether the stops on this sheet were planned (ledger #351).
  const stopsRead: StopRow[] | null = pick ? pick.kept : null;

  // 🔴 ONLY THE KEPT STOPS REACH THE MODEL. `buildLoadList` is pure over its input, so every total on
  // a crew's sheet is for that crew's stops, and the day's totals are never computed for it.
  const model = useMemo<LoadListModel | null>(() => {
    if (!dayRead || !pick || !settingsRead) return null;
    return buildLoadList(date, pick.kept.map(s => loadInputFor(s, dayRead)), settingsRead.settings);
  }, [dayRead, pick, settingsRead, date]);

  // PAGE 4's content — every stop's checks, for the WHOLE day, in the order the stops print.
  // ⚠️ Computed from the same `stopChecks` the install decision uses, so the sheet cannot load a kit
  //    on a basis page 4 does not mention, or mention one it did not load for (STD-011).
  const dayChecks = useMemo<LoadCheck[]>(() => {
    if (!dayRead || !pick) return [];
    return pick.kept.flatMap(s => stopChecks({
      stopId: s.id,
      customerName: customerDisplayName(s.customers ?? {}, 'Customer'),
      serviceType: s.service_type,
      markedInstall: s.order_id ? dayRead.transportByOrderId.get(s.order_id) === 'install' : false,
      lines: (s.order_id ? dayRead.linesByOrderId.get(s.order_id) : undefined) ?? [],
    }).checks);
  }, [dayRead, pick]);

  // 🔴 ONE SECTION PER TEAM (ledger #373, teams piece 4 — David, 2026-09-21). The stops this sheet
  // CARRIES are grouped by the team that takes them, and each section's totals are `buildLoadList`
  // over that section's stops — the same builder, so the allow-list and every roll-up rule are the
  // ones the day's sheet already uses. Nothing here re-states a rule.
  // ⚠️ A day where NOT ONE stop carries a team renders exactly as before: `sheetIsSectioned` is false
  // and the page prints the single whole-day model, with no headers and no "No team" caption.
  const sections = useMemo<TeamSection<StopRow>[]>(() => (pick ? groupStopsByTeam(pick.kept) : []), [pick]);
  const sectioned = sheetIsSectioned(sections);
  const sectionSheets = useMemo(() => {
    if (!dayRead || !settingsRead || !sectioned) return null;
    return sections.map(sec => ({
      teamId: sec.teamId,
      stopCount: sec.stops.length,
      model: buildLoadList(date, sec.stops.map(s => loadInputFor(s, dayRead)), settingsRead.settings),
    }));
  }, [sections, sectioned, dayRead, settingsRead, date]);

  useEffect(() => {
    if (!TRACE_LOADLIST || !model || !pick || !settingsRead) return;
    console.log('[TRACE:LOADLIST] built', {
      date, stops: model.stopCount, trees: model.treeCount, mixYards: model.mixYards,
      tPosts: model.tPosts, ropeFeet: model.ropeFeet, floors: model.totalsAreFloors,
      bubblers: model.bubblers, waterMonitors: model.waterMonitors, installTrees: model.installTreeCount,
      unresolved: model.unresolved.length, unreadStops: model.unreadStops,
      offLadderTrees: model.offLadderTreeCount, noVolumeRows: model.noVolumeTrees.length,
      deerFenceUnknownStops: model.deerFenceUnknownStops, sizes: settingsRead.sizes, figures: settingsRead.figures,
      valuesUsed: model.valuesUsed,
      subset: pick.isSubset, dayStops: pick.kept.length + pick.leftOff.length,
      leftOff: pick.leftOff.length, unknownIds: pick.unknown.length,
    });
  }, [model, pick, settingsRead, date]);

  // 🔴 STD-003, ON BY DEFAULT until David owner-proves CARDS 21-25. The emit names EVERY section and
  // its stop count, and states the total, because the one defect worth catching here is a stop that
  // is in no section — which is visible as sections summing to less than the sheet carries.
  useEffect(() => {
    if (!TRACE_LOADLIST || !sectionSheets || !model) return;
    const counted = sectionSheets.reduce((n, x) => n + x.stopCount, 0);
    console.log('[TRACE:LOADLIST] sections', {
      date, sections: sectionSheets.length, sheetStops: model.stopCount, inSections: counted,
      accountsForEveryStop: counted === model.stopCount,
      each: sectionSheets.map(x => ({
        team: x.teamId ?? 'no team', stops: x.stopCount,
        trees: x.model.treeCount, tPosts: x.model.tPosts, mixYards: x.model.mixYards,
      })),
    });
  }, [sectionSheets, model, date]);

  /** Tick or untick one stop. All ticked drops `stops=` — the whole day, the same sheet as before. */
  function toggleStop(id: string) {
    if (!dayRead) return;
    const dayIds = dayRead.stops.map(s => s.id);
    const ticked = new Set(pick ? pick.kept.map(s => s.id) : dayIds);
    if (ticked.has(id)) ticked.delete(id); else ticked.add(id);
    const value = stopsParamFor(dayIds, ticked);
    if (TRACE_LOADLIST) console.log('[TRACE:LOADLIST] stops ticked', { date, ticked: ticked.size, of: dayIds.length });
    setParams(value === null ? { date } : { date, stops: value });
  }
  const dayStopCount = pick ? pick.kept.length + pick.leftOff.length : 0;
  const planNo = useMemo(() => new Map((pick?.kept ?? []).map(s => [s.id, s.route_position ?? null])), [pick]);

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
          <Printer size={18} /> {pick?.isSubset
            ? `Print these ${model?.stopCount ?? 0} stop${model?.stopCount === 1 ? '' : 's'}`
            : 'Print this day'}
        </button>
        {model && model.stopCount === 0 && !pick?.isSubset
          ? <span style={{ color: '#666' }}>Nothing to print — no stops on this day.</span>
          : null}
      </div>

      {/* 🔴 ONE SHEET PER CREW (ledger #354, David 2026-09-18: two crews Saturday). Tick the stops a
          crew takes and print; tick the rest and print again. Screen only — never on the paper. */}
      {dayRead && dayStopCount > 1 ? (
        <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 1rem', background: '#fff',
          border: '1px solid #d6e3c4', borderRadius: 8, padding: '.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
            <strong>Stops on this sheet</strong>
            <span style={{ color: '#444', fontSize: '.9rem' }}>
              {LOAD_LIST_COPY.subsetHowTo}
            </span>
            {pick?.isSubset ? (
              <button type="button" style={{ ...S.btn, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}` }}
                onClick={() => setParams({ date })}>
                Whole day
              </button>
            ) : null}
          </div>
          {dayRead.stops.map(s => {
            const on = pick ? pick.kept.some(k => k.id === s.id) : true;
            return (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', minHeight: 48,
                borderTop: '1px solid #eee', cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggleStop(s.id)}
                  style={{ width: 24, height: 24 }} />
                <span>
                  {s.route_position != null ? <strong>{s.route_position}. </strong> : null}
                  {customerDisplayName(s.customers ?? {}, 'Customer')}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}

      <div style={S.sheet} className="sheet">
        <h1 style={S.h1}>Load list — {longDate(date)}</h1>
        {/* Stops print in the SAVED route order when there is one (ledger #351) — readStops orders
            them — and the sheet says which, in the same words as the crew's phone. */}
        {stopsRead && <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{routeOrderLine(dayRoutedAt(stopsRead), 'crew')}</p>}
        <p style={{ margin: '.25rem 0 0', color: '#444' }}>
          {business?.name ?? 'This business'}
          {model ? <> · {model.stopCount} stop{model.stopCount === 1 ? '' : 's'}</> : null}
          {model && pick?.isSubset ? <> {LOAD_LIST_COPY.subsetOfDay(dayStopCount)}</> : null}
        </p>

        {/* 🔴 A PARTIAL SHEET SAYS SO, AND NAMES WHAT IT DOES NOT CARRY (ledger #354). Every total on it
            is for these stops only; the stops listed here are on another sheet — or on none, which is
            exactly what laying the crews' sheets side by side should show. */}
        {pick?.isSubset ? (
          <div style={S.flag} className="ll-flag">
            <strong>{LOAD_LIST_COPY.subsetHeading(model?.stopCount ?? 0, dayStopCount)}</strong>
            <div style={S.note}>{LOAD_LIST_COPY.subsetTotalsNote}</div>
            {pick.leftOff.length > 0 ? (
              <div style={S.note}>
                <strong>{LOAD_LIST_COPY.subsetLeftOffLabel}</strong>{' '}
                {pick.leftOff.map(s => `${s.route_position != null ? `${s.route_position}. ` : ''}${customerDisplayName(s.customers ?? {}, 'Customer')}`).join(' · ')}
              </div>
            ) : null}
            {pick.unknown.length > 0 ? (
              <div style={S.note}><strong>{LOAD_LIST_COPY.subsetUnknown(pick.unknown.length)}</strong></div>
            ) : null}
          </div>
        ) : null}
        {model && pick?.isSubset && model.stopCount === 0 ? (
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>{LOAD_LIST_COPY.subsetNone}</p>
        ) : null}

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

        {model && !loading && model.stopCount === 0 && !pick?.isSubset ? (
          <p style={{ marginTop: '2rem', fontSize: '1.1rem' }}>{LOAD_LIST_COPY.emptyDay}</p>
        ) : null}

        {/* 🔴 ONE SECTION PER TEAM (ledger #373, David 2026-09-21), or the sheet exactly as it was.
            A day with no teams takes the `null` branch below and renders the single whole-day body —
            the same component, the same model, the same paper. Nothing about a one-crew nursery's
            sheet changes because teams exist. */}
        {model && model.stopCount > 0 ? (
          sectionSheets ? (
            <>
              {/* The sheet says up front how it is divided, so two crews' paper accounts for the day. */}
              <div style={S.flag} className="ll-flag">
                <strong>{LOAD_LIST_COPY.teamSectionsHeading(sectionSheets.length, model.stopCount)}</strong>
                <div style={S.note}>{LOAD_LIST_COPY.teamSectionsNote}</div>
              </div>
              {sectionSheets.map(sec => (
                <div key={sec.teamId ?? 'no-team'} className="ll-team">
                  {/* 🔴 A SECTION IS NAMED, INCLUDING WHEN THE TEAM IS GONE. `teamLabel` says "No team",
                      "(retired)" or "A team that is no longer listed" — never a blank heading, and never
                      a silently missing section (D-9). The stops are here either way. */}
                  <h2 style={{ ...S.h1, fontSize: '1.4rem', marginTop: '1.5rem',
                    borderTop: `3px solid ${GREEN}`, paddingTop: '.75rem' }}>
                    {teamLabel(teams, sec.teamId)} — {sec.stopCount} stop{sec.stopCount === 1 ? '' : 's'}
                  </h2>
                  {sec.teamId === null ? (
                    <div style={S.flag} className="ll-flag">
                      <strong>{LOAD_LIST_COPY.teamNoneHeading}</strong>
                      <div style={S.note}>{LOAD_LIST_COPY.teamNoneNote}</div>
                    </div>
                  ) : null}
                  <SheetBody model={sec.model} planNo={planNo} isSubset={!!pick?.isSubset} settingsRead={settingsRead} />
                </div>
              ))}
            </>
          ) : (
            <SheetBody model={model} planNo={planNo} isSubset={!!pick?.isSubset} settingsRead={settingsRead} />
          )
        ) : null}
        {/* PAGE 4 · ONCE for the whole day, after every stops page — a split day gets ONE check
            page, not one per crew: an order written two ways is the office's problem, not a crew's,
            and printing it twice would have each crew think the other had dealt with it. */}
        {model ? <CheckPage checks={dayChecks} /> : null}
      </div>
    </div>
  );
}
