// ============================================================
// Customers — the customer ROSTER datasheet (Cultivar OS)
// PURPOSE:      The desktop roster + edit surface for the `customers` table — the list Lauren/
//               David expect (every customer created via OCR-invoice capture, QR checkout, or
//               added directly here) AND the inline-edit surface, in one. Runs through the SAME
//               shared <DataSheet> engine /inventory + /assets use (the 3rd consumer — one
//               engine, three configs; AC-4 settle-once). Reached via its owner-only nav node.
//               STD-011 (one canonical form): BOTH "Add Customer" (create) and "Edit customer" open
//               the SAME grouped <CustomerPartyEditor> — the old flat Add form is retired, so a field
//               added to the party record can never drift between two forms. The roster shows only
//               the at-a-glance columns (name/type/tier/tax/status); everything else is in the editor.
// SCOPE (v1):   customers table ONLY. The person spine (customers.person_id → people) is DEFERRED
//               — it stays populated-on-create by the OCR/service-key path and needs nothing from
//               this list; people RLS (people_self_all, auth_user_id-keyed) blocks an owner from
//               reading OTHER person rows anyway, so cross-role ("also a vendor") display is not
//               possible here. person_id is not shown.
// DEPENDENCIES: supabase (customers rows, business_id-scoped), useBusinessContext (businessId →
//               RLS scope), DataSheet cell components. NO migration, NO new dep, NO endpoint.
// OUTPUTS:      Inline roster writes: tier + status (per-row RLS UPDATE). Full field editing +
//               create (insert, source='manual') both go through CustomerPartyEditor. Reflects on
//               that customer's deliveries via the deliveries→customers join.
// GATE:         OWNER-ONLY — the /customers route sits in an owner-only PermissionRoute group
//               (like /costs), matching the customers_business_owner RLS (owner-only, FOR ALL).
//               Staff hold no access at either layer → nav never opens onto an empty RLS wall.
// INSTRUMENTATION (STD-003): `[TRACE:customers]` on load + every inline edit + insert.
//               ON BY DEFAULT — standing owner instruction (do NOT comment out).
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { customerDisplayName } from '@trace/shared/utils/personName';
import {
  DataSheet, SelectCell, sheetStyles as SS,
  type DataSheetColumn,
} from '@trace/shared/components/datasheet/DataSheet';
import { writeLanded, applyRowPatch } from '@trace/shared/components/datasheet/rowPatch';
import { CustomerPartyEditor, BLANK_PARTY_CUSTOMER, type PartyCustomer } from '../components/customers/CustomerPartyEditor';
import { CUSTOMER_SELECT_CORE, CUSTOMER_SELECT_FULL, CUSTOMER_SEARCH_FIELDS, customerSearchHaystack } from '../components/customers/customerFieldRegistry';
import { readPricingConfig, normalizeDiscountTypes, RETAIL_TIER_NAME, taxExemptionLabel, type DiscountType } from '@trace/shared/business-logic';
import { requirementText } from '@trace/shared/components/SurfaceState';
import { findDuplicateParties, DUP_AXES } from '@trace/shared/customers/duplicateParties';
import { AlertTriangle } from 'lucide-react';

const SOURCE_LABEL: Record<string, string> = {
  'qr-scan':     'QR checkout',
  'ocr-invoice': 'Invoice scan',
  'manual':      'Added by hand',
};

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price_tier: string | null;
  customer_type: string | null;
  // D-40: the persistent tax exemption (gated cols 20260713; optional so a pre-migration read is safe).
  tax_exempt?: boolean | null;
  tax_exempt_reason?: string | null;
  tax_exempt_cert_ref?: string | null;
  // Party-record cols (2026-07-13, gated) — optional so a pre-migration read is safe (deploy-window).
  organization_name?: string | null;
  display_name?: string | null;
  billing_line1?: string | null;
  billing_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  tax_id?: string | null;
  tax_exempt_expires?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  status?: string | null;
  notes?: string | null;
  source: string | null;
  qb_customer_id: string | null;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const sourceStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: '#374151', background: '#f3f4f6', borderRadius: 6, padding: '2px 7px' };
const tierSelectStyle = (): React.CSSProperties => ({ color: '#3730a3', fontWeight: 700 });

export function Customers() {
  const { businessId, can } = useBusinessContext();
  // PRE-EMPTIVE, not apologetic (Phase 3, ruling 2026-07-30). These grid cells were among the only
  // three surfaces on the platform that SPOKE when a write was refused — correct that they speak,
  // wrong that they speak AFTER. A person changed a tier, watched it repaint, and was told a
  // moment later it had not saved. The permission is knowable BEFORE the click.
  //
  // 🔴 THE POST-WRITE CHECK STAYS. It is not redundant: this flag is the CLIENT's belief, and RLS
  // is the authority. A write can still be refused for a reason the client cannot predict (a
  // policy narrower than the string, a row that moved). Pre-emptive copy prevents the ordinary
  // case; the A8 check catches the case the client got wrong. Removing either one loses something.
  const canEditCustomer = can('customers:update');
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  // The TRUE number of customers in the table, from `count: 'exact'` — not `customers.length`,
  // which is only what this page managed to load. The grid header renders the difference.
  const [customerTotal, setCustomerTotal] = useState<number | null>(null);

  // The ONE customer form (STD-011): Add (create) AND Edit both open CustomerPartyEditor. null =
  // closed; { mode:'create' } opens it empty; { mode:'edit', row } opens it populated.
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; row: PartyCustomer } | null>(null);

  // Configured discount types × tiers (from business_pricing_config.config — set on the Discounts
  // screen). READ is business-scoped (readPricingConfig), NOT owner-restricted — the tier picker
  // resolves the full set independently of the /discounts admin route. aiEnabled gates the AI slot.
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);

  const loadCustomers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    console.log('[TRACE:customers] loadCustomers → customers', { businessId });
    // CORE = guaranteed-live set (everything pre-2026-07-13). FULL adds the D-40 exemption trio +
    // the party-record cols (both gated 20260713). Deploy-window-safe: try FULL, retry CORE on a
    // missing-column error so the roster never breaks before the migrations apply.
    // E6 (Phase A): these were two hand-maintained column strings — the list most likely to silently
    // omit a field (a field added to the form but missed here reads back null forever). Now DERIVED.
    const CORE = CUSTOMER_SELECT_CORE;
    const FULL = CUSTOMER_SELECT_FULL;
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 THE READ IS PAGED AND THE TOTAL IS COUNTED — IT USED TO BE NEITHER.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // This was one unbounded `.select()`. **PostgREST caps that at 1000 rows**, so against 1,964
    // customers the roster held exactly 1000 and the header — which derived its total from
    // `rows.length` — read `1000 of 1000`. The screen did not truncate, it ASSERTED: the 1,000th
    // customer was the last one that existed as far as Lauren could tell, and there was no
    // scrollbar, banner or count anywhere that disagreed.
    //
    // ⚠️ IT WAS HONEST ON `/inventory` IN THE SAME SESSION (`647 of 647`) FOR ONE REASON: 647 is
    // under the cap. Same code, honest below 1000, lying above it — which is why this is fixed in
    // the shared grid's contract (`totalRows`) and not with a bigger number here.
    //
    // `count: 'exact'` on the first page gives the TRUE total; `.range()` then pages until the
    // rows run out. The count and the rows come from the same filter, so they cannot disagree.
    const PAGE = 1000;
    const run = (cols: string, from: number) => supabase
      .from('customers')
      .select(cols, { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    // Which column set ANSWERED is remembered, so the remaining pages are read with the same one —
    // paging page 2 with FULL after page 1 fell back to CORE would fail every page but the first.
    let answered = FULL;
    let { data, error, count } = await run(FULL, 0);
    if (error && ((error as any).code === '42703' || (error as any).code === 'PGRST204')) {
      console.log('[TRACE:customers] party/exemption cols absent — roster retrying with CORE (migration pending)', { code: (error as any).code });
      answered = CORE;
      ({ data, error, count } = await run(CORE, 0));
    }
    // Pull the remaining pages. `total` bounds the loop, and a short or empty page ends it, so a
    // mis-sized page can never spin.
    if (!error) {
      const total = count ?? (data?.length ?? 0);
      const all = [...((data ?? []) as any[])];
      while (all.length < total) {
        const next = await run(answered, all.length);
        if (next.error) { console.log('[TRACE:customers] page read failed — showing what loaded', { got: all.length, total, message: next.error.message }); break; }
        const rows = (next.data ?? []) as any[];
        if (rows.length === 0) break;
        all.push(...rows);
      }
      data = all as any;
      count = total;
    }
    setCustomerTotal(count ?? null);
    if (error) { console.error('[TRACE:customers] loadCustomers error', error.message); setListError(error.message); setListLoading(false); return; }
    // `searchableFields` is on this emit deliberately: the roster's search covering fewer fields
    // than it displays was invisible from every screen and every log. Now the trail says what a
    // customer can be FOUND BY, next to how many were loaded.
    console.log('[TRACE:customers] loadCustomers ok', {
      count: data?.length ?? 0,
      // 🔴 BOTH NUMBERS, ALWAYS. `loaded === total` is the assertion the header makes; if they ever
      // diverge the trail says so rather than leaving a capped read looking complete.
      totalInTable: count ?? null,
      searchableFields: CUSTOMER_SEARCH_FIELDS.length,
      searchable: CUSTOMER_SEARCH_FIELDS.join(','),
    });
    setCustomers((data ?? []) as unknown as CustomerRow[]);
    setListLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    void loadCustomers();
  }, [businessId, loadCustomers]);

  // Load the configured discount types (business-scoped read; forward-migrates legacy pricingTiers).
  // Feeds the inline tier picker + the Add-Customer form. Also reads the AI-advisory toggle.
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data } = await readPricingConfig(supabase, businessId);
      const cfg = (data?.config ?? {}) as Record<string, unknown>;
      setDiscountTypes(normalizeDiscountTypes(cfg));
      setAiEnabled(cfg.aiBiEnabled === true);
    })();
  }, [businessId]);

  // Inline tier edit — one immediate RLS-scoped write (owner-only). price_tier drives the checkout
  // discount (submit.ts) — tagging a customer 'contractor' is how they get contractor pricing.
  function onTier(c: CustomerRow, v: string) {
    if (!businessId || v === (c.price_tier ?? 'retail')) return;
    if (!canEditCustomer) { setListError(requirementText('customers:update')); return; }
    const bid = businessId;
    console.log('[TRACE:customers] tier edit', { id: c.id, from: c.price_tier, to: v });
    void (async () => {
      // A8 — a grid cell is a write too: without the affected-row check a refused tier change
      // silently repaints as if it landed, then reverts on the next load.
      const { data, error } = await supabase.from('customers').update({ price_tier: v }).eq('id', c.id).eq('business_id', bid).select('id');
      const verdict = writeLanded({ data, error }, 'That tier change was not saved — you may not have permission to edit this customer.');
      if (!verdict.landed) { setListError(verdict.message); return; }
      // The row is patched from the write's own proven response — no refetch, no flash (G11 pass,
      // 2026-09-07). `price_tier` is the only field this write moves and the roster shows no
      // server-derived column beside it, so there is nothing left to read back.
      setCustomers(prev => applyRowPatch(prev, c.id, { price_tier: v }));
    })();
  }

  // Options for a row's tier select — the retail floor + every tier across every configured type
  // (label "Type · Tier", value = the tier NAME stored in customers.price_tier) ∪ the row's current
  // value (so a legacy/removed tier still displays and can be changed). Dynamic — no hardcoded set.
  const tierOptions = (current: string | null) => {
    const opts: { value: string; label: string }[] = [{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }];
    for (const ty of discountTypes) for (const ti of ty.tiers) opts.push({ value: ti.name, label: `${ty.name} · ${ti.name}` });
    const cur = current ?? RETAIL_TIER_NAME;
    if (!opts.some(o => o.value === cur)) opts.push({ value: cur, label: cur });
    return opts;
  };

  // ── Status inline (quick soft-deactivate; full editor also carries it). Immediate RLS write. ──
  function onStatus(c: CustomerRow, v: string) {
    if (!businessId || v === (c.status ?? 'active')) return;
    if (!canEditCustomer) { setListError(requirementText('customers:update')); return; }
    const bid = businessId;
    console.log('[TRACE:customers] status edit', { id: c.id, from: c.status, to: v });
    void (async () => {
      // A8 — see onTier.
      const { data, error } = await supabase.from('customers').update({ status: v }).eq('id', c.id).eq('business_id', bid).select('id');
      const verdict = writeLanded({ data, error }, 'That status change was not saved — you may not have permission to edit this customer.');
      if (!verdict.landed) { setListError(verdict.message); return; }
      setCustomers(prev => applyRowPatch(prev, c.id, { status: v }));
    })();
  }

  // Open the ONE editor in EDIT mode for a roster row (tax badge + Edit button use this — a roster
  // quick-edit). The NAME click instead navigates to /customers/:id (the detail page + order history).
  const openEdit = (r: CustomerRow) => setEditor({ mode: 'edit', row: r as unknown as PartyCustomer });

  // 🔴 ONE helper, every surface. This line rendered `Terry null` for the 39 mononym people the
  // 2026-09-07 import created — `${r.last_name}` stringifies NULL to four characters, and NULL is
  // now the TRUE value for a person with one name. `customerDisplayName` drops absent parts.
  const displayName = (r: CustomerRow) => customerDisplayName(r, '—');

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 DUPLICATE CUSTOMERS — MARKED, SORTED TO THE TOP, FILTERABLE. DERIVED, NEVER STORED.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // This is the DEPENDENCY that ships with David's names-on-paper ruling (2026-09-08). The printed
  // books report deliberately carries no customer names — it says *"we identified X potential
  // duplicates — review your customers in Cultivar"* — and until this existed, that sentence sent
  // Lauren to a screen that could not answer the question. A pointer to a surface that cannot help
  // is worse than no pointer at all.
  //
  // 🔴 THE SAME RULE THE BOOKS REVIEW USES, IMPORTED AND NOT RE-KEYED (§6 r8). That is R-101's
  // whole lesson, paid for once already: the catalogue import found eleven collisions and the
  // inventory grid showed none of them, for a fortnight, because two files implemented one
  // operation. A duplicate here and a duplicate there must be the same word.
  //
  // 🔴 DERIVED AT READ TIME (R-101 clause ③). Merge two records or correct an email and the mark
  // clears itself on the next load; a stored flag stays red until somebody re-runs something. It
  // also means a duplicate typed by hand is flagged identically to one an import created.
  //
  // ⚠️ IT MARKS AND IT NEVER MERGES. *"It never merges two firms on its own, because a duplicate is
  // fixable and a wrong merge is not"* (`user_stories.md`). Every control here is read-only.
  const dupGroups = useMemo(
    () => findDuplicateParties(customers.map(c => ({
      id: c.id,
      label: displayName(c),
      email: c.email,
      phone: c.phone,
      // The NAME axis reads the same string the roster prints, so what she sees flagged and what
      // was compared are the same thing — an organisation compared on `organization_name` and
      // displayed as one cannot disagree with itself.
      name: displayName(c),
    }))),
    [customers],
  );
  const dupByRow = useMemo(() => {
    const m = new Map<string, { size: number; axes: string }>();
    for (const g of dupGroups) {
      const axes = g.axes.map(a => DUP_AXES[a]).join(' and ');
      for (const mem of g.members) m.set(mem.id, { size: g.members.length, axes });
    }
    if (dupGroups.length > 0) {
      // Both nouns, named. The banner counts ROWS and a trace that counted GROUPS made the two
      // contradict each other on /inventory — a number that disagrees with its own trace is how
      // the next session misdiagnoses this.
      console.log('[TRACE:customers] possible duplicates', {
        groups: dupGroups.length, rows: m.size,
        byAxis: dupGroups.reduce<Record<string, number>>((acc, g) => {
          for (const a of g.axes) acc[a] = (acc[a] ?? 0) + 1;
          return acc;
        }, {}),
      });
    }
    return m;
  }, [dupGroups]);
  const isDuplicate = (r: CustomerRow) => dupByRow.has(r.id);

  // 🔴 THE SEARCH READS THE SAME LIST THE RECORD DECLARES (`searchText` on <DataSheet> below).
  // It WAS a hand-written eight-field array inline in that prop, and it omitted `organization_name`
  // — the field `displayName` above RENDERS for an organization — so an org customer printed its own
  // name on this roster and could not be found by typing it (recon f666dbb A1; two `Diane Foster`
  // rows, "foster" returned one). The list is now DERIVED from `CUSTOMER_SEARCH_FIELDS` in the field
  // registry, which is the one place it lives and the place a new field joins the search for free.
  //
  // ── Column config — the LEAN at-a-glance roster (name/type/tier/tax/status/added + Edit).
  //    The full field set lives in CustomerPartyEditor (opened via the name or the Edit button). ──
  const columns: DataSheetColumn<CustomerRow>[] = [
    { key: 'first_name', header: 'Name', sortable: true, sortVal: r => displayName(r).toLowerCase(), frozen: true, frozenWidth: 200, identifier: true,
      render: r => (
        <button onClick={() => navigate(`/customers/${r.id}`)} title="Open customer record + order history"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>
          {displayName(r) || '—'}
        </button>
      ) },
    /* 🔴 "Needs a look" — the same mark, in the same place, as `/inventory` (R-101 · G11: it sits
       AFTER the identifier, because it is data and not a gutter, and because putting it BEFORE the
       name would break the contiguous leading frozen run and silently unpin the identifier).
       `sortVal` is the GROUP SIZE so the biggest merge decision leads. The cell says WHICH axis
       matched, because "email" and "same name" call for different levels of caution — §5 clause 4:
       the header carries the shared fact, the cell carries what distinguishes THIS row.
       ⚠️ READ-ONLY MARK, not a control (E7 · G8): a plain span, no handler, no pointer cursor. */
    { key: 'dup', header: 'Needs a look', sortable: true,
      sortVal: (r: CustomerRow) => dupByRow.get(r.id)?.size ?? 0,
      render: (r: CustomerRow) => {
        const d = dupByRow.get(r.id);
        if (!d) return null;
        return (
          <span title={`This record shares ${d.axes} with ${d.size - 1} other ${d.size === 2 ? 'record' : 'records'}. Check whether they are the same customer before you merge anything in QuickBooks.`}
                style={{ fontSize: 12, color: '#8a6d1f' }}>
            possible duplicate
          </span>
        );
      } },
    { key: 'customer_type', header: 'Type', sortable: true, sortVal: r => (r.customer_type ?? 'person'),
      render: r => <span style={sourceStyle}>{r.customer_type === 'organization' ? 'Organization' : 'Person'}</span> },
    { key: 'price_tier', header: 'Tier', sortable: true, sortVal: r => (r.price_tier ?? '').toLowerCase(),
      render: r => <SelectCell value={r.price_tier ?? 'retail'} options={tierOptions(r.price_tier)} onChange={v => onTier(r, v)} styleFor={tierSelectStyle} title="Customer price tier — drives the checkout discount" /> },
    { key: 'tax_exempt', header: 'Tax', sortable: true, sortVal: r => (r.tax_exempt ? 1 : 0),
      render: r => (
        <button onClick={() => openEdit(r)} title="Tax exemption — click to edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          {r.tax_exempt
            ? <span style={{ ...sourceStyle, color: '#166534', background: '#dcfce7' }}>Exempt · {taxExemptionLabel(r.tax_exempt_reason)}</span>
            : <span style={{ ...SS.muted, textDecoration: 'underline dotted' }}>Taxable</span>}
        </button>
      ) },
    { key: 'status', header: 'Status', sortable: true, sortVal: r => (r.status ?? 'active'),
      render: r => <SelectCell value={r.status ?? 'active'} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onChange={v => onStatus(r, v)} title="Account status — inactive soft-deactivates" /> },
    { key: 'source', header: 'Source', sortable: true, sortVal: r => (r.source ?? '').toLowerCase(), defaultVisible: false,
      render: r => <span style={sourceStyle}>{SOURCE_LABEL[r.source ?? ''] ?? r.source ?? '—'}</span> },
    { key: 'created_at', header: 'Added', sortable: true, sortVal: r => r.created_at,
      render: r => <span style={SS.muted}>{fmtDate(r.created_at)}</span> },
  ];

  // Row action — LEFT-PINNED by the shared engine, immediately BEFORE the identifier column, so
  // Edit is always reachable without scrolling right AND sits where it sits on /inventory (G11:
  // ACTIONS · NAME · DATA). ⚠️ THIS ROSTER IS THE CLAUSE'S REASON: it used to render NAME · ACTIONS
  // while inventory rendered ACTIONS · NAME, and neither was a decision — each fell out of where
  // its config happened to put the frozen run.
  const rowActions = (r: CustomerRow) => (
    <button onClick={() => openEdit(r)} style={{ ...sourceStyle, cursor: 'pointer', border: '1px solid #d1d5db', background: '#fff' }}>Edit</button>
  );

  return (
    <>
      {/* AI_BI advisory slot (toggle-gated, owner setting on the Discounts screen; default OFF).
          WIRED PLACEHOLDER — reads nothing yet (no spend aggregation) and changes nothing (never
          auto-assigns a tier); it's a suggestion the owner acts on or ignores (D-38 advisory-only).
          The real inference (orders summed per person → threshold suggestion) is the AIEngine port,
          post-demo — this pass wires the surface + toggle + placeholder ONLY. */}
      {aiEnabled && <AiAdvisorySlot />}

      <DataSheet<CustomerRow>
        title="Customers"
        rows={customers}
        loading={listLoading}
        error={listError}
        getRowId={r => r.id}
        columns={columns}
        rowActions={rowActions}
        rowActionsWidth={78}
        searchText={customerSearchHaystack}
        searchPlaceholder="Search name, phone, email, city…"
        statusFilter={{ label: 'sources', options: ['qr-scan', 'ocr-invoice', 'manual'], get: r => r.source ?? '' }}
        /* The filter the report's sentence promises: "marked and sorted to the top". Without a way
           to see ONLY them, a duplicate on row 900 of 1,953 is marked and unreachable. */
        extraFilter={{ label: 'duplicates', options: ['possible duplicate'], get: r => (isDuplicate(r) ? 'possible duplicate' : 'no duplicate') }}
        rowFlag={r => isDuplicate(r)}
        /* 🔴 THE BANNER DESCRIBES THE ROWS ON SCREEN, and says separately how many are outside the
           current filter. Counting flagged rows over the WHOLE table and printing that above a
           narrowed view is the defect fixed on /inventory: the number was true and the place was a
           lie. It counts ROWS throughout — the noun the flag marks and the noun the trace reports. */
        flagBanner={(inView, elsewhere) => (
          <>
            <AlertTriangle size={15} />
            {inView > 0 ? (
              <>
                {inView} {inView === 1 ? 'record' : 'records'} here may be the same customer entered
                more than once — matched on a shared email, a shared phone number, or the same name.
                {' '}<b>Check before you merge.</b> Fix them in QuickBooks and read your books again;
                nothing on this screen merges anything.
                {elsewhere > 0 && <> {elsewhere} more {elsewhere === 1 ? 'is' : 'are'} outside this filter.</>}
              </>
            ) : (
              <>
                {elsewhere} flagged {elsewhere === 1 ? 'record' : 'records'} <b>elsewhere</b> in your
                customer list may be duplicates — nothing on this screen is affected. Clear the
                search or the filters to see {elsewhere === 1 ? 'it' : 'them'}.
              </>
            )}
          </>
        )}
        /* Biggest cluster first (R-66's shape): the merge with the most records behind it is the
           one worth opening. Clean rows sort below every flagged one, then the grid is hers. */
        defaultSortKey="dup"
        defaultSortDir="desc"
        itemNoun="customers"
        totalRows={customerTotal}
        emptyIcon={<Users size={32} color="#d1d5db" style={{ marginBottom: 8 }} />}
        emptyText="No customers yet. They appear here from checkout + invoice scans, or add one."
        actions={
          <button style={SS.addBtn} onClick={() => setEditor({ mode: 'create', row: BLANK_PARTY_CUSTOMER })}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      {/* The ONE customer form (STD-011) — Add (create) AND Edit both render this grouped editor.
          All fields beyond the lean roster cols live here, incl. the D-40 tax set. */}
      {editor && (
        <CustomerPartyEditor
          mode={editor.mode}
          customer={editor.row}
          tierOptions={tierOptions(editor.row.price_tier ?? null)}
          onClose={() => setEditor(null)}
          onSaved={() => { void loadCustomers(); }}
        />
      )}
    </>
  );
}

// AI_BI advisory PLACEHOLDER — the wired, toggle-gated slot on the customer surface. Renders a
// suggestion card only; the real spend→tier inference is the post-demo AIEngine port (see above).
function AiAdvisorySlot() {
  useEffect(() => { console.log('[TRACE:AI_BI] advisory slot rendered (placeholder — no inference yet)'); }, []);
  return (
    <div style={{ border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>💡</span>
      <div>
        <div style={{ fontWeight: 700, color: '#4c1d95', fontSize: '0.875rem' }}>Spend-based suggestion (advisory)</div>
        <div style={{ fontSize: '0.8125rem', color: '#6d28d9', marginTop: 2, lineHeight: 1.5 }}>
          When a customer's order history suggests a discount tier might fit, it'll surface here for you to act on or
          ignore. Advisory only — it never assigns a tier or changes a price. (Suggestions arrive in a later update.)
        </div>
      </div>
    </div>
  );
}
