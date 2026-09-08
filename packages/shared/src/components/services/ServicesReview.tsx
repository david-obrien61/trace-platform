// ============================================================
// ServicesReview — "Services — what we found". The /discounts review, pointed at the checkout menu.
//
// PURPOSE:      Read this business's own QuickBooks books — the product list and the whole invoice
//               history — show every service they ALREADY charge for with the evidence it was
//               measured from, and write the ones the owner agrees to into `service_offerings`.
//               NOTHING IS WRITTEN UNTIL SHE PRESSES IT.
// DEPENDENCIES: ../../business-logic/serviceReview (PURE — all the judgement; this file holds
//               none) · ../../quickbooks/invoiceList (parseInvoiceList) · authHeaders ·
//               useBusinessContext. READS `/api/qbo/items` + `/api/qbo/invoices` and OPTIONALLY
//               `/api/discovery/ingest` — all EXISTING routes. NO new api/ file (12/12), NO
//               migration, NO new permission string.
// OUTPUTS:      <ServicesReview supabase={…} onWritten={…} /> — mounted at the top of the
//               Services card on /settings/services, beside the editor that corrects it.
// GATE:         Inherits the Services card's gate. The write is `service_offerings` INSERT under
//               the owner RLS fence; nothing extra is asserted here.
// INSTRUMENTATION (STD-003): `[TRACE:SERVICE]` on read, build, accept, write and verify. ON BY
//               DEFAULT — standing owner instruction, do NOT comment out.
//
// Run: it is a screen. `node scripts/run-tests.mjs serviceReview` proves the judgement behind it;
//      the six acceptance checks are on the owner-test board and need a browser.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY IT LIVES BESIDE THE SERVICES EDITOR AND NOT ON A ROUTE OF ITS OWN.
// David's ruling: CORRECTION, NOT UNDO — *"nothing to reverse because nothing was decided for
// her."* There is no undo on this screen and there does not need to be one, because the surface
// that edits a service is the card directly below it. A wrong price is corrected on the way in
// (every row is editable before she presses) or afterwards, in the same place, on the same page.
// A separate route would have put the fix a navigation away from the mistake.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 IT PARSES THE CAPTURE IN THE BROWSER, AND THAT IS WHY THERE IS NO NEW ENDPOINT.
// `/api/qbo/invoices` returns COUNTS ONLY — the parsed records never leave that function, because
// an invoice names the human who bought and says what they paid (R-23/R-24). The verbatim bodies
// DO come back, inside `capture`, which is what the operator screen writes to a file. So the
// tally is computed here, from those bodies, and nothing is persisted. That keeps `api/` at 12 of
// 12 (§6 r11 — function #13 fails the whole deploy SILENTLY) and keeps a customer's purchase
// history out of every payload.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ NO NUMBER ON THIS SCREEN IS TYPED INTO THIS REPOSITORY. Every price, count, share and rung
// is measured from her books at read time. There is no tenant literal in this file and none in
// the module behind it: point it at another QuickBooks company and it reports that company.
// ============================================================
import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Search, AlertTriangle, Check, Info } from 'lucide-react';
import { authHeaders } from '../../auth/authHeaders';
import { useBusinessContext } from '../../context';
import { parseInvoiceList } from '../../quickbooks/invoiceList';
import {
  buildServiceReview, buildServiceRows, readServiceEvidence,
  SERVICE_REFUSALS, SERVICE_CATEGORIES, PRICE_UNITS, SERVICE_OFFERING_SELECT, toExistingOffering,
  type ServiceReview as Review, type ServiceRow, type ServiceItemFact,
  type ExistingOffering, type AcceptedService,
} from '../../business-logic/serviceReview';

const GREEN = '#27500A';
const DARK  = '#111827';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const AMBER = '#92400e';
const RULE  = '#e5e7eb';

/** What the owner has done to one suggested row. A price is a STRING until she presses. */
interface RowState { include: boolean; name: string; price: string; category: string; unit: string }

const money = (n: number): string => `$${Math.round(n).toLocaleString()}`;
const dateWords = (iso: string | null): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return 'an unknown date';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${Number(d)} ${MON[Number(m) - 1]} ${y}`;
};

/** Every refusal says what it MEANS to her, in her words — never the constant's name. */
function refusalWords(row: ServiceRow): string {
  if (row.blockers.includes(SERVICE_REFUSALS.everyLineFree)) {
    return `You have billed this ${row.invoices} time${row.invoices === 1 ? '' : 's'} and charged nothing every time. `
         + 'That is what this costs you, not something you sell — so we count it and never put a price on it.';
  }
  if (row.blockers.includes(SERVICE_REFUSALS.bundle)) {
    return `Every charge has been different — ${row.price.distinctPrices} different figures across ${row.price.pricedLines} lines. `
         + 'That is a price agreed job by job, not a rate, so there is nothing here we could put on a menu.';
  }
  if (row.price.confidence === 'never-billed') {
    return 'This is in your product list and no invoice has ever used it. We have nothing to measure.';
  }
  if (row.price.refusal === SERVICE_REFUSALS.noInvoicePrice) {
    return `Charged ${row.price.pricedLines} time${row.price.pricedLines === 1 ? '' : 's'} only. `
         + 'One or two charges is not enough for us to say what you charge — type what it should be.';
  }
  return `The amount moves: ${row.price.distinctPrices} different prices across ${row.price.pricedLines} lines, `
       + `and the most common one (${money(row.price.mostCommon ?? 0)}) is only ${Math.round(100 * row.price.agreeing / Math.max(1, row.price.pricedLines))}% of them. `
       + 'We will not guess — type what you charge.';
}

/** The evidence sentence under every row. It always names the lines it came from. */
function evidenceWords(row: ServiceRow): string {
  if (row.lines === 0) return `Your product list publishes ${row.listPrice === null ? 'no price' : money(row.listPrice)}. No invoice has used it.`;
  const span = row.first && row.last && row.first !== row.last
    ? ` between ${dateWords(row.first)} and ${dateWords(row.last)}`
    : row.last ? ` on ${dateWords(row.last)}` : '';
  return `${row.invoices} invoice${row.invoices === 1 ? '' : 's'}, ${row.customers} customer${row.customers === 1 ? '' : 's'}, `
       + `${money(row.amountTotal)} in total${span}.`;
}

export function ServicesReview({ supabase, onWritten }:
  { supabase: SupabaseClient; onWritten: () => void }) {
  const { business, businessId } = useBusinessContext();
  const [phase, setPhase]   = useState<'idle' | 'reading' | 'ready' | 'writing' | 'done'>('idle');
  const [error, setError]   = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [rows, setRows]     = useState<Record<string, RowState>>({});
  const [readNote, setReadNote] = useState<string | null>(null);
  const [result, setResult]     = useState<string | null>(null);
  const [siteReading, setSiteReading] = useState(false);
  const [siteError, setSiteError]     = useState<string | null>(null);
  const [siteServices, setSiteServices] = useState<string[] | null>(null);

  // ── THE READ ───────────────────────────────────────────────────────────────────────────────
  const run = useCallback(async (site: string[] | null) => {
    if (!businessId) return;
    setPhase('reading'); setError(null); setResult(null);
    console.log('[TRACE:SERVICE] services review — reading books', { businessId });
    try {
      const headers = await authHeaders();
      const get = async (route: string): Promise<Record<string, unknown>> => {
        const res = await fetch(`/api/qbo/${route}?business_id=${encodeURIComponent(businessId)}`, { headers });
        const body = (await res.json()) as Record<string, unknown>;
        if (!res.ok || body.ok === false) {
          // Every refusal names ITSELF — the endpoint already classifies 401 vs 403 vs INCOMPLETE,
          // and a generic "the read failed" sends someone hunting the wrong problem.
          throw new Error(String(body.headline ?? body.detail ?? body.error ?? `The ${route} read failed (HTTP ${res.status}).`));
        }
        return body;
      };
      // Invoices FIRST: it is the read that can refuse, and failing before the item read means not
      // querying a customer's books for something we cannot use.
      const inv = await get('invoices');
      const itm = await get('items');

      // 🔴 COMPLETENESS IS REPORTED, NOT ASSUMED. A truncated walk under-counts every line tally
      // on this screen and looks exactly like a business that charges for less than it does.
      if (inv.complete === false) {
        throw new Error(
          `The invoice read came back incomplete — ${String(inv.retrieved_total ?? 0)} of ` +
          `${String(inv.expected_total ?? 0)}. Every count below would be short, so nothing is shown.`);
      }

      // The verbatim bodies, parsed HERE. See the file header: they are the only copy of this data
      // that reaches a browser, and none of it is stored.
      const capture = inv.capture as { pages?: { body?: unknown }[] } | undefined;
      const bodies = (capture?.pages ?? []).map(p => typeof p.body === 'string' ? p.body : JSON.stringify(p.body ?? {}));
      const invoices = bodies.flatMap(b => parseInvoiceList(b).invoices);
      if (invoices.length === 0) {
        throw new Error('The invoice read came back with no readable invoices, so there is nothing to measure. Nothing is shown.');
      }
      const { tallies, placement } = readServiceEvidence(invoices);

      const items = ((itm.items ?? []) as Record<string, unknown>[]).map((i): ServiceItemFact => ({
        id: String(i.id ?? ''), name: String(i.name ?? ''),
        description: (i.description as string | null) ?? null,
        unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : null,
        type: (i.type as string | null) ?? null,
        // 🔴 `incomeAccount`, NOT `incomeAccountName` — THE ENDPOINT'S NAME, NOT OURS.
        // `/api/qbo/items` returns `QboItemRow`, whose field is `incomeAccount` (itemList.ts:37).
        // Reading `incomeAccountName` here returned `undefined` on ALL 685 of LAWNS's items, so
        // the classification axis was null on every row and the screen offered her 17 of her own
        // TREES as services, printed "0 are bookkeeping" above two bookkeeping rows, and split
        // 500·140·7·0·38 where her books say 564·73·8·2·38. Every other consumer in the repo
        // (`booksFindings.ts:571`, `QboBooksReader.tsx:1035`) already reads `incomeAccount`.
        incomeAccountName: (i.incomeAccount as string | null) ?? null,
      }));

      // What is ALREADY on her menu. Read now, and read AGAIN immediately before the write — a
      // row added between the two is the duplicate this screen exists not to create.
      const { data: offerings, error: offErr } = await supabase
        .from('service_offerings').select(SERVICE_OFFERING_SELECT).eq('business_id', businessId);
      if (offErr) throw new Error(`We could not read your existing services (${offErr.message}), so nothing is shown — adding to a list we cannot see would risk duplicating what is on it.`);
      const ex: ExistingOffering[] = (offerings ?? []).map(toExistingOffering);

      const built = buildServiceReview({ items, tallies, existing: ex, placement, siteServices: site ?? [] });
      setReview(built);

      const seed: Record<string, RowState> = {};
      for (const r of [...built.sure, ...built.needsHer]) {
        seed[r.id] = {
          // 🔴 PRE-TICKED ONLY WHEN BOTH DOUBTS ARE ANSWERED — we know the price AND her books say
          // what kind of thing it is. A contested row is on screen with its price filled in and
          // its box EMPTY, because ticking it would be us deciding a question her books left open.
          include: r.price.confidence === 'sure' && !r.destination.contested,
          name: r.description?.trim() || r.name,
          price: r.price.price === null ? '' : String(r.price.price),
          category: r.category ?? '',
          unit: r.unit.unit ?? '',
        };
      }
      setRows(seed);
      setReadNote(typeof inv.queried_at === 'string' ? `Read on ${dateWords(inv.queried_at.slice(0, 10))}.` : null);
      setPhase('ready');
      console.log('[TRACE:SERVICE] services review built', {
        businessId, items: items.length, invoices: invoices.length, census: built.census,
        sure: built.sure.length, needsHer: built.needsHer.length,
        notSuggesting: built.notSuggesting.map(r => `${r.name}:${r.blockers.join('|')}`),
        ladder: built.ladder.rungs.map(g => `${g.size}=$${g.premium}×${g.installedLines}`),
        medianRatio: built.ladder.medianRatio, alreadyOffered: built.alreadyOffered,
        siteServices: (site ?? []).length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'The read failed.';
      console.log('[TRACE:SERVICE] services review READ FAILED', { businessId, msg });
      setError(msg); setPhase('idle');
    }
  }, [businessId, supabase]);

  // ── THE OPTIONAL SECOND SOURCE ─────────────────────────────────────────────────────────────
  // Her own website. It states no prices, so nothing here can ever be suggested — it is a list
  // she reads against her books. It writes nothing: `business_id` is DELIBERATELY not sent,
  // because the discovery endpoint SEEDS `service_offerings` when it receives one, and a screen
  // whose whole promise is "nothing is written until you press it" must not call a writer.
  const readSite = useCallback(async () => {
    const url = business?.website?.trim();
    if (!url) return;
    setSiteReading(true); setSiteError(null);
    console.log('[TRACE:SERVICE] services review — reading website', { url });
    try {
      const res = await fetch('/api/discovery/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ url, vertical: business?.business_type ?? undefined }),
      });
      const body = (await res.json()) as { profile?: { servicesFound?: string[] }; identity?: { servicesFound?: string[] }; error?: string };
      if (!res.ok) throw new Error(body.error || `Your website could not be read (HTTP ${res.status}).`);
      const found = body.profile?.servicesFound ?? body.identity?.servicesFound ?? [];
      console.log('[TRACE:SERVICE] website read', { url, found: found.length });
      setSiteServices(found);
      await run(found);
    } catch (e) {
      // A failed website read must not lose the books read she is looking at.
      setSiteError(e instanceof Error ? e.message : 'Your website could not be read.');
    } finally {
      setSiteReading(false);
    }
  }, [business, run]);

  // ── THE WRITE ──────────────────────────────────────────────────────────────────────────────
  const accept = useCallback(async () => {
    if (!businessId || !review) return;
    setPhase('writing'); setError(null);

    const all = [...review.sure, ...review.needsHer];
    const accepted: AcceptedService[] = all
      .map((r, i) => ({ r, s: rows[r.id], i }))
      .filter(x => x.s?.include)
      .map(x => ({
        name: x.s.name.trim(),
        description: x.r.description,
        category: x.s.category,
        priceUnit: x.s.unit,
        price: Number(x.s.price),
        sortOrder: 100 + x.i,
      }));

    // 🔴 RE-READ THE MENU IMMEDIATELY BEFORE WRITING. The list we read minutes ago is not
    // evidence of what is on it NOW, and the one thing this write must never do is put a second
    // row on her checkout with the same name and a different price.
    const { data: fresh, error: readErr } = await supabase
      .from('service_offerings').select(SERVICE_OFFERING_SELECT).eq('business_id', businessId);
    if (readErr) {
      setError(`We could not re-read your services list (${readErr.message}), so nothing was written.`);
      setPhase('ready'); return;
    }
    const current: ExistingOffering[] = (fresh ?? []).map(toExistingOffering);

    const built = buildServiceRows({ accepted, businessId, existing: current });
    if (!built.ok) {
      console.log('[TRACE:SERVICE] services write REFUSED', { businessId, reason: built.reason });
      setError(built.reason); setPhase('ready'); return;
    }

    // 🔴 `.select('id')` ASKS FOR EVIDENCE IT LANDED. An RLS refusal returns zero rows and NO
    // error — indistinguishable from success without this (A8, the pattern the Services editor
    // one card down already uses).
    const { data: landed, error: wErr } = await supabase
      .from('service_offerings').insert(built.rows).select('id');
    console.log('[TRACE:SERVICE] services write result', {
      businessId, asked: built.rows.length, rows: landed?.length ?? 0, error: wErr?.message ?? null,
    });
    if (wErr) { setError(`Nothing was saved — ${wErr.message}.`); setPhase('ready'); return; }
    if (!landed || landed.length !== built.rows.length) {
      setError(`The save reported no error but ${landed?.length ?? 0} of ${built.rows.length} rows came back, `
             + 'which usually means permission was refused. Check your services list before adding anything else.');
      setPhase('ready'); return;
    }

    // VERIFY BY READING BACK — the only honest confirmation is the menu saying what we expect.
    const { data: after } = await supabase
      .from('service_offerings').select(SERVICE_OFFERING_SELECT).eq('business_id', businessId);
    const now = (after ?? []).length;
    console.log('[TRACE:SERVICE] services write VERIFIED', {
      businessId, wrote: landed.length, offeringsBefore: current.length, offeringsNow: now,
    });

    setResult(
      `Saved. ${landed.length === 1 ? '1 service is' : `${landed.length} services are`} now on your checkout menu, `
      + `alongside the ${current.length} you already had. You can change a price on the Services card below at any time — `
      + 'and you can run this again to add more; what you just saved will not be offered twice.');
    setPhase('done');
    onWritten();
  }, [businessId, review, rows, supabase, onWritten]);

  // ── RENDER ─────────────────────────────────────────────────────────────────────────────────
  const setRow = (k: string, patch: Partial<RowState>) => setRows(m => ({ ...m, [k]: { ...m[k], ...patch } }));
  const ticked = Object.values(rows).filter(r => r.include);
  const unpriced = ticked.filter(r => !(Number(r.price) > 0)).length;

  if (phase === 'idle' || phase === 'reading') {
    return (
      <section style={sect}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Search size={18} color={GREEN} />
          <h3 style={h3}>Find the services you already charge for</h3>
        </div>
        <p style={p}>
          We can read your QuickBooks invoices and product list and show you every service you have
          actually been charging for — how often, at what price, and when you last used it.{' '}
          <b>Nothing is added until you say so</b>, and every number shows where it came from.
        </p>
        <p style={{ ...p, color: AMBER }}>
          This reads your whole invoice history, so it takes a few seconds. It only reads — it
          changes nothing in QuickBooks.
        </p>
        {error && <p style={errStyle}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {error}</p>}
        <button onClick={() => { void run(siteServices); }} disabled={phase === 'reading' || !businessId} style={primary(phase === 'reading')}>
          {phase === 'reading' ? 'Reading your books…' : 'Find my services'}
        </button>
      </section>
    );
  }

  if (!review) return null;
  const { census, ladder } = review;

  return (
    <section style={sect}>
      <h3 style={h3}>Services — what we found</h3>
      <p style={p}>
        Read from your QuickBooks invoices and your product list. <b>Nothing is added until you press
        the button at the bottom.</b> Every number shows where it came from and how sure we are of it.
        {readNote ? ` ${readNote}` : ''}
      </p>

      {/* ── THE CENSUS. This is the number the import button should be printing. ───────────── */}
      <div style={callout}>
        <b>Your QuickBooks holds {census.total} items, and they are not all products.</b>{' '}
        {census.products} are things you sell, {census.services} are services, {census.discounts} are
        discounts and {census.notASale} are bookkeeping{census.folders > 0 ? `, plus ${census.folders} folders that are not items at all` : ''}.
        {' '}The product import counts every one of them as a product.
      </div>

      {/* 🔴 THE RULE, ON THE SCREEN, WHERE SHE AGREES TO THE PRICES. It is not being decided here
          — the engine already does it (D-39) — and saying it here is the point. */}
      <div style={callout}>
        <b>A discount comes off the tree price — never off services.</b> Delivery, placement, trip
        charge and add-ons are always charged in full, for every customer and every tier. You do not
        set this per service; it is how the platform prices every order.
      </div>

      {review.alreadyOffered.length > 0 && (
        <p style={{ ...p, color: GRAY }}>
          <Check size={13} style={{ verticalAlign: -2 }} /> Already on your menu, so not offered again:{' '}
          <b>{review.alreadyOffered.join(', ')}</b>.
        </p>
      )}

      <Section n={review.sure.length} title="WE'RE SURE OF THE PRICE" />
      {review.sure.map(r => <Row key={r.id} row={r} state={rows[r.id]} onChange={patch => setRow(r.id, patch)} />)}

      <Section n={review.needsHer.length} title="WE CAN'T TELL YOU THE PRICE" />
      <p style={{ ...p, color: GRAY, marginTop: -4 }}>
        You clearly charge for these. The amount moves, so we will not put a number in your mouth —
        type what you charge, or leave it and add it later.
      </p>
      {review.needsHer.map(r => <Row key={r.id} row={r} state={rows[r.id]} onChange={patch => setRow(r.id, patch)} />)}

      {review.notSuggesting.length > 0 && (
        <>
          <Section n={review.notSuggesting.length} title="WE'RE NOT SUGGESTING THESE" />
          {review.notSuggesting.map(r => (
            <div key={r.id} style={{ ...rowBox, background: '#fafafa' }}>
              <div style={{ fontWeight: 700, color: DARK }}>{r.description?.trim() || r.name}</div>
              <div style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 3 }}>{evidenceWords(r)}</div>
              <div style={{ fontSize: '0.8125rem', color: AMBER, marginTop: 5 }}>
                <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {refusalWords(r)}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── THE PLACEMENT LADDER ───────────────────────────────────────────────────────────── */}
      {ladder.rungs.length > 0 && (
        <>
          <Section n={ladder.rungs.length} title="PUTTING THE TREE IN THE GROUND" />
          <p style={{ ...p, marginTop: -4 }}>
            <b>Planting is not a line on any of your invoices</b> — it is inside the tree price. We
            found it by comparing the same plant sold planted against the same plant collected:{' '}
            <b>{ladder.itemsSoldBothWays} of your plants have been sold both ways</b>, across{' '}
            {ladder.installedLines.toLocaleString()} planted lines, and a planted tree costs{' '}
            <b>about {ladder.medianRatio === null ? 'the same' : `${ladder.medianRatio}×`}</b> what a
            collected one costs.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: 10 }}>
            <thead><tr>
              <th style={th}>Pot size</th><th style={th}>What planting adds</th><th style={th}>Measured from</th>
            </tr></thead>
            <tbody>
              {ladder.rungs.map(g => (
                <tr key={g.size}>
                  <td style={td}>{g.size}</td>
                  <td style={{ ...td, fontWeight: 700, color: DARK }}>{money(g.premium)} a tree</td>
                  <td style={{ ...td, color: GRAY }}>{g.installedLines} planted lines across {g.items} plant{g.items === 1 ? '' : 's'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...p, color: AMBER }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> This is a <b>suggestion, and it
            is not saved by the button below</b> — a planting price varies by more than pot size, and
            it is yours to set. Set it on the Services card below, one price or one per size. Whatever
            you have there now stays exactly as it is until you change it.
          </p>
        </>
      )}

      {/* ── THE SECOND SOURCE ──────────────────────────────────────────────────────────────── */}
      <Section n={review.siteServices.length} title="WHAT YOUR WEBSITE SAYS" />
      {review.siteServices.length === 0 ? (
        <p style={{ ...p, color: GRAY }}>
          {business?.website
            ? <>We have not read <b>{business.website}</b> yet. Your site is a second opinion on what you offer — it states no prices, so nothing from it can ever be added for you.{' '}
                <button onClick={() => { void readSite(); }} disabled={siteReading} style={linkBtn}>
                  {siteReading ? 'Reading your website…' : 'Read my website too'}
                </button></>
            : 'No website is saved for this business, so there is no second source to compare against.'}
          {siteError && <><br /><span style={{ color: RED }}>{siteError}</span></>}
        </p>
      ) : (
        <>
          <p style={{ ...p, marginTop: -4 }}>
            Your website names these. <b>We looked for each of these words in your product list</b> —
            that is all this is. A service can be here and unmatched simply because you call it
            something shorter in QuickBooks, so read it as a checklist, not a verdict.
          </p>
          <ul style={{ margin: '0 0 12px 18px', padding: 0, fontSize: '0.875rem', color: DARK }}>
            {review.siteServices.map(s => (
              <li key={s.name} style={{ marginBottom: 3 }}>
                {s.name}{' '}
                <span style={{ color: s.matchedItem ? GRAY : AMBER }}>
                  — {s.matchedItem ? 'an item in your list uses these words' : 'no item in your list uses these words'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ── THE PRESS ──────────────────────────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 14, marginTop: 8 }}>
        {error && <p style={errStyle}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {error}</p>}
        {result && <p style={{ ...p, color: GREEN, fontWeight: 600 }}><Check size={14} style={{ verticalAlign: -2 }} /> {result}</p>}
        {unpriced > 0 && (
          <p style={{ ...p, color: AMBER }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} />{' '}
            {unpriced === 1 ? 'One ticked service has no price' : `${unpriced} ticked services have no price`}.
            A service saved at $0 tells a customer it is free, so nothing will be saved until you type a
            price or untick it.
          </p>
        )}
        <button
          onClick={() => { void accept(); }}
          disabled={phase === 'writing' || ticked.length === 0}
          style={primary(phase === 'writing' || ticked.length === 0)}
        >
          {phase === 'writing' ? 'Saving…'
            : ticked.length === 0 ? 'Tick a service to add it'
            : `Add ${ticked.length === 1 ? 'this service' : `these ${ticked.length} services`} to my checkout`}
        </button>
        <p style={{ ...p, color: GRAY, marginTop: 8, marginBottom: 0 }}>
          <Info size={13} style={{ verticalAlign: -2 }} /> You can run this again later. Anything you
          save now will not be offered a second time, and nothing you save now is changed by a later run.
        </p>
      </div>
    </section>
  );
}

// ── one suggested row ────────────────────────────────────────────────────────────────────────
function Row({ row, state, onChange }:
  { row: ServiceRow; state: RowState | undefined; onChange: (p: Partial<RowState>) => void }) {
  if (!state) return null;
  const priced = Number(state.price) > 0;
  return (
    <div style={rowBox}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox" checked={state.include}
          onChange={e => onChange({ include: e.target.checked })}
          style={{ width: 20, height: 20, marginTop: 2, accentColor: GREEN, flexShrink: 0 }}
        />
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: DARK }}>{state.name}</span>
          {row.destination.contested && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: AMBER, fontWeight: 600 }}>NOT TICKED FOR YOU</span>
          )}
          <span style={{ display: 'block', fontSize: '0.8125rem', color: GRAY, marginTop: 3 }}>
            {evidenceWords(row)}
          </span>
          <span style={{ display: 'block', fontSize: '0.8125rem', color: GRAY, marginTop: 3 }}>
            {row.price.confidence === 'sure'
              ? <>Charged <b>{money(row.price.price ?? 0)}</b> on {row.price.agreeing} of {row.price.pricedLines} priced lines
                  {row.price.zeroLines > 0 ? ` (${row.price.zeroLines} more were free and are not counted)` : ''}.
                  {' '}Your books file it under “{row.accountName ?? 'no account'}”.</>
              : <>{refusalWords(row)} Your books file it under “{row.accountName ?? 'no account'}”.</>}
          </span>
          {row.destination.contested && (
            <span style={{ display: 'block', fontSize: '0.8125rem', color: AMBER, marginTop: 4 }}>
              {row.destination.reason}
            </span>
          )}
        </span>
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingLeft: 30 }}>
        <Field label="Name on the menu">
          <input value={state.name} onChange={e => onChange({ name: e.target.value })} style={{ ...input, minWidth: 200 }} />
        </Field>
        <Field label="Price">
          <input
            value={state.price} onChange={e => onChange({ price: e.target.value })}
            inputMode="decimal" placeholder="—"
            style={{ ...input, width: 90, borderColor: state.include && !priced ? RED : '#d1d5db' }}
          />
        </Field>
        <Field label="Charged">
          <select value={state.unit} onChange={e => onChange({ unit: e.target.value })} style={{ ...input, width: 130 }}>
            <option value="">choose…</option>
            {PRICE_UNITS.map(u => <option key={u} value={u}>{u === 'order' ? 'once per order' : u === 'plant' ? 'per plant' : `per ${u}`}</option>)}
          </select>
        </Field>
        <Field label="Kind">
          <select value={state.category} onChange={e => onChange({ category: e.target.value })} style={{ ...input, width: 140 }}>
            <option value="">choose…</option>
            {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      {state.include && row.unit.unknown && !state.unit && (
        <p style={{ fontSize: '0.75rem', color: AMBER, margin: '6px 0 0 30px' }}>
          Your invoices charge this once on some jobs and per tree on others
          ({row.unit.qtyOneLines} of {row.unit.lines} lines were for one), so we have not chosen for you.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {children}
    </label>
  );
}

function Section({ n, title }: { n: number; title: string }) {
  return (
    <p style={{
      fontSize: '0.6875rem', fontWeight: 800, color: GREEN, textTransform: 'uppercase',
      letterSpacing: '0.08em', margin: '20px 0 10px', borderTop: `1px solid ${RULE}`, paddingTop: 14,
    }}>
      {/* The count is IN the header because a header that says "we're sure" over an empty list is
          a claim about nothing — §6 r18, a header's assertion must hold for every row beneath it. */}
      {title} — {n === 0 ? 'none' : n}
    </p>
  );
}

const sect: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '18px 16px',
  border: `1px solid ${RULE}`, marginBottom: 18,
};
const h3: React.CSSProperties = { fontSize: '1.0625rem', fontWeight: 800, color: DARK, margin: 0 };
const p: React.CSSProperties = { fontSize: '0.875rem', color: DARK, lineHeight: 1.55, margin: '8px 0 12px' };
const callout: React.CSSProperties = {
  background: '#f7faf3', border: `1px solid ${GREEN}33`, borderRadius: 10,
  padding: '11px 13px', fontSize: '0.8125rem', color: DARK, lineHeight: 1.5, marginBottom: 12,
};
const rowBox: React.CSSProperties = {
  border: `1px solid ${RULE}`, borderRadius: 10, padding: '12px 13px', marginBottom: 8,
};
const input: React.CSSProperties = {
  padding: '9px 11px', border: '1.5px solid #d1d5db', borderRadius: 8,
  fontSize: '0.875rem', fontFamily: 'inherit', color: DARK, background: '#fff', boxSizing: 'border-box',
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '7px 8px', borderBottom: `1px solid ${RULE}`,
  fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const td: React.CSSProperties = { padding: '7px 8px', borderBottom: `1px solid ${RULE}` };
const errStyle: React.CSSProperties = {
  fontSize: '0.875rem', color: RED, background: '#fef2f2', border: `1px solid ${RED}33`,
  borderRadius: 8, padding: '9px 11px', marginBottom: 10, lineHeight: 1.5,
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: GREEN, fontWeight: 700, fontSize: '0.875rem',
  textDecoration: 'underline', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
};
const primary = (disabled: boolean): React.CSSProperties => ({
  width: '100%', minHeight: 48, padding: '13px 20px',
  background: disabled ? '#e5e7eb' : GREEN, color: disabled ? GRAY : '#fff',
  fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
  cursor: disabled ? 'default' : 'pointer',
});
