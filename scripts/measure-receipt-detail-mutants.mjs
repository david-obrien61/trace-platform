#!/usr/bin/env node
/**
 * ── measure-receipt-detail-mutants — does the suite actually defend what it claims? ──────────
 *
 * PURPOSE:      `receiptDetail.test.ts` is 84 green assertions, and green proves nothing on its
 *               own (R-33). This breaks one guarantee at a time and requires the suite to go RED.
 *               A mutant that SURVIVES is a guarantee nobody is holding.
 *
 * DEPENDENCIES: node_modules/.bin/esbuild · the sources it mutates. Offline, no database.
 *
 * OUTPUTS:      CONTROL result, then CAUGHT/SURVIVED per mutant, then a count. Exit 1 if the
 *               control is red or any mutant survives.
 *
 * 🔴 TWO PROPERTIES THAT ARE THE WHOLE POINT OF THE HARNESS:
 *   ① IT ASSERTS A GREEN CONTROL FIRST. Without that, every "CAUGHT" could be a suite that was
 *      already red for an unrelated reason, and the run would look like a triumph.
 *   ② IT KEYS OFF THE EXIT CODE, never a grep for the word FAIL. A grep would be defeated by a
 *      suite that crashes before printing anything — which is a failure that must count as one.
 *
 * Every edit is applied to a COPY in a temp dir and the originals are restored in a finally block,
 * so a crash mid-run cannot leave a mutated file in the tree.
 *
 * Run: node scripts/measure-receipt-detail-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const TEST = join(ROOT, 'packages/cultivar-os/src/lib/receiptDetail.test.ts');

const F = {
  model:  join(ROOT, 'packages/cultivar-os/src/lib/receiptDetail.ts'),
  vendor: join(ROOT, 'packages/cultivar-os/src/lib/vendorKey.ts'),
  keeper: join(ROOT, 'packages/cultivar-os/src/pages/ReceiptKeeper.tsx'),
  sql:    join(ROOT, 'supabase/migrations/20260902_receipt_line_edit_and_vendor_preference.sql'),
};
const ORIGINAL = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, readFileSync(p, 'utf8')]));

/** Run the suite. Returns true when GREEN. Keys off the exit code only. */
function suiteIsGreen() {
  try {
    const bundle = execFileSync(ESBUILD, [TEST, '--bundle', '--platform=node', '--format=cjs'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    execFileSync(process.execPath, ['-e', bundle], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;   // non-zero exit, OR a bundle error — both are a red suite
  }
}

function restore() { for (const [k, p] of Object.entries(F)) writeFileSync(p, ORIGINAL[k]); }

/** Apply one textual mutation. Throws if the anchor is absent — a mutant that did not apply
 *  would otherwise be scored CAUGHT/SURVIVED on an unmutated tree, which is a lie either way. */
function mutate(fileKey, from, to) {
  const src = ORIGINAL[fileKey];
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times in ${fileKey}: ${from.slice(0, 60)}`);
  writeFileSync(F[fileKey], src.replace(from, to));
}

const MUTANTS = [
  ['M1  recoverParsedOcr returns the OUTER envelope instead of digging for the parsed reply',
   () => mutate('model', "  const candidates = env.candidates;", "  return env as Record<string, unknown>;\n  const candidates = env.candidates;")],

  ['M2  a key the saved copy never carried is scored as CHANGED',
   () => mutate('model', "    } else if (!hasCurrentKey && orgPresent) {\n      state = 'never-carried';", "    } else if (false && !hasCurrentKey && orgPresent) {\n      state = 'never-carried';")],

  ['M3  a blank amount is summed as zero instead of reported incomplete',
   () => mutate('model', "  if (anyBlankAmount || total === null) {", "  if (false && (anyBlankAmount || total === null)) {")],

  ['M4  every attachment is treated as an image (the 8 PDFs render as nothing)',
   () => mutate('model', "  if (ext === 'pdf') return { kind: 'pdf', path: imageUrl, note: null };", "")],

  ['M5  the vendor fold stops stripping corporate suffixes',
   () => mutate('vendor', "  while (words.length > 1 && VENDOR_SUFFIXES.includes(words[words.length - 1])) {", "  while (false) {")],

  ['M6  "not sure" is treated as never-asked (the vendor is re-prompted forever)',
   () => mutate('model', "  const answered = stored !== null;", "  const answered = stored !== null && stored.preference_value !== null;")],

  ['M7  an absent subtotal renders as $0.00',
   () => mutate('model', "    subtotalText: sub === null ? null : fmt.format(sub),", "    subtotalText: fmt.format(sub ?? 0),")],

  ['M8  any line with no original is attributed to the platform',
   () => mutate('model', "    if (looksLikeTax && parsedTax !== null && amt !== null && Math.abs(amt - parsedTax) < 0.005) {", "    if (true) {")],

  ['M9  the RPC also writes line_items_original (the snapshot is overwritten)',
   () => mutate('sql', "     SET line_items              = p_line_items,", "     SET line_items              = p_line_items,\n         line_items_original     = p_line_items,")],

  ['M10 the trigger stops guarding line_items_original',
   () => mutate('sql', "  IF NEW.line_items_original IS DISTINCT FROM OLD.line_items_original THEN", "  IF false AND NEW.line_items_original IS DISTINCT FROM OLD.line_items_original THEN")],

  ['M11 a large mismatch no longer needs acknowledging before it is stored',
   () => mutate('sql', "      IF NOT p_acknowledged_mismatch THEN", "      IF false THEN")],

  ['M12 the confirm path goes back to dropping quantity',
   () => mutate('keeper', "          quantity:    item.quantity   ?? null,\n          unit_price:  item.unit_price ?? null,", "")],

  ['M13 the confirm path goes back to coercing a blank amount to 0',
   () => mutate('keeper', "          amount:      Number.isFinite(parsed) ? parsed : null,", "          amount:      parseFloat(item.amount) || 0,")],

  ['M14 the server match tolerance drifts away from the client one',
   () => mutate('sql', "    IF v_abs <= 0.02 THEN", "    IF v_abs <= 0.05 THEN")],

  ['M15 the detail projection stops selecting line_items',
   () => mutate('model', "  line_items, line_items_original, ocr_raw,", "  line_items_original, ocr_raw,")],

  ['M16 a line the owner DELETED silently disappears from the page',
   () => mutate('model', "  const count = Math.max(current.length, original.length);", "  const count = current.length;")],

  ['M17 the RPC drops its owner check',
   () => mutate('sql', "  IF NOT v_is_owner THEN\n    -- \u{1F534} THE DENIAL IS *NOT* AUDITED HERE", "  IF false THEN\n    -- \u{1F534} THE DENIAL IS *NOT* AUDITED HERE")],

  ['M19 the edit form opens on the STORED line, so an unrelated save deletes the rate',
   () => mutate('model', "      if (!(f in line) && present(org[f])) (seeded as Record<string, unknown>)[f] = org[f];", "")],

  ['M20 the seeding overwrites a deliberately-blank value instead of only an absent key',
   () => mutate('model', "      if (!(f in line) && present(org[f]))", "      if (!present(line[f]) && present(org[f]))")],

  ['M18 the trigger drops its owner check on line_items',
   () => mutate('sql', "    IF NOT v_is_owner THEN\n      RAISE EXCEPTION 'only the business owner may change receipt line items'", "    IF false THEN\n      RAISE EXCEPTION 'only the business owner may change receipt line items'")],

  // ── the two added 2026-09-02 in review of this build, each restoring a real defect it shipped ──
  ['M21 the refusal writes an audit row it cannot commit (the RAISE rolls it back)',
   () => mutate('sql', "    RAISE EXCEPTION 'only the business owner may edit receipt line items'",
     "    INSERT INTO public.audit_log (business_id, actor_user_id, action, target_type, target_id, detail, outcome)\n    VALUES (v_receipt.business_id, v_actor, 'receipt.line_edit_denied', 'receipt', p_receipt_id::text,\n            jsonb_build_object('reason', 'not_business_owner'), 'denied');\n    RAISE EXCEPTION 'only the business owner may edit receipt line items'")],

  ['M22 an absent key and a present null are compared as different (nine phantom changes on Sudderth)',
   () => mutate('sql', "      IF COALESCE(v_old_v, 'null'::jsonb) IS DISTINCT FROM COALESCE(v_new_v, 'null'::jsonb) THEN",
     "      IF v_old_v IS DISTINCT FROM v_new_v THEN")],
];

let caught = 0; const survived = [];
try {
  process.stdout.write('CONTROL (unmutated tree must be GREEN) … ');
  const controlGreen = suiteIsGreen();
  console.log(controlGreen ? 'GREEN ✓' : 'RED ✗');
  if (!controlGreen) {
    console.error('\n🔴 The control run is RED. Every "CAUGHT" below would be meaningless — a suite that');
    console.error('   was already failing catches every mutant for free. Fix the suite before trusting this.');
    process.exit(1);
  }

  console.log(`\nPOPULATION: ${MUTANTS.length} mutants, one guarantee each.\n`);
  for (const [label, apply] of MUTANTS) {
    restore();
    apply();
    const green = suiteIsGreen();
    if (green) { survived.push(label); console.log(`  SURVIVED ✗  ${label}`); }
    else { caught++; console.log(`  CAUGHT   ✓  ${label}`); }
  }
} finally {
  restore();
}

console.log(`\n${caught}/${MUTANTS.length} mutants CAUGHT against a green control.`);
if (survived.length) {
  console.log('\n🔴 SURVIVORS — each is a guarantee the suite claims and does not hold:');
  survived.forEach(s => console.log('   · ' + s));
  process.exit(1);
}
console.log('No survivors.');
