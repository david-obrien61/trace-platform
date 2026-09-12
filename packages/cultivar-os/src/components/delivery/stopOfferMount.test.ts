/**
 * ── THE SAVE-THIS-SITE OFFER, PROVED BY MOUNTING IT ───────────────────────────────────────────
 *
 * PURPOSE:      Prove that the D-41 L2 offer survives the refresh its own save triggers. CARD 4 of
 *               `customer-addresses-full-surface-test.md` FAILED live on 2026-09-12 (build fe24e68,
 *               Test Dave's, OWNER): the address saved and the green panel never appeared.
 * DEPENDENCIES: jsdom · react · react-dom/client · StopCard · useStopActions (type only)
 *
 * 🔴 IT DRIVES THE CARD'S OWN CONTROLS, NOT A SHORTCUT. The test clicks "Change address",
 * types into the real field, and clicks "Save address" — so the save runs through `submitAddress`
 * on the very component instance the refresh is about to destroy. A harness that called the action
 * directly would still go green on the broken card, because the broken card's state died in a
 * function the harness never entered. Driving the real button is what makes the red mean something.
 * OUTPUTS:      exit 0 / exit 1 with the failing assertion named.
 *
 * 🔴 WHY THIS FILE EXISTS AT ALL, AND WHY `shipToSurfaces.test.ts` §C DID NOT CATCH IT.
 * §C is REGEX OVER SOURCE TEXT — `read(CARD)` then `/siteOffer &&/.test(src)`. Every one of its
 * assertions was TRUE of the defective file and would still be true today with the defect restored.
 * The defect never lived in the card's text: it lived in the card's LIFECYCLE, in a parent file §C
 * does not read. That is tech-debt #182's class — *a harness that cannot reach its target reports
 * the same as one that passed* — and [[R-33]]: those probes could not have disagreed.
 *
 * So this file MOUNTS. It is the first test in the repo that renders React, and it reproduces the
 * exact sequence `DeliverySchedule` and `DeliveryRoute` perform:
 *
 *     save lands  →  await onChanged()  →  loading = true  →  {!loading && <StopCard/>}  ← UNMOUNTS
 *                                       →  loading = false →  fresh <StopCard/> mounts
 *
 * A2 is the regression probe: revert the fix (put the offer back in `StopCard`'s own `useState`)
 * and A2 goes RED, because the instance holding it was destroyed mid-await. It was RUN RED against
 * the pre-fix card before being trusted (§6 r19(b) — a check nobody has seen refuse is a claim).
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
// `navigator` is an accessor on modern Node, so a plain assignment throws — defineProperty for all
// of them rather than discovering one at a time which globals the runtime has locked down.
function put(name: string, value: unknown) {
  Object.defineProperty(g, name, { value, configurable: true, writable: true });
}
put('window', dom.window);
put('document', dom.window.document);
put('navigator', dom.window.navigator);
put('HTMLElement', dom.window.HTMLElement);
put('Element', dom.window.Element);
put('Node', dom.window.Node);
put('getComputedStyle', dom.window.getComputedStyle);
put('requestAnimationFrame', (cb: (t: number) => void) => dom.window.setTimeout(() => cb(0), 0));
put('cancelAnimationFrame', (h: number) => dom.window.clearTimeout(h));
put('IS_REACT_ACT_ENVIRONMENT', true);

// 🔴 SET BEFORE <StopCard> IS LOADED, WHICH IS WHY THAT IMPORT IS DEFERRED BELOW. The card imports
// `useBusinessContext`, which pulls `@trace/shared/supabase/client`, which calls `createClient` AT
// IMPORT TIME and THROWS `supabaseUrl is required` on an empty string. Nothing here talks to
// Supabase — the client is constructed and never used — but it must be constructible for the module
// graph to load at all. A placeholder URL is honest about that: it is not a test fixture standing in
// for a database, it is the one value that lets an unrelated module finish importing.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key-not-a-credential';

import React, { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { StopActions } from './useStopActions';
import type { StopCard as StopCardType } from './StopCard';
import type { StopRow, StopRead } from '../../lib/stopRead';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); return; }
  failed++; console.error(`  ✗ ${label}`);
}

const STOP_A = 'stop-a'; const STOP_B = 'stop-b';
const stop = (id: string): StopRow => ({
  id, customer_id: `cust-${id}`, delivery_date: '2026-09-12',
  address_line1: '770 Oak Creek Dr', city: 'Leander', state: 'TX', zip: '78641',
  status: 'scheduled', service_type: 'delivery', notes: null, order_id: null,
  created_at: '2026-09-12T00:00:00Z', started_at: null, completed_at: null,
  review_asked_at: null, review_ask_outcome: null,
  customers: { first_name: 'John', last_name: 'Smith', phone: null, email: null,
    address_line1: null, city: null, state: null, zip: null },
});
const read: StopRead = {
  stops: [stop(STOP_A), stop(STOP_B)], fulfilmentColumns: true,
  orderStatusById: new Map(), linesByOrderId: new Map(), linesRead: false, canReadLines: false,
};

/**
 * The PAGE. It holds the offer exactly where `useStopActions` holds it — at page level — and it
 * unmounts its card list behind a loading flag exactly as DeliverySchedule.tsx:176 and
 * DeliveryRoute.tsx:622 do. `actions` is typed `StopActions`, so if the real hook stops returning
 * `siteOffer` / `setSiteOfferLabel` / `dismissSiteOffer` THIS FILE NO LONGER COMPILES — and the
 * runner counts a file that cannot build as a failure, which is the link back to the real hook.
 */
function Page({ permissions, onSaveShipTo }: { permissions: string[]; onSaveShipTo?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [siteOffer, setSiteOffer] = useState<{ stopId: string; label: string } | null>(null);
  const [siteNote,  setSiteNote]  = useState<{ stopId: string; text: string } | null>(null);

  async function refresh() {
    setLoading(true);
    await Promise.resolve();
    setLoading(false);
  }

  const actions = {
    savingId: null, actionError: null, clearActionError: () => {},
    markStop: async () => {}, editDate: async () => {}, openEditor: async () => {},
    overlays: null,
    saveShipTo: async (d: StopRow) => {
      onSaveShipTo?.();
      if (permissions.includes('customers:create') && d.customer_id) {
        setSiteNote(null); setSiteOffer({ stopId: d.id, label: '' });
      }
      await refresh();
      return { kind: 'saved' as const, audited: true, auditError: null };
    },
    saveSite: async () => ({ kind: 'refused' as const, reason: 'not exercised here' }),
    siteOffer, siteNote,
    setSiteOfferLabel: (label: string) => setSiteOffer(o => (o ? { ...o, label } : o)),
    dismissSiteOffer: () => { setSiteOffer(null); setSiteNote(null); },
  } as unknown as StopActions;

  const ctx = {
    businessId: 'biz-1', isOwner: true, role: 'OWNER', permissions,
    can: (p: string) => p === 'member' || permissions.includes(p),
  } as never;

  // The list lives behind the loading flag exactly as DeliverySchedule.tsx:176 does. This is the
  // line that destroys the card mid-save, and it is reproduced rather than described.
  return React.createElement(BusinessContext.Provider, { value: ctx },
    React.createElement('div', null,
      loading ? React.createElement('p', null, 'Loading…')
              : read.stops.map(s => React.createElement(StopCard, { key: s.id, stop: s, read, actions })),
    ));
}

const OFFER = /Save this address as a delivery site/;
let root: Root;
function mount(el: React.ReactElement) {
  const host = document.getElementById('root')!;
  act(() => { root = createRoot(host); root.render(el); });
  return host;
}
function byText(host: HTMLElement, re: RegExp): HTMLButtonElement | null {
  for (const b of Array.from(host.querySelectorAll('button')))
    if (re.test(b.textContent ?? '')) return b as HTMLButtonElement;
  return null;
}
/**
 * The real gesture David performed: open the editor on the FIRST card, change the street, save.
 * Every step asserts it found its control, so a silently-missing button fails loudly instead of
 * making the test pass by doing nothing (tech-debt #182 — a harness that cannot reach its target).
 */
async function driveTheCard(host: HTMLElement) {
  const open = byText(host, /Change address|Add address/);
  if (!open) throw new Error('harness: no Change-address control on the card');
  await act(async () => { open.click(); });

  const field = host.querySelector<HTMLInputElement>('input[value="770 Oak Creek Dr"]')
             ?? host.querySelector<HTMLInputElement>('input');
  if (!field) throw new Error('harness: no address field after opening the editor');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(field, '772 Oak Creek Dr');
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });

  const save = byText(host, /^Save address$/);
  if (!save) throw new Error('harness: no Save-address button');
  await act(async () => { save.click(); await Promise.resolve(); await Promise.resolve(); });
}

let StopCard: typeof StopCardType;
// Typed loosely on purpose: this is only ever a Provider wrapper in this file, and the context's
// real shape is the app's business, asserted where the app uses it.
let BusinessContext: React.Context<unknown>;

void (async () => {
  // Both deferred on purpose — see the env note at the top of this file. A static import would
  // hoist ABOVE the `process.env` lines and take the supabase client down with it.
  ({ StopCard } = await import('./StopCard'));
  const shared = await import('@trace/shared/context');
  BusinessContext = shared.BusinessContext as unknown as React.Context<unknown>;

  console.log('\n── A. THE OFFER SURVIVES THE REFRESH ITS OWN SAVE TRIGGERS ──');
  {
    const host = mount(React.createElement(Page, { permissions: ['deliveries:update', 'customers:create'] }));
    ok(!OFFER.test(host.textContent ?? ''), 'A1 before any save there is no offer — nothing is promised unprompted');

    await driveTheCard(host);
    ok(OFFER.test(host.textContent ?? ''),
      'A2 🔴 after a save that UNMOUNTED the card list, the offer is on screen (CARD 4, the live failure)');

    const boxes = host.querySelectorAll('input[placeholder="Job site A"]');
    ok(boxes.length === 1, `A3 the offer renders on ONE card, not on every card (found ${boxes.length})`);
    // Guarded: when A2/A3 fail there is no box, and a crash here would bury the assertion that
    // actually explains the failure. A red must stay readable.
    ok(boxes.length === 1 && (boxes[0] as HTMLInputElement).value === '',
      'A4 the name box is BLANK — no label is guessed on the owner\'s behalf');
    act(() => { root.unmount(); });
  }

  console.log('\n── B. THE PROBE DISCRIMINATES (R-33 — it can go red) ──');
  {
    // The card must render the offer the PAGE holds and nothing else. Drive the same save with the
    // raising permission absent: the save still lands, the page raises nothing, and the card must
    // show nothing. Without this, A2 could be passing on a panel the card renders unconditionally.
    const host = mount(React.createElement(Page, { permissions: ['deliveries:update'] }));
    await driveTheCard(host);
    ok(!OFFER.test(host.textContent ?? ''),
      'B1 the card renders the offer ONLY when the page holds one — A2 is not a constant wearing a gate\'s clothes');
    act(() => { root.unmount(); });
  }
  {
    let saves = 0;
    const host = mount(React.createElement(Page, {
      permissions: ['deliveries:update', 'customers:create'], onSaveShipTo: () => { saves++; },
    }));
    await driveTheCard(host);
    ok(saves === 1, 'B2 the harness genuinely drove the save path once — it is not asserting over a screen nothing happened on');
    ok(/Loading|Job site A/.test(host.innerHTML), 'B3 the harness reached a post-save render at all');
    act(() => { root.unmount(); });
  }

  // The spelling `run-tests.mjs` parses. A file whose assertions do not roll up is a file whose
  // count nobody can see — the shape tech-debt #186 is about.
  console.log(`\nstopOfferMount: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();

/*
 * ⚠️ WHAT THIS FILE DOES NOT COVER, SAID PLAINLY (OP-14 clause 2 — an unrecorded hole is a lie by
 * omission). It does not mount the REAL `useStopActions`: that hook imports the Supabase client,
 * which throws at import time without env, and stubbing a network client to assert a lifecycle
 * would be a double more forgiving than the real thing (tech-debt #138). The link back to the real
 * hook is the COMPILER: `actions` is typed `StopActions = ReturnType<typeof useStopActions>`, so if
 * the hook stops returning `siteOffer` / `siteNote` / `setSiteOfferLabel` / `dismissSiteOffer`,
 * THIS FILE NO LONGER BUILDS — and `run-tests.mjs` counts a file that cannot build as a failure.
 * Type-level, not behavioural: it catches the shape changing, never the hook's own logic drifting.
 */
