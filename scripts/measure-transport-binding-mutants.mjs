/**
 * ── measure-transport-binding-mutants — can a transport service reach the menu without saying who carries it? ──
 *
 * PURPOSE:      Every mutant here reopens the 2026-09-09 defect by a different door: the rule itself,
 *               the books review, the Settings editor's silent 'staff', the On/Off toggle, the discovery
 *               seed, the checkout message — and ONE that changes the POPULATION rather than the subject.
 *                 · Z1 is that one. It turns a READER of service_offerings into a WRITER. Every other
 *                   mutant edits a thing the probes were written about; Z1 adds a thing nobody wrote a
 *                   probe for, which is how a fourth writer actually arrives (tech-debt #182: none of the
 *                   repo's earlier mutants changed the population, so none could show a scanner reaching it).
 *                 · S1/S2 restore the silent default — the reason the old check could never fire.
 *                 · R1 removes the review's refusal, the writer that produced LAWNS's row.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates one file at a time; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, AND A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. A target string that
 *    is found zero times or twice has proven nothing (tech-debt #182 · R-33 · §6 r19).
 *
 * Run: node scripts/measure-transport-binding-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const SHAPE    = ROOT + 'packages/shared/src/business-logic/serviceOfferingShape.ts';
const REVIEW   = ROOT + 'packages/shared/src/business-logic/serviceReview.ts';
const SETTINGS = ROOT + 'packages/shared/src/pages/Settings.tsx';
const SEED     = ROOT + 'packages/shared/src/discovery/seed.ts';
const RESOLVER = ROOT + 'packages/cultivar-os/src/lib/transport.ts';
const ADDONS   = ROOT + 'packages/cultivar-os/src/pages/AddOns.tsx';
const READER   = ROOT + 'packages/cultivar-os/src/hooks/useServices.ts';

const SUITES = [
  'packages/shared/src/business-logic/serviceOfferingShape.test.ts',
  'packages/shared/src/business-logic/serviceReview.test.ts',
  'packages/cultivar-os/src/lib/transport.test.ts',
  'packages/shared/src/pages/serviceWriteFailure.test.ts',
];

function suitesAreGreen() {
  for (const s of SUITES) {
    try {
      execSync(`set -o pipefail; ${ESB} ${s} --bundle --platform=node --format=cjs --log-level=error `
             + `--external:@supabase/supabase-js --external:@anthropic-ai/sdk 2>/dev/null | node`,
        { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    } catch { return false; }
  }
  return true;
}

const MUTANTS = [
  // ── THE RULE ─────────────────────────────────────────────────────────────────────────────
  { id: 'T1', file: SHAPE, why: '🔴 THE RULE IS GONE — a transport row with no mode is accepted everywhere at once',
    from: '  return isTransportMode(transportMode) ? null : TRANSPORT_MODE_REQUIRED;',
    to:   '  return null;' },
  { id: 'T2', file: SHAPE, why: 'any non-empty string is a mode — "truck" passes the app and fails the CHECK',
    from: "  return v === 'self' || v === 'staff';",
    to:   "  return typeof v === 'string' && v.length > 0;" },
  { id: 'T3', file: SHAPE, why: 'the address default stops following the mode — a staff delivery never asks for a ship-to',
    from: "  return transportMode === 'staff';",
    to:   '  return false;' },
  { id: 'T4', file: SHAPE, why: '⚠️ the default becomes a LOCK — an owner\'s "no address" on a staff drop is overwritten',
    from: "        requires_address: typeof input.requiresAddress === 'boolean' ? input.requiresAddress : defaultRequiresAddress(mode),",
    to:   '        requires_address: defaultRequiresAddress(mode),' },
  { id: 'T5', file: SHAPE, why: 'an add-on trigger is written onto a transport row',
    from: '        trigger_transport_mode: null,',
    to:   "        trigger_transport_mode: (input.triggerTransportMode === 'self' || input.triggerTransportMode === 'staff') ? input.triggerTransportMode : null," },
  { id: 'T6', file: SHAPE, why: 'a mode typed against an add-on is written — a stale rule survives a change of kind',
    from: '      transport_mode: null,',
    to:   "      transport_mode: (input.transportMode === 'self' || input.transportMode === 'staff') ? input.transportMode : null," },

  // ── THE BOOKS REVIEW — the writer that produced LAWNS's row ─────────────────────────────────
  { id: 'R1', file: REVIEW, why: '🔴 THE 2026-09-09 WRITER RETURNS — the review writes a transport row that says nothing about who carries it',
    from: '    if (!scoped.ok) {',
    to:   '    if (false) {' },
  { id: 'R2', file: REVIEW, why: '🔴 the review asks the rule and then does not WRITE the columns — transport_mode lands NULL on an accepted row',
    from: '      ...scoped.fields,',
    to:   '' },

  // ── THE SETTINGS EDITOR ─────────────────────────────────────────────────────────────────────
  { id: 'S1', file: SETTINGS, why: '🔴 THE SILENT DEFAULT RETURNS on the add form — the required check can never fire again',
    from: "setNewTransportMode]       = useState('')",
    to:   "setNewTransportMode]       = useState('staff')" },
  { id: 'S2', file: SETTINGS, why: '🔴 opening a mode-less row turns it into STAFF — one rename and the half-bound row is silently billed',
    from: "      transport_mode:    o.transport_mode ?? '',",
    to:   "      transport_mode:    o.transport_mode ?? 'staff'," },
  { id: 'S3', file: SETTINGS, why: 'a mode-less transport row can be switched "On" — the list says On while checkout still cannot offer it',
    from: '    if (unbound) {',
    to:   '    if (false) {' },
  { id: 'S4', file: SETTINGS, why: 'the form validator stops asking the rule — the refusal reaches the owner only as a raw write failure',
    from: '  if (bindErr) errs.transportMode = bindErr;',
    to:   '' },
  { id: 'S5', file: SETTINGS, why: 'the edit form loses its "Choose…" option — the select silently shows the first mode',
    from: '                        <option value="">Choose who transports…</option>\n                        {TRANSPORT_MODE_OPTIONS.map(op =>',
    to:   '                        {TRANSPORT_MODE_OPTIONS.map(op =>' },
  { id: 'S6', file: SETTINGS, why: 'the add form writes its own copy of the columns beside the shared mapping — the drift #218 predicts',
    from: '      ...scoped.fields,\n      is_active:    true,',
    to:   '      transport_mode: newTransportMode || null,\n      is_active:    true,' },

  // ── THE DISCOVERY SEED ──────────────────────────────────────────────────────────────────────
  { id: 'D1', file: SEED, why: '🔴 the seed stops holding back transport suggestions — the whole batch is refused and logged "non-fatal"',
    from: '    if (bind) { held.push({ name: o.name, reason: bind }); continue; }',
    to:   '' },
  { id: 'D2', file: SEED, why: '#217 returns — `uncategorized` is sent to a CHECK that refuses it, losing every offering found',
    from: "    if (cat.flagged) { held.push({ name: o.name, reason: cat.reason ?? 'category not recognized' }); continue; }",
    to:   '' },

  // ── THE CHECKOUT ────────────────────────────────────────────────────────────────────────────
  { id: 'C1', file: RESOLVER, why: '🔴 the resolver forgets unbound rows — a set-up service vanishes again with no flag naming it',
    from: "  const unbound = transportOfferings.filter(o => o.transport_mode !== 'self' && o.transport_mode !== 'staff');",
    to:   '  const unbound: ServiceOffering[] = [];' },
  { id: 'C2', file: ADDONS, why: '🔴 the checkout says "no transport options are set up" over a row that IS set up (§6 r18)',
    from: '            {roles.unbound.length > 0',
    to:   '            {false' },

  // ── THE POPULATION (#182) ──────────────────────────────────────────────────────────────────
  { id: 'Z1', file: READER, why: '🔴 A FOURTH WRITER APPEARS — a reader of service_offerings starts writing it, asking no rule. Nothing here was written about this file.',
    from: "        .from('service_offerings')\n        .select('*')",
    to:   "        .from('service_offerings')\n        .insert({})" },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const originals = new Map(FILES.map(f => [f, readFileSync(f, 'utf8')]));
let caught = 0, survived = 0, notApplied = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suitesAreGreen()) {
    console.log('RED — the suites must be green before any mutant means anything.');
    process.exit(1);
  }
  console.log('green');

  for (const m of MUTANTS) {
    const src = originals.get(m.file);
    const hits = src.split(m.from).length - 1;
    if (hits !== 1) {
      notApplied++;
      console.log(`  ⚠️  NEVER APPLIED ${m.id} — target found ${hits}× in ${m.file.replace(ROOT, '')} (must be exactly 1)`);
      continue;
    }
    writeFileSync(m.file, src.replace(m.from, () => m.to));
    const green = suitesAreGreen();
    writeFileSync(m.file, src);
    if (green) { survived++; console.log(`  🔴 SURVIVED ${m.id} — ${m.why}`); }
    else       { caught++;   console.log(`  ✅ CAUGHT   ${m.id} — ${m.why}`); }
  }
} finally {
  for (const [f, s] of originals) writeFileSync(f, s);
}

console.log(`\n  transport-binding mutants: ${caught} caught, ${survived} survived, ${notApplied} never applied (of ${MUTANTS.length})`);
process.exit(survived > 0 || notApplied > 0 ? 1 : 0);
