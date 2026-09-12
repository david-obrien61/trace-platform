/**
 * ── ShipToPicker — WHERE THIS LOAD GOES, CHOSEN RATHER THAN RE-TYPED ────────────────────────
 *
 * PURPOSE      D-41's L2 picker (ledger #303). A customer's saved sites are offered FIRST, and a
 *              new address is always typeable — the book is a convenience, never a gate. Choosing
 *              a site FILLS the address fields beside it, so the operator SEES where the truck is
 *              being sent rather than trusting a chip.
 *
 *              🔴 WHAT IT PRODUCES IS TEXT, NEVER A POINTER. The chosen address travels to the
 *              server as four strings and is snapshotted onto the delivery row. Editing "Job site
 *              A" tomorrow cannot move a past order, because no past order points at it.
 *
 *              ⚠️ FREE ENTRY IS NOT A FALLBACK, IT IS THE DEFAULT. A customer with no saved sites
 *              sees exactly the form that was there before this build. A customer with sites sees
 *              the same form plus a row of choices above it. Nothing is taken away.
 *
 * DEPENDENCIES ../../business-logic/customerAddresses (the ONE module that knows the book) ·
 *              a supabase client passed in. No vertical noun (AC-1) — a "site" is a value of the
 *              customer relationship, and this component is as true for Kinna as for Cultivar.
 * OUTPUTS      <ShipToPicker> — renders nothing at all when there is nothing to offer.
 */
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readCustomerAddresses, siteLine, sameAddress,
  type CustomerAddress, type ShipToInput,
} from '../../business-logic/customerAddresses';

const TRACE_SITES = true; // [TRACE:SITES] STD-003 — ON until David owner-proves

export type ShipToPickerProps = {
  db: SupabaseClient;
  businessId: string | null;
  /** The customer whose sites to offer. Null (a brand-new customer) ⇒ nothing to offer. */
  customerId: string | null;
  /** The address currently in the form beside this control — what "typed" means right now. */
  current: { line1: string; city: string; state: string; zip: string };
  /** Fill the form from a chosen site. The picker never writes; the page owns its own fields. */
  onChoose: (address: { line1: string; city: string; state: string; zip: string }, chosen: ShipToInput) => void;
};

export function ShipToPicker({ db, businessId, customerId, current, onChoose }: ShipToPickerProps) {
  const [sites, setSites] = useState<CustomerAddress[]>([]);
  // Null until the read finishes. A picker that renders "no saved sites" before it has looked
  // states a fact it does not have (D-9) — so it renders NOTHING until it knows.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!businessId || !customerId) { setSites([]); setLoaded(true); return; }
    let live = true;
    void (async () => {
      const out = await readCustomerAddresses(db, businessId, customerId);
      if (!live) return;
      // A refused read is an EMPTY BOOK, not a broken screen: a person without `customers:read`
      // must still be able to type an address and take the order (A9 — a missing convenience
      // must not delete the act).
      setSites(out.ok ? out.sites : []);
      setLoaded(true);
      if (TRACE_SITES) console.log('[TRACE:SITES] picker loaded', {
        customerId, ok: out.ok, sites: out.ok ? out.sites.length : 0,
      });
    })();
    return () => { live = false; };
  }, [db, businessId, customerId]);

  // Nothing saved ⇒ render NOTHING. The form below is exactly what was there before this build,
  // and a header promising saved sites above an empty row would be a claim that is not true
  // (§6 r18 — a header's assertion must hold for every row the section can contain).
  if (!loaded || sites.length === 0) return null;

  const matching = sites.find(s => sameAddress(s, {
    line1: current.line1 || null, city: current.city || null,
    state: current.state || null, zip: current.zip || null,
  })) ?? null;

  function choose(s: CustomerAddress) {
    const address = { line1: s.line1 ?? '', city: s.city ?? '', state: s.state ?? '', zip: s.zip ?? '' };
    if (TRACE_SITES) console.log('[TRACE:SITES] site chosen at checkout', { siteId: s.id, label: s.label });
    onChoose(address, { ...address, source: 'saved_site', siteId: s.id });
  }

  return (
    <div style={{
      border: '1px solid #d8e3c8', background: '#F6FAF0', borderRadius: 8,
      padding: '10px 12px', margin: '0 0 12px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#27500A', marginBottom: 8 }}>
        Saved delivery sites for this customer
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sites.map(s => {
          const chosen = matching?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => choose(s)}
              aria-pressed={chosen}
              style={{
                // §1.6 item 5 — ≥48px touch target. This is rung up at a counter on a phone.
                minHeight: 48, textAlign: 'left', cursor: 'pointer',
                border: chosen ? '2px solid #27500A' : '1px solid #cbd5c0',
                background: chosen ? '#E7F0DA' : '#fff',
                borderRadius: 6, padding: '6px 12px', flex: '1 1 220px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                {s.label}{s.is_default ? ' · default' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#4b5563' }}>{siteLine(s)}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: '#4b5563', marginTop: 8 }}>
        {/* The honest state sentence. It says what is true of the fields below RIGHT NOW, rather
            than naming an action ("or type a new one") the operator may already have taken. */}
        {matching
          ? `Delivering to ${matching.label}. Edit the address below to send this order somewhere else.`
          : 'The address below is not one of the saved sites — this order will go where the fields say.'}
      </div>
    </div>
  );
}
