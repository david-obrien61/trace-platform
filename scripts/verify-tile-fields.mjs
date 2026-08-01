#!/usr/bin/env node
/**
 * verify-tile-fields.mjs — EVERY TILE DECLARES EVERY REQUIRED FIELD WITH A LEGAL VALUE.
 *
 * PURPOSE:      One assertion, applied to all 33 rows of TILE_REGISTRY: a row is COMPLETE (every
 *               non-optional field of `TileEntry` is present) and VALID (every union-typed field
 *               holds a member of its union; `depends_on` resolves to a real tile key; keys are
 *               unique).
 * DEPENDENCIES: packages/cultivar-os/src/registry/tileRegistry.ts — parsed as TEXT. No import, no
 *               transpile: the registry pulls in lucide-react and this must run in plain node.
 * OUTPUTS:      exit 0 = every row complete and valid. exit 1 = the offending rows, by key + field.
 *
 * ── WHY THIS EXISTS (the defect it is named after) ──────────────────────────────────────────────
 * `campaigns` carried `status:'planned'` for NINE WEEKS after the feature shipped. Nothing could
 * see it. The consolidation that seeded eight tiles `planned` as a batch was correct about seven of
 * them, and no check existed that could ask the eighth "are you sure?". The same silence produced
 * `qr_checkout.kind:'action'` (true for a QR scan, false the moment Nav C2 pointed it at a full
 * `/orders` workspace) and `nav_eligible` wrong on SEVEN of thirty-three rows in both directions.
 *
 * The pattern is exact and it is the reason this cap is worth its weight: EVERY FIELD WITH A READER
 * WAS CORRECT OR NEARLY SO; EVERY FIELD WITHOUT ONE HAD DRIFTED. A declaration nobody reads is a
 * declaration nobody corrects. This cap is a reader for all of them.
 *
 * ── THE RULES ARE DERIVED FROM THE SOURCE, NEVER HARDCODED (STD-011, tech-debt #73's lesson) ────
 * The required-field list is read out of `interface TileEntry` (a field is required unless it is
 * declared `name?:`). The legal value sets are read out of the `export type Tile* = 'a' | 'b'`
 * unions in the same file. So:
 *   · adding a field to TileEntry makes it required HERE, in the same commit, with no second edit;
 *   · adding a member to a union makes that value legal HERE, with no second edit.
 * A hardcoded copy of either would be the thing this cap exists to prevent, one layer up — which
 * is precisely what `OWNER_ONLY_PENDING` became (#73). Probes T14/T15 prove the derivation by
 * exercising values that a hardcoded list would have rejected.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'packages/cultivar-os/src/registry/tileRegistry.ts';

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', O = '\x1b[0m';

// ── source stripping ────────────────────────────────────────────────────────────────────────────
// The registry documents retired field names and wrong past values IN PROSE (the `nav_eligible`
// deletion note names the seven rows it was wrong on; the `campaigns` note quotes `status:'planned'`
// verbatim). A cap that reads prose reports fiction — strip comments before anything else.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

// ── DERIVE: which fields are required? ──────────────────────────────────────────────────────────
// From `interface TileEntry { … }`. `name?:` is optional; everything else is required.
function requiredFields(src) {
  const i = src.indexOf('export interface TileEntry');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  let depth = 0, end = open;
  for (let p = open; p < src.length; p++) {
    if (src[p] === '{') depth++;
    else if (src[p] === '}') { depth--; if (depth === 0) { end = p; break; } }
  }
  const body = src.slice(open + 1, end);
  const req = [], opt = [];
  for (const m of body.matchAll(/^\s*([a-z_]+)(\??):/gm)) (m[2] === '?' ? opt : req).push(m[1]);
  return { req, opt };
}

// ── DERIVE: what values are legal? ──────────────────────────────────────────────────────────────
// From `export type TileKind = 'destination' | 'readout';` etc. Field name → union type name.
const UNION_FIELDS = { kind: 'TileKind', placement: 'TilePlacement', status: 'TileStatus', vertical: 'TileVertical' };

function legalValues(src) {
  const out = {};
  for (const [field, typeName] of Object.entries(UNION_FIELDS)) {
    const m = src.match(new RegExp(`export type ${typeName}\\s*=([^;]+);`));
    if (!m) continue;
    out[field] = new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  }
  return out;
}

// ── PARSE: the rows ─────────────────────────────────────────────────────────────────────────────
// A hand-written walker rather than a regex, for one reason worth stating: `note:` holds free prose
// containing commas, colons, parens and apostrophes-in-quotes. Any regex that splits on `,` or
// matches `\w+:` reads the middle of a sentence as a field name. The walker tracks brace depth and
// skips string literals, so a note is one value and never a source of phantom fields.
// `start` is parameterised so MODULE_CATALOG reuses this walker verbatim — the note-with-commas
// problem is identical there (every catalog row carries a prose `note`), and a second parser would
// be a second thing to get wrong.
function parseRows(src, start = src.indexOf('export const TILE_REGISTRY')) {
  if (start < 0) return null;
  // 🔴 NOT `indexOf('[', start)`. The declaration reads `TILE_REGISTRY: TileEntry[] = [`, so the
  // FIRST `[` after the name is the empty pair in the TYPE annotation — depth-matching from there
  // closes immediately and yields a body of zero rows, i.e. a cap that passes everything. Caught by
  // probes T1-T9 going 0-for-9 on first run. Anchor on the `=` instead. (Same shape as the
  // field-lists `m.index` defect, 2026-07-31 — a window anchored one token too early.)
  const eq = src.indexOf('=', start);
  const open = src.indexOf('[', eq);
  let depth = 0, end = open;
  for (let p = open; p < src.length; p++) {
    if (src[p] === '[') depth++;
    else if (src[p] === ']') { depth--; if (depth === 0) { end = p; break; } }
  }
  const body = src.slice(open + 1, end);

  const rows = [];
  let p = 0;
  while (p < body.length) {
    if (body[p] !== '{') { p++; continue; }
    // walk this object literal, collecting depth-0 `field:` names and their raw values
    const fields = {};
    let d = 0, q = null, keyBuf = '', valBuf = '', inVal = false;
    for (; p < body.length; p++) {
      const c = body[p];
      if (q) {                                   // inside a string literal
        if (inVal) valBuf += c;
        if (c === q && body[p - 1] !== '\\') q = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { q = c; if (inVal) valBuf += c; continue; }
      if (c === '{' || c === '[') { d++; if (inVal) valBuf += c; continue; }
      if (c === '}' || c === ']') {
        d--;
        if (d === 0) { if (inVal && keyBuf.trim()) fields[keyBuf.trim()] = valBuf.trim(); p++; break; }
        if (inVal) valBuf += c;
        continue;
      }
      if (d === 1 && c === ':' && !inVal) { inVal = true; valBuf = ''; continue; }
      if (d === 1 && c === ',' && inVal) { fields[keyBuf.trim()] = valBuf.trim(); keyBuf = ''; valBuf = ''; inVal = false; continue; }
      if (inVal) valBuf += c; else keyBuf += c;
    }
    rows.push(fields);
  }
  return rows;
}

const unquote = (v) => (v && /^['"`]/.test(v) ? v.slice(1, -1) : v);

// ── THE SCAN ────────────────────────────────────────────────────────────────────────────────────
export function scan(src) {
  const clean = stripComments(src);
  const spec = requiredFields(clean);
  const legal = legalValues(clean);
  const rows = parseRows(clean);
  const problems = [];

  if (!spec) return [{ key: '(file)', field: 'TileEntry', how: 'interface TileEntry not found — the cap cannot derive its required-field list' }];
  if (!rows) return [{ key: '(file)', field: 'TILE_REGISTRY', how: 'TILE_REGISTRY array not found' }];

  const keys = rows.map((r) => unquote(r.key)).filter(Boolean);
  const seen = new Set();
  for (const k of keys) {
    if (seen.has(k)) problems.push({ key: k, field: 'key', how: `duplicate tile key '${k}' — two rows claim one identity; every selector returns whichever comes first` });
    seen.add(k);
  }

  for (const row of rows) {
    const key = unquote(row.key) || '(no key)';

    for (const f of spec.req) {
      if (!(f in row)) { problems.push({ key, field: f, how: `required field '${f}' is MISSING (TileEntry declares it non-optional)` }); continue; }
      const raw = row[f];
      if (raw === '' || raw === undefined) { problems.push({ key, field: f, how: `field '${f}' is declared with no value` }); continue; }

      // union-typed fields: the value must be a member of the union declared in the same file
      if (legal[f]) {
        const v = unquote(raw);
        if (!legal[f].has(v)) {
          problems.push({ key, field: f, how: `'${f}: ${raw}' is not a member of ${UNION_FIELDS[f]} (legal: ${[...legal[f]].map((x) => `'${x}'`).join(' | ')})` });
        }
        continue;
      }
      // free-string fields still must not be empty — '' passes TypeScript and means nothing
      if (/^['"`]\s*['"`]$/.test(raw)) problems.push({ key, field: f, how: `field '${f}' is an EMPTY string — TypeScript accepts it and it declares nothing` });
    }

    // depends_on is `string | null` — null is fine, a string must name a real tile
    if ('depends_on' in row) {
      const dep = row.depends_on;
      if (dep !== 'null') {
        const target = unquote(dep);
        if (!seen.has(target)) problems.push({ key, field: 'depends_on', how: `depends_on: '${target}' does not name any tile in the registry — a prerequisite that resolves to nothing is not a prerequisite` });
      }
    }
  }
  return problems;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ASSERTION 2 — TILE_REGISTRY.module_key ↔ MODULE_CATALOG, BOTH DIRECTIONS
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// WHY IT LIVES IN THIS CAP RATHER THAN ITS OWN FILE (§6 r8 — reuse, don't fork): it reads the SAME
// file through the SAME `parseRows` walker and asserts the same class of fact — a registry
// declaration that nothing corrects. A second script would duplicate the parser, the comment
// stripper and the npm wiring to assert one more invariant about one more list in one more object
// literal in the file this cap already owns.
//
// WHY BOTH DIRECTIONS. Forward (a tile's module_key with no catalog entry) is the one that breaks a
// screen: the marketplace renders a module with no price. Reverse (a catalog entry no tile
// references) is the one that rots quietly — a price for a module nobody can reach, which is how a
// list stops being trustworthy. The whole point of splitting price onto its own object was that the
// two lists must not be able to drift apart in silence, and one direction is not that.
//
// THE WITHIN-OBJECT INVARIANT IS LEGITIMATE, and it is worth naming the difference. The conditional
// this design REMOVED was ACROSS objects ("required on a tile, but only if another field is set").
// `billing` ↔ `price_monthly` is a three-state machine INSIDE one object, and a state machine is
// exactly what an invariant check is for: core ⇒ 0, add_on ⇒ > 0, unpriced ⇒ null. An `unpriced`
// module carrying a number, or an `add_on` carrying null, is the fabricated-value defect D-9 names.
const BILLING_RULE = {
  core:     { ok: (v) => v === '0',    how: 'billing:core means INCLUDED IN BASE, so the price must be exactly 0' },
  add_on:   { ok: (v) => /^\d+$/.test(v) && Number(v) > 0, how: 'billing:add_on must carry a real price > 0 — 0 would read as free' },
  unpriced: { ok: (v) => v === 'null', how: 'billing:unpriced must be null, NEVER 0 — a price we do not have must not render as a real figure (D-9)' },
};

/** Parse MODULE_CATALOG rows with the same walker used for the tiles. */
function parseCatalog(src) {
  const start = src.indexOf('export const MODULE_CATALOG');
  if (start < 0) return null;
  return parseRows(src, start);
}

function scanCatalog(src) {
  const clean = stripComments(src);
  const tiles = parseRows(clean);
  const catalog = parseCatalog(clean);
  const problems = [];
  if (tiles === null) return [{ key: '(file)', field: 'TILE_REGISTRY', how: 'TILE_REGISTRY not found' }];
  if (catalog === null) return [{ key: '(file)', field: 'MODULE_CATALOG', how: 'MODULE_CATALOG not found — every tile module_key would be unpriced and nothing would say so' }];

  const catKeys = new Set();
  for (const row of catalog) {
    const key = unquote(row.module_key) || '(no module_key)';
    if (catKeys.has(key)) problems.push({ key, field: 'module_key', how: 'two catalog entries claim the same module_key' });
    catKeys.add(key);

    for (const f of ['module_key', 'billing', 'price_monthly', 'trial_days', 'note']) {
      if (!(f in row) || row[f] === '' || row[f] === undefined) {
        problems.push({ key, field: f, how: `required catalog field '${f}' is MISSING — every module declares its billing facts and where they came from` });
      }
    }
    if (/^['"`]\s*['"`]$/.test(row.note ?? '')) {
      problems.push({ key, field: 'note', how: 'note is EMPTY — a price with no provenance cannot be told from an assumed one' });
    }

    const billing = unquote(row.billing ?? '');
    const rule = BILLING_RULE[billing];
    if (!rule) {
      if (billing) problems.push({ key, field: 'billing', how: `'${billing}' is not a member of ModuleBilling (legal: ${Object.keys(BILLING_RULE).map((x) => `'${x}'`).join(' | ')})` });
    } else if (!rule.ok((row.price_monthly ?? '').trim())) {
      problems.push({ key, field: 'price_monthly', how: `${rule.how} — found '${row.price_monthly}'` });
    }
    if (!/^\d+$/.test((row.trial_days ?? '').trim())) {
      problems.push({ key, field: 'trial_days', how: `trial_days must be a non-negative whole number of days — found '${row.trial_days}'` });
    }
  }

  // ── FORWARD: every tile module_key is priced ──
  const usedKeys = new Set();
  for (const row of tiles) {
    if (!('module_key' in row)) continue;
    const mk = unquote(row.module_key);
    usedKeys.add(mk);
    if (!catKeys.has(mk)) {
      problems.push({ key: unquote(row.key), field: 'module_key', how: `module_key '${mk}' has NO MODULE_CATALOG entry — the marketplace would render this module with no price` });
    }
  }
  // ── REVERSE: every priced module is reachable ──
  for (const mk of catKeys) {
    if (!usedKeys.has(mk)) {
      problems.push({ key: mk, field: 'module_key', how: 'MODULE_CATALOG prices a module NO TILE references — a price for something nobody can reach' });
    }
  }
  return problems;
}

// ── PROBES (STD-022 — planted, BOTH directions, run BEFORE the real scan) ───────────────────────
// A cap that has never been shown to FAIL is a green light of unknown wiring. Every probe below is
// a whole synthetic registry file, so the derivation path (interface → required set, unions → legal
// sets) is exercised end-to-end rather than stubbed.
const FIXTURE = (rows, extra = {}) => `
export type TileKind = 'destination' | 'readout'${extra.kind ?? ''};
export type TilePlacement = 'dashboard' | 'settings' | 'admin' | 'TBD';
export type TileStatus = 'live' | 'planned';
export type TileVertical = 'general' | 'cultivar' | 'ignition' | 'conduit' | 'kinna';
export interface TileEntry {
  key: string;
  label: string;
  group: string;
  vertical: TileVertical;
  kind: TileKind;
  placement: TilePlacement;
  required_permission: string;
  status: TileStatus;
  depends_on: string | null;
  icon: ComponentType<LucideProps>;
  color: string;
  bg: string;
  route?: string;
  module_key?: string;
  note?: string;
}
export const TILE_REGISTRY: TileEntry[] = [
${rows}
];
export const NAV_IA = [];
`;

const OK_ROW = `  { key: 'alpha', vertical: 'general', label: 'Alpha', group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'costs:read', status: 'live', depends_on: null,
    icon: Boxes, color: '#fff', bg: '#000' },`;

function runProbes() {
  const p = [];
  const t = (name, src, shouldFail) => {
    const got = scan(src).length > 0;
    p.push({ name, ok: got === shouldFail, expect: shouldFail ? 'FAIL' : 'PASS', got: got ? 'FAIL' : 'PASS' });
  };

  // ── BAD — must be caught ──────────────────────────────────────────────────────────────────────
  t('T1 a row missing `status` entirely',
    FIXTURE(`  { key: 'a', vertical: 'general', label: 'A', group: 'g', kind: 'destination', placement: 'dashboard', required_permission: 'x', depends_on: null,
    icon: I, color: '#fff', bg: '#000' },`), true);

  t("T2 🔴 kind: 'action' — the RETIRED value this build collapsed away",
    FIXTURE(OK_ROW.replace("kind: 'destination'", "kind: 'action'")), true);

  t("T3 placement: 'sidebar' — not a member of TilePlacement",
    FIXTURE(OK_ROW.replace("placement: 'dashboard'", "placement: 'sidebar'")), true);

  t("T4 🔴 vertical: 'nursery' — the business_type value, NOT a registry vertical (the confusable pair)",
    FIXTURE(OK_ROW.replace("vertical: 'general'", "vertical: 'nursery'")), true);

  t("T5 status: 'planed' — a one-letter typo that TypeScript would catch and a text edit would not",
    FIXTURE(OK_ROW.replace("status: 'live'", "status: 'planed'")), true);

  t('T6 group: \'\' — empty string, accepted by `group: string`, declares nothing',
    FIXTURE(OK_ROW.replace("group: 'financial'", "group: ''")), true);

  t('T7 two rows claiming the same key',
    FIXTURE(`${OK_ROW}\n${OK_ROW}`), true);

  t("T8 🔴 depends_on: 'social' — a NEAR-MISS of a real key, resolving to nothing",
    FIXTURE(OK_ROW.replace('depends_on: null', "depends_on: 'social'")), true);

  t('T9 a row missing `icon` — a required field that is not a quoted string',
    FIXTURE(OK_ROW.replace('icon: Boxes, ', '')), true);

  // ── GOOD — must NOT be reported (this is the half that keeps the cap from being a blunt instrument)
  t('T10 a complete, valid row', FIXTURE(OK_ROW), false);

  t('T11 depends_on naming a real sibling key resolves',
    FIXTURE(`${OK_ROW}\n${OK_ROW.replace("key: 'alpha'", "key: 'beta'").replace('depends_on: null', "depends_on: 'alpha'")}`), false);

  t('T12 optional fields ABSENT is legal (no route, no module_key, no note)',
    FIXTURE(OK_ROW), false);

  t('T13 optional fields PRESENT is legal — incl. a note full of commas, colons and parens',
    FIXTURE(OK_ROW.replace(`bg: '#000' }`, `bg: '#000', route: '/x', module_key: 'alpha', note: 'EDITOR LIVE: transport, add-ons (incl. netting), other; permission PROVISIONAL.' }`)), false);

  t("T14 🔴 vertical: 'cultivar' passes — a value a hardcoded 'general'-only list would have rejected",
    FIXTURE(OK_ROW.replace("vertical: 'general'", "vertical: 'cultivar'")), false);

  t("T15 🔴 DERIVATION PROOF — adding 'widget' to the TileKind union makes 'widget' legal here, with no edit to this cap",
    FIXTURE(OK_ROW.replace("kind: 'destination'", "kind: 'widget'"), { kind: " | 'widget'" }), false);

  // ── ASSERTION 2 probes — the tile ↔ catalog join, both directions ────────────────────────────
  const c = (rows) => `\nexport const MODULE_CATALOG: ModuleEntry[] = [\n${rows}\n];\n`;
  const OK_CAT = `  { module_key: 'alpha', billing: 'add_on', price_monthly: 19, trial_days: 30, note: 'MASTER_BRIEF:306 — $19/mo.' },`;
  const TILE_WITH_MK = OK_ROW.replace(`bg: '#000' }`, `bg: '#000', module_key: 'alpha' }`);
  const tc = (name, src, shouldFail) => {
    const got = scanCatalog(src).length > 0;
    p.push({ name, ok: got === shouldFail, expect: shouldFail ? 'FAIL' : 'PASS', got: got ? 'FAIL' : 'PASS' });
  };

  tc('C1 🔴 FORWARD — a tile module_key with NO catalog entry (the marketplace renders no price)',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace("'alpha'", "'beta'") ) + '\n', true);
  tc('C2 🔴 REVERSE — a catalog entry NO tile references (a price for something unreachable)',
    FIXTURE(OK_ROW) + c(OK_CAT), true);
  tc('C3 🔴 unpriced carrying 0 — the D-9 defect this split exists to make impossible',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace("billing: 'add_on'", "billing: 'unpriced'").replace('price_monthly: 19', 'price_monthly: 0')), true);
  tc('C4 🔴 add_on carrying 0 — a real module rendering as free',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace('price_monthly: 19', 'price_monthly: 0')), true);
  tc('C5 core carrying a price — included-in-base is not $19',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace("billing: 'add_on'", "billing: 'core'")), true);
  tc("C6 billing: 'free' — not a member of ModuleBilling",
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace("billing: 'add_on'", "billing: 'free'")), true);
  tc('C7 an EMPTY note — a price with no provenance',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace(/note: '[^']*'/, "note: ''")), true);
  tc('C8 a MISSING trial_days',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace('trial_days: 30, ', '')), true);
  tc('C9 two catalog entries claiming one module_key',
    FIXTURE(TILE_WITH_MK) + c(`${OK_CAT}\n${OK_CAT}`), true);
  tc('C10 🔴 NO MODULE_CATALOG AT ALL is a failure, not a skip',
    FIXTURE(TILE_WITH_MK), true);

  // GOOD — the half that keeps it from being a blunt instrument
  tc('C11 a matched pair passes', FIXTURE(TILE_WITH_MK) + c(OK_CAT), false);
  tc('C12 unpriced with null passes — the honest unknown is legal, only the fabricated 0 is not',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace("billing: 'add_on'", "billing: 'unpriced'").replace('price_monthly: 19', 'price_monthly: null').replace('trial_days: 30', 'trial_days: 0')), false);
  tc('C13 core with 0 passes', FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace("billing: 'add_on'", "billing: 'core'").replace('price_monthly: 19', 'price_monthly: 0').replace('trial_days: 30', 'trial_days: 0')), false);
  tc('C14 TWO tiles sharing one module_key is legal (inventory_manual/intake pattern) — no reverse violation',
    FIXTURE(`${TILE_WITH_MK}\n${TILE_WITH_MK.replace("key: 'alpha'", "key: 'gamma'")}`) + c(OK_CAT), false);
  tc('C15 a tile with NO module_key needs no catalog entry',
    FIXTURE(`${OK_ROW}\n${TILE_WITH_MK.replace("key: 'alpha'", "key: 'gamma'")}`) + c(OK_CAT), false);
  tc('C16 a note full of commas, colons and an apostrophe is ONE value (the walker, reused)',
    FIXTURE(TILE_WITH_MK) + c(OK_CAT.replace(/note: '[^']*'/, "note: 'MASTER_BRIEF:306 — Social Media + AI posts, $19/mo, all verticals; the brief\\'s label differs.'")), false);

  return p;
}

// ── main ────────────────────────────────────────────────────────────────────────────────────────
const probes = runProbes();
const bad = probes.filter((x) => !x.ok);
console.log(`${DIM}tile-fields probes: ${probes.length - bad.length}/${probes.length} behaved${O}`);
if (bad.length) {
  console.error(`${RED}SELF-TEST FAILED${O} — the cap does not behave on planted input, so a green run proves nothing:`);
  for (const b of bad) console.error(`  ${RED}✗${O} ${b.name} — expected ${b.expect}, got ${b.got}`);
  process.exit(1);
}

const path = join(ROOT, REGISTRY);
if (!existsSync(path)) {
  console.log(`${YEL}skip${O} ${REGISTRY} not present`);
  process.exit(0);
}

const src = readFileSync(path, 'utf8');
const problems = [...scan(src), ...scanCatalog(src)];
if (problems.length === 0) {
  const clean = stripComments(src);
  const rows = parseRows(clean);
  const spec = requiredFields(clean);
  const cat = parseCatalog(clean);
  console.log(`${GRN}✓${O} tile-fields — ${rows.length} tiles, each declaring all ${spec.req.length} required fields with a legal value; depends_on resolves; keys unique`);
  console.log(`${GRN}✓${O} module-catalog — ${cat.length} modules priced, joined to the registry in BOTH directions; billing ↔ price agrees on every row`);
  process.exit(0);
}

console.error(`\n${RED}✗ tile-fields — ${problems.length} invalid field(s) in ${REGISTRY}:${O}`);
for (const p of problems) console.error(`  ${RED}${p.key}${O} · ${p.field} — ${p.how}`);
console.error(`\n${DIM}A tile's fields are its contract with every surface that reads the registry. Fix the row.${O}`);
process.exit(1);
