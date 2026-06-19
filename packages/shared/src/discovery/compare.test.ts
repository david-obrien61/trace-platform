/**
 * ── DISCOVERY DISCREPANCY-COMPARE — adversarial tests · capability 1.1 · 2026-06-19 ──
 *
 * Proves the D-9 honesty gates and the hedge guarantee WITHOUT a live AI call:
 * fetch + AI gateway are injected. Each test computes what a NAIVE/buggy compare
 * would do and asserts the real one differs.
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/discovery/compare.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import {
  compareEnteredVsSite, filterDiscrepancies, buildDiscrepancyMessage, looksSame,
  type EnteredBusinessData,
} from './compare';
import type { WebsiteContent } from './adapters/website';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const ENTERED: EnteredBusinessData = {
  businessName:    'LAWNS Tree Farm',
  location:        'Leander, TX',
  phone:           '(512) 450-3336',
  services:        ['tree sales', 'planting'],
  hours:           'Mon–Fri 9–5',
  website:         'https://example-nursery.com',
};

const ENTERED_STR: Record<string, string | null> = {
  businessName: 'LAWNS Tree Farm', location: 'Leander, TX', phone: '(512) 450-3336',
  email: null, services: 'tree sales, planting', hours: 'Mon–Fri 9–5', yearsInBusiness: null,
};

function liveContent(text: string, error?: string): WebsiteContent {
  return { url: ENTERED.website, title: 'LAWNS', description: '', text, fetchedAt: '2026-06-19T00:00:00Z', error };
}

// ── 1. A real mismatch surfaces as a HEDGED QUESTION, never an assertion ──────────
(async () => {
  const res = await compareEnteredVsSite(ENTERED, {
    apiKey: 'test',
    _fetchContent: async () => liveContent('Call us at (512) 999-1111'),
    _execute: async () => ([{ field: 'phone', siteValue: '(512) 999-1111', confidence: 'high' }]),
  });
  ok(res.discrepancies.length === 1, '1: one discrepancy surfaced');
  const m = res.discrepancies[0]?.message ?? '';
  ok(m.includes('?'), '1: message is phrased as a question (hedge)');
  ok(/512\) 999-1111/.test(m) && /512\) 450-3336/.test(m), '1: message shows BOTH site and entered values');
  // a buggy/asserting version would say "your phone is wrong" — ours never asserts a correct value
  ok(!/is wrong|is incorrect|update to|correct value is|the correct/i.test(m), '1: never asserts which value is correct');
})();

// ── 2. Site says nothing about a field → NO claim (gate 1) ────────────────────────
{
  const out = filterDiscrepancies(
    [{ field: 'email', siteValue: '', confidence: 'high' }],
    ENTERED_STR,
  );
  ok(out.length === 0, '2: empty site value produces no discrepancy');
}

// ── 3. Entered and site are effectively the SAME → not a discrepancy (gate 2) ─────
{
  // site states the same phone, formatted differently / extra spaces
  const out = filterDiscrepancies(
    [{ field: 'phone', siteValue: ' (512) 450.3336 ', confidence: 'high' }],
    ENTERED_STR,
  );
  ok(out.length === 0, '3: cosmetically-different-but-same value is not flagged');
  ok(looksSame('(512) 450-3336', '512 450 3336'), '3: looksSame ignores punctuation/spacing');
  ok(!looksSame('Leander, TX', 'Austin, TX'), '3: looksSame catches a real difference');
}

// ── 4. Low-confidence is dropped at default threshold; medium survives (gate 3) ───
{
  const low = filterDiscrepancies(
    [{ field: 'location', siteValue: 'Austin, TX', confidence: 'low' }],
    ENTERED_STR,
  );
  ok(low.length === 0, '4: low-confidence discrepancy dropped at default (medium) threshold');
  const med = filterDiscrepancies(
    [{ field: 'location', siteValue: 'Austin, TX', confidence: 'medium' }],
    ENTERED_STR,
  );
  ok(med.length === 1 && med[0].confidence === 'medium', '4: medium-confidence survives');
  ok(med[0].message.includes('?') && /may list/i.test(med[0].message), '4: medium message is extra-hedged');
}

// ── 5. Unreachable site → siteReachable false, ZERO fabricated discrepancies ──────
(async () => {
  let aiCalled = false;
  const res = await compareEnteredVsSite(ENTERED, {
    apiKey: 'test',
    _fetchContent: async () => liveContent('', 'HTTP 403'),
    _execute: async () => { aiCalled = true; return []; },
  });
  ok(res.siteReachable === false, '5: unreachable site reported as not reachable');
  ok(res.discrepancies.length === 0, '5: no discrepancies fabricated when site unreadable');
  ok(aiCalled === false, '5: AI not even called when the site cannot be read (honest short-circuit)');
  ok(res.error === 'HTTP 403', '5: surfaces the fetch error honestly');
})();

// ── 6. fetchedAt is carried through → proves a LIVE fetch, not cache ──────────────
(async () => {
  const res = await compareEnteredVsSite(ENTERED, {
    apiKey: 'test',
    _fetchContent: async () => liveContent('We are located in Austin, TX'),
    _execute: async () => ([{ field: 'location', siteValue: 'Austin, TX', confidence: 'high' }]),
  });
  ok(res.fetchedAt === '2026-06-19T00:00:00Z', '6: fetchedAt propagated (freshness provable)');
  ok(buildDiscrepancyMessage({ field: 'location', entered: 'Leander, TX', site: 'Austin, TX', confidence: 'high' }).includes('your location'), '6: field label used in message');
})();

// ── summary (deferred so async tests resolve) ─────────────────────────────────────
setTimeout(() => {
  console.log(`\n=== compare.test.ts: ${passed} passed / ${failed} failed ===`);
  if (failed) { failures.forEach(f => console.error('  - ' + f)); process.exit(1); }
}, 50);
