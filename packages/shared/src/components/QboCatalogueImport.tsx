// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the operator-facing half of the QuickBooks catalogue import — the surface Lauren
//   actually presses. PREVIEW first (counts, collisions, what will be retired), then IMPORT on an
//   explicit second press, then UNDO once a run exists. Two steps to write, one to take it back.
// DEPENDENCIES: `/api/qbo/items/preview` · `/ingest` · `/undo` (api/qbo/router.ts — the SAME
//   Vercel function as every other read, no new one) · authHeaders() · useBusinessContext.
// OUTPUTS: <QboCatalogueImport businessId /> — mounted in the Accounting card beside the two
//   existing ingests, whose shape this follows deliberately.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS: EVERYTHING WAS PROVEN THROUGH THE CONSOLE, AND THAT IS NOT THE PATH.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The whole mechanism — 647 created, 447 retired, wiped, fingerprint identical — was exercised by
// hand-written `fetch` calls. R-69 says LAUREN runs the import with David standing behind her, and
// she is not running JavaScript in a console. **The wipe is HER loop, not his**: *"import, look,
// wipe, reload as many times as it takes."* Everything below — building the request, holding the
// run id, rendering the counts, deciding when to offer the undo — was the part nothing had tested.
//
// 🔴 SHE NEVER SEES A UUID AND NEVER WRITES ONE DOWN. The run id is held here, in state, from the
// moment the import returns until the undo consumes it. A person asked to copy a uuid between two
// screens will eventually paste the wrong one, and the undo is keyed on exactly that value.
//
// 🔴 THE UNDO APPEARS ONLY AFTER A RUN EXISTS, AND NAMES WHAT IT WILL NOT TOUCH. Her 111 receipts
// and 31 deliveries carry no run id, so they are outside the delete by definition — but "cannot
// happen by construction" is how several silent failures were described just before they happened,
// so the button says it and the report proves it with counts taken before and after.
//
// ⚠️ NO AUTO-ROLLBACK, AND THAT IS A RULING (David, 2026-09-07). A failed run STOPS, reports
// exactly what landed, and OFFERS the undo as a button. An automatic rollback that itself partly
// fails leaves a state nobody chose — and the customer half genuinely can fail halfway, because a
// customer with an order cannot be deleted. Same shape as `leftovers`: name what is still there,
// let her press once.
//
// 🔴 SIX SURFACE STATES, none of them a blank panel: idle · loading · empty · error · refused
//   (writes are on — the undo is closed, and it says why) · ready.
import React, { useEffect, useState } from 'react';
import { authHeaders } from '../auth/authHeaders';
import { useBusinessContext } from '../context';
import { supabase } from '../supabase/client';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

interface CollisionMember { qboId: string; name: string; size: string | null; unitPrice: number | null; fullyQualifiedName: string | null }
interface Collision { shapeKey: string; members: CollisionMember[]; pricesDiffer: boolean; moneyAtStake: number; reason: string }
interface AdaptedCounts {
  readIn: number; categories: number; sellable: number;
  sized: number; notStated: number; couldNotRead: number;
  collidingItems: number; collisionsWithPriceDifference: number;
}
interface CountedRow { id: string; name: string; size: string | null; qty: number }
/**
 * 🔴 THE CUSTOMER SHAPES ARE IMPORTED, NOT GUESSED — AND THIS IS THE THIRD TIME THAT MATTERED.
 *
 * This panel first hand-declared `customers?: { created?: number; reconciled?: number }`, which was
 * my guess at #278's shape. The PREVIEW returns **`toCreate` / `toReconcile`**; only the RUN
 * returns `created` / `reconciled`. So the panel read `undefined ?? 0` and told David
 * **"Customers: 0 new"** and **"Import 0 customers and 647 products"** against 1,946 records in
 * QuickBooks and 30 held locally. The walk was running perfectly and the number was mine.
 *
 * Every optional field in a hand-written interface is a claim that TypeScript cannot check against
 * the thing it describes, because the response is cast. That is the same defect as `source` (a
 * column `business_inventory` never had) and as `ok` inherited from a preview onto a run — **the
 * third instance in this build of a declaration that did not match its source.** Importing the real
 * types makes the compiler the check, which is the only fix that does not rely on me being careful.
 */
import type { CustomerPlanReport, CustomerRunReport, CustomerUndoReport } from '../quickbooks/customerImportWriter';

/** What the ITEMS half reports — this build's own shapes, kept local because they already are. */
interface ItemPlan {
  ok?: boolean;
  adapted?: { counts: AdaptedCounts; collisions: Collision[] };
  wouldRetire?: number; wouldCreate?: number;
  countedRowsBeingRetired?: CountedRow[];
  error?: string;
}
interface ItemRun extends ItemPlan {
  runId?: string; created?: number; retired?: number;
  stoppedAt?: 'create' | 'retire' | null; undoable?: boolean; committed?: boolean;
}
interface ItemUndo {
  ok?: boolean; inventoryDeleted?: number; unretired?: number;
  leftovers?: string[]; receiptsAfter?: number; deliveriesAfter?: number;
  refused?: boolean; error?: string;
}

/** 🔴 ONE SHAPE PER STEP. A single `Report` covering plan, run and undo is what let a run-report
 *  field be read off a plan report without the compiler minding. */
interface PlanReport  { ok?: boolean; customers?: CustomerPlanReport | null; items?: ItemPlan | null; error?: string }
interface RunReport   { ok?: boolean; runId?: string; stoppedAt?: 'customers' | 'items' | null;
                        customers?: CustomerRunReport | null; items?: ItemRun | null;
                        committed?: boolean; undoable?: boolean; error?: string }
interface UndoReport  { ok?: boolean; refused?: boolean; runId?: string;
                        customers?: CustomerUndoReport | null; items?: ItemUndo | null; error?: string }

const money = (n: number | null) =>
  n === null || n === undefined ? 'no price' : `$${n.toLocaleString('en-US')}`;

export function QboCatalogueImport({ businessId }: { businessId: string | null }) {
  const { isOwner } = useBusinessContext();
  const [busy, setBusy]       = useState<null | 'preview' | 'import' | 'undo'>(null);
  const [plan, setPlan]       = useState<PlanReport | null>(null);
  const [run, setRun]         = useState<RunReport | null>(null);
  const [undone, setUndone]   = useState<UndoReport | null>(null);
  const [failed, setFailed]   = useState<string | null>(null);

  // 🔴 THE RUN ID LIVES HERE AND NOWHERE ELSE SHE CAN SEE. Set by the import, consumed by the
  // undo, cleared when the undo succeeds — so the button cannot be pressed twice against a run
  // that is already gone.
  const [recovered, setRecovered] = useState<string | null>(null);
  const [stacked, setStacked] = useState(0);
  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    void (async () => {
      const { data, error } = await supabase
        .from('business_inventory')
        .select('import_run_id')
        .eq('business_id', businessId)
        .is('retired_at', null)
        .not('import_run_id', 'is', null)
        .limit(2000);
      if (!alive) return;
      if (error) { console.log('[TRACE:QBITEMS] run recovery failed', { message: error.message }); return; }
      const ids = [...new Set((data ?? []).map(r => (r as { import_run_id: string }).import_run_id))];
      setStacked(ids.length);
      setRecovered(ids.length === 1 ? ids[0] : null);
      console.log('[TRACE:QBITEMS] recoverable runs', { businessId, distinct: ids.length });
    })();
    return () => { alive = false; };
  }, [businessId, undone, run]);

  const runId = run?.runId ?? recovered;

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 A PAGE REFRESH USED TO LOSE THE RUN ID, AND WITH IT THE ONLY WAY BACK.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // `run` is component state. Reload the page after an import — or open Settings on a second
  // device, or come back tomorrow — and the Undo button simply was not there. 647 rows live, no
  // route to remove them through any surface. David named it before it was tested: *"the run id
  // surviving a page refresh mid-run."*
  //
  // 🔴 RECOVERED BY DERIVING IT, NOT BY CACHING IT (R-101 ③ / [[R-84]]). A localStorage copy would
  // be a second record of one fact and would go stale the moment the run was undone from anywhere
  // else. **The table already knows**: a live row carrying an `import_run_id` IS an undoable run.
  // Nothing is stored, and the answer cannot disagree with the data it came from.
  //
  // ⚠️ MORE THAN ONE DISTINCT ID IS NOT A RUN TO OFFER — it is two stacked imports, and guessing
  // which to undo is exactly the choice this build refuses to make on her behalf. The panel says so
  // rather than picking the newest.


  async function call(step: 'preview' | 'import' | 'undo') {
    setBusy(step); setFailed(null);
    if (step === 'preview') { setPlan(null); setRun(null); setUndone(null); }
    if (step === 'import')  { setRun(null); setUndone(null); }
    if (step === 'undo')    { setUndone(null); }
    try {
      // 🔴 `books/*`, NOT `items/*` — ONE run id over customers AND items (David, 2026-09-07).
      // Two run ids would mean two undos in the right order, and the failure case is worse than the
      // inconvenience: items wipe cleanly, customers hit a RESTRICT because she rang up an order,
      // and she is left with half a catalogue and a full customer list.
      const path =
        step === 'preview' ? `preview?business_id=${businessId}`
        : step === 'import' ? `ingest?business_id=${businessId}`
        : `undo?business_id=${businessId}&run_id=${runId}`;
      const res = await fetch(`/api/qbo/books/${path}`, {
        method: step === 'preview' ? 'GET' : 'POST',
        headers: await authHeaders(),
      });
      const body = (await res.json()) as PlanReport & RunReport & UndoReport;
      console.log('[TRACE:QBITEMS] ui', { step, status: res.status, ok: body.ok, runId: body.runId ?? runId });
      if (step === 'preview') setPlan(body as PlanReport);
      if (step === 'import')  setRun(body as RunReport);
      if (step === 'undo')    { setUndone(body as UndoReport); if (body.ok) setRun(null); }
      if (!res.ok && !body.error && !body.refused) setFailed(`The request failed (${res.status}).`);
    } catch (e) {
      // A dead zone is NOT an empty result — say which happened (D-9).
      setFailed(`Could not reach the server — ${(e as Error).message}. Nothing was changed.`);
    } finally {
      setBusy(null);
    }
  }

  // 🔴 OWNER-ONLY ON THE SCREEN *AND* ON THE SERVER, and the server is the one that counts. R-80:
  // importing a company's books is an owner act. Hiding the panel is courtesy; `refuseUnlessOwner`
  // in the router is the control.
  // A missing business id is not an empty catalogue — refuse to render rather than fire a request
  // scoped to nothing (the neighbouring panels take the same `string | null` from Settings).
  if (!isOwner || !businessId) return null;

  const counts = plan?.items?.adapted?.counts;
  const collisions = plan?.items?.adapted?.collisions ?? [];
  const money6 = collisions.filter(c => c.pricesDiffer);
  const canImport = !!plan?.ok && !run?.committed && ((plan.items?.wouldCreate ?? 0) > 0 || (plan.customers?.toCreate ?? 0) > 0);

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
      <h4 style={{ margin: '0 0 .25rem', color: DARK, fontSize: '1rem' }}>Your customers and product list from QuickBooks</h4>
      <p style={{ margin: '0 0 .75rem', color: GRAY, fontSize: '.85rem', lineHeight: 1.5 }}>
        Brings your customers and your product list across from QuickBooks in one go — names, sizes
        and prices as they are entered there. <strong>Customers first, then products</strong>, because an
        order needs somebody to belong to. Your old products are <strong>hidden, not
        deleted</strong>. Nothing is written until you press Import, and while QuickBooks writes are
        switched off you can <strong>undo the whole thing</strong> and start again as many times as
        you like.
      </p>

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => void call('preview')}
          disabled={busy !== null}
          style={{ minHeight: 48, padding: '0 1.1rem', background: '#fff', color: GREEN,
                   border: `2px solid ${GREEN}`, borderRadius: 6, fontWeight: 700,
                   cursor: busy ? 'wait' : 'pointer' }}>
          {busy === 'preview' ? 'Reading QuickBooks…' : 'Preview your books'}
        </button>
        <button
          onClick={() => void call('import')}
          disabled={busy !== null || !canImport}
          style={{ minHeight: 48, padding: '0 1.1rem',
                   background: canImport ? GREEN : '#d1d5db', color: '#fff',
                   border: 'none', borderRadius: 6, fontWeight: 700,
                   cursor: busy ? 'wait' : canImport ? 'pointer' : 'not-allowed' }}>
          {busy === 'import' ? 'Importing…'
            : plan ? `Import ${plan.customers?.toCreate ?? 0} customers and ${plan.items?.wouldCreate ?? 0} products` : 'Import'}
        </button>
        {/* 🔴 THE UNDO APPEARS ONLY ONCE A RUN EXISTS. Before that there is nothing to take back,
            and a permanently-visible undo invites a press that can only error. */}
        {/* Shown for a run this page just made OR one recovered from the data after a refresh. */}
        {/* Offered after a COMMITTED run, after a run that stopped having written something, and
            for a run recovered from the data after a refresh. A half-landed run is exactly when she
            most needs it. */}
        {runId && (run?.committed || run?.stoppedAt === 'items' || (!run && recovered)) && (
          <button
            onClick={() => void call('undo')}
            disabled={busy !== null}
            style={{ minHeight: 48, padding: '0 1.1rem', background: '#fff', color: RED,
                     border: `2px solid ${RED}`, borderRadius: 6, fontWeight: 700,
                     cursor: busy ? 'wait' : 'pointer' }}>
            {busy === 'undo' ? 'Undoing…' : 'Undo this import'}
          </button>
        )}
      </div>

      {failed && <p style={{ marginTop: '.75rem', color: RED, fontSize: '.85rem' }}>⚠️ {failed}</p>}

      {/* 🔴 A RUN THIS PAGE DID NOT MAKE. She reloaded, or came back later, or is on another
          device. Saying where it came from is the difference between a button she trusts and one
          that appeared for no reason. */}
      {!run && recovered && !undone && (
        <p style={{ marginTop: '.75rem', color: AMBER, fontSize: '.85rem', lineHeight: 1.5 }}>
          There is an import already in your catalogue from an earlier session. You can undo it, or
          preview and import again to replace it.
        </p>
      )}
      {!run && !recovered && stacked > 1 && (
        <p style={{ marginTop: '.75rem', color: RED, fontSize: '.85rem', lineHeight: 1.5 }}>
          ⚠️ Your catalogue contains products from <strong>{stacked}</strong> different imports.
          Undo cannot tell you which one you meant, so it is not offered — ask David before
          importing again.
        </p>
      )}

      {/* ── THE PLAN ─────────────────────────────────────────────────────────── */}
      {plan && !plan.ok && plan.error && (
        <p style={{ marginTop: '.75rem', color: RED, fontSize: '.85rem' }}>⚠️ {plan.error}</p>
      )}
      {plan?.ok && counts && !run && (
        <div style={{ marginTop: '.9rem' }}>
          <p style={{ margin: '0 0 .6rem', color: DARK, fontSize: '.85rem', lineHeight: 1.6 }}>
            Read <strong>{counts.readIn}</strong> items from QuickBooks.{' '}
            <strong>{counts.categories}</strong> are category folders, not products, and are skipped.{' '}
            That leaves <strong>{counts.sellable}</strong> products.<br />
            This will <strong style={{ color: GREEN }}>create {plan.items?.wouldCreate}</strong> and{' '}
            <strong style={{ color: AMBER }}>hide {plan.items?.wouldRetire}</strong> of your current rows.<br />
            Sizes: <strong>{counts.sized}</strong> read, <strong>{counts.notStated}</strong> with no
            size given, <strong>{counts.couldNotRead}</strong> we could not read.
            {plan?.customers && (
              <><br />Customers: <strong style={{ color: GREEN }}>{plan.customers.toCreate}</strong> new,{' '}
              <strong>{plan.customers.toReconcile}</strong> already here (their tax-exempt status is
              refreshed, nothing else about them is touched). You hold{' '}
              <strong>{plan.customers.existingCustomers}</strong> today.</>
            )}
          </p>

          {/* 🔴 THE COUNTED ROWS ABOUT TO BE HIDDEN — LISTED, NEVER SUMMARISED. A count is the one
              number nobody can recreate, so if one is about to disappear from the grid it is named
              here rather than left as a figure to go looking for. */}
          {(plan.items?.countedRowsBeingRetired?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '.9rem', padding: '.75rem', background: '#fffbeb',
                          border: `1px solid ${AMBER}`, borderRadius: 6 }}>
              <strong style={{ color: AMBER, fontSize: '.85rem' }}>
                {plan.items!.countedRowsBeingRetired!.length} row{plan.items!.countedRowsBeingRetired!.length === 1 ? '' : 's'} you have counted will be hidden
              </strong>
              <ul style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem', color: AMBER, fontSize: '.82rem' }}>
                {plan.items!.countedRowsBeingRetired!.map(r => (
                  <li key={r.id}>{r.name}{r.size ? ` · ${r.size}` : ''} — <strong>{r.qty}</strong> on hand</li>
                ))}
              </ul>
              <p style={{ margin: '.35rem 0 0', color: AMBER, fontSize: '.8rem' }}>
                Hidden, not deleted. The count is still there and the undo brings it back.
              </p>
            </div>
          )}

          {/* 🔴 THE COLLISIONS — HER FIRST EDITS (R-101). Money first, because six of these are
              two prices for one product and the rest are tidy-ups. */}
          {collisions.length > 0 && (
            <div style={{ marginBottom: '.6rem' }}>
              <strong style={{ color: DARK, fontSize: '.85rem' }}>
                {collisions.length} product{collisions.length === 1 ? '' : 's'} appear{collisions.length === 1 ? 's' : ''} twice in QuickBooks
                {money6.length > 0 && <> — <span style={{ color: RED }}>{money6.length} with different prices</span></>}
              </strong>
              <p style={{ margin: '.25rem 0 .4rem', color: GRAY, fontSize: '.8rem', lineHeight: 1.5 }}>
                Both are imported so you can see them; neither was chosen for you. They are marked on
                the Inventory screen and sorted to the top, biggest price gap first.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: DARK, fontSize: '.82rem' }}>
                {collisions.map(c => (
                  <li key={c.shapeKey} style={{ marginBottom: '.2rem',
                        color: c.pricesDiffer ? RED : GRAY, fontWeight: c.pricesDiffer ? 600 : 400 }}>
                    {c.members[0].name}{c.members[0].size ? ` ${c.members[0].size}` : ''} —{' '}
                    {c.members.map(m => money(m.unitPrice)).join(' vs ')}
                    {c.pricesDiffer && <> <span style={{ fontWeight: 700 }}>(${c.moneyAtStake.toLocaleString()} apart)</span></>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── THE RUN ──────────────────────────────────────────────────────────── */}
      {run && (
        <div style={{ marginTop: '.9rem', padding: '.75rem', borderRadius: 6,
                      background: run.committed ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${run.committed ? GREEN : RED}` }}>
          {run.committed ? (
            <>
              <strong style={{ color: GREEN, fontSize: '.9rem' }}>
                Imported. {run.customers?.created ?? 0} customers and {run.items?.created} products created,{' '}
                {run.items?.retired} of your old rows hidden.
              </strong>
              <p style={{ margin: '.35rem 0 0', color: DARK, fontSize: '.82rem', lineHeight: 1.5 }}>
                Have a look at your Inventory screen. If it is not what you wanted, press{' '}
                <strong>Undo this import</strong> and everything goes back exactly as it was —{' '}
                {run.undoable === false && <span style={{ color: RED }}>except that QuickBooks writes are switched on, so the undo is closed.</span>}
                {run.undoable !== false && <>your receipts and your delivery schedule are not touched either way.</>}
              </p>
            </>
          ) : (
            <>
              {/* 🔴 A STOPPED RUN, NAMED. `ok` is false here and says so on its own — a run that
                  wrote nothing must never read as a success (the defect this build shipped once). */}
              <strong style={{ color: RED, fontSize: '.9rem' }}>
                {/* 🔴 TWO LEVELS, AND THE COMPILER CAUGHT ME CONFLATING THEM. The RUN stops at
                    'customers' or 'items'; only the ITEMS half knows whether it stopped while
                    creating or while hiding. Reading `run.stoppedAt === 'create'` was a comparison
                    that could never be true — and it only surfaced because the real types are now
                    imported instead of hand-declared. */}
                {run.stoppedAt === 'customers'
                  ? 'Nothing was imported — it stopped on the customers.'
                  : 'Your customers were imported. Your product list was not.'}
              </strong>
              <p style={{ margin: '.35rem 0 0', color: DARK, fontSize: '.82rem', lineHeight: 1.5 }}>
                {run.error ?? 'The import did not finish.'}
                {run.stoppedAt === 'customers' && <> Your product list was not touched at all, and there is nothing to undo.</>}
                {run.stoppedAt === 'items' && (
                  <>
                    {run.items?.stoppedAt === 'create'
                      ? <> Your current catalogue is untouched — nothing was hidden.</>
                      : (run.items?.created ?? 0) > 0
                        ? <> <strong>{run.items?.created} new rows did land</strong>, so your catalogue has both lists in it.</>
                        : null}
                    {' '}Both halves carry the same run, so <strong>one Undo removes everything this run
                    made</strong> — the customers included.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── THE UNDO ─────────────────────────────────────────────────────────── */}
      {undone && (
        <div style={{ marginTop: '.75rem', padding: '.75rem', borderRadius: 6,
                      background: undone.ok ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${undone.ok ? GREEN : RED}` }}>
          {undone.refused ? (
            <>
              <strong style={{ color: RED, fontSize: '.9rem' }}>Undo is closed.</strong>
              <p style={{ margin: '.35rem 0 0', color: DARK, fontSize: '.82rem', lineHeight: 1.5 }}>{undone.error}</p>
            </>
          ) : undone.ok ? (
            <>
              <strong style={{ color: GREEN, fontSize: '.9rem' }}>
                Undone. {undone.items?.inventoryDeleted} imported products and {undone.customers?.deleted ?? 0} imported
                customers removed, {undone.items?.unretired} of your own rows brought back.
              </strong>
              <p style={{ margin: '.35rem 0 0', color: DARK, fontSize: '.82rem', lineHeight: 1.5 }}>
                Your receipts ({undone.items?.receiptsAfter}) and deliveries ({undone.items?.deliveriesAfter}) are
                exactly as they were — the undo cannot reach them. You can preview and import again.
              </p>
            </>
          ) : (
            <>
              <strong style={{ color: RED, fontSize: '.9rem' }}>The undo did not finish.</strong>
              <p style={{ margin: '.35rem 0 0', color: DARK, fontSize: '.82rem', lineHeight: 1.5 }}>
                {undone.error}
              </p>
              {(undone.items?.leftovers?.length ?? 0) > 0 && (
                <ul style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem', color: RED, fontSize: '.82rem' }}>
                  {undone.items!.leftovers!.map(l => <li key={l}>{l}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
