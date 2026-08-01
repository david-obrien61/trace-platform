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
function parseRows(src) {
  const start = src.indexOf('export const TILE_REGISTRY');
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

const problems = scan(readFileSync(path, 'utf8'));
if (problems.length === 0) {
  const rows = parseRows(stripComments(readFileSync(path, 'utf8')));
  const spec = requiredFields(stripComments(readFileSync(path, 'utf8')));
  console.log(`${GRN}✓${O} tile-fields — ${rows.length} tiles, each declaring all ${spec.req.length} required fields with a legal value; depends_on resolves; keys unique`);
  process.exit(0);
}

console.error(`\n${RED}✗ tile-fields — ${problems.length} invalid field(s) in ${REGISTRY}:${O}`);
for (const p of problems) console.error(`  ${RED}${p.key}${O} · ${p.field} — ${p.how}`);
console.error(`\n${DIM}A tile's fields are its contract with every surface that reads the registry. Fix the row.${O}`);
process.exit(1);
