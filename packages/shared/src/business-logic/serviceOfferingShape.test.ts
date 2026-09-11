/**
 * ── serviceOfferingShape — a transport service must say who transports, and every writer asks ONE rule ──
 *
 * 🔴 R-120 (David, 2026-09-11): "PICK TRANSPORT, AND THE MODE FIELD APPEARS AND IS REQUIRED."
 * On 2026-09-09 LAWNS's Trip Charge was written `category='transport'` with `transport_mode` NULL and
 * did not appear on an order at all. The books review never wrote a mode; the Settings editor had a
 * mode-required check that could never fire, because its state defaulted to 'staff'.
 *
 * WHAT EACH § GUARDS
 *   §A the refusal comes FIRST — a guard only ever seen accepting is not a proven guard (§6 r19).
 *   §B requires_address follows the mode as a DEFAULT, never a lock.
 *   §C the category-scoped columns: one mapping, every category.
 *   §D the vocabulary is the migration's, and the new constraint says what this rule says.
 *   §E 🔴 EVERY WRITER USES THE ONE RULE — the writer population is DERIVED from the corpus and its
 *      size is STATED, so a fourth writer fails this file until it is declared (#182: a scanner that
 *      never states an expected count reports the same whether or not it reached its target).
 *   §F the discovery seed holds a row back rather than losing the batch — against a double that
 *      REFUSES what Postgres refuses (§6 r19a), watched refusing before it is trusted.
 *   §G the Settings editor and the books review: no silent default anywhere, and the refusal is reachable.
 *
 * Run: node scripts/run-tests.mjs serviceOfferingShape
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TRANSPORT_MODES, TRANSPORT_MODE_REQUIRED, transportBindingError, defaultRequiresAddress, categoryScopedFields,
} from './serviceOfferingShape';
import { TRANSPORT_MODE_OPTIONS } from './serviceOfferingEnums';
import { seedServiceOfferings } from '../discovery/seed';
import type { BusinessDiscoveryProfile } from '../discovery/types';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/** Comments removed, so a probe grades CODE and never its own file's prose (#146). `://` is kept. */
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §A — THE REFUSAL, FIRST.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  for (const junk of [null, undefined, '', 'truck', 'Staff', 'STAFF', ' staff']) {
    ok(transportBindingError('transport', junk) === TRANSPORT_MODE_REQUIRED,
      `🔴 §A a transport row with mode ${JSON.stringify(junk)} is REFUSED — only 'self' and 'staff' are modes`);
  }
  ok(transportBindingError('transport', 'staff') === null, '§A a staff transport row is accepted');
  ok(transportBindingError('transport', 'self') === null, '§A a self transport row is accepted');
  for (const cat of ['addon', 'maintenance', 'inspection', 'subscription', '']) {
    ok(transportBindingError(cat, null) === null, `§A a ${JSON.stringify(cat)} row needs no mode — only transport can fail this rule`);
  }
  ok(/who transports/i.test(TRANSPORT_MODE_REQUIRED) && /never appears at checkout/i.test(TRANSPORT_MODE_REQUIRED),
    '§A the reason says what is missing AND what it costs — not a bare "required"');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §B — requires_address FOLLOWS THE MODE, AS A DEFAULT.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(defaultRequiresAddress('staff') === true, '§B staff → needs an address (both of Test Dave\'s staff rows, measured 2026-09-10)');
  ok(defaultRequiresAddress('self') === false, '§B self → no address (Test Dave\'s Self Pickup, measured 2026-09-10)');
  ok(defaultRequiresAddress(null) === false && defaultRequiresAddress('') === false, '§B no mode → no claim that an address is needed');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §C — THE CATEGORY-SCOPED COLUMNS. ONE MAPPING, EVERY CATEGORY.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const refused = categoryScopedFields({ category: 'transport', transportMode: null });
  ok(refused.ok === false && refused.reason === TRANSPORT_MODE_REQUIRED, '🔴 §C a mode-less transport row gets a REASON, never fields');
  const refusedEmpty = categoryScopedFields({ category: 'transport', transportMode: '', requiresAddress: true });
  ok(refusedEmpty.ok === false, '§C an explicit address answer does not rescue a row that has no mode');

  const staff = categoryScopedFields({ category: 'transport', transportMode: 'staff' });
  ok(staff.ok && staff.fields.transport_mode === 'staff' && staff.fields.requires_address === true && staff.fields.trigger_transport_mode === null,
    '§C staff transport → {staff, needs address, no trigger}');
  const self = categoryScopedFields({ category: 'transport', transportMode: 'self' });
  ok(self.ok && self.fields.transport_mode === 'self' && self.fields.requires_address === false,
    '§C self transport → {self, no address}');

  const staffNoAddr = categoryScopedFields({ category: 'transport', transportMode: 'staff', requiresAddress: false });
  ok(staffNoAddr.ok && staffNoAddr.fields.requires_address === false,
    '⚠️ §C the owner\'s explicit "no address" on a staff row WINS — a staff drop to a site with no street address is real');
  const selfAddr = categoryScopedFields({ category: 'transport', transportMode: 'self', requiresAddress: true });
  ok(selfAddr.ok && selfAddr.fields.requires_address === true, '§C and the other direction: an explicit "needs address" on self is kept');

  const transportWithTrigger = categoryScopedFields({ category: 'transport', transportMode: 'staff', triggerTransportMode: 'self' });
  ok(transportWithTrigger.ok && transportWithTrigger.fields.trigger_transport_mode === null,
    '§C a transport row NEVER carries an add-on trigger — all three measured transport rows hold NULL there');

  const addon = categoryScopedFields({ category: 'addon', transportMode: 'staff', requiresAddress: true, triggerTransportMode: 'self' });
  ok(addon.ok && addon.fields.transport_mode === null && addon.fields.requires_address === false && addon.fields.trigger_transport_mode === 'self',
    '§C an add-on keeps its trigger and drops a mode typed against it — moving a service between kinds leaves no stale rule');
  const addonAlways = categoryScopedFields({ category: 'addon', triggerTransportMode: '' });
  ok(addonAlways.ok && addonAlways.fields.trigger_transport_mode === null, '§C an add-on with no trigger is "always show" (NULL)');
  const addonJunk = categoryScopedFields({ category: 'addon', triggerTransportMode: 'truck' });
  ok(addonJunk.ok && addonJunk.fields.trigger_transport_mode === null, '§C a trigger outside the CHECK is not written');

  const other = categoryScopedFields({ category: 'maintenance', transportMode: 'self', requiresAddress: true, triggerTransportMode: 'staff' });
  ok(other.ok && other.fields.transport_mode === null && other.fields.requires_address === false && other.fields.trigger_transport_mode === null,
    '§C every other kind carries none of the three');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §D — THE VOCABULARY IS THE MIGRATION'S, AND THE CONSTRAINT SAYS WHAT THIS RULE SAYS.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const mig = read('supabase/migrations/20260529_businesses_f_service_offerings.sql');
  const m = /transport_mode\s+text\s+CHECK \(transport_mode IN \(([^)]*)\)\)/.exec(mig);
  const fromCheck = m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')).sort() : [];
  ok(fromCheck.length === 2, `§D the transport_mode CHECK was found and parsed (${fromCheck.join('|')}) — a parse that finds nothing agrees with everything`);
  ok(JSON.stringify([...TRANSPORT_MODES].sort()) === JSON.stringify(fromCheck), '§D TRANSPORT_MODES is exactly the CHECK');
  ok(JSON.stringify(TRANSPORT_MODE_OPTIONS.map(o => o.value).sort()) === JSON.stringify(fromCheck),
    '§D and the picker offers exactly the same two — the select cannot offer a value the rule refuses');

  const RULE = 'supabase/migrations/20260911_service_offerings_transport_requires_mode.sql';
  ok(existsSync(join(ROOT, RULE)), '§D the database form of the rule is written (applied or not is David\'s — R-111)');
  const rule = existsSync(join(ROOT, RULE)) ? strip(read(RULE).replace(/^\s*--.*$/gm, '')) : '';
  ok(/ADD CONSTRAINT service_offerings_transport_requires_mode\s+CHECK \(category <> 'transport' OR transport_mode IS NOT NULL\)/.test(rule),
    '§D the constraint is NAMED and says exactly what transportBindingError says (an inline CHECK is auto-named and a name-grep never finds it — #91)');
  ok(/RAISE EXCEPTION/.test(rule) && /transport_mode IS NULL/.test(rule),
    '🔴 §D and its pre-flight REFUSES while a half-bound row exists — the migration repairs nothing');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E — 🔴 EVERY WRITER USES THE ONE RULE. THE POPULATION IS DERIVED, AND ITS SIZE IS STATED.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function walk(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
    }
    return out;
  }
  const files = [...walk(join(ROOT, 'packages')), ...walk(join(ROOT, 'api'))];
  ok(files.length > 200, `§E the walk reached the corpus (${files.length} source files) — a walk of nothing finds no writers and passes`);

  const WRITE = /\.from\(\s*['"]service_offerings['"]\s*\)\s*\.(insert|update|upsert)\(/;
  const DECLARED: Record<string, { uses: RegExp; why: string }> = {
    'packages/shared/src/pages/Settings.tsx':
      { uses: /from '\.\.\/business-logic\/serviceOfferingShape'/, why: 'the owner\'s editor — add, edit, On/Off' },
    'packages/shared/src/components/services/ServicesReview.tsx':
      { uses: /buildServiceRows\(/, why: 'the books review — its rows come from buildServiceRows, which asks the rule' },
    'packages/shared/src/discovery/seed.ts':
      { uses: /from '\.\.\/business-logic\/serviceOfferingShape'/, why: 'the website-discovery seed' },
  };
  const found = files.filter(f => WRITE.test(strip(readFileSync(f, 'utf8')))).map(f => relative(ROOT, f)).sort();
  console.log(`  §E discovered ${found.length} service_offerings writer file(s), expected ${Object.keys(DECLARED).length}: ${found.join(', ')}`);

  ok(found.length === Object.keys(DECLARED).length,
    `🔴 §E EXPECTED ${Object.keys(DECLARED).length} writer files and FOUND ${found.length} — a new writer must be declared here AND ask the shape rule`);
  for (const f of found) ok(f in DECLARED, `🔴 §E UNDECLARED service_offerings writer: ${f} — it may write a transport row with no mode`);
  for (const [f, d] of Object.entries(DECLARED)) {
    ok(found.includes(f), `§E STALE declaration — ${f} no longer writes service_offerings (${d.why})`);
    ok(existsSync(join(ROOT, f)) && d.uses.test(strip(read(f))), `§E ${f} asks the ONE rule (${d.why})`);
  }
  const review = strip(read('packages/shared/src/business-logic/serviceReview.ts'));
  ok(/categoryScopedFields\(/.test(review), '§E …and buildServiceRows, which the review writes through, asks it too');

  // No writer restates the rule inline — the exact shape of the unreachable check this build replaced.
  for (const f of Object.keys(DECLARED)) {
    ok(!/category === 'transport' && !/.test(existsSync(join(ROOT, f)) ? strip(read(f)) : ''),
      `§E ${f} does not restate the transport rule inline — a second copy is the one that drifts`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §F — THE DISCOVERY SEED HOLDS A ROW BACK. IT NEVER LOSES THE BATCH.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const CATEGORY_CHECK = ['transport', 'addon', 'maintenance', 'inspection', 'subscription'];
  // 🔴 THE DOUBLE REFUSES WHAT POSTGRES REFUSES (§6 r19a). One bad row, and the whole array is lost —
  // which is exactly the failure #217 describes. A double that accepted everything would bless it.
  function fakeDb(existingNames: string[] = []) {
    const inserts: Record<string, unknown>[][] = [];
    const client = {
      from(_table: string) {
        return {
          select(_cols: string) {
            return { eq: async (_c: string, _v: string) => ({ data: existingNames.map(name => ({ name })), error: null }) };
          },
          async insert(rows: Record<string, unknown>[]) {
            for (const r of rows) {
              if (!CATEGORY_CHECK.includes(String(r.category))) return { error: { message: 'violates check constraint "service_offerings_category_check"' } };
              if (r.category === 'transport' && (r.transport_mode ?? null) === null) {
                return { error: { message: 'violates check constraint "service_offerings_transport_requires_mode"' } };
              }
            }
            inserts.push(rows);
            return { error: null };
          },
        };
      },
    };
    return { client: client as unknown as SupabaseClient, inserts };
  }
  const profile = (offers: { name: string; category: string }[]): BusinessDiscoveryProfile =>
    ({ suggestedOfferings: offers.map(o => ({ ...o, description: '', price_type: 'flat', price_unit: 'order', rationale: '' })) }) as unknown as BusinessDiscoveryProfile;

  // The double is watched REFUSING before any assertion rests on it.
  void (async () => {
    const probe = fakeDb();
    const t = await probe.client.from('service_offerings').insert([{ category: 'transport', transport_mode: null }]);
    ok(t.error !== null, '§F CONTROL: the double REFUSES a mode-less transport row, as the constraint will');
    const u = await probe.client.from('service_offerings').insert([{ category: 'uncategorized' }]);
    ok(u.error !== null, '§F CONTROL: the double REFUSES `uncategorized`, as the category CHECK does');
    const a = await probe.client.from('service_offerings').insert([{ category: 'addon' }]);
    ok(a.error === null, '§F CONTROL: and it accepts a row Postgres would accept');

    const db = fakeDb(['Existing thing']);
    let threw = false;
    let r: Awaited<ReturnType<typeof seedServiceOfferings>> | null = null;
    try {
      r = await seedServiceOfferings(profile([
        { name: 'Delivery', category: 'transport' },
        { name: 'Travel netting', category: 'addon' },
        { name: 'Mystery', category: 'weird-made-up-thing' },
        { name: 'Existing thing', category: 'addon' },
      ]), 'biz-1', db.client);
    } catch { threw = true; }
    ok(!threw, '🔴 §F one transport suggestion and one unknown kind do NOT lose the batch (#217\'s failure: the whole array refused, logged "non-fatal")');
    ok(db.inserts.length === 1 && db.inserts[0].length === 1 && db.inserts[0][0].name === 'Travel netting',
      '§F exactly the writable row is written — the netting, and nothing else');
    ok(r !== null && r.seeded === 1 && r.flagged === 2, '§F seeded 1, held 2 — the counts say what happened');
    ok(r !== null && r.held.some(h => h.name === 'Delivery' && /who transports/i.test(h.reason)),
      '🔴 §F the transport suggestion is HELD with the R-120 reason — a suggestion states no mode, and none is guessed');
    ok(r !== null && r.held.some(h => h.name === 'Mystery' && /not recognized/.test(h.reason)),
      '§F the unknown kind is HELD with its reason — never written as a value the CHECK refuses');
    ok(r !== null && !r.held.some(h => h.name === 'Existing thing'), '§F a name already on the menu is skipped, not reported as held');

    const onlyTransport = fakeDb();
    const r2 = await seedServiceOfferings(profile([{ name: 'Customer pickup', category: 'transport' }]), 'biz-2', onlyTransport.client);
    ok(onlyTransport.inserts.length === 0 && r2.seeded === 0 && r2.held.length === 1,
      '§F a batch with nothing writable makes NO insert call at all');
  })().then(finish);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §G — THE TWO SCREENS: NO SILENT DEFAULT ANYWHERE, AND THE REFUSAL IS REACHABLE.
// ══════════════════════════════════════════════════════════════════════════════════════════════
function fnBody(src: string, name: string): string {
  const m = new RegExp(`(?:async )?function ${name}\\(`).exec(src);
  if (!m) return '';
  const rest = src.slice(m.index + 1);
  const next = rest.search(/\n\s*(?:async )?function \w+\(/);
  return src.slice(m.index, next < 0 ? undefined : m.index + 1 + next);
}
{
  const settings = strip(read('packages/shared/src/pages/Settings.tsx'));
  ok(settings.length > 20000, '§G Settings.tsx was read — a probe over an empty string agrees with everything');

  const v = fnBody(settings, 'validateServiceForm');
  ok(/const bindErr = transportBindingError\(f\.category, f\.transportMode\);/.test(v) && /if \(bindErr\) errs\.transportMode = bindErr;/.test(v),
    '§G the form validator asks the ONE rule');

  ok(!/useState\('staff'\)/.test(settings), '🔴 §G no form state STARTS on staff — the select must be able to hold "nothing chosen"');
  ok(!/transport_mode:\s*'staff'/.test(settings), '§G the editor\'s initial state is not staff');
  ok(!/\?\? 'staff'/.test(settings), '🔴 §G no NULL mode is turned into staff when a row is opened — that was the silent default');
  ok(!/setNewTransportMode\('staff'\)/.test(settings), '§G the post-add reset does not re-arm staff for the next service');
  ok((settings.match(/<option value="">Choose who transports…<\/option>/g) ?? []).length === 2,
    '§G BOTH mode selects (add and edit) open on "Choose who transports…" — a value the rule refuses');
  ok((settings.match(/defaultRequiresAddress\(e\.target\.value\)/g) ?? []).length === 2,
    '§G choosing a mode sets the address box to its default, on both forms');

  const toggle = fnBody(settings, 'toggleOffering');
  ok(/transportBindingError\(row\.category, row\.transport_mode\)/.test(toggle) && /if \(unbound\) \{/.test(toggle)
     && toggle.indexOf('if (unbound) {') < toggle.indexOf('.update('),
    '🔴 §G turning ON a mode-less transport row is refused BEFORE the write — "On" would be a lie at checkout');
  ok(/!current && row/.test(toggle), '§G only turning ON is refused — a broken row can always be turned OFF');

  const save = fnBody(settings, 'saveEdit');
  ok(save.indexOf('categoryScopedFields(') >= 0 && save.indexOf('categoryScopedFields(') < save.indexOf('.update('),
    '§G the editor\'s save writes through the shared mapping, before the write');
  const add = fnBody(settings, 'addOffering');
  const payload = add.slice(add.indexOf('.insert({'), add.indexOf('}).select('));
  ok(payload.length > 20 && /\.\.\.scoped\.fields/.test(payload), '§G the add form\'s INSERT payload takes its three columns from the shared mapping');
  ok(!/transport_mode|requires_address|trigger_transport_mode/.test(payload), '§G …and types none of them inline beside it');
  ok(/transportBindingError\(o\.category, o\.transport_mode\) &&/.test(settings),
    '§G a mode-less transport row carries a marker on the list — shown to the owner, never repaired');

  const reviewUi = strip(read('packages/shared/src/components/services/ServicesReview.tsx'));
  ok(/mode: '',/.test(reviewUi), '🔴 §G the review suggests NO mode — even when her income account says "Delivery"');
  ok(/transportMode: x\.s\.mode \|\| null/.test(reviewUi), '§G the accepted row carries the mode she chose, to the rule');
  ok(/state\.category === 'transport' && \(/.test(reviewUi), '§G the mode field APPEARS when Kind is transport');
  ok(/defaultRequiresAddress\(e\.target\.value\)/.test(reviewUi), '§G choosing a mode on the review sets the address default');
}

function finish(): void {
  console.log(`\n  serviceOfferingShape: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
}
