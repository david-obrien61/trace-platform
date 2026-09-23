/**
 * ── THE PARKED SALE — a started order survives the interruption ────────────────────────────────
 *
 * WHAT THIS GUARDS. David started an order live on 2026-09-23, backed out, and found no way back.
 * #387 stopped the back arrow DESTROYING it; it did not make it SURVIVE anything — the cart lived
 * in module memory, so a refresh, a new tab, or a phone locking long enough for Safari to evict
 * the tab lost a customer's order mid-sale, silently.
 *
 * 🔴 THIS FILE READS THE STORE'S SOURCE, AND THAT IS DELIBERATE. The behaviour under test is a
 * middleware CONFIGURATION — which key, which fields, which version, what happens on a bad read —
 * and the thing that can silently regress is the config, not a function. A test that exercised the
 * store through a stubbed localStorage would prove zustand works, which nobody doubts.
 *
 * Run: node scripts/run-tests.mjs parkedOrder
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg); console.error('   ✗ ' + msg);
}

const raw  = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/hooks/useCart.ts'), 'utf8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');

// ── §A — IT IS PERSISTED, TO localStorage, UNDER A VERSIONED KEY ─────────────────────────────
{
  ok(/create<CartStore>\(\)\(persist\(/.test(code), '§A the store is wrapped in persist');
  ok(/createJSONStorage\(\(\) => localStorage\)/.test(code),
    '§A 🔴 to localStorage — it must survive a tab closing, which sessionStorage would not');
  ok(/const PARKED_KEY = 'trace\.parked-order\.v1'/.test(code),
    '§A the key carries a version, so a shape change cannot half-read an old cart');
  ok(/version: 1/.test(code), '§A …and persist is told that version');
}

// ── §B — 🔴 CLEARED BY EXACTLY TWO THINGS, AND NEITHER IS A TIMER ────────────────────────────
// David: "never expire, surface by age… nothing deletes a customer's order on a timer."
{
  const scan = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/ScanOrder.tsx'), 'utf8');
  const conf = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/Confirmation.tsx'), 'utf8');
  ok(/clear\(\)/.test(scan) && /clear\(\)/.test(conf),
    '§B the two callers are the discard confirm and a successful submit');
  ok(!/setTimeout|setInterval|expire|maxAge|ttl|Date\.now\(\) -/.test(code),
    '🔴 §B NOTHING IN THE STORE EXPIRES A CART — no timer, no TTL, no max age. David: "nothing deletes a customer\'s order on a timer"');
  ok(/parkedAt:\s*null,/.test(code.slice(code.indexOf('clear: () => set({'))),
    '§B clear() drops the park stamp with the cart, so a fresh order is not reported as days old');
}

// ── §C — AGE IS SURFACED, NEVER ENFORCED ─────────────────────────────────────────────────────
{
  ok(/parkedAt:\s+string \| null/.test(code), '§C the cart records WHEN it was started');
  ok(/parkedAt: new Date\(\)\.toISOString\(\)/.test(code), '§C stamped when a line lands');
  ok(/const parkedAt = s\.parkedAt \?\? new Date\(\)\.toISOString\(\)/.test(code),
    '🔴 §C STAMPED ONCE, ON THE FIRST LINE — re-stamping on every scan would make a two-hour-old order look new, which is the one thing the age is for');
}

// ── §D — 🔴 WHAT IS PERSISTED IS DECLARED, NOT INFERRED ──────────────────────────────────────
{
  ok(/partialize: \(s\) => \(\{/.test(code),
    '§D the persisted fields are listed, so a NEW field is not silently stored before anyone decided it should be');
  for (const f of ['items', 'customer', 'shipTo', 'orderTier', 'parkedAt', 'startedBy']) {
    ok(new RegExp(`${f}: s\\.${f}`).test(code), `§D "${f}" is persisted`);
  }
  ok(!/setItem: s\.setItem|clear: s\.clear/.test(code), '§D …and no action is — they are functions and would not survive anyway');
}

// ── §E — 🔴 A BAD OR FOREIGN CART IS DROPPED, NOT TRUSTED ────────────────────────────────────
{
  ok(/migrate: \(\) => undefined as never/.test(code),
    '🔴 §E an OLDER SHAPE is DISCARDED, not migrated — a half-understood cart prices against fields this build no longer writes, and losing a sale once at a deploy beats mis-billing silently');
  ok(/!Array\.isArray\(state\.items\)/.test(code),
    '§E a rehydrated cart that is not a list of lines is emptied — localStorage is editable by anyone at the keyboard');
  ok(/onRehydrateStorage/.test(code) && /could not be read — starting empty/.test(raw),
    '§E a failed READ starts empty and says so, rather than looking like an empty cart');
  ok(/dropIfOtherBusiness/.test(code),
    '🔴 §E A CART PARKED FOR ANOTHER BUSINESS IS DROPPED — AC-3 reached through localStorage, which no RLS policy can see. Signing into a second tenant in the same browser must not resume the first tenant\'s order');
  ok(/owner === businessId\) return false/.test(code),
    '§E …and it drops only on a MISMATCH — a cart for the active business is kept');
}

// ── §F — 🔴 NO `draft` STATUS WAS ADDED, ON DAVID'S EXPLICIT INSTRUCTION ─────────────────────
{
  const statuses = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/lib/orderStatus.ts'), 'utf8');
  const arr = statuses.match(/ORDER_STATUSES = \[([^\]]*)\]/)?.[1] ?? '';
  ok(!/draft/.test(arr),
    `🔴 §F ORDER_STATUSES has NO "draft" — a parked sale has no row, no number and no commitment, and minting a status would put a half-typed cart into every roster, filter and count that reads orders. Got: ${arr.trim()}`);
  ok(/'pending'/.test(arr) && /'invoiced'/.test(arr) && /'fulfilled'/.test(arr) && /'cancelled'/.test(arr),
    '§F …and the ratified four are untouched');
  ok(!/from\('orders'\)/.test(code),
    '§F 🔴 the cart store writes NOTHING to the database — the park is local, and that is the whole scope of this build');
}

console.log(`\n  parkedOrder: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
