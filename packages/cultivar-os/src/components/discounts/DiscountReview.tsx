// ============================================================
// DiscountReview — "Discounts — what we found". The services-review pattern, pointed at the
//   pricing config.
// PURPOSE:      Read this business's own QuickBooks books, show every discount they ALREADY give
//               with the evidence it was measured from, and write the ones the owner agrees to
//               into `business_pricing_config.config.discountTypes` — plus the plumbing keys that
//               have no decision in them. NOTHING IS WRITTEN UNTIL SHE PRESSES IT.
// DEPENDENCIES: @trace/shared/business-logic — buildDiscountReview / buildAcceptancePatch (PURE,
//               all the judgement; this file holds none) · readPricingConfig · mergePricingConfig
//               · @trace/shared/quickbooks/invoiceList (the tally) · authHeaders.
//               READS `/api/qbo/invoices` + `/api/qbo/items` — both EXISTING routes on the one
//               qbo function. NO new api/ file (12/12), NO migration, NO new permission.
// GATE:         Mounted on /discounts, which is gated `pricing_recipe:update` — the pricing
//               authority. The same gate the write needs; nothing extra is asserted here.
// INSTRUMENTATION (STD-003): `[TRACE:config]` on read, build, accept, write and verify. ON BY
//               DEFAULT — standing owner instruction, do NOT comment out.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY IT IS A SCREEN AND NOT A SCRIPT. A script David runs behind Lauren's back would fill the
// config correctly and teach her nothing. She is agreeing to what her business charges
// contractors — she has to see what she is agreeing to, and see what we read it from. Every
// number on this screen carries the invoice lines it came from, and anything we cannot evidence
// is REFUSED and left for her to enter. Surface, don't decide.
//
// 🔴 THE TWO READS ARE EXPLICIT AND THE SCREEN SAYS SO BEFORE IT MAKES THEM. This is a live query
// against a customer's accounting system — 1,480 invoices at LAWNS. It never fires on mount.
//
// ⚠️ WHY IT LIVES HERE RATHER THAN ON ITS OWN ROUTE. `/discounts` is already the SOLE writer of
// `config.discountTypes`. A standalone review screen writing the same jsonb key would be a second
// writer of one field (STD-011), and the copy that drifts is never the one you are looking at.
// Folding it in also needs no tile-registry row, no nav node and no new permission. The cost is
// that this file reads `/api/qbo/*`, which `QboBooksReader` also reads — a second CALLER of a
// read, which is not the thing §6 r8 forbids.
// ============================================================
import { useState, useCallback } from 'react';
import { Search, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '@trace/shared/auth/authHeaders';
import {
  readPricingConfig, mergePricingConfig,
  buildDiscountReview, buildAcceptancePatch, REVIEW_REFUSALS,
  type DiscountReview as Review, type EvidencedDiscount, type DiscountItemFact, type AcceptedTier,
} from '@trace/shared/business-logic';
import type { InvoiceBreakdown } from '@trace/shared/quickbooks/invoiceList';

const GREEN = '#27500A';
const DARK  = '#111827';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const AMBER = '#92400e';
const RULE  = '#e5e7eb';

/**
 * 🔴 HARDCODED, DELIBERATELY, AND ON THE REGISTER. These two tier names are LAUREN'S — from her
 * own spreadsheet — and no data source in this platform holds them: they are in no invoice, no
 * item and no table. They are here so the screen can MEASURE their absence and show her why her
 * spreadsheet's tiers are missing, which is the question she will actually ask.
 *
 * It is a tenant literal in vertical code (never in `shared` — AC-1), logged in
 * `docs/decisions/HARDCODED-REGISTER.md`, and it caps this capability at AMBER until a stated-
 * but-unevidenced tier has somewhere real to live. Removing it would remove the section David
 * asked for; pretending it is derived would be worse.
 */
const OWNER_STATED_TIERS = ['Contractor 35%', 'Contractor 25%'];

interface QboRead {
  ok?: boolean;
  breakdown?: InvoiceBreakdown;
  items?: { id: string; name: string; description: string | null; unitPrice: number | null }[];
  complete?: boolean;
  expected_total?: number | null;
  retrieved_total?: number;
  queried_at?: string;
  headline?: string;
  detail?: string;
  error?: string;
}

/** What the owner has done to one suggested row. `accept` is the default for a measured rate. */
type RowState = { include: boolean; typeName: string; tierName: string; pct: string };

const money0 = (n: number) => n.toLocaleString();
const dateWords = (iso: string | null): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return 'an unknown date';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${Number(d)} ${MON[Number(m) - 1]} ${y}`;
};

export function DiscountReview({ businessId, onWritten }: { businessId: string | null; onWritten: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'reading' | 'ready' | 'writing' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [readNote, setReadNote] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // ── THE READ ───────────────────────────────────────────────────────────────────────────────
  const run = useCallback(async () => {
    if (!businessId) return;
    setPhase('reading'); setError(null); setResult(null); setReadNote(null);
    console.log('[TRACE:config] discount review — reading books', { businessId });
    try {
      const headers = await authHeaders();
      const get = async (route: string): Promise<QboRead> => {
        const res = await fetch(`/api/qbo/${route}?business_id=${encodeURIComponent(businessId)}`, { headers });
        const body = (await res.json()) as QboRead;
        if (!res.ok || body.ok === false) {
          // Every refusal names ITSELF — a generic "the read failed" sends someone hunting the
          // wrong problem, and the endpoint already classifies 401 vs 403 vs INCOMPLETE.
          throw new Error(body.headline || body.detail || body.error || `The ${route} read failed (HTTP ${res.status}).`);
        }
        return body;
      };
      // Invoices FIRST: it is the read that can refuse (ceiling-capped), and failing before the
      // item read means not querying a customer's books for something we cannot use.
      const inv = await get('invoices');
      const itm = await get('items');

      // 🔴 COMPLETENESS IS REPORTED, NOT ASSUMED. A truncated invoice walk would under-count
      // every line tally on this screen and look exactly like a business that discounts less.
      if (inv.complete === false) {
        throw new Error(
          `The invoice read came back incomplete — ${money0(inv.retrieved_total ?? 0)} of ` +
          `${money0(inv.expected_total ?? 0)}. Every count below would be short, so nothing is shown.`);
      }

      const discountNames = new Set((inv.breakdown?.discounts.byName ?? []).map(r => r.itemName.trim().toLowerCase()));
      const items: DiscountItemFact[] = (itm.items ?? [])
        .filter(i => discountNames.has((i.name ?? '').trim().toLowerCase()))
        .map(i => ({ id: i.id, name: i.name, description: i.description, unitPrice: i.unitPrice }));

      const { data } = await readPricingConfig(supabase, businessId);
      const cfg = (data?.config && typeof data.config === 'object') ? (data.config as Record<string, unknown>) : null;

      const built = buildDiscountReview({
        discounts: inv.breakdown?.discounts ?? null,
        items,
        config: cfg,
        statedTiers: OWNER_STATED_TIERS,
      });
      setReview(built);
      const seed: Record<string, RowState> = {};
      for (const r of built.sure) seed[r.tierName] = { include: true, typeName: r.typeName, tierName: r.tierName, pct: String(r.percent) };
      for (const r of built.needsHer) seed[r.tierName] = { include: false, typeName: r.typeName, tierName: r.tierName, pct: '' };
      setRows(seed);
      setReadNote(inv.queried_at ? `Read on ${dateWords(inv.queried_at.slice(0, 10))}.` : null);
      setPhase('ready');
      console.log('[TRACE:config] discount review built', {
        businessId, sure: built.sure.length, needsHer: built.needsHer.length,
        alreadyConfigured: built.alreadyConfigured.length, plumbingMissing: built.plumbingMissing.length,
        configRowPresent: built.configRowPresent, taxRatePresent: built.taxRatePresent,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'The read failed.';
      console.log('[TRACE:config] discount review READ FAILED', { businessId, msg });
      setError(msg); setPhase('idle');
    }
  }, [businessId]);

  // ── THE WRITE ──────────────────────────────────────────────────────────────────────────────
  const accept = useCallback(async () => {
    if (!businessId || !review) return;
    setPhase('writing'); setError(null);

    const accepted: AcceptedTier[] = Object.values(rows)
      .filter(r => r.include)
      .map(r => ({ typeName: r.typeName.trim(), tierName: r.tierName.trim(), percent: Number(r.pct) }));

    // 🔴 RE-READ IMMEDIATELY BEFORE WRITING, AND BUILD THE PATCH AGAINST WHAT CAME BACK.
    // `mergePricingConfig` FAILS OPEN on an empty read — `data: null` with no error makes its
    // `current` `{}` and the write REPLACES the whole config, deleting the sales-tax rate. The
    // config we read minutes ago is not evidence that the row is readable NOW.
    const { data, error: readErr } = await readPricingConfig(supabase, businessId);
    const cfg = (data?.config && typeof data.config === 'object') ? (data.config as Record<string, unknown>) : null;
    if (readErr || cfg === null) {
      console.log('[TRACE:config] discount write REFUSED — config unreadable', { businessId, readErr: readErr?.message });
      setError(readErr
        ? `We could not read this business's pricing settings (${readErr.message}), so nothing was written.`
        : 'We could not read this business\'s pricing settings, so nothing was written. Writing now would ' +
          'replace the whole record — including your sales-tax rate — instead of adding to it.');
      setPhase('ready'); return;
    }
    const taxBefore = cfg.taxRate;

    const built = buildAcceptancePatch({ accepted, config: cfg });
    if (!built.ok) {
      console.log('[TRACE:config] discount write REFUSED by patch builder', { businessId, reason: built.reason });
      setError(built.reason); setPhase('ready'); return;
    }

    const { error: wErr } = await mergePricingConfig(supabase, businessId, built.patch);
    if (wErr) {
      console.log('[TRACE:config] discount write FAILED', { businessId, msg: wErr.message });
      setError(`Nothing was saved — ${wErr.message}.`); setPhase('ready'); return;
    }

    // 🔴 VERIFY BY READING BACK. `writePricingConfig` upserts WITHOUT `.select()`, so a write
    // refused by policy returns no error and no row — indistinguishable from success. The only
    // honest confirmation is the config saying what we expect it to say.
    const { data: after } = await readPricingConfig(supabase, businessId);
    const post = (after?.config && typeof after.config === 'object') ? (after.config as Record<string, unknown>) : null;
    const landed = Array.isArray(post?.discountTypes)
      ? (post!.discountTypes as { tiers: unknown[] }[]).reduce((n, t) => n + (t.tiers?.length ?? 0), 0) : 0;
    const taxAfter = post?.taxRate;
    const taxHeld = taxBefore === undefined ? taxAfter === undefined : taxAfter === taxBefore;

    console.log('[TRACE:config] discount write VERIFIED', {
      businessId, accepted: accepted.length, tiersInConfigNow: landed,
      plumbingWritten: built.plumbingWritten, taxBefore, taxAfter, taxHeld,
    });

    if (post === null || landed === 0) {
      setError('The save reported no error but nothing came back changed, which usually means permission ' +
               'was refused. Nothing was written.');
      setPhase('ready'); return;
    }
    if (!taxHeld) {
      // Should be unreachable — the patch cannot carry taxRate. Said out loud anyway, because a
      // money field changing unnoticed is the one outcome that must never be silent.
      setError(`Saved, but your sales-tax rate changed from ${String(taxBefore)} to ${String(taxAfter)}. ` +
               'Check Settings before taking another order.');
      setPhase('done'); onWritten(); return;
    }
    setResult(
      `Saved. ${accepted.length === 1 ? '1 discount tier is' : `${accepted.length} discount tiers are`} now live at ` +
      `checkout, and your sales-tax rate is untouched at ${taxBefore === undefined ? 'not set' : `${Number(taxBefore) * 100}%`}. ` +
      'Tag a customer with a tier on the Customers page and the discount comes off their tree prices automatically.');
    setPhase('done');
    onWritten();
  }, [businessId, review, rows, onWritten]);

  // ── RENDER ─────────────────────────────────────────────────────────────────────────────────
  const setRow = (k: string, patch: Partial<RowState>) => setRows(m => ({ ...m, [k]: { ...m[k], ...patch } }));
  const acceptedCount = Object.values(rows).filter(r => r.include).length;

  if (phase === 'idle' || phase === 'reading') {
    return (
      <section style={sect}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Search size={18} color={GREEN} />
          <h2 style={h2}>Find the discounts you already give</h2>
        </div>
        <p style={p}>
          We can read your QuickBooks invoices and products, and show you every discount you have
          actually been giving — how often, at what percent, and when you last used it. <b>Nothing is
          added until you say so</b>, and every number will show where it came from.
        </p>
        <p style={{ ...p, color: AMBER }}>
          This reads your whole invoice history from QuickBooks, so it takes a few seconds. It only
          reads — it changes nothing in QuickBooks.
        </p>
        {error && <p style={errStyle}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {error}</p>}
        <button onClick={() => { void run(); }} disabled={phase === 'reading' || !businessId} style={primary(phase === 'reading')}>
          {phase === 'reading' ? 'Reading your books…' : 'Find my discounts'}
        </button>
      </section>
    );
  }

  if (!review) return null;

  return (
    <section style={sect}>
      <h2 style={h2}>Discounts — what we found</h2>
      <p style={p}>
        Read from your QuickBooks invoices and your product list. <b>Nothing is added until you press
        the button at the bottom.</b> Every number shows where it came from and how sure we are of it.
        {readNote ? ` ${readNote}` : ''}
      </p>

      {/* 🔴 THE RULE, ON THE SCREEN. It is not a per-tier setting and it is not being decided here —
          the engine already does it (D-39). Saying it where she accepts the tiers is the point. */}
      <div style={callout}>
        <b>A discount comes off the tree price — never off services.</b> Military, contractor,
        landscaper, family: all of them work the same way. Delivery, placement, trip charge and
        add-ons are always charged in full. You do not set this per tier; it is how the platform
        prices every order, and the receipt shows it line by line.
      </div>

      {/* ── SURE ─────────────────────────────────────────────────────────────────────────── */}
      {review.sure.length > 0 && (
        <>
          <SectionHead n={review.sure.length} title="WE FOUND THESE AND WE'RE SURE" />
          <p style={lead}>
            You gave each of these at the same percent every single time. Add them as they are.
          </p>
          {review.sure.map(r => (
            <Row key={r.tierName} r={r} state={rows[r.tierName]} editing={!!editing[r.tierName]}
              onEdit={() => setEditing(m => ({ ...m, [r.tierName]: !m[r.tierName] }))}
              onChange={patch => setRow(r.tierName, patch)} tone="sure" />
          ))}
        </>
      )}

      {/* ── NEEDS HER ────────────────────────────────────────────────────────────────────── */}
      {review.needsHer.length > 0 && (
        <>
          <SectionHead n={review.needsHer.length} title="WE FOUND THESE AND WE CAN'T TELL YOU THE PERCENT" />
          <p style={lead}>
            You have used these, but not at one steady rate — so we would be guessing. Set your own
            percent to add one, or leave it out.
          </p>
          {review.needsHer.map(r => (
            <Row key={r.tierName} r={r} state={rows[r.tierName]} editing
              onEdit={() => undefined} onChange={patch => setRow(r.tierName, patch)} tone="unsure" />
          ))}
        </>
      )}

      {/* ── NOT SUGGESTING ───────────────────────────────────────────────────────────────── */}
      {review.notSuggesting.length > 0 && (
        <>
          <SectionHead n={review.notSuggesting.length} title="YOU NAMED THESE AND WE'RE NOT SUGGESTING THEM" />
          <p style={lead}>
            These are on your own pricing sheet. We looked for them and could not find them, so we
            are not creating them — two real tiers beat four half-real ones. Add either yourself
            below if you do use it.
          </p>
          {review.notSuggesting.map(s => (
            <div key={s.name} style={{ ...row, borderLeft: `3px solid ${RED}`, background: '#fef2f2' }}>
              <div>
                <div style={nm}>{s.name}</div>
                <div style={ev}>
                  <Chip label="YOUR SHEET" tone="stated" />
                  {s.existsAsItem
                    ? <>An item by this name exists in your books, but <b>{s.invoiceLines === 0 ? 'no invoice has ever used it' : `only ${s.invoiceLines} invoice line uses it`}</b>.</>
                    : <>There is <b>no such item in your books</b> and <b>no invoice has ever charged it</b>.</>}
                </div>
              </div>
              <div style={priceCell}><span style={{ color: AMBER, fontWeight: 700, fontSize: '0.8125rem' }}>not created</span></div>
              <div />
            </div>
          ))}
        </>
      )}

      {/* ── ALREADY THERE ────────────────────────────────────────────────────────────────── */}
      {review.alreadyConfigured.length > 0 && (
        <p style={{ ...lead, marginTop: 14 }}>
          <Check size={13} style={{ verticalAlign: -2, color: GREEN }} />{' '}
          Already set up, so not offered again: <b>{review.alreadyConfigured.join(', ')}</b>.
        </p>
      )}

      {review.sure.length === 0 && review.needsHer.length === 0 && (
        <p style={{ ...lead, color: AMBER }}>
          We read your invoices and found no discount items in them at all. That is a real answer,
          not an error — you can add your tiers by hand below.
        </p>
      )}

      {/* ── THE EXACT-STRING WARNING. The single most consequential fact on this screen. ── */}
      <div style={warnbox}>
        <b>The tier name has to match exactly.</b> Once you add a tier, you tag customers with it on
        the Customers page — and the name is matched letter for letter, including capitals. A
        customer tagged <code style={code}>cd10%</code> when the tier is <code style={code}>CD10%</code>
        {' '}quietly pays full price and nothing warns you. Rename them now if you want them tidier.
      </div>

      {!review.taxRatePresent && (
        <div style={warnbox}>
          <b>No sales-tax rate is set for this business.</b> That is separate from discounts and is
          not changed here — set it in Settings, or invoices will keep showing tax as not identified.
        </div>
      )}

      {error && <p style={errStyle}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {error}</p>}
      {result && <p style={{ ...p, color: GREEN, fontWeight: 600 }}><Check size={15} style={{ verticalAlign: -2 }} /> {result}</p>}

      <div style={foot}>
        <div style={{ fontSize: '0.8125rem', color: GRAY }}>
          <b style={{ color: DARK }}>
            {review.sure.length} we're sure about · {review.needsHer.length} need a percent from you ·{' '}
            {review.notSuggesting.length} not created
          </b>
          <div style={{ marginTop: 2 }}>
            {review.plumbingMissing.length > 0
              ? `This will also fill in ${review.plumbingMissing.length} platform settings that have no choice in them. Your sales-tax rate is not touched.`
              : 'Your sales-tax rate is not touched.'}
          </div>
        </div>
        <button onClick={() => { void accept(); }} disabled={phase === 'writing' || acceptedCount === 0} style={primary(phase === 'writing' || acceptedCount === 0)}>
          {phase === 'writing' ? 'Saving…' : acceptedCount === 0 ? 'Nothing selected' : `Add the ${acceptedCount} I've ticked`}
        </button>
      </div>
    </section>
  );
}

// ── row ──────────────────────────────────────────────────────────────────────────────────────
function Row({ r, state, editing, onEdit, onChange, tone }: {
  r: EvidencedDiscount; state: RowState | undefined; editing: boolean;
  onEdit: () => void; onChange: (p: Partial<RowState>) => void; tone: 'sure' | 'unsure';
}) {
  if (!state) return null;
  const border = tone === 'sure' ? GREEN : AMBER;
  return (
    <div style={{ ...row, borderLeft: `3px solid ${border}`, background: tone === 'sure' ? '#fff' : '#fffbeb' }}>
      <div>
        <div style={nm}>{state.tierName}{state.typeName ? <span style={{ color: GRAY, fontWeight: 400 }}> · under {state.typeName}</span> : null}</div>
        <div style={ev}>
          <Chip label="INVOICES" tone="books" />
          {r.item && <Chip label="YOUR PRODUCT LIST" tone="books" />}
          {r.refusal === REVIEW_REFUSALS.ratesDisagree ? (
            <>Used on <b>{r.lines} invoice {r.lines === 1 ? 'line' : 'lines'}</b>, but at{' '}
              <b>{r.rates.length} different rates</b> — {r.rates.map(x => `${x.pct}% on ${x.lines}`).join(', ')}.
              We will not pick one for you.</>
          ) : r.refusal === REVIEW_REFUSALS.noMeasurableRate ? (
            <>Used on <b>{r.lines} invoice {r.lines === 1 ? 'line' : 'lines'}</b>, but not one of them
              records what the percentage was taken from, so the rate cannot be worked out.</>
          ) : (
            <>Used on <b>{r.lines} invoice {r.lines === 1 ? 'line' : 'lines'}</b> at a clean{' '}
              <b>{r.percent}%</b> every time. Last used <b>{dateWords(r.mostRecent)}</b>.</>
          )}
          {r.item && (
            <> Your books hold it as item <b>{r.item.id}</b>
              {r.item.description ? <>, “{r.item.description}”</> : null}
              {r.itemPercent !== null ? <>, published at <b>{r.itemPercent}%</b>{r.sourcesAgree ? ' — which agrees with what the invoices did' : ''}</> : null}.</>
          )}
        </div>
        {(editing || tone === 'unsure') && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <Field label="Discount type" value={state.typeName} onChange={v => onChange({ typeName: v })} w={160} />
            <Field label="Tier name (must match the customer tag)" value={state.tierName} onChange={v => onChange({ tierName: v })} w={220} />
            <Field label="Percent off" value={state.pct} onChange={v => onChange({ pct: v })} w={90} />
          </div>
        )}
      </div>
      <div style={priceCell}>
        {state.pct.trim() === '' || !Number.isFinite(Number(state.pct))
          ? <span style={{ color: AMBER, fontWeight: 700, fontSize: '0.8125rem' }}>you set it</span>
          : <><span style={{ fontSize: '1.0625rem', fontWeight: 700, color: DARK }}>{Number(state.pct)}%</span>
              <small style={{ display: 'block', fontSize: '0.72rem', color: GRAY }}>off the tree price</small></>}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', color: DARK, cursor: 'pointer' }}>
          <input type="checkbox" checked={state.include} onChange={e => onChange({ include: e.target.checked })}
            style={{ width: 17, height: 17 }} />
          Add
        </label>
        {tone === 'sure' && (
          <button onClick={onEdit} style={btn}>{editing ? 'Done' : 'Edit'}</button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, w }: { label: string; value: string; onChange: (v: string) => void; w: number }) {
  return (
    <div style={{ flex: `0 0 ${w}px` }}>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ ...input, width: '100%' }} />
    </div>
  );
}

function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <h3 style={{ fontSize: '0.75rem', color: GRAY, fontWeight: 700, margin: '22px 0 4px', letterSpacing: '0.04em' }}>
      {title} — <span style={{ color: DARK }}>{n}</span>
    </h3>
  );
}

function Chip({ label, tone }: { label: string; tone: 'books' | 'stated' }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: '0.625rem', padding: '1px 6px', marginRight: 5, verticalAlign: 1,
      border: `1px solid ${tone === 'books' ? GREEN : AMBER}`, color: tone === 'books' ? GREEN : AMBER,
      background: tone === 'books' ? '#EAF3DE' : '#fdf6e3', borderRadius: 3, fontWeight: 700, letterSpacing: '0.03em',
    }}>{label}</span>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────────────────────
const sect: React.CSSProperties = { border: `1px solid ${RULE}`, borderRadius: 12, padding: 18, marginBottom: 22, background: '#fff' };
const h2: React.CSSProperties   = { margin: 0, fontSize: '1.0625rem', color: DARK, fontWeight: 700 };
const p: React.CSSProperties    = { margin: '8px 0 12px', fontSize: '0.875rem', color: GRAY, lineHeight: 1.55 };
const lead: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5 };
const row: React.CSSProperties  = {
  border: `1px solid ${RULE}`, padding: '12px 14px', marginBottom: 8, borderRadius: 6,
  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 130px 120px', gap: 14, alignItems: 'start',
};
const nm: React.CSSProperties   = { fontWeight: 700, fontSize: '0.9375rem', color: DARK };
const ev: React.CSSProperties   = { fontSize: '0.8125rem', color: GRAY, marginTop: 4, lineHeight: 1.5 };
const priceCell: React.CSSProperties = { textAlign: 'right' };
const callout: React.CSSProperties = {
  borderLeft: `3px solid ${GREEN}`, background: '#EAF3DE', padding: '12px 14px',
  fontSize: '0.8125rem', color: DARK, lineHeight: 1.55, margin: '14px 0', borderRadius: '0 6px 6px 0',
};
const warnbox: React.CSSProperties = {
  borderLeft: `3px solid ${AMBER}`, background: '#fffbeb', padding: '12px 14px',
  fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.55, margin: '14px 0', borderRadius: '0 6px 6px 0',
};
const foot: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
  borderTop: `1px solid ${RULE}`, paddingTop: 14, marginTop: 18,
};
const btn: React.CSSProperties = {
  font: 'inherit', fontSize: '0.75rem', padding: '5px 9px', border: `1px solid ${RULE}`,
  background: '#fff', color: GRAY, cursor: 'pointer', borderRadius: 4, minHeight: 30,
};
const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', border: `1.5px solid #d1d5db`, borderRadius: 8,
  fontSize: '0.8125rem', background: '#fff', color: DARK,
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
};
const code: React.CSSProperties = { background: '#fff', border: `1px solid ${RULE}`, padding: '0 4px', borderRadius: 3 };
const errStyle: React.CSSProperties = { fontSize: '0.8125rem', color: RED, lineHeight: 1.5, margin: '10px 0' };
const primary = (disabled: boolean): React.CSSProperties => ({
  padding: '12px 20px', background: disabled ? '#e5e7eb' : GREEN, color: disabled ? GRAY : '#fff',
  fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
  cursor: disabled ? 'default' : 'pointer', minHeight: 48,
});
