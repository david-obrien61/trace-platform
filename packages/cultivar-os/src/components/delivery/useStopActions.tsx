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
 * OUTPUTS      { savingId, actionError, clearActionError, markStop, editDate, saveShipTo, saveSite,
 *                openEditor,
 *                overlays } — a page renders `overlays` ONCE.
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
import { BUSINESS_MODULE_COLUMNS, type BusinessModuleRow } from '@trace/shared/business-logic/moduleState';
import { REVIEW_LINK_MODULE_KEY } from '@trace/shared/business-logic/reviewLink';
import {
  fulfilmentPatch, startPatch, reviewAskDecision, reviewAskPatch,
  REVIEW_ASK_SHOWN, REVIEW_ASK_SKIPPED, DELIVERY_STATUS_FULFILLED, type ReviewAskOffer,
} from '../../lib/deliveryFulfilment';
import { updateStop, saveShipTo as saveShipToRow, type ShipToForm, type ShipToSaveOutcome } from '../../lib/stopWrites';
import { readCustomerAddresses, saveCustomerAddress, type SaveOutcome } from '@trace/shared/business-logic';
import type { StopRow } from '../../lib/stopRead';
import { CUSTOMER_SELECT_FULL, CUSTOMER_SELECT_CORE } from '../customers/customerFieldRegistry';
import { CustomerPartyEditor, type PartyCustomer } from '../customers/CustomerPartyEditor';
import { ReviewAskSheet } from './ReviewAskSheet';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

export function useStopActions({ onChanged }: { onChanged: () => Promise<void> }) {
  const { businessId, can } = useBusinessContext();

  const [savingId, setSavingId]         = useState<string | null>(null);
  const [actionError, setActionError]   = useState<string | null>(null);
  // A1/E1 — ONE customer form: the same <CustomerPartyEditor> the roster uses, opened over the page.
  const [editing, setEditing]           = useState<PartyCustomer | null>(null);
  // The follow-up module's per-tenant row — the ONLY thing that decides whether a review may be asked
  // for. Null until loaded, and a null row means OFF (absent is not enabled).
  const [followUp, setFollowUp]         = useState<BusinessModuleRow | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  // The stop whose prompt is open, and the offer to render. `offer: null` renders NOTHING.
  const [asking, setAsking]             = useState<{ id: string; offer: ReviewAskOffer | null } | null>(null);
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
  const [siteOffer, setSiteOffer] = useState<{ stopId: string; label: string } | null>(null);
  const [siteNote,  setSiteNote]  = useState<{ stopId: string; text: string } | null>(null);

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

  // The follow-up module row + the business's own name (the customer screen greets with it).
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data: mod } = await supabase
        .from('business_modules')
        .select(BUSINESS_MODULE_COLUMNS)
        .eq('business_id', businessId)
        .eq('module_key', REVIEW_LINK_MODULE_KEY)
        .maybeSingle();
      setFollowUp((mod ?? null) as BusinessModuleRow | null);
      const { data: biz } = await supabase
        .from('businesses').select('name').eq('id', businessId).maybeSingle();
      setBusinessName((biz as { name?: string } | null)?.name ?? null);
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] follow-up module —', mod ? `enabled=${(mod as BusinessModuleRow).enabled}` : 'NO ROW (off)');
    })();
  }, [businessId]);

  /**
   * THE TAP. One action; five consumers eventually read it (review request · completion status ·
   * contractor pay · material consumption · what actually happened on a day). A plain RLS UPDATE under
   * the crew member's own session — no endpoint, no service key, no new Vercel function (12 of 12).
   */
  async function markStop(d: StopRow, kind: 'start' | 'finish') {
    if (!can('deliveries:update')) { setActionError(requirementText('deliveries:update')); return; }
    setSavingId(d.id);
    const now = new Date();
    const patch = kind === 'start'
      ? startPatch(now)
      : fulfilmentPatch(now, { started_at: d.started_at, completed_at: d.completed_at });

    const wrote = await updateStop(supabase, businessId!, d.id, { ...patch }, 'That stop');
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY]', kind, { id: d.id, patch, ok: wrote.ok });
    if (!wrote.ok) { setActionError(wrote.error); setSavingId(null); return; }

    // 🔴 THE ASK IS CONSULTED ONLY AFTER THE STOP IS ALREADY DONE — the honest moment (you cannot ask
    // about a job that has not happened), and the reason the crew's own card never has to know whether
    // the business pays for the tile.
    if (kind === 'finish') {
      let lastAsked: string | null = null;
      if (d.customer_id && followUp?.enabled) {
        const { data: prior } = await supabase
          .from('deliveries')
          .select('review_asked_at')
          .eq('business_id', businessId!)
          .eq('customer_id', d.customer_id)
          .not('review_asked_at', 'is', null)
          .order('review_asked_at', { ascending: false })
          .limit(1);
        lastAsked = (prior?.[0] as { review_asked_at?: string } | undefined)?.review_asked_at ?? null;
      }
      const decision = reviewAskDecision({
        moduleEnabled:    !!followUp?.enabled,
        moduleConfigured: !!followUp?.configured,
        config:           followUp?.config ?? null,
        businessName,
        status:           DELIVERY_STATUS_FULFILLED,   // we just wrote it, in the update above
        customerId:       d.customer_id,
        deliveryDate:     d.delivery_date,   // the ask is for the door, not for catching up paperwork
        reviewAskedAt:    d.review_asked_at,
        customerLastAskedAt: lastAsked,
        now,
      });
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] review ask —', decision.offer ? 'OFFERED' : `suppressed:${decision.suppressedBy}`);
      if (decision.offer) setAsking({ id: d.id, offer: decision.offer });
    }

    await onChanged();
    setSavingId(null);
  }

  /**
   * Record that the prompt was reached — shown or skipped. A8: the ask record is what the repeat-
   * customer window reads, so a silently-lost row means this customer gets asked again next visit.
   */
  async function recordAsk(deliveryId: string, outcome: typeof REVIEW_ASK_SHOWN | typeof REVIEW_ASK_SKIPPED) {
    const wrote = await updateStop(supabase, businessId!, deliveryId, { ...reviewAskPatch(new Date(), outcome) }, 'The review prompt');
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] review ask recorded —', outcome, wrote.ok ? 'ok' : wrote.error);
    // Surfaced to the page's error line, not to the customer screen the crew may still be holding out.
    if (!wrote.ok) setActionError('The review prompt was not recorded — this customer may be asked again next time.');
    if (outcome === REVIEW_ASK_SKIPPED) setAsking(null);
    await onChanged();
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
      // Raised BEFORE the refresh, not after: `onChanged()` unmounts the card list on two of the
      // three screens, and state set after an await that outlives the component is the defect this
      // moved to fix. Here it is page state, so the order is a choice rather than a hazard — and
      // raising it first means a refresh that THROWS still leaves the owner the offer they earned.
      // The gate is the same pair the card used, checked in one place now (§1.6 item 4).
      if (can('customers:create') && d.customer_id) {
        setSiteNote(null);
        setSiteOffer({ stopId: d.id, label: '' });
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

  /** "Not this one" — and the note goes with it, so a dismissed offer leaves no orphan sentence. */
  function dismissSiteOffer() {
    setSiteOffer(null);
    setSiteNote(null);
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
      setSiteOffer(null);
      setSiteNote({ stopId: d.id, text: `Saved as \u201c${out.site.label}\u201d. It will be offered next time you take an order for ${who}.` });
    } else if (out.kind === 'already_saved') {
      // Not an error. The answer to "save this?" for an address already in the book is "it already
      // is" — and naming the site they have beats both a duplicate row and a red refusal.
      setSiteOffer(null);
      setSiteNote({ stopId: d.id, text: `This address is already saved for ${who} as \u201c${out.site.label}\u201d.` });
    } else {
      setSiteNote({ stopId: d.id, text: out.kind === 'refused' ? out.reason : out.error });
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
      {/* `offer` is null whenever there is nothing to offer, and a null offer renders NOTHING — no
          greyed control and no upgrade copy on a crew member's phone. */}
      <ReviewAskSheet
        offer={asking?.offer ?? null}
        onShown={() => { if (asking) void recordAsk(asking.id, REVIEW_ASK_SHOWN); }}
        onSkip={()  => { if (asking) void recordAsk(asking.id, REVIEW_ASK_SKIPPED); }}
        onClose={()  => setAsking(null)}
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

  return {
    savingId, actionError, clearActionError: () => setActionError(null),
    markStop, editDate, saveShipTo, saveSite, openEditor, overlays,
    siteOffer, siteNote, setSiteOfferLabel, dismissSiteOffer,
  };
}

export type StopActions = ReturnType<typeof useStopActions>;
