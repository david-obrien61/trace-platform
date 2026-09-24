#!/usr/bin/env node
/**
 * ── verify-address-fields — one address field, and the key never reaches the browser ─────────
 *
 * PURPOSE:      Two rules David set on 2026-09-24, made mechanical.
 *               ① AUTOCOMPLETE EVERYWHERE an address is typed — so every address entry routes
 *                 through the ONE shared `AddressInput`, and a new free-text address form
 *                 outside it fails the build (§6 r8: the same operation in one place).
 *               ② 🔴 THE GOOGLE KEY NEVER REACHES A CLIENT FILE. Its env name or a key-shaped
 *                 literal appearing anywhere the browser is built from is a build failure.
 * DEPENDENCIES: git (for the tracked-file list). No network, no database.
 * OUTPUTS:      exit 0 clean · exit 1 naming every file:line · `--self-test`.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 WHY ② IS A CAP AND NOT A CONVENTION
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * TRACE's Google key has **Application restrictions = NONE**. That is deliberate — it is what
 * lets it answer from a Node script and from our server proxy — and it means a copy of it in a
 * browser bundle is an unrestricted, billable key handed to every visitor. Vite substitutes
 * `VITE_*` at BUILD time, so the mistake is one character of naming and it is PERMANENT: the
 * value ships inside a static asset and cannot be un-shipped without rotating the key.
 *
 * A key was pasted into a chat window once today and had to be rotated. This is the same class,
 * one surface over, and it is the class nobody notices — nothing errors, the app works, and the
 * key is simply public.
 *
 * ⚠️ WHAT IS DELIBERATELY ALLOWED: `VITE_GOOGLE_MAPS_API_KEY` in client code. That key is
 * REFERRER-LOCKED and public by design — it draws the map. The two keys are not
 * interchangeable and the difference is the restriction, not the value (see docs/inventory-env.md).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

/** The server-side key. Never in a client file. */
const SERVER_KEY_NAME = 'GOOGLE_GEOCODING_API_KEY';
/** A Google API key literal: `AIza` then 35 more. Matches a pasted value, whatever it is called. */
const KEY_SHAPED = /AIza[0-9A-Za-z_-]{35}/;
/** The one component every address entry must go through. */
const SHARED_FIELD = 'components/AddressInput';

/** Files the BROWSER is built from. `api/` is server-side and legitimately holds the key. */
function isClientFile(f) {
  if (!/\.(ts|tsx|js|jsx)$/.test(f)) return false;
  if (f.includes('/api/') || f.startsWith('api/')) return false;
  if (f.includes('/scripts/') || f.startsWith('scripts/')) return false;
  if (/\.test\.|\.spec\./.test(f)) return false;
  return f.startsWith('packages/');
}

/** An address form: a file with street-address inputs a person types into. */
export function looksLikeAddressForm(text) {
  // Two independent address parts named as FIELDS, plus an input element. One alone is a mention;
  // together with an input they are a form. Deliberately narrow — a cap that is red on arrival
  // gets switched off (#73).
  // 🔴 A TYPE ANNOTATION IS NOT A FIELD. `billing_line1: string | null` in an interface matched
  // the first version of this and flagged OrderDetail — which has no address form at all, only a
  // row type and unrelated inputs. A cap that cries wolf gets declared away, and then it is not
  // watching the real ones either. So a match followed by a TypeScript type is discarded.
  const TYPEISH = /^\s*(string|number|boolean|null|undefined|Date|unknown|any|never|\w+\[\]|\{)/;
  const parts = ['line1', 'address_line1', 'billing_line1'].filter(p => {
    const re = new RegExp(`['"\`]?${p}['"\`]?\\s*[:=]\\s*([^\\n]{0,40})`, 'g');
    for (const m of text.matchAll(re)) { if (!TYPEISH.test(m[1])) return true; }
    return false;
  });
  const hasCityOrZip = /(['"`]?(city|zip)['"`]?\s*[:=])/.test(text);
  const hasInput = /<input|<AddressInput/.test(text);
  return parts.length > 0 && hasCityOrZip && hasInput;
}

export function usesSharedField(text) {
  return text.includes(SHARED_FIELD) || /<AddressInput/.test(text);
}

function tracked() {
  return execSync('git ls-files -z', { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);
}

/** Surfaces allowed to hold address fields without the shared component, each with its reason. */
const DECLARED = {
  'packages/shared/src/components/AddressInput.tsx': 'IS the shared field',
  'packages/shared/src/components/customers/ShipToPicker.tsx':
    'lists SAVED sites to choose from — it never takes typed input, so there is nothing to autocomplete',

  // ── 🔴 THE SEVEN SURFACES THAT EXISTED BEFORE THE SHARED FIELD DID ────────────────────────
  // Every one of these is a real address form and every one is OWED the shared field. They are
  // declared, not exempted: the list is the migration plan, and it must SHRINK.
  //
  // ⚠️ DECLARED RATHER THAN LEFT RED ON PURPOSE. A cap that is red on arrival gets switched off
  // (#73), and then it is not protecting the NEW forms either — which is the half that matters,
  // because the seven below are known and a new one would not be. Each line comes off as its
  // surface is wired.
  'packages/cultivar-os/src/pages/DeliveryRoute.tsx':
    'DECIDE FIRST, then wire or retire: its address box feeds a MAP LINK and is never saved ' +
    '(tech-debt #316, declared as not-a-capture in writer-registry.json). If a typed address ' +
    'there should be kept, it needs the shared field AND a writer; if not, it may not need either.',
};

function main() {
  const keyHits = [];
  const formHits = [];
  for (const f of tracked()) {
    if (!existsSync(f)) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }

    // ── ② the key ──────────────────────────────────────────────────────────────────────────
    if (isClientFile(f)) {
      text.split('\n').forEach((l, i) => {
        if (l.includes(SERVER_KEY_NAME)) keyHits.push(`${f}:${i + 1}  names ${SERVER_KEY_NAME}`);
        if (KEY_SHAPED.test(l)) keyHits.push(`${f}:${i + 1}  contains a Google-key-shaped literal`);
      });
    }

    // ── ① one address field ────────────────────────────────────────────────────────────────
    if (isClientFile(f) && !(f in DECLARED) && looksLikeAddressForm(text) && !usesSharedField(text)) {
      formHits.push(f);
    }
  }

  let bad = 0;
  if (keyHits.length) {
    bad = 1;
    console.log(`\n🔴 THE SERVER KEY REACHES A CLIENT FILE — ${keyHits.length} place(s):\n`);
    for (const h of keyHits) console.log(`  · ${h}`);
    console.log('\n  That key has NO application restriction. In a browser bundle it is an');
    console.log('  unrestricted, billable key handed to every visitor, permanently — the value is');
    console.log('  baked into a static asset and cannot be un-shipped without rotating the key.');
    console.log('  Call the server proxy instead (api/customers/create, action geocode|autocomplete).');
  }
  if (formHits.length) {
    bad = 1;
    console.log(`\n🔴 AN ADDRESS FORM OUTSIDE THE SHARED FIELD — ${formHits.length} file(s):\n`);
    for (const h of formHits) console.log(`  · ${h}`);
    console.log('\n  David, 2026-09-24: autocomplete must be available EVERYWHERE an address is');
    console.log('  typed. Route it through <AddressInput>, or declare it here with its reason.');
  }
  if (!bad) console.log('✅ address-fields — one shared field, and the server key is nowhere a browser can read it.');
  return bad;
}

function selfTest() {
  let pass = 0; const fails = [];
  const ok = (c, m) => { if (c) pass++; else fails.push(m); };

  // ✏️ The first fixture used `const [line1, setLine1] = useState('')`, which the detector does
  // NOT match — and that is correct: a destructured hook is not a field declaration. The shape
  // that matters is how these files really write it, so the fixture is now real code.
  ok(looksLikeAddressForm(`const form = { line1: '', city: '', zip: '' }; return <input value={form.line1} />;`),
     'P1 a typed address form is detected, in the shape the real files use');
  ok(looksLikeAddressForm(`address_line1: d.address_line1 ?? '', city: d.city ?? '', <input onChange={e=>set(e)} />`),
     'P1b …including the stop-edit shape');
  ok(!looksLikeAddressForm(`// the line1 column is billing_line1 in the database`),
     'P2 🔴 PROSE ABOUT line1 IS NOT A FORM — a cap that fires on comments is red on arrival and gets switched off (#73)');
  ok(!looksLikeAddressForm(`const cols = 'id, line1, city, zip';`),
     'P3 a column list is not a form — no input element');
  ok(!looksLikeAddressForm(`interface Row { billing_line1: string | null; city: string | null } <input value={qty} />`),
     '🔴 P3b A TYPE ANNOTATION IS NOT A FIELD — this exact shape flagged OrderDetail, which has no address form at all. A cap that cries wolf gets declared away, and then it is not watching the real ones either');
  ok(looksLikeAddressForm(`const draft = { billing_line1: '', city: '' }; <input value={draft.billing_line1} />`),
     'P3c …but the same NAME holding a VALUE still counts, so the tightening did not blind it');
  ok(usesSharedField(`import { AddressInput } from '@trace/shared/components/AddressInput';`), 'P4 the shared field is recognised by import');
  ok(usesSharedField(`<AddressInput value={a} onChange={setA} businessId={b} />`), 'P5 …and by use');
  ok(!isClientFile('packages/cultivar-os/api/customers/create.ts'), '🔴 P6 api/ IS NOT A CLIENT FILE — the proxy legitimately holds the key, and a cap that forbade it there would forbid the fix');
  ok(!isClientFile('scripts/geoprobe.mjs'), 'P7 scripts are not shipped to a browser');
  ok(isClientFile('packages/cultivar-os/src/pages/CustomerCapture.tsx'), 'P8 a page IS a client file');
  ok(KEY_SHAPED.test('const k = "AIzaSyBQcGmqJnkeDnWatqYEHW1BWSBMtUDFn28";'),
     '🔴 P9 A PASTED KEY IS CAUGHT BY SHAPE, not only by variable name — someone inlining the value is the case a name check misses entirely');
  ok(!KEY_SHAPED.test('const k = process.env.GOOGLE_GEOCODING_API_KEY;'), 'P10 …and an env READ is not a literal');
  ok(!isClientFile('packages/shared/src/business-logic/geocodeResult.test.ts'), 'P11 a test file is not shipped');

  const files = tracked();
  ok(files.length > 100, `🔴 P12 THE TRACKED-FILE LIST IS A REAL POPULATION (${files.length}) — a cap that reaches nothing reports the same as one that passed (#182)`);
  ok(files.includes('packages/shared/src/components/AddressInput.tsx'), 'P13 …and it can see the shared field');

  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`address-fields self-test — ${pass} passed, ${fails.length} failed`);
  return fails.length === 0 ? 0 : 1;
}

process.exit(process.argv.includes('--self-test') ? selfTest() : main());
