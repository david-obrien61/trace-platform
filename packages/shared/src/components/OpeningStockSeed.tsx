// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the surface the OWNER presses to give an imported product list a starting number, so
//   it stops reading "None in stock" on every row and becomes something a business can be run
//   from. It explains the state, shows what their own books say a typical item moves, suggests a
//   deliberately LOW number with the reason, takes their number, and says what happens next.
// DEPENDENCIES: ../quickbooks/openingStock (the pure rule + planner) · ../quickbooks/booksRunStore
//   (`readLatestResult` — the last stored books run) · ../context (useBusinessContext) ·
//   ../supabase/client · the `adjust_inventory_manual` RPC (D-50 LAYER 1, member-checked
//   server-side) in LIVE mode · ../quickbooks/openingStockTestWrite (`seedQtyWithoutLedger`) in
//   TEST mode. NO new `api/` function — the ceiling is 12 of 12 (§6 r11).
// OUTPUTS: <OpeningStockSeed /> — mounted in the Accounting card beneath <QboCatalogueImport />.
// STORY: *The imported catalogue can be sold from* (`user_stories.md`, ARC: cost-to-produce).
// INSTRUMENTATION (STD-003): `[TRACE:SEED]` on load, plan, and every RPC step. ON BY DEFAULT.
//
// 🔴 LEDGER #342 — TWO MODES, AND THE SCREEN SAYS WHICH. In TEST mode (QuickBooks writes off) the
// seed sets qty on IMPORTED rows only and writes NO ledger row (David, 2026-09-16: *"we must never
// allow them to write to the actual record during testing"*). In LIVE mode it is unchanged.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE CUSTOMER RUNS THIS. WE DO NOT DO IT TO THEM.
// ══════════════════════════════════════════════════════════════════════════════════════════
// A number we picked and applied silently would be indistinguishable, on every screen afterwards,
// from stock somebody counted — and it would be OURS, so the first time it was wrong it would be
// our mistake in their books. They choose it, they press it, and the screen tells them in plain
// words that what they are creating is a placeholder.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THE SUGGESTION IS LOW, WHICH IS THE ONLY INTERESTING DESIGN DECISION HERE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Ruled 2026-09-01. A low number blocks a sale sooner, and a blocked sale is what sends somebody
// out to the lot to count. **That is how the real numbers get in.** A generous seed feels helpful
// and quietly removes the only event that ever produces a true figure — so the ceiling
// (`SEED_CAP`) is not a safety rail, it is the mechanism.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SIX SURFACE STATES, NONE OF THEM A BLANK PANEL.
// ══════════════════════════════════════════════════════════════════════════════════════════
//   loading · refused (not the owner — and it says why) · empty (nothing to start) ·
//   error · ready-with-a-measurement · ready-WITHOUT-one (no sales history: the honest path,
//   which says so and lets them choose). The last two are deliberately different screens.
import React, { useCallback, useEffect, useState } from 'react';
import { useBusinessContext } from '../context';
import { supabase } from '../supabase/client';
import { readLatestResult } from '../quickbooks/booksRunStore';
import {
  planOpeningStockSeed, seedRefusal, seedModeFor, SEED_CAP, SEED_MIN, SEED_LEDGER_KIND,
  OPENING_STOCK_RULE_ID, type SeedCandidate,
} from '../quickbooks/openingStock';
import { seedQtyWithoutLedger } from '../quickbooks/openingStockTestWrite';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

type Phase =
  | { k: 'loading' }
  | { k: 'refused'; why: string }
  | { k: 'error'; why: string }
  | { k: 'empty'; why: string }
  | { k: 'ready' }
  | { k: 'working'; done: number; of: number }
  | { k: 'done'; seeded: number; qty: number; skipped: { withStock: number; withHistory: number; notImported: number; notAProduct: number; underProduction: number; markedNotStock: number } };

/** What the books review last said, or why it said nothing. Never a silent absence. */
interface Suggestion {
  /** null = we have no sales history to go on. The screen says so and they choose. */
  unitsPerMonth: number | null;
  suggested: number | null;
  ranAt: string | null;
  /** Present when we could not read the saved reports at all — OUR problem, not theirs. */
  unreadable: string | null;
  itemsMeasured: number;
  atOrBelow: number;
}

export function OpeningStockSeed(): React.ReactElement | null {
  const { businessId, isOwner, business } = useBusinessContext();
  // An unread switch is TEST mode — the side that writes nothing permanent.
  const mode = seedModeFor(business?.qbo_writes_enabled);
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [userId, setUserId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SeedCandidate[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!businessId) return;
    setPhase({ k: 'loading' });

    // 🔴 THE GATE IS OWNERSHIP, AND IT IS STATED RATHER THAN HIDDEN. Seeding writes a permanent,
    // immutable ledger row against every empty product in the catalogue. That is a setup decision
    // about the shape of the business's own records, not a day-to-day inventory edit — and §1.6
    // item 4 requires the read scope and the write scope to agree, so a manager who cannot make
    // the decision is told why instead of being shown a button that refuses.
    if (!isOwner) {
      setPhase({ k: 'refused', why: 'Only the owner can set a starting number. It writes a permanent line against every product, so it is their call — ask them to run this once and everything else here works for you afterwards.' });
      return;
    }

    try {
      // ── the lots this may touch ───────────────────────────────────────────
      // RETIRED-FILTER-EXEMPT is NOT claimed here: a retired row is one the owner has already
      // replaced, and giving it stock would put it back in front of people.
      const inv = await supabase
        .from('business_inventory')
        // qb_item_type / qb_income_account are what the books said this row IS (20260920b);
        // description and sell_price are what a DISCOUNT row is recognised by.
        .select('id,name,qty,import_run_id,qb_item_id,qb_item_type,qb_income_account,description,sell_price')
        .eq('business_id', businessId)
        .is('retired_at', null);
      if (inv.error) { setPhase({ k: 'error', why: inv.error.message }); return; }
      const rows = (inv.data ?? []) as { id: string; name: string | null; qty: number | null; import_run_id: string | null; qb_item_id: string | null;
        qb_item_type: string | null; qb_income_account: string | null; description: string | null; sell_price: number | null }[];
      setTotalProducts(rows.length);

      // ── which of them have ANY ledger history ─────────────────────────────
      // 🔴 THIS READ IS WHAT STOPS A MEASURED ZERO BEING OVERWRITTEN WITH A PLACEHOLDER. A lot
      // that sold out has a zero that MEANS something; a lot that was imported has a zero that
      // means nothing was ever said. They look identical in `business_inventory` and are only
      // distinguishable here.
      const led = await supabase
        .from('business_inventory_ledger')
        .select('inventory_id')
        .eq('business_id', businessId);
      if (led.error) { setPhase({ k: 'error', why: led.error.message }); return; }
      const withHistory = new Set(
        (led.data ?? []).map(r => String((r as { inventory_id: unknown }).inventory_id ?? '')),
      );

      // ── WHAT THE OWNER HAS SAID IS NOT STOCK ──────────────────────────────────────────────
      // 🔴 A FAILED READ IS NOT AN EMPTY LIST. If this query is refused or the table is missing,
      // treating it as "no overrides" would quietly give a starting number to the very rows she
      // marked — so the screen stops instead and says so (A8: zero rows and no error are what a
      // refusal looks like, and here the two must not be treated alike).
      const ov = await supabase
        .from('business_not_stock_items')
        .select('qb_item_id')
        .eq('business_id', businessId)
        .eq('active', true);
      if (ov.error) {
        setPhase({ k: 'error', why: `We could not read which products you have marked as "not stock" (${ov.error.message}), so nothing was suggested. Seeding without that list could give stock to a gift certificate.` });
        return;
      }
      const notStock = new Set((ov.data ?? []).map(r => String((r as { qb_item_id: unknown }).qb_item_id ?? '')));
      console.log('[TRACE:SEED] not-stock overrides', { count: notStock.size });

      const cands: SeedCandidate[] = rows.map(r => ({
        id: String(r.id),
        name: String(r.name ?? 'Unnamed product'),
        qty: Number(r.qty ?? 0),
        hasHistory: withHistory.has(String(r.id)),
        imported: r.import_run_id != null,
        qbType: r.qb_item_type,
        qbIncomeAccount: r.qb_income_account,
        description: r.description,
        sellPrice: r.sell_price,
        notStockOverride: r.qb_item_id != null && notStock.has(String(r.qb_item_id)),
      }));
      setCandidates(cands);

      // 🔴 COUNTED BY THE PLANNER ITSELF, NOT BY A SECOND COPY OF ITS RULES. This line used to
      // re-implement the exclusions inline, so the moment the planner learned to skip fees the
      // screen would have promised a number it was no longer going to do (STD-011).
      const preview = planOpeningStockSeed(cands, SEED_MIN, mode);
      const seedable = preview.ok ? preview.steps.length : 0;
      console.log('[TRACE:SEED] loaded', { products: rows.length, seedable, withHistory: withHistory.size, mode });

      if (seedable === 0) {
        setPhase({ k: 'empty', why: rows.length === 0
          ? 'There are no products here yet. Import your product list first, then come back.'
          : mode === 'test'
            ? 'In test mode only the products your QuickBooks import created get a starting number, and every one of those already holds stock or has been counted or sold.'
            : 'Every product here either already holds stock or has already been counted or sold — there is nothing to give a starting number to. That is the state you want to be in.' });
        return;
      }

      // ── what their own books said, the last time we read them ─────────────
      const latest = await readLatestResult(supabase, businessId, OPENING_STOCK_RULE_ID);
      if (latest.found && latest.result.measured) {
        const median = latest.result.value;
        setSug({
          unitsPerMonth: median,
          suggested: median === null ? null : Math.min(SEED_CAP, Math.max(SEED_MIN, Math.round(median))),
          ranAt: latest.result.ranAt, unreadable: null,
          itemsMeasured: latest.result.of, atOrBelow: latest.result.matched,
        });
        if (median !== null) setQtyText(String(Math.min(SEED_CAP, Math.max(SEED_MIN, Math.round(median)))));
      } else if (latest.found) {
        // The rule RAN and could not measure — that is the honest path, not an error.
        setSug({ unitsPerMonth: null, suggested: null, ranAt: latest.result.ranAt, unreadable: null, itemsMeasured: 0, atOrBelow: 0 });
      } else if (latest.reason === 'unreadable') {
        // 🔴 OURS, NOT THEIRS, AND IT MUST NOT BE DRESSED AS THEIRS. Telling somebody to go and
        // read their QuickBooks data when they already did is how a screen loses their trust in
        // one step. The seed still works — only the suggestion is missing.
        setSug({ unitsPerMonth: null, suggested: null, ranAt: null, unreadable: latest.detail, itemsMeasured: 0, atOrBelow: 0 });
      } else {
        setSug({ unitsPerMonth: null, suggested: null, ranAt: null, unreadable: null, itemsMeasured: 0, atOrBelow: 0 });
      }
      setPhase({ k: 'ready' });
    } catch (e: unknown) {
      setPhase({ k: 'error', why: e instanceof Error ? e.message : String(e) });
    }
  }, [businessId, isOwner, mode]);

  useEffect(() => { void load(); }, [load]);

  async function apply(): Promise<void> {
    setStepError(null);
    const qty = Number(qtyText.trim());
    const plan = planOpeningStockSeed(candidates, qty, mode);
    if (!plan.ok) { setStepError(plan.error); return; }
    if (!userId) { setStepError('Confirming your sign-in — one moment, then try again.'); return; }
    if (!businessId) return;

    console.log('[TRACE:SEED] plan', { steps: plan.steps.length, qty, skipped: plan.skipped, mode: plan.mode });
    setPhase({ k: 'working', done: 0, of: plan.steps.length });

    // ── TEST MODE: qty on imported rows, NO ledger row (ruling ②) ─────────
    if (plan.mode === 'test') {
      const r = await seedQtyWithoutLedger(supabase, businessId, plan.steps);
      if (!r.ok) {
        setStepError(r.error);
        setPhase({ k: 'ready' });
        return;
      }
      console.log('[TRACE:SEED] applied (TEST MODE — no ledger rows)', { seeded: r.written, qty });
      setPhase({ k: 'done', seeded: r.written, qty, skipped: plan.skipped });
      return;
    }

    let done = 0;
    for (const step of plan.steps) {
      const { data, error } = await supabase.rpc('adjust_inventory_manual', {
        p_lot_id: step.lotId, p_business_id: businessId, p_new_qty: step.newQty,
        p_actor_user_id: userId, p_reason: step.reason, p_kind: step.kind,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.applied) {
        // 🔴 A PARTIAL RUN IS STATED, NEVER HIDDEN, AND IT CANNOT BE ROLLED BACK. Every row that
        // already landed is a permanent ledger line — that is what append-only means. Saying
        // exactly where it stopped is the whole mitigation, and it lets a second press pick up
        // from a known place (the lots already seeded now hold stock and are skipped).
        console.log('[TRACE:SEED] STOPPED', { done, of: plan.steps.length, lot: step.lotId, err: error?.message ?? row?.reason });
        setStepError(`Stopped after ${done} of ${plan.steps.length}. ${error?.message ?? String(row?.reason ?? 'the database refused the change')}. The ones already done are permanent and keep their number; pressing again picks up where this stopped.`);
        setPhase({ k: 'ready' });
        return;
      }
      done++;
      if (done % 25 === 0) setPhase({ k: 'working', done, of: plan.steps.length });
    }
    console.log('[TRACE:SEED] applied', { seeded: done, qty, kind: SEED_LEDGER_KIND });
    setPhase({ k: 'done', seeded: done, qty, skipped: plan.skipped });
  }

  if (!businessId) return null;

  const card: React.CSSProperties = {
    border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem',
    background: '#fff', marginTop: '1rem',
  };
  const h: React.CSSProperties = { margin: '0 0 .5rem', fontSize: '1rem', color: DARK, fontWeight: 700 };
  const p: React.CSSProperties = { margin: '0 0 .65rem', fontSize: '.875rem', color: '#374151', lineHeight: 1.5 };
  const note: React.CSSProperties = { ...p, color: GRAY, fontSize: '.8125rem' };

  if (phase.k === 'loading') {
    return <div style={card}><h3 style={h}>Starting numbers</h3><p style={note}>Reading your product list…</p></div>;
  }
  if (phase.k === 'refused') {
    return <div style={card}><h3 style={h}>Starting numbers</h3><p style={{ ...p, color: AMBER }}>{phase.why}</p></div>;
  }
  if (phase.k === 'error') {
    return (
      <div style={card}>
        <h3 style={h}>Starting numbers</h3>
        <p style={{ ...p, color: RED }}>We could not read your product list: {phase.why}</p>
        <button onClick={() => void load()} style={btn(false)}>Try again</button>
      </div>
    );
  }
  if (phase.k === 'empty') {
    return <div style={card}><h3 style={h}>Starting numbers</h3><p style={p}>{phase.why}</p></div>;
  }
  if (phase.k === 'working') {
    return (
      <div style={card}>
        <h3 style={h}>Setting starting numbers…</h3>
        <p style={p}>{phase.done.toLocaleString()} of {phase.of.toLocaleString()} products.</p>
        <p style={note}>{mode === 'test'
          ? 'Test mode: only the number is set — nothing is written to your stock record. Please leave this open.'
          : 'Each one is being written as a dated line, so it can be explained later. Please leave this open.'}</p>
      </div>
    );
  }
  if (phase.k === 'done') {
    const skipped = phase.skipped.withStock + phase.skipped.withHistory + phase.skipped.notImported
      + phase.skipped.notAProduct + phase.skipped.underProduction + phase.skipped.markedNotStock;
    return (
      <div style={card}>
        <h3 style={h}>Done — {phase.seeded.toLocaleString()} products start at {phase.qty}</h3>
        {mode === 'test' && (
          <p style={{ ...p, color: AMBER }}>
            <b>Test mode:</b> these numbers are on your imported products only, and nothing was written
            to your stock record — so this import can still be undone and loaded again. The permanent
            opening line for each product is written once, after you switch QuickBooks writes on.
          </p>
        )}
        <p style={p}>
          From this moment we track every movement: every sale takes units off, every delivery in puts
          them on. <b>When you count, we will compare what we have tracked against what you found and
          show you only the part we cannot explain.</b>
        </p>
        <p style={note}>
          These numbers are marked as starting numbers, not counts — they show as a placeholder
          everywhere a count would show, until somebody counts that product for real.
        </p>
        {skipped > 0 && (
          <p style={note}>
            {skipped.toLocaleString()} left alone: {phase.skipped.withStock.toLocaleString()} already
            held stock and {phase.skipped.withHistory.toLocaleString()} had already been sold or
            counted, so their numbers are real and we did not touch them
            {phase.skipped.notImported > 0 && <>; {phase.skipped.notImported.toLocaleString()} were not
            created by your QuickBooks import, and test mode leaves those alone</>}
            {phase.skipped.notAProduct > 0 && <>; <b>{phase.skipped.notAProduct.toLocaleString()} are not
            things you keep in stock</b> — your books put them under delivery, labour, a discount or
            bookkeeping, so a starting number would read as stock you could sell</>}
            {phase.skipped.underProduction > 0 && <>; {phase.skipped.underProduction.toLocaleString()} are
            marked <b>(UNDER PRODUCTION)</b>, so they are still growing and are not sellable yet</>}
            {phase.skipped.markedNotStock > 0 && <>; {phase.skipped.markedNotStock.toLocaleString()} you have
            marked as <b>not stock</b> yourself, because QuickBooks files them with your trees</>}.
          </p>
        )}
      </div>
    );
  }

  // ── READY ────────────────────────────────────────────────────────────────
  const seedable = candidates.filter(c => c.qty <= 0 && !c.hasHistory && (mode === 'live' || c.imported)).length;
  const qty = Number(qtyText.trim());
  const refusal = qtyText.trim() === '' ? null : seedRefusal(qty);
  const canPress = qtyText.trim() !== '' && refusal === null;

  return (
    <div style={card}>
      <h3 style={h}>Starting numbers</h3>

      {/* ⓪ WHICH MODE, AND WHAT IT MEANS (ledger #342). */}
      {mode === 'test' ? (
        <p style={{ ...p, color: AMBER }}>
          <b>You are in test mode.</b> A starting number set now goes onto the products your
          QuickBooks import created, and nowhere else. <b>Nothing is written to your stock record</b> —
          so you can still undo the import and load it again. The permanent opening line is written
          once, after you switch QuickBooks writes on.
        </p>
      ) : (
        <p style={p}>
          <b>QuickBooks writes are on.</b> A starting number set now is written to your stock record
          as a dated line, and it stays there.
        </p>
      )}

      {/* ① EXPLAIN THE STATE. */}
      <p style={p}>
        <b>{seedable.toLocaleString()} of your {totalProducts.toLocaleString()} products have no
        count against them.</b> What came across from QuickBooks is a <b>price card</b> — what you
        sell and what it costs — and a price card does not say how many are standing in the field.
        Until there is a number, every one of these reads “None in stock” and cannot be added to an
        order.
      </p>

      {/* ② WHAT THEIR BOOKS SAY — OR PLAINLY THAT THEY SAY NOTHING. */}
      {sug?.unitsPerMonth != null ? (
        <p style={p}>
          Your own invoices say a typical product moves <b>{sug.unitsPerMonth} a month</b>
          {sug.itemsMeasured > 0 && <> — measured across {sug.itemsMeasured.toLocaleString()} products</>}
          {sug.ranAt && <>, read on {sug.ranAt.slice(0, 10)}</>}.
        </p>
      ) : sug?.unreadable ? (
        <p style={{ ...p, color: AMBER }}>
          We could not read your saved reports just now, so we have no suggestion to offer — that is
          ours to fix, not something you need to do. You can still choose a number below.
        </p>
      ) : (
        <p style={p}>
          <b>We have no sales history to go on</b>, so we are not going to pretend to suggest a
          number. Choose one yourself — anything low is fine, and the next paragraph says why.
        </p>
      )}

      {/* ③ THE REASON THE NUMBER SHOULD BE LOW. */}
      <p style={p}>
        Pick a <b>low</b> number. A low number runs out sooner, and something running out is what
        sends somebody out to count it — which is the only thing that ever puts a true number in
        here. A big number stops anything ever running out, and then the guess quietly becomes the
        answer.
      </p>

      {/* ④ THEIR NUMBER. */}
      <label style={{ display: 'block', fontSize: '.8125rem', color: DARK, fontWeight: 600, margin: '0 0 .35rem' }}>
        Start every one of these at
      </label>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number" inputMode="numeric" min={SEED_MIN} max={SEED_CAP}
          value={qtyText}
          onChange={e => { setQtyText(e.target.value); setStepError(null); }}
          aria-label={`Starting number, between ${SEED_MIN} and ${SEED_CAP}`}
          style={{
            width: 110, minHeight: 48, padding: '0 .75rem', fontSize: '1rem',
            border: `1px solid ${refusal ? RED : '#d1d5db'}`, borderRadius: 8,
          }}
        />
        <span style={{ fontSize: '.875rem', color: GRAY }}>units each — {SEED_CAP} is the most</span>
        <button onClick={() => void apply()} disabled={!canPress} style={btn(!canPress)}>
          Set starting numbers
        </button>
      </div>

      {/* 🔴 THE REFUSAL IS SURFACED, NEVER SILENT (§1.6 item 3 / the M2 modal standard). */}
      {refusal && <p style={{ ...p, color: RED, marginTop: '.6rem' }}>{refusal}</p>}
      {stepError && <p style={{ ...p, color: RED, marginTop: '.6rem' }}>{stepError}</p>}

      {/* ⑤ WHAT HAPPENS NEXT. */}
      <p style={{ ...note, marginTop: '.85rem' }}>
        This is a <b>starting number, not a count</b> — it is recorded as one, and it shows as a
        placeholder everywhere a count would show. From the moment you press this we track every
        movement, and when you do count, we will net off the sales and the deliveries and hand you
        only the part we cannot explain.
      </p>
      {mode === 'live' && (
        <p style={note}>
          ⚠️ Once a product has a starting number it has a history, and re-importing your product list
          will no longer clear it. Do your import first and press this last.
        </p>
      )}
    </div>
  );
}

function btn(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 48, padding: '0 1rem', borderRadius: 8, border: 'none',
    background: disabled ? '#d1d5db' : GREEN, color: '#fff',
    fontWeight: 600, fontSize: '.9375rem', cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
