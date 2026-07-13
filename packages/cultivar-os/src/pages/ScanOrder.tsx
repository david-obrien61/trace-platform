// ============================================================
// ScanOrder — the multi-item scan-loop front door into the PROVEN order flow.
// PURPOSE:  the user story — scan QR → add / scan QR → pass / scan QR → add, N items into
//           ONE order, then hand off to the proven addons → customer → review → submit tail.
//           No URL-typing: the owner walks the lot and builds the cart by scanning.
// DEPENDENCIES: QrScanner (jsQR camera — reused from walk-and-count), resolveStockLine +
//           STOCK_LINE_COLUMNS (@trace/shared/inventory — the SAME ladder the proven purchase
//           path uses), synthesizePlant + anchorKey (../lib/stockLinePlant — ONE definition),
//           extractTag (../lib/scanTag), useCart.addLine (merge-by-anchor). business_inventory
//           has owner/member RLS → an authenticated owner/staff session (this route is gated).
// OUTPUTS:  builds useCart.items[] (each line an Item-2 anchor: stock_line_id + sell_price),
//           then routes to /checkout/addons. [TRACE:CART] on each scan-add / pass / miss.
// CUSTOMER-FIRST (ways 1 & 4): a customer-attach strip lets a manager attach a customer BEFORE
//           pricing — WAY 1 look up an existing customer (reads via customers_member RLS,
//           20260710; gated on view_customers) and attach their stored tier; WAY 4 add a new
//           customer inline + invoke an order-scoped discount (owner/manager). The attached
//           customerId + invokedTier flow through the cart → submit (which honors them). The
//           anonymous QR path (path B) attaches nothing and is unchanged. [TRACE:lookup] on
//           search/attach; [TRACE:customers] on new-customer stage.
// SCOPE:    cart-building loop + customer attach. Pricing/anchoring/netting unchanged; the
//           authoritative price is always recomputed server-side (money-safety).
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ScanLine, UserPlus, UserCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { resolveStockLine, searchStockLines, STOCK_LINE_COLUMNS } from '@trace/shared/inventory';
import type { StockLineRow } from '@trace/shared/inventory';
import {
  readPricingConfig, normalizeDiscountTypes, resolveTier, RETAIL_TIER_NAME, type DiscountType,
} from '@trace/shared/business-logic';
import { QrScanner } from '../components/inventory/QrScanner';
import { useCart } from '../hooks/useCart';
import { synthesizePlant, anchorKey } from '../lib/stockLinePlant';
import { extractTag } from '../lib/scanTag';
import { totalPlantCount } from '../lib/netting';
import type { Plant } from '../types/plant';
import type { CustomerInput } from '../types/customer';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

type Phase = 'scanning' | 'reviewing' | 'picker' | 'unknown';

// A pick-list choice — used by BOTH the size-collision picker (a scanned multi-size variety)
// and the manual-search picker (a partial-term lookup that matched >1 lot). One shape, one UI.
interface PickChoice { inventoryId: string; title: string; sub: string; row: StockLineRow }

// A customer row for the attach lookup (way 1). Read via the customers_member RLS (20260710) —
// an owner reads via the owner policy, a manager holding view_customers via the member policy.
interface CustomerHit {
  id: string; first_name: string; last_name: string | null;
  phone: string | null; email: string | null;
  address_line1: string | null; city: string | null; state: string | null; zip: string | null;
  price_tier: string | null;
  // D-40 (optional — gated cols 20260713): the persistent exemption, carried so Review reflects it.
  tax_exempt?: boolean | null; tax_exempt_reason?: string | null; tax_exempt_cert_ref?: string | null;
}

// Human label of a tier for the "visible moment" badge — the pricing agreement the manager sees
// BEFORE submit (the authoritative price is always recomputed server-side). Uses the shared
// resolver so the badge and the server's applyTierPrice read the SAME tier definition (no drift).
function tierLabelFor(tierName: string | null, types: DiscountType[]): string {
  const t = resolveTier(tierName, types);
  if (t.basis === 'at_cost') return `${t.name} · at cost`;
  if (t.discountPercent > 0) return `${t.name} · ${t.discountPercent}% off retail`;
  return 'Retail — no discount';
}

// Tier options for the way-4 order-discount picker (retail floor + every configured type × tier).
// Mirrors Customers.tsx tierOptions (value = the tier NAME; label = "Type · Tier"). Dynamic — no
// hardcoded set.
function buildTierOptions(types: DiscountType[]): { value: string; label: string }[] {
  const opts = [{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }];
  for (const ty of types) for (const ti of ty.tiers) opts.push({ value: ti.name, label: `${ty.name} · ${ti.name}` });
  return opts;
}

function customerToInput(r: CustomerHit): CustomerInput {
  return {
    first_name:    r.first_name,
    last_name:     r.last_name ?? '',
    email:         r.email ?? '', // CustomerInput.email is required; CustomerCapture requires a valid one before submit
    phone:         r.phone ?? undefined,
    address_line1: r.address_line1 ?? undefined,
    city:          r.city ?? undefined,
    state:         r.state ?? undefined,
    zip:           r.zip ?? undefined,
    price_tier:    r.price_tier ?? null, // D-39: carry the stored tier so Review resolves the same discount submit charges
    tax_exempt:          r.tax_exempt ?? null,          // D-40: carry the persistent exemption to the Review preview
    tax_exempt_reason:   r.tax_exempt_reason ?? null,
    tax_exempt_cert_ref: r.tax_exempt_cert_ref ?? null,
  };
}

export function ScanOrder() {
  const navigate = useNavigate();
  const { businessId, isOwner, can } = useBusinessContext();
  const {
    items, addLine, removeLine, clear,
    attachedCustomerName, orderTierLabel, attachCustomer, clearAttachedCustomer,
  } = useCart();

  const [phase, setPhase]           = useState<Phase>('scanning');
  const [resolved, setResolved]     = useState<Plant | null>(null);
  const [qty, setQty]               = useState(1);
  const [candidates, setCandidates] = useState<PickChoice[]>([]);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerHint, setPickerHint]   = useState('');
  const [unknownTag, setUnknownTag] = useState('');

  // ── Customer-first attach (ways 1 & 4) ──────────────────────────────────────
  const [customerView, setCustomerView] = useState<null | 'lookup' | 'create'>(null);
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [searchTerm, setSearchTerm]   = useState('');
  const [searchHits, setSearchHits]   = useState<CustomerHit[]>([]);
  const [searching, setSearching]     = useState(false);
  const [searched, setSearched]       = useState(false);
  // way-4 new-customer mini-form (rest is confirmed at CustomerCapture)
  const [nf, setNf] = useState({ first: '', last: '', email: '', phone: '' });
  const [nfTier, setNfTier] = useState(RETAIL_TIER_NAME);
  const [nfError, setNfError] = useState('');

  // A manager holding view_customers (or the owner) may LOOK UP existing customers; without it
  // the search would always return empty (RLS), so we offer only the "add new" path (honest).
  const canLookup = isOwner || can('view_customers');
  // The order-scoped tier INVOKE (way 4) is an owner/manager act, server-verified at submit —
  // hide the picker for staff (their new customers ring at retail).
  const canInvoke = isOwner || can('manage_orders');

  const plantCount = totalPlantCount(items);
  const customerOpen = customerView !== null;

  // Load the configured discount types (business-scoped read; feeds the badge + way-4 picker).
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data } = await readPricingConfig(supabase, businessId);
      setDiscountTypes(normalizeDiscountTypes((data?.config ?? {}) as Record<string, unknown>));
    })();
  }, [businessId]);

  async function runCustomerSearch() {
    if (!businessId) return;
    const safe = searchTerm.trim().replace(/[,%()]/g, ' ').trim();
    if (!safe) { setSearchHits([]); setSearched(false); return; }
    setSearching(true);
    const like = `%${safe}%`;
    const runSearch = (cols: string) => supabase
      .from('customers')
      .select(cols)
      .eq('business_id', businessId)
      .or(`first_name.ilike.${like},last_name.ilike.${like}`)
      .order('first_name')
      .limit(10);
    // D-40 gated cols (20260713) — deploy-window-safe: try with the exemption cols; on a missing-column
    // error retry WITHOUT them so customer search never breaks before the migration applies.
    const BASE = 'id,first_name,last_name,phone,email,address_line1,city,state,zip,price_tier';
    let { data, error } = await runSearch(`${BASE},tax_exempt,tax_exempt_reason,tax_exempt_cert_ref`);
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      console.log('[TRACE:TAX] customer exemption cols absent — search retrying without them (migration pending)', { code: error.code });
      ({ data, error } = await runSearch(BASE));
    }
    if (error) console.log('[TRACE:lookup] search error', { error: error.message });
    console.log('[TRACE:lookup] customer search', { term: safe, count: data?.length ?? 0 });
    setSearchHits((data ?? []) as unknown as CustomerHit[]);
    setSearched(true);
    setSearching(false);
  }

  // WAY 1 — attach an existing customer: use their stored tier (no invoke).
  function attachExisting(r: CustomerHit) {
    attachCustomer({
      customerId:  r.id,
      name:        `${r.first_name} ${r.last_name ?? ''}`.trim(),
      customer:    customerToInput(r),
      invokedTier: null,
      tierLabel:   tierLabelFor(r.price_tier, discountTypes),
      // Resolve the customer's STORED tier once here (config is loaded) → carried into the cart so
      // CartReview shows the SAME discount submit charges (D-39). submit re-resolves authoritatively.
      resolvedTier: resolveTier(r.price_tier, discountTypes),
    });
    closeCustomer();
  }

  // WAY 4 — a NEW customer: submit creates the row (findOrCreateCustomer, source='qr-scan'). The
  // chosen discount is invoked for THIS order only (invokedTier, server-verified owner/manager) —
  // NOT persisted to the new customer (making a tier a customer's default is the /customers roster
  // path). attachedCustomerId stays null → submit creates + resolves + applies the order invoke.
  function useNewCustomerForOrder() {
    if (!nf.first.trim()) { setNfError('First name is required.'); return; }
    const chosen = canInvoke ? nfTier : RETAIL_TIER_NAME;
    const customer: CustomerInput = {
      first_name: nf.first.trim(),
      last_name:  nf.last.trim(),
      email:      nf.email.trim(), // required by CustomerInput; confirmed/completed at CustomerCapture
      phone:      nf.phone.trim() || undefined,
    };
    attachCustomer({
      customerId:  null, // NEW — submit creates via findOrCreateCustomer
      name:        `${nf.first.trim()} ${nf.last.trim()}`.trim(),
      customer,
      invokedTier: chosen !== RETAIL_TIER_NAME ? chosen : null,
      tierLabel:   tierLabelFor(chosen, discountTypes),
      // Resolve the invoked tier once → carried so CartReview shows what submit charges (D-39).
      resolvedTier: resolveTier(chosen, discountTypes),
    });
    console.log('[TRACE:customers] new customer staged for order (created at submit)', {
      name: customer.first_name, invokedTier: chosen !== RETAIL_TIER_NAME ? chosen : null,
    });
    closeCustomer();
  }

  function openCustomer() {
    setSearchTerm(''); setSearchHits([]); setSearched(false);
    setNf({ first: '', last: '', email: '', phone: '' }); setNfTier(RETAIL_TIER_NAME); setNfError('');
    setCustomerView(canLookup ? 'lookup' : 'create');
  }
  function closeCustomer() { setCustomerView(null); }

  async function handleScan(raw: string) {
    if (!businessId) return;
    const tag = extractTag(raw);
    const resolution = await resolveStockLine(supabase, businessId, tag, { columns: STOCK_LINE_COLUMNS });

    if (resolution.kind === 'resolved') {
      const plant = synthesizePlant(resolution.row, businessId, tag);
      if (TRACE_CART) console.log('[TRACE:CART] scan resolved —', resolution.via, plant.common_name, { anchor: anchorKey(plant), sellPrice: plant.business_inventory?.sell_price });
      openReview(plant);
      return;
    }

    if (resolution.kind === 'collision') {
      const choices: PickChoice[] = resolution.candidates.map(row => ({
        inventoryId: row.id,
        title:       (row.size ?? '').trim() || 'Unspecified size',
        sub:         row.qty != null ? `${row.qty} available` : '',
        row,
      }));
      if (TRACE_CART) console.log('[TRACE:CART] scan size collision — picker:', choices.map(c => c.title).join(' / '));
      openPicker(`${resolution.variety} — which size?`, "This variety is stocked in more than one size. Pick the one you're looking at.", choices);
      return;
    }

    // miss — surface, keep scanning.
    if (TRACE_CART) console.log('[TRACE:CART] scan miss — not recognized:', tag);
    setUnknownTag(tag);
    setPhase('unknown');
  }

  // Manual "Search" field: a PARTIAL id / name token → matching lot(s). 0 → unknown; 1 →
  // resolve; >1 → the same pick list the size collision uses. No exact-tag requirement.
  async function handleLookup(term: string) {
    if (!businessId) return;
    const results = await searchStockLines(supabase, businessId, term, { columns: STOCK_LINE_COLUMNS });
    if (TRACE_CART) console.log('[TRACE:RESOLVE] manual search', { term, matchCount: results.length });

    if (results.length === 0) {
      setUnknownTag(term);
      setPhase('unknown');
      return;
    }
    if (results.length === 1) {
      const row = results[0];
      const plant = synthesizePlant(row, businessId, row.sku ?? row.name);
      if (TRACE_CART) console.log('[TRACE:RESOLVE] manual search — single match resolved', plant.common_name);
      openReview(plant);
      return;
    }
    const choices: PickChoice[] = results.map(row => ({
      inventoryId: row.id,
      title: `${row.name}${(row.size ?? '').trim() ? ` · ${(row.size ?? '').trim()}` : ''}`,
      sub: [
        row.sku ?? '',
        row.qty != null ? `${row.qty} available` : '',
        (row.sell_price != null && Number(row.sell_price) > 0) ? `$${Number(row.sell_price).toFixed(2)}` : '',
      ].filter(Boolean).join(' · '),
      row,
    }));
    openPicker(`"${term}" — pick an item`, `${results.length} matches. Pick the one you're looking at.`, choices);
  }

  function openPicker(title: string, hint: string, choices: PickChoice[]) {
    setPickerTitle(title);
    setPickerHint(hint);
    setCandidates(choices);
    setPhase('picker');
  }

  function closePicker() {
    setCandidates([]);
    setPickerTitle('');
    setPickerHint('');
    setPhase('scanning');
  }

  function openReview(plant: Plant) {
    setResolved(plant);
    setQty(1);
    setPhase('reviewing');
  }

  function pick(c: PickChoice) {
    if (!businessId) return;
    const plant = synthesizePlant(c.row, businessId, c.row.sku ?? c.row.name);
    setCandidates([]);
    setPickerTitle('');
    setPickerHint('');
    openReview(plant);
  }

  function addToOrder() {
    if (!resolved) return;
    addLine(resolved, qty);   // [TRACE:CART] scan-add fires in the store (merge-by-anchor)
    setResolved(null);
    setPhase('scanning');
  }

  function pass() {
    if (TRACE_CART) console.log('[TRACE:CART] scan pass — item skipped (not added)', { anchor: resolved ? anchorKey(resolved) : null });
    setResolved(null);
    setPhase('scanning');
  }

  function review() {
    if (items.length === 0) return;
    navigate('/checkout/addons');
  }

  function exit() {
    clear();
    navigate('/orders');
  }

  const sellPrice = resolved?.business_inventory?.sell_price ?? 0;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={exit} aria-label="Cancel order"><ArrowLeft size={22} color="#1a2e0a" /></button>
        <h1 style={S.title}>New order — scan items</h1>
        <div style={{ flex: 1 }} />
        {items.length > 0 && <span style={S.tally}>{items.length} item{items.length !== 1 ? 's' : ''} · {plantCount}</span>}
      </div>

      {/* Customer-first attach strip (ways 1 & 4) — attach a customer BEFORE pricing so the cart
          prices against their tier and the tier is a visible moment, not inferred after. */}
      {attachedCustomerName ? (
        <div style={S.custStrip}>
          <UserCheck size={18} color="#27500A" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.custName}>{attachedCustomerName}</p>
            {orderTierLabel && <span style={S.tierBadge}>{orderTierLabel}</span>}
          </div>
          <button style={S.custChange} onClick={clearAttachedCustomer}>Change</button>
        </div>
      ) : (
        <button style={S.custAttachBtn} onClick={openCustomer}>
          <UserPlus size={17} color="#27500A" />
          {canLookup ? 'Look up or add a customer' : 'Add a customer'}
        </button>
      )}

      {/* Camera */}
      <div style={S.card}>
        <QrScanner active={phase === 'scanning' && !customerOpen} onScan={raw => void handleScan(raw)} onLookup={term => void handleLookup(term)} />
      </div>

      {/* Cart so far */}
      {items.length > 0 && (
        <div style={S.cartCard}>
          <p style={S.cartHead}>In this order</p>
          {items.map((l) => {
            const key = anchorKey(l.plant);
            return (
              <div key={key} style={S.cartRow}>
                <span style={S.cartLabel}>{l.plant.common_name ?? l.plant.species}{l.plant.current_container ? ` · ${l.plant.current_container}` : ''} × {l.quantity}</span>
                <span style={S.cartAmt}>${((l.plant.business_inventory?.sell_price ?? 0) * l.quantity).toFixed(2)}</span>
                <button onClick={() => removeLine(key)} aria-label="Remove" style={S.iconBtn}><X size={15} color="#9ca3af" /></button>
              </div>
            );
          })}
          <button style={S.reviewBtn} onClick={review}>Review order →</button>
        </div>
      )}

      {items.length === 0 && phase === 'scanning' && (
        <div style={S.hintCard}>
          <ScanLine size={34} color="#27500A" style={{ marginBottom: 10 }} />
          <p style={S.lead}>Scan a plant tag QR to add it. Scan the next, and the next — they all go on one order. Pass on anything you don't want.</p>
        </div>
      )}

      {/* REVIEW sheet — resolved item, Add or Pass */}
      {phase === 'reviewing' && resolved && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) pass(); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{resolved.common_name ?? resolved.species}{resolved.current_container ? ` · ${resolved.current_container}` : ''}</h2>
              <button style={S.iconBtn} onClick={pass} aria-label="Pass"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={sellPrice > 0 ? S.price : S.priceNone}>
              {sellPrice > 0 ? `$${sellPrice.toFixed(2)} each` : 'No price set — you can set it in Inventory before checkout'}
            </p>
            <div style={S.qtyRow}>
              <span style={S.qtyLabel}>Quantity</span>
              <div style={S.stepper}>
                <button style={S.stepBtn} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease"><Minus size={16} color="#374151" /></button>
                <span style={S.stepVal}>{qty}</span>
                <button style={S.stepBtn} onClick={() => setQty(q => q + 1)} aria-label="Increase"><Plus size={16} color="#374151" /></button>
              </div>
            </div>
            <button style={S.btnPrimary} onClick={addToOrder}>Add to order</button>
            <button style={S.btnGhost} onClick={pass}>Pass — scan the next</button>
          </div>
        </div>
      )}

      {/* PICKER sheet — size collision OR manual-search multi-match */}
      {phase === 'picker' && candidates.length > 0 && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) closePicker(); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{pickerTitle}</h2>
              <button style={S.iconBtn} onClick={closePicker} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            {pickerHint && <p style={S.subtle}>{pickerHint}</p>}
            {candidates.map((c) => (
              <button key={c.inventoryId} style={S.pickBtn} onClick={() => pick(c)}>
                <span style={S.pickSize}>{c.title}</span>
                {c.sub && <span style={S.pickQty}>{c.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* UNKNOWN sheet — not recognized, keep scanning */}
      {phase === 'unknown' && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setPhase('scanning'); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Didn't recognize this</h2>
              <button style={S.iconBtn} onClick={() => setPhase('scanning')} aria-label="Close"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>Scanned <code style={S.code}>{unknownTag}</code> — it didn't match a stock line. Check the tag, or keep scanning.</p>
            <button style={S.btnPrimary} onClick={() => setPhase('scanning')}>Keep scanning</button>
          </div>
        </div>
      )}

      {/* CUSTOMER sheet — look up an existing customer (way 1) or add a new one (way 4) */}
      {customerOpen && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) closeCustomer(); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{customerView === 'create' ? 'New customer' : 'Attach a customer'}</h2>
              <button style={S.iconBtn} onClick={closeCustomer} aria-label="Close"><X size={20} color="#6b7280" /></button>
            </div>

            {customerView === 'lookup' && (
              <>
                <div style={S.searchRow}>
                  <input
                    style={S.searchInput}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void runCustomerSearch(); }}
                    placeholder="Search by name…"
                    autoFocus
                  />
                  <button style={S.searchBtn} onClick={() => void runCustomerSearch()} disabled={searching}>
                    {searching ? '…' : 'Search'}
                  </button>
                </div>
                {searched && searchHits.length === 0 && (
                  <p style={S.subtle}>No customer found. Add them as a new customer below.</p>
                )}
                {searchHits.map(h => (
                  <button key={h.id} style={S.pickBtn} onClick={() => attachExisting(h)}>
                    <span style={S.pickSize}>{h.first_name} {h.last_name ?? ''}</span>
                    <span style={S.pickQty}>
                      {[h.phone, h.email, tierLabelFor(h.price_tier, discountTypes)].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
                <button style={S.btnGhost} onClick={() => setCustomerView('create')}>+ Add a new customer</button>
              </>
            )}

            {customerView === 'create' && (
              <>
                <div style={S.formRow}>
                  <input style={S.formInput} value={nf.first} onChange={e => setNf(v => ({ ...v, first: e.target.value }))} placeholder="First name *" autoFocus />
                  <input style={S.formInput} value={nf.last} onChange={e => setNf(v => ({ ...v, last: e.target.value }))} placeholder="Last name" />
                </div>
                <input style={{ ...S.formInput, width: '100%', marginBottom: 10 }} type="email" value={nf.email} onChange={e => setNf(v => ({ ...v, email: e.target.value }))} placeholder="Email (you can add it at checkout)" />
                <input style={{ ...S.formInput, width: '100%', marginBottom: 12 }} type="tel" value={nf.phone} onChange={e => setNf(v => ({ ...v, phone: e.target.value }))} placeholder="Phone" />

                {/* Order-scoped discount invoke (owner/manager only) */}
                {canInvoke && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.formLabel}>Discount for this order</label>
                    <select style={{ ...S.formInput, width: '100%' }} value={nfTier} onChange={e => setNfTier(e.target.value)}>
                      {buildTierOptions(discountTypes).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <p style={S.hintText}>Applies to this order only. Set a customer's standing tier in Customers.</p>
                  </div>
                )}
                {nfError && <p style={S.priceNone}>{nfError}</p>}
                <button style={S.btnPrimary} onClick={useNewCustomerForOrder}>Use for this order</button>
                {canLookup && <button style={S.btnGhost} onClick={() => setCustomerView('lookup')}>← Look up an existing customer</button>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 } as React.CSSProperties,
  backBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  title:      { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  tally:      { background: '#27500A', color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' } as React.CSSProperties,
  card:       { background: '#fff', borderRadius: 14, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 } as React.CSSProperties,
  hintCard:   { background: '#fff', borderRadius: 14, padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  lead:       { color: '#374151', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 } as React.CSSProperties,
  cartCard:   { background: '#fff', borderRadius: 14, padding: '1rem 1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  cartHead:   { fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' } as React.CSSProperties,
  cartRow:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } as React.CSSProperties,
  cartLabel:  { flex: 1, minWidth: 0, fontSize: '0.9rem', color: '#374151' } as React.CSSProperties,
  cartAmt:    { fontWeight: 600, fontSize: '0.9rem', color: '#374151' } as React.CSSProperties,
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  reviewBtn:  { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, boxSizing: 'border-box' } as React.CSSProperties,
  sheet:      { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' } as React.CSSProperties,
  sheetHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' } as React.CSSProperties,
  sheetTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  price:      { color: '#27500A', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' } as React.CSSProperties,
  priceNone:  { color: '#A32D2D', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 1rem' } as React.CSSProperties,
  qtyRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 } as React.CSSProperties,
  qtyLabel:   { fontSize: '0.95rem', color: '#374151', fontWeight: 600 } as React.CSSProperties,
  stepper:    { display: 'flex', alignItems: 'center', gap: 4, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: 2 } as React.CSSProperties,
  stepBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  stepVal:    { minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: '#1f2937' } as React.CSSProperties,
  subtle:     { color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1rem' } as React.CSSProperties,
  code:       { background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', fontSize: '0.82rem', color: '#374151' } as React.CSSProperties,
  btnPrimary: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  btnGhost:   { width: '100%', minHeight: 44, background: 'none', color: '#6b7280', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', marginTop: 10 } as React.CSSProperties,
  pickBtn:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, width: '100%', minHeight: 52, background: '#fff', border: '1.5px solid #27500A', borderRadius: 10, padding: '0.7rem 1rem', cursor: 'pointer', marginBottom: 10, textAlign: 'left' } as React.CSSProperties,
  pickSize:   { fontSize: '1.02rem', fontWeight: 700, color: '#1a2e0a' } as React.CSSProperties,
  pickQty:    { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' } as React.CSSProperties,
  // ── customer-first attach ──
  custStrip:  { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #27500A', borderRadius: 12, padding: '0.65rem 0.9rem', marginBottom: 14 } as React.CSSProperties,
  custName:   { fontSize: '0.95rem', fontWeight: 700, color: '#1a2e0a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as React.CSSProperties,
  tierBadge:  { display: 'inline-block', marginTop: 3, background: '#eef2ff', color: '#3730a3', fontWeight: 700, fontSize: '0.72rem', borderRadius: 6, padding: '2px 8px' } as React.CSSProperties,
  custChange: { background: 'none', border: 'none', color: '#27500A', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
  custAttachBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46, background: '#fff', border: '1.5px dashed #27500A', borderRadius: 12, color: '#27500A', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', marginBottom: 14 } as React.CSSProperties,
  searchRow:  { display: 'flex', gap: 8, marginBottom: 12 } as React.CSSProperties,
  searchInput:{ flex: 1, minHeight: 46, border: '1.5px solid #d1d5db', borderRadius: 9, padding: '0 12px', fontSize: '0.95rem', boxSizing: 'border-box' } as React.CSSProperties,
  searchBtn:  { minHeight: 46, background: '#27500A', color: '#fff', border: 'none', borderRadius: 9, padding: '0 16px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  formRow:    { display: 'flex', gap: 8, marginBottom: 10 } as React.CSSProperties,
  formInput:  { flex: 1, minWidth: 0, minHeight: 44, border: '1.5px solid #d1d5db', borderRadius: 9, padding: '0 12px', fontSize: '0.95rem', boxSizing: 'border-box', background: '#fff', color: '#111827' } as React.CSSProperties,
  formLabel:  { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 } as React.CSSProperties,
  hintText:   { fontSize: '0.74rem', color: '#9ca3af', margin: '4px 0 0' } as React.CSSProperties,
};
