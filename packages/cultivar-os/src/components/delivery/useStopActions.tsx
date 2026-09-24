/**
 * ── useStopActions — EVERY ACTION A STOP OFFERS, ONCE, FOR ALL THREE SCREENS ────────────────
 *
 * PURPOSE      The fulfilment tap, the review ask that may follow it, the date move, the ship-to edit
 *              and "Edit customer" — lifted out of DeliverySchedule.tsx (ledger #301, 2026-09-11) so
 *              the route and the order screen offer the SAME actions under the SAME permissions
 *              (STD-017). David: *"on orders and delivery I can edit customer data; on route I can't
 *              do anything."* A second copy of markStop on the route page is the drift this prevents.
 * DEPENDENCIES supabase client · useBusinessContext (can) · ../../lib/stopWrites (the ONE client write
 *              path to `deliveries`) · ../../lib/deliveryFulfilment (every decision about the tap and
 *              the ask) · ReviewAskSheet · CustomerPartyEditor.
 * OUTPUTS      { savingId, actionError, actionNote, clearActionError, markStop, editDate, saveShipTo, saveSite,
 *                openEditor, teams, setStopTeam,
 *                overlays } — a page renders `overlays` ONCE.
 *
 * TEAMS (ledger #362) are read ONCE here, at page level, not per card: a day has one team list and
 * twenty stops. `setStopTeam` is the only client call to `assign_stops_team`, so the schedule, the
 * route and the order screen set a team the same way, under the same permission.
 *
 * PERMISSIONS  Saving a stop's address as a named SITE is `customers:create` — a different and
 *              STRICTER string than the edit beside it, which STAFF hold and which is
 *              `deliveries:update`. No string was minted for the address book (D-41 L2, ledger
 *              #302): a saved site is a field of the customer relationship, not a capability.
 *              Every stop write is gated on `deliveries:update` — the string the date move and the tap
 *              already used, and the one the live `deliveries_member_update` policy enforces on the
 *              server (measured 2026-09-11). No string was minted. "Edit customer" stays on
 *              `customers:update`, the capability the editor exercises.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { customerDisplayName } from '@trace/shared/utils/personName';
import { readPricingConfig, normalizeDiscountTypes, RETAIL_TIER_NAME } from '@trace/shared/business-logic';
import { requirementText } from '@trace/shared/components/SurfaceState';
import { stopAct } from '../../lib/stopProgress';
import { fulfilOrderForStop, restoreOrderForStop, stopOrderNote } from '../../lib/stopFulfilsOrder';
import { readTeams, assignStopsTeam, type Team } from '../../lib/teams';
import { updateStop, saveShipTo as saveShipToRow, type ShipToForm, type ShipToSaveOutcome } from '../../lib/stopWrites';
import { readCustomerAddresses, saveCustomerAddress, type SaveOutcome } from '@trace/shared/business-logic';
import type { StopRow } from '../../lib/stopRead';
import { CUSTOMER_SELECT_FULL, CUSTOMER_SELECT_CORE } from '../customers/customerFieldRegistry';
import { CustomerPartyEditor, type PartyCustomer } from '../customers/CustomerPartyEditor';
import { SaveSiteDialog, type SiteOffer, type SiteResult } from './SaveSiteDialog';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

export function useStopActions(
  { onChanged, stops = [] }: { onChanged: () => Promise<void>; stops?: StopRow[] },
) {
  const { businessId, can } = useBusinessContext();

  const [savingId, setSavingId]         = useState<string | null>(null);
  const [actionError, setActionError]   = useState<string | null>(null);
  // 🔴 A SEPARATE LINE FROM THE ERROR, because "the stop finished and its order is fulfilled" is
  // not a failure and must not be styled as one — and the failure half ("…but the order was not")
  // must not be styled as a success. Two outcomes, two sentences (#319).
  const [actionNote, setActionNote]     = useState<string | null>(null);
  // A1/E1 — ONE customer form: the same <CustomerPartyEditor> the roster uses, opened over the page.
  const [editing, setEditing]           = useState<PartyCustomer | null>(null);
  // The follow-up module's per-tenant row — the ONLY thing that decides whether a review may be asked
  // for. Null until loaded, and a null row means OFF (absent is not enabled).
  const [tierOptions, setTierOptions]   = useState<{ value: string; label: string }[]>([{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }]);

  // ── D-41 L2 (ledger #303) — THE SAVE-THIS-SITE OFFER LIVES HERE, NOT ON THE CARD ───────────────
  // 🔴 IT LIVED ON <StopCard> AND COULD NEVER APPEAR ON TWO OF THE THREE SCREENS. CARD 4 failed live
  // on 2026-09-12 (build fe24e68, Test Dave's, OWNER) and the cause is a LIFECYCLE, not a gate:
  // `saveShipTo` awaits `onChanged()`, the schedule's `load()` sets `loading = true`, and both the
  // schedule (DeliverySchedule.tsx:176) and the route (DeliveryRoute.tsx:622) render their cards
  // behind `{!loading && ...}`. So every <StopCard> UNMOUNTED mid-await, its `useState` went with it,
  // and the `setSiteOffer` that ran when the promise resolved was called on a DEAD instance —
  // which React 18 discards SILENTLY, with no warning. The address saved; the offer never showed.
  // `/orders/:id` worked only because its `loadStops` never touches `loading`.
  //
  // The hook is called by the PAGE, which stays mounted while the list subtree does not. Holding the
  // offer here makes it survive the refresh BY CONSTRUCTION rather than by every consumer remembering
  // not to unmount its list — the fix belongs at the ONE place all three screens share (STD-017).
  // Keyed by stop id so it can only ever render on the card it belongs to.
  // ✏️ §8 V1/V3 (R-150, 2026-09-12) — THE OFFER IS A DIALOG NOW, NOT A PANEL ON THE CARD, so this
  // state carries what the DIALOG renders rather than a stop id the card matched on. It was moved
  // OFF <StopCard> on 2026-09-11 to survive the refresh (#304); it is moved OUT OF THE LIST ENTIRELY
  // here, because surviving the refresh and being VISIBLE are different properties and only the
  // first was fixed. The outcome sentence rides in the same dialog — reporting it on the card would
  // put the answer back in the place the question could not be seen.
  const [siteOffer,  setSiteOffer]  = useState<SiteOffer | null>(null);
  const [siteResult, setSiteResult] = useState<SiteResult | null>(null);
  // The team list for the pickers. An empty list is a real answer (no teams yet); `teamsAbsent`
  // is the different fact that the migration has not been applied, and the card says so.
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsAbsent, setTeamsAbsent] = useState(false);

  // The editor prices from the configured tiers, same source the roster uses.
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data } = await readPricingConfig(supabase, businessId);
      const opts = [{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }];
      for (const ty of normalizeDiscountTypes((data?.config ?? {}) as Record<string, unknown>))
        for (const ti of ty.tiers) opts.push({ value: ti.name, label: `${ty.name} · ${ti.name}` });
      setTierOptions(opts);
    })();
  }, [businessId]);

  /**
   * THE TAP — Start, Done, and Undo, through the ONE COMPLETION WRITER.
   *
   * 🔴 IT NO LONGER WRITES `deliveries` FROM HERE, AND THAT IS DAVID'S RULING (2026-09-17):
   *    *"the office's Mark done must behave like the crew's Done — HOLD the review ask (never spend
   *    it) and be undoable — so both doors do the same thing. One completion writer, registered with
   *    its path tests."* So this calls `stop_act` → `stop_progress_apply` (20260917c §4b), which is
   *    the same function the crew link's token door calls. One set of columns, one event row, one
   *    audit row, one undo rule — whichever door the tap came through (§6 r8 · tech-debt #321).
   *
   * 🔴 THE REVIEW PROMPT NO LONGER OPENS HERE. The ask is HELD (`review_ask_held_at`) and nothing
   *    sends it. `reviewAskDecision` / `ReviewAskSheet` are kept, unmounted, for the held-ask build:
   *    the POLICY (Google's three rules, quoted at the code) is not the thing being changed — only
   *    the moment of asking is. An ask spent at a desk days after the job cannot be taken back; a
   *    held one can still be asked.
   *
   * `changed: false` means the stop was already in that state — reported, never dressed up as a write.
   */
  async function markStop(d: StopRow, kind: 'start' | 'finish' | 'undo') {
    if (!can('deliveries:update')) { setActionError(requirementText('deliveries:update')); return; }
    setSavingId(d.id); setActionError(null); setActionNote(null);
    const action = kind === 'start' ? 'start' : kind === 'finish' ? 'done' : 'undo_done';
    const out = await stopAct(supabase, businessId!, d.id, action);
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY]', kind, { id: d.id, ok: out.ok, changed: out.ok ? out.changed : null });
    if (!out.ok) { setActionError(out.message); setSavingId(null); return; }

    // ── THE ORDER FOLLOWS THE STOP (tech-debt #319) ───────────────────────────────────────────
    // 🔴 AFTER the stop's own write, never before or instead of it. The stop is the fact the
    // driver reported; the order's status is a consequence. If the consequence cannot be applied
    // — no permission, no order, the endpoint refused — the stop still stands and the screen SAYS
    // which half moved. Swallowing it is how a completed truck run leaves stock un-sold and
    // nobody knows (David, 2026-09-21).
    //
    // ⚠️ OFFICE DOOR ONLY. The crew's Done keeps holding until teams land — David's ruling.
    if (kind === 'finish' || kind === 'undo') {
      const mayChangeOrders = can('orders:update');
      const outcome = kind === 'finish'
        ? await fulfilOrderForStop(supabase, businessId!, d, mayChangeOrders)
        : await restoreOrderForStop(supabase, businessId!, d, mayChangeOrders);
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] order follows stop', { id: d.id, kind, outcome: outcome.kind });
      const note = stopOrderNote(outcome);
      if (note?.bad) setActionError(note.text);
      else if (note) setActionNote(note.text);
    }

    await onChanged();
    setSavingId(null);
  }

  // Move a stop to a different day (e.g. off a Sunday). Data KEPT, never deleted. Empty → undated.
  async function editDate(d: StopRow, newVal: string) {
    const next = newVal || null;
    if (next === d.delivery_date) return; // no change → no write
    // PRE-EMPTIVE, not apologetic: the permission is knowable before the write, and the count check in
    // `updateStop` stays as the backstop for refusals the client cannot predict.
    if (!can('deliveries:update')) { setActionError(requirementText('deliveries:update')); return; }
    setSavingId(d.id);
    const wrote = await updateStop(supabase, businessId!, d.id, { delivery_date: next }, 'That delivery date');
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] date edit', { id: d.id, from: d.delivery_date, to: next, ok: wrote.ok });
    if (!wrote.ok) { setActionError(wrote.error); setSavingId(null); return; }
    await onChanged();
    setSavingId(null);
  }

  /**
   * Change where THIS stop goes. Writes the stop and an audit row — never the customer (D-41 L1).
   * `onChanged` re-reads the page, which is what re-derives everything that consumes the address:
   * the card's line, "Route this day"'s enablement, and — on the route page — the built route and
   * its Google Maps link (DeliveryRoute rebuilds a route that was on screen).
   */
  async function saveShipTo(d: StopRow, form: ShipToForm): Promise<ShipToSaveOutcome> {
    if (!can('deliveries:update')) return { kind: 'refused', reason: requirementText('deliveries:update') };
    setSavingId(d.id);
    const { data: { user } } = await supabase.auth.getUser();
    const out = await saveShipToRow(supabase, {
      businessId: businessId!, stop: d, form, actorUserId: user?.id ?? null, now: new Date(),
    });
    if (TRACE_DELIVERY) console.log('[TRACE:STOP] ship-to save —', out.kind, out);
    if (out.kind === 'saved') {
      // ══════════════════════════════════════════════════════════════════════════════════════
      // 🔴 RULING 4 — A CHANGED ADDRESS NEVER SILENTLY RE-PRICES AN ALREADY-INVOICED ORDER
      // ══════════════════════════════════════════════════════════════════════════════════════
      // David, 2026-09-23. This is the surface where it can happen: the order is done, the
      // invoice is out, and someone corrects the street on the stop. Re-pricing the delivery
      // then would change a number the customer has already been billed — the no-recompute-history
      // invariant, and the reason nothing here touches money.
      //
      // ⚠️ IT IS ENFORCED BY ABSENCE, WHICH IS WHY IT IS WRITTEN DOWN. There is no re-price call
      // to guard; the protection is that this path writes the ADDRESS and nothing else. A future
      // edit that "helpfully" recalculates the trip charge here would break the ruling without
      // touching a single line that mentions it, so the rule lives at the place it would be
      // broken rather than only in a document.
      //
      // David's note: this should rarely arise — the address is corrected at the counter while
      // the customer is sitting there — but the rule holds for when it does.
      if (TRACE_DELIVERY) {
        console.log('[TRACE:STOP] address changed — order NOT re-priced (ruling 4, no-recompute-history)', {
          stopId: d.id, orderId: d.order_id ?? null,
        });
      }
      // Raised BEFORE the refresh, not after: `onChanged()` unmounts the card list on two of the
      // three screens, and state set after an await that outlives the component is the defect this
      // moved to fix. Here it is page state, so the order is a choice rather than a hazard — and
      // raising it first means a refresh that THROWS still leaves the owner the offer they earned.
      // The gate is the same pair the card used, checked in one place now (§1.6 item 4).
      if (can('customers:create') && d.customer_id) {
        setSiteResult(null);
        setSiteOffer({
          stopId: d.id,
          customerName: customerDisplayName(d.customers, 'this customer'),
          address: [form.address_line1, form.city, form.state, form.zip].filter(Boolean).join(', '),
          label: '',
        });
      }
      await onChanged();
    }
    setSavingId(null);
    return out;
  }

  /** The name box on the offer. The label starts BLANK and nothing guesses one (David's redline). */
  function setSiteOfferLabel(label: string) {
    setSiteOffer(o => (o ? { ...o, label } : o));
  }

  /** "Not this one", and "Done" after an outcome — one dismissal, so nothing is left half-open. */
  function dismissSiteOffer() {
    setSiteOffer(null);
    setSiteResult(null);
  }

  /** The dialog's Save. It owns the stop id it was raised for; the card is not consulted. */
  async function saveOfferedSite(stops: StopRow[]) {
    if (!siteOffer) return;
    const stop = stops.find(x => x.id === siteOffer.stopId);
    // The stop can genuinely be gone — a refresh may have dropped it from the day being viewed.
    // Say so rather than closing silently on a question the reader answered.
    if (!stop) { setSiteResult({ ok: false, text: 'That stop is no longer on screen, so the site was not saved.' }); return; }
    await saveSite(stop, siteOffer.label);
  }

  /**
   * D-41 L2 (ledger #303) — SAVE THIS STOP'S ADDRESS AS A NAMED SITE FOR THIS CUSTOMER.
   *
   * 🔴 POPULATION IS A BY-PRODUCT, NEVER A CHORE. The book fills itself out of an edit somebody was
   * already making, the same way zone assignment rides the count walk. Nothing here is automatic:
   * David's redline is that *"a one-off delivery to a customer's mother is not a site, and a book
   * full of one-offs is worse than no book"*, so a save needs a NAME a person chose — which is what
   * `planSaveSite` refuses without.
   *
   * ⚠️ A DIFFERENT PERMISSION FROM THE EDIT BESIDE IT, AND THE GAP IS REAL. The ship-to edit is
   * `deliveries:update`, which STAFF hold. Adding to the customer's book is `customers:create`,
   * which they do NOT (`STAFF_DEFAULT_BUNDLE` carries `customers:read` only). So Joel can move a
   * stop and cannot save the site — correct, and the card must not offer him a button that refuses.
   */
  async function saveSite(d: StopRow, label: string): Promise<SaveOutcome> {
    if (!can('customers:create')) return { kind: 'refused', reason: requirementText('customers:create') };
    if (!d.customer_id) return { kind: 'refused', reason: 'This stop has no customer, so there is nobody to save the site for.' };
    setSavingId(d.id);
    // Re-read the book immediately before planning: the twin check and the label check are only
    // as good as the list they are made against, and another screen may have saved one since.
    const book = await readCustomerAddresses(supabase, businessId!, d.customer_id);
    const out = await saveCustomerAddress(supabase, {
      businessId: businessId!, customerId: d.customer_id, label,
      address: { line1: d.address_line1, city: d.city, state: d.state, zip: d.zip },
      existing: book.ok ? book.sites : [],
    });
    if (TRACE_DELIVERY) console.log('[TRACE:SITES] save-site from a stop —', out.kind, { stopId: d.id, label });
    setSavingId(null);
    // The outcome sentence is page state for the same reason the offer is: it is written after an
    // await, and on two screens the card that asked for it is already gone by then. Keyed by stop.
    const who = customerDisplayName(d.customers, 'this customer');
    if (out.kind === 'saved') {
      setSiteResult({ ok: true, text: `Saved as \u201c${out.site.label}\u201d. It will be offered next time you take an order for ${who}.` });
    } else if (out.kind === 'already_saved') {
      // Not an error. The answer to "save this?" for an address already in the book is "it already
      // is" — and naming the site they have beats both a duplicate row and a red refusal.
      setSiteResult({ ok: true, text: `This address is already saved for ${who} as \u201c${out.site.label}\u201d.` });
    } else {
      setSiteResult({ ok: false, text: out.kind === 'refused' ? out.reason : out.error });
    }
    return out;
  }

  // Open the ONE customer editor over the page. It fetches the FULL row rather than reusing the card's
  // join: the editor edits the whole party record, and a partial row would let a Save write defaults
  // over fields the page never loaded. Columns come from the field registry (A4) — deploy-window-safe.
  async function openEditor(d: StopRow) {
    if (!d.customer_id) return;
    let { data, error } = await supabase.from('customers').select(CUSTOMER_SELECT_FULL).eq('id', d.customer_id).maybeSingle();
    const code = (error as { code?: string } | null)?.code;
    if (error && (code === '42703' || code === 'PGRST204')) {
      ({ data, error } = await supabase.from('customers').select(CUSTOMER_SELECT_CORE).eq('id', d.customer_id).maybeSingle());
    }
    if (error || !data) { console.error('[TRACE:customers] could not open editor', error?.message); return; }
    setEditing(data as unknown as PartyCustomer);
  }

  const overlays = (
    <>
      {/* The review prompt is NOT mounted here any more (ledger #347): a Done HOLDS the ask and
          sends nothing. <ReviewAskSheet> and `reviewAskDecision` are kept for the held-ask build —
          the policy is unchanged, only the moment of asking is. */}
      {/* §8 V1 — the save-a-site offer renders HERE, at page level, beside the review ask: outside the
          stop list, so its position cannot depend on how many stops are above it. V4 — bounded, with
          its buttons pinned. It renders NOTHING when there is no offer. */}
      <SaveSiteDialog
        offer={siteOffer}
        result={siteResult}
        busy={savingId !== null}
        onLabelChange={setSiteOfferLabel}
        onSave={() => { void saveOfferedSite(stops); }}
        onDismiss={dismissSiteOffer}
      />
      {editing && (
        <CustomerPartyEditor
          customer={editing}
          tierOptions={tierOptions}
          onSaved={() => { void onChanged(); }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );

  // ── TEAMS ────────────────────────────────────────────────────────────────────────────────
  // Read once per page. A business with no teams yet is not an error and not a prompt — the card
  // simply has nothing to offer, and says so rather than showing an empty picker.
  useEffect(() => {
    if (!businessId) return;
    let live = true;
    void readTeams(supabase, businessId).then(r => {
      if (!live) return;
      if (r.ok) { setTeams(r.teams); setTeamsAbsent(false); }
      else { setTeams([]); setTeamsAbsent(r.absent); }
    });
    return () => { live = false; };
  }, [businessId]);

  /** Set (or clear) the team on ONE stop. The writer takes a set; a card sends a set of one. */
  async function setStopTeam(d: StopRow, teamId: string | null) {
    setSavingId(d.id);
    setActionError(null);
    const r = await assignStopsTeam(supabase, businessId!, [d.id], teamId);
    setSavingId(null);
    if (!r.ok) {
      // The SERVER's refusal is what the person reads — a retired team, a stop that moved, no
      // permission. Never a cheerful local message over a write that did not happen.
      setActionError(r.message);
      return;
    }
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] stop team set', { stop: d.id, teamId, team: r.value.teamName });
    await onChanged();
  }

  return {
    savingId, actionError, actionNote,
    clearActionError: () => { setActionError(null); setActionNote(null); },
    markStop, editDate, saveShipTo, saveSite, openEditor, overlays,
    // TEAMS (ledger #362) — the list every picker on the page reads, and the one call that sets one.
    teams, teamsAbsent, setStopTeam,
    // §8 V1/V3 — <StopCard> no longer renders the offer, so it no longer needs to read it. What it
    // DOES need is whether an offer is open for its own stop, which nothing on the card depends on
    // today; the surface is kept off the card deliberately (STD-011 — one renderer, one place).
    siteOffer, siteResult, setSiteOfferLabel, dismissSiteOffer,
  };
}

export type StopActions = ReturnType<typeof useStopActions>;
