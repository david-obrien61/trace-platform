#!/usr/bin/env node
/**
 * ── verify-browser-key-restricted — the browser key must be REFUSED off-referrer ─────────────
 *
 * PURPOSE:      Prove, by calling Google, that the key shipped in the production bundle is
 *               application-restricted. Not by reading a comment that says it is.
 * DEPENDENCIES: network (only with `--live`) · `browser-key-declarations.json` for the record.
 * OUTPUTS:      exit 0 clean · exit 1 with the reason · `--live` re-measures · `--self-test`.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 WHY: THE COMMENT WAS WRONG, AND A CAP BELIEVED IT
 * ═════════════════════════════════════════════════════════════════════════════
 * `verify-address-fields` deliberately allows `VITE_GOOGLE_MAPS_API_KEY` in client code, on the
 * grounds that it is "REFERRER-LOCKED and public by design". I wrote that. Nobody measured it.
 *
 * MEASURED 2026-09-25 against the live bundle: the key in `index-BgAWjCC2.js` answered a
 * server-side Geocoding call from a laptop with no referrer — `status: OK`, no error_message. A
 * referrer-locked key is REFUSED for that call. David then confirmed the cause: the browser key
 * and the server key were **the same key**, so an unrestricted billable key was readable by every
 * visitor to the site.
 *
 * ⚠️ THE DEFECT WAS NOT THE KEY, IT WAS THE EXEMPTION. A cap that carves out an exception on the
 * strength of a sentence in its own header is [[R-26]] wearing a hi-vis jacket: the one place
 * everyone trusts is the one place nobody checks. So the exemption now has to be EARNED by a
 * measurement, and the measurement expires.
 *
 * 🔴 THE KEY IS NEVER PRINTED. Not in output, not in the declaration, not on failure. The record
 * keeps a FINGERPRINT (first 8 + last 4) — enough to notice the key changed, useless to anyone
 * who reads it.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DECLS = 'browser-key-declarations.json';
const SITE = process.env.TRACE_SITE_URL ?? 'https://cultivar-os.app';
const MAX_AGE_DAYS = 30;

export function fingerprint(key) {
  return key.length < 14 ? '(too short to fingerprint)' : `${key.slice(0, 8)}…${key.slice(-4)}`;
}

/** REQUEST_DENIED is the ONLY answer that proves a restriction. Anything else is a live key. */
export function verdictFromGoogle(body) {
  const status = body?.status;
  if (status === 'REQUEST_DENIED') return { restricted: true, status, why: 'refused off-referrer — the key is application-restricted' };
  if (typeof status !== 'string') return { restricted: false, status: '(none)', why: 'no status in the reply — treated as UNPROVEN, never as safe' };
  // OK, ZERO_RESULTS, OVER_QUERY_LIMIT … all mean Google ACCEPTED the key from a bare server.
  return { restricted: false, status, why: `Google ANSWERED (${status}) a call with no referrer — the key is NOT restricted` };
}

export function isFresh(decl, now) {
  if (!decl?.measured_at) return false;
  const at = Date.parse(decl.measured_at);
  if (Number.isNaN(at)) return false;
  const days = (now - at) / 86400000;
  return days >= 0 && days < MAX_AGE_DAYS;
}

async function live() {
  const idx = await fetch(SITE, { redirect: 'follow' });
  const html = await idx.text();
  const m = /\/assets\/index-[A-Za-z0-9_-]+\.js/.exec(html);
  if (!m) { console.log('🔴 could not find the bundle on the live page'); return 1; }
  const js = await (await fetch(SITE + m[0])).text();
  const km = /AIza[0-9A-Za-z_-]{35}/.exec(js);
  if (!km) {
    console.log(`✅ no Google key literal in the served bundle (${m[0]}) — nothing to restrict.`);
    writeFileSync(DECLS, JSON.stringify({ measured_at: new Date().toISOString(), bundle: m[0], key_present: false }, null, 2) + '\n');
    return 0;
  }
  const key = km[0];
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Leander,TX&key=${key}`);
  const v = verdictFromGoogle(await r.json().catch(() => ({})));
  const rec = {
    measured_at: new Date().toISOString(), bundle: m[0], key_present: true,
    key_fingerprint: fingerprint(key), restricted: v.restricted, google_status: v.status, why: v.why,
  };
  writeFileSync(DECLS, JSON.stringify(rec, null, 2) + '\n');
  if (!v.restricted) {
    console.log(`\n🔴 THE KEY IN THE PRODUCTION BUNDLE IS NOT RESTRICTED.\n   ${v.why}`);
    console.log(`   bundle ${m[0]} · key ${rec.key_fingerprint} (fingerprint only — the value is never printed)`);
    console.log('   Restrict it in the Google console to the APIs the browser actually calls,');
    console.log('   or rotate it. Until then it is a billable key readable by every visitor.');
    return 1;
  }
  console.log(`✅ browser-key-restricted — measured just now: ${v.why} (${m[0]}, key ${rec.key_fingerprint}).`);
  return 0;
}

function fromRecord() {
  if (!existsSync(DECLS)) {
    console.log('🔴 browser-key-restricted — NO MEASUREMENT ON RECORD.');
    console.log('   The exemption in verify-address-fields is not free: run');
    console.log('     npm run verify:browser-key -- --live');
    console.log('   A comment saying a key is restricted is not evidence that it is.');
    return 1;
  }
  const d = JSON.parse(readFileSync(DECLS, 'utf8'));
  if (d.key_present === false) { console.log('✅ browser-key-restricted — the last measurement found no key in the bundle.'); return 0; }
  if (!d.restricted) {
    console.log(`🔴 browser-key-restricted — the last measurement says NOT RESTRICTED (${d.google_status}, ${d.measured_at}).`);
    return 1;
  }
  if (!isFresh(d, Date.now())) {
    console.log(`🔴 browser-key-restricted — the measurement is STALE (${d.measured_at}, older than ${MAX_AGE_DAYS} days).`);
    console.log('   A key that was restricted last month is not evidence about today. Re-run with --live.');
    return 1;
  }
  console.log(`✅ browser-key-restricted — measured ${d.measured_at}, refused off-referrer (key ${d.key_fingerprint}).`);
  return 0;
}

function selfTest() {
  let pass = 0; const fails = [];
  const ok = (c, m) => { if (c) pass++; else fails.push(m); };
  ok(verdictFromGoogle({ status: 'REQUEST_DENIED' }).restricted === true, 'P1 REQUEST_DENIED proves a restriction');
  ok(verdictFromGoogle({ status: 'OK' }).restricted === false,
     '🔴 P2 "OK" IS THE FAILURE — Google answering a bare server call is exactly what an UNRESTRICTED key does, and it is the reply that looked like success on 2026-09-25');
  ok(verdictFromGoogle({ status: 'ZERO_RESULTS' }).restricted === false,
     '🔴 P3 ZERO_RESULTS ALSO MEANS THE KEY WORKED — Google accepted it and found nothing. Reading "no results" as "refused" would call an unrestricted key safe');
  ok(verdictFromGoogle({ status: 'OVER_QUERY_LIMIT' }).restricted === false, 'P4 a quota error still means the key was accepted');
  ok(verdictFromGoogle({}).restricted === false, 'P5 no status at all is UNPROVEN, never safe');
  ok(fingerprint('AIzaSyBaXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3CzA').includes('…'), 'P6 a fingerprint is truncated');
  ok(!fingerprint('AIzaSyBaXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3CzA').includes('XXXXXXXXXXXXXXXXXXXXXXXXXXXXX'), '🔴 P7 …and it does NOT contain the key');
  const now = Date.parse('2026-09-25T00:00:00Z');
  ok(isFresh({ measured_at: '2026-09-20T00:00:00Z' }, now) === true, 'P8 a measurement from five days ago is fresh');
  ok(isFresh({ measured_at: '2026-08-01T00:00:00Z' }, now) === false,
     '🔴 P9 A MEASUREMENT FROM LAST MONTH IS STALE — a key that was restricted then is not evidence about today, and console settings change without touching the repo');
  ok(isFresh({}, now) === false, 'P10 no date is not fresh');
  ok(isFresh({ measured_at: '2027-01-01T00:00:00Z' }, now) === false, 'P11 a future date is not fresh either — a clock disagreed');
  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`browser-key-restricted self-test — ${pass} passed, ${fails.length} failed`);
  return fails.length === 0 ? 0 : 1;
}

const arg = process.argv.slice(2);
process.exit(arg.includes('--self-test') ? selfTest() : arg.includes('--live') ? await live() : fromRecord());
