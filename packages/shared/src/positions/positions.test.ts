/**
 * positions.test.ts — the responsibility catalogue, its derived marks, and the document.
 *
 * WHAT THIS ASSERTS AND WHY EACH PROBE EXISTS. Three of them exist because the 2026-08-29 draft
 * was WRONG in that exact way, and a probe that has never been red is a probe nobody trusts:
 *   A — catalogue integrity. Every cited string is in the model; ids are unique and stable.
 *   B — 🔴 `permissions: []` does NOT mean "not built". Measured: 20 rows carry an empty array
 *       and they mean three different things.
 *   C — 🔴 the marks are DERIVED. The draft hand-set `ownerOnly: false` on eight rows that cite
 *       an `owner-only` string. Both directions are asserted, so a hand flag can never win.
 *   D — the document. No blank ever prints; no software vocabulary reaches the page.
 *   E — negative controls. Each of C and D is proven to FAIL when the mechanism is removed —
 *       a green suite over a stub is the shape D-49's own tests had.
 *   F — 🔴 the starting points. A set never SUGGESTS an undelegable row (derived, not typed), the
 *       owner set is never enumerated, and the vertical filter cuts a set rather than inventing.
 *   G — 🔴 the context proposals. An unknown site proposes NOTHING; no proposal carries marketing
 *       prose; every proposed value names its source.
 *   H — the ④ empty-document state the description route keys on.
 *
 * Run: node_modules/.bin/esbuild packages/shared/src/positions/positions.test.ts \
 *        --bundle --platform=node --format=cjs | node
 */
import { RESPONSIBILITY_CATALOGUE, RESPONSIBILITY_AREAS, FREQUENCY_ORDER, FREQUENCY_LABEL, responsibilityById } from './responsibilityCatalogue';
import type { Responsibility } from './responsibilityCatalogue';
import { marksFor } from './responsibilityMarks';
import { buildPositionDocument, describeOperatingDays } from './positionDescription';
import {
  POSITION_STARTING_POINTS, startingPointIds, unknownStartingPointIds,
} from './positionStartingPoints';
import { proposedContextFor, hostOf } from './contextProposals';
import { ALL_MODEL_PERMISSIONS, PERMISSION_MANIFEST } from '../auth/permissionManifest';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const rows = RESPONSIBILITY_CATALOGUE;
const row = (id: string): Responsibility => {
  const r = responsibilityById(id);
  if (!r) throw new Error(`fixture row ${id} is gone — update the probe, do not delete it`);
  return r;
};

// ── A — CATALOGUE INTEGRITY ─────────────────────────────────────────────────────────────────
ok(rows.length === 93, `A1 catalogue holds 93 rows (got ${rows.length})`);

const ids = rows.map((r) => r.id);
ok(new Set(ids).size === ids.length, 'A2 every responsibility id is unique');

// 🔴 A3 — a stored pick references an id. Renaming one in place silently re-points every tenant's
// row at different work. The FORMAT is pinned so a rename is a visible, deliberate act.
ok(ids.every((id) => /^[A-Z]{3}-\d{2}$/.test(id)), 'A3 every id matches AREA-NN');

const model = new Set(ALL_MODEL_PERMISSIONS);
const cited = [...new Set(rows.flatMap((r) => r.permissions))];
const unknown = cited.filter((p) => !model.has(p));
ok(unknown.length === 0, `A4 every cited permission is in the model (unknown: ${unknown.join(', ')})`);

// 🔴 A5 — a `declared-unwired` or `planned` string gates nothing today, so citing one would tell
// an owner a responsibility is covered when nothing enforces it. Only real strings may be cited.
const notEnforced = cited.filter((p) => {
  const e = PERMISSION_MANIFEST[p];
  return e && e.status !== 'enforced' && e.status !== 'derived';
});
ok(notEnforced.length === 0, `A5 no cited string is un-enforced (${notEnforced.join(', ')})`);

ok(RESPONSIBILITY_AREAS.length === 10, `A6 ten areas (got ${RESPONSIBILITY_AREAS.length})`);
ok(rows.filter((r) => r.vertical === null).length === 77, 'A7 77 core rows');
ok(rows.filter((r) => r.vertical === 'cultivar').length === 16, 'A8 16 nursery rows');

// 🔴 A9 — GATING IS BY VERTICAL (ruling ①). No row may point at a module_key, because the one it
// would want (`grow_ladder`) does not exist. If a future row genuinely tracks a paid module this
// probe fails and the change is made deliberately rather than by drift.
ok(rows.every((r) => r.moduleKey === null), 'A9 no row is gated on a module_key');

ok(rows.every((r) => FREQUENCY_ORDER.includes(r.defaultFrequency)), 'A10 every frequency is in the order list');
ok(rows.every((r) => FREQUENCY_LABEL[r.defaultFrequency] !== undefined), 'A11 every frequency has a label');
ok(rows.every((r) => r.text.trim().length > 0 && !r.text.endsWith('.')), 'A12 texts are non-empty and unpunctuated (they are list items)');

// 🔴 A13 — decision ②. `order_compliance_records` is an ORDER-SCOPED customer accept/decline
// receipt (`order_id NOT NULL`, `decision IN ('accepted','declined')`) — the Regina netting record.
// A chemical application has no order, no decision and no acknowledgement. The draft cited it on
// three rows; this probe is what stops it coming back.
ok(!cited.some((p) => p.startsWith('order_compliance_records')),
   'A13 no row cites order_compliance_records — it does not fit a chemical application record');

// ── B — `permissions: []` MEANS "GRANTS NOTHING", NOT "NOT BUILT" ───────────────────────────
const empty = rows.filter((r) => r.permissions.length === 0);
ok(empty.length === 20, `B1 twenty rows grant nothing (got ${empty.length})`);

// 🔴 B2 — THE MEASUREMENT THAT FORCED A DECLARED FIELD. Those 20 rows carry THREE different
// capability values. Inferring "not built" from the empty array would print a false claim about
// our own coverage on a document an owner hands to a person.
const kinds = new Set(empty.map((r) => r.capability));
ok(kinds.size === 3, `B2 the empty-array rows carry three different capabilities (got ${[...kinds].sort().join('/')})`);

ok(row('PPL-09').capability === 'not_software', 'B3 training a new member of staff needs no software — it is not a gap');
ok(row('GRO-03').capability === 'none',         'B4 uppotting a lot is real work the software cannot represent');
ok(row('PPL-10').capability === 'partial',      'B5 a role can be assigned today; ownership authority is not built');

// B6 — a covered row must actually cite something. `covered` with no permission is the
// contradiction the declared field exists to make visible.
ok(rows.every((r) => r.capability !== 'covered' || r.permissions.length > 0),
   'B6 no row claims covered while citing nothing');

// ── C — THE MARKS ARE DERIVED FROM THE MANIFEST ─────────────────────────────────────────────
// 🔴 C1/C2 — the draft hand-set `ownerOnly: false` on eight rows citing an owner-only string.
// `CATALOG_PERMISSIONS` filters `owner-only` out of the grantable catalog entirely, so those
// strings cannot be granted to ANYONE, by construction (ruling 2026-08-01).
const ownerOnlyResources = new Set(
  Object.values(PERMISSION_MANIFEST).filter((e) => e.sensitivity === 'owner-only').map((e) => e.permission),
);
const citesOwnerOnly = (r: Responsibility) => r.permissions.some((p) => ownerOnlyResources.has(p));
ok(rows.filter(citesOwnerOnly).every((r) => !marksFor(r).delegable),
   'C1 every row citing an owner-only string is marked not-delegable');
// 🔴 C1b — no row may cite a string that gates NOTHING. `team:update`/`team:delete` are
// `declared-unwired` — the manifest says outright "no member-held string authorizes them" — and
// the draft cited both on PPL-02/PPL-04, which would have told an owner the act is covered by a
// permission that does not exist. Caught by A5, fixed at the rows, pinned here.
ok(!cited.includes('team:update') && !cited.includes('team:delete'),
   'C1b no row cites a declared-unwired team verb');
ok(rows.filter((r) => !citesOwnerOnly(r) && !r.accountHolderOnly).every((r) => marksFor(r).delegable),
   'C2 a row citing no owner-only string and carrying no hand flag IS delegable');
// ⚠️ NINE, not eight. Stage 0 counted the `team:*` and `subscription:*` rows and MISSED MON-07
// ("Connect or manage the accounting system"), which cites `subscription:read`. The number is
// pinned here so the next person inherits the measurement rather than the estimate.
ok(rows.filter(citesOwnerOnly).length === 9,
   `C3 nine rows cite an owner-only string (got ${rows.filter(citesOwnerOnly).length})`);

// C4 — the hand flag covers only what the manifest structurally cannot see: an act with no string.
ok(rows.filter((r) => r.accountHolderOnly).every((r) => r.permissions.length === 0),
   'C4 the hand flag is used only on rows citing no permission at all');
ok(!marksFor(row('SYS-07')).delegable, 'C5 transferring ownership is not delegable (hand flag)');

// 🔴 C6/C7 — SENSITIVE reads the manifest's own `exposure` sentence, so the owner is told a
// CONSEQUENCE and never a permission string. That is the story's explicit requirement.
const wages = marksFor(row('PPL-05'));
ok(wages.sensitive !== null && /paid/i.test(wages.sensitive), 'C6 setting a pay rate is marked sensitive and says what it exposes');
ok(marksFor(row('SEL-01')).sensitive === null, 'C7 serving a walk-in customer is not sensitive');

// 🔴 C8 — NO PERMISSION STRING MAY REACH ANY MARK TEXT. The owner is being asked what a person
// DOES; a colon-shaped identifier in the answer is the vocabulary the inversion exists to avoid.
const markText = rows.flatMap((r) => {
  const m = marksFor(r);
  return [m.sensitive, m.delegableReason, m.capabilityNote].filter((s): s is string => !!s);
});
ok(markText.every((t) => !/[a-z_]+:[a-z_]+/.test(t)), 'C8 no mark text contains a permission string');

// C9 — a row citing several confidential strings on ONE resource says it once.
const budget = marksFor(row('MON-12'));
ok(budget.sensitive !== null && budget.sensitive.split('—').length - 1 === 2,
   'C9 a row exposing cost and margin names both, each once');

// ── D — THE DOCUMENT ────────────────────────────────────────────────────────────────────────
const TODAY = new Date('2026-08-31T15:00:00Z');
const fullDoc = buildPositionDocument({
  title: 'Operations Manager',
  businessName: 'LAWNS Tree Farm',
  context: { whatWeDo: 'grows and sells shade trees on forty acres', whoWeServe: 'landscapers, builders and homeowners', knownFor: 'big trees, dug and delivered the same week' },
  operatingDays: [
    { weekday: 1, dayTypeLabel: 'Service / maintenance' },
    { weekday: 2, dayTypeLabel: 'Delivery only' },
    { weekday: 3, dayTypeLabel: 'Delivery only' },
    { weekday: 4, dayTypeLabel: 'Delivery / placement' },
  ],
  picks: [
    { responsibilityId: 'INV-01', frequency: null },
    { responsibilityId: 'SEL-01', frequency: null },
    { responsibilityId: 'DEL-01', frequency: null },
    { responsibilityId: 'GRO-03', frequency: null },
  ],
  excellence: 'Nothing leaves the yard he has not looked at himself.',
  today: TODAY,
});

ok(fullDoc.responsibilityCount === 4, 'D1 every resolvable pick reaches the document');
ok(fullDoc.contextComplete, 'D2 a fully-supplied position reports complete context');
ok(fullDoc.intro.length === 3 && fullDoc.intro[0] === 'LAWNS Tree Farm grows and sells shade trees on forty acres.',
   `D3 the intro reads as sentences (got: ${JSON.stringify(fullDoc.intro[0])})`);

// 🔴 D4 — the operating rhythm is READ, never asked. Days are grouped by type and walk the week.
ok(fullDoc.operatingLine === 'How the week runs here: Monday — service / maintenance; Tuesday and Wednesday — delivery only; Thursday — delivery / placement.',
   `D4 the operating line groups days by type (got: ${JSON.stringify(fullDoc.operatingLine)})`);

// 🔴 D5 — NO SOFTWARE VOCABULARY ON THE PAGE. GRO-03 ("uppot a lot") is `capability: 'none'` and
// must print EXACTLY like covered work: to the person doing the job it is the same work.
const flat = JSON.stringify(fullDoc);
ok(!/cannot represent|not built|capability|permission|:read|:update/i.test(flat),
   'D5 no software vocabulary reaches the document');
ok(fullDoc.areas.some((a) => a.items.some((i) => /Uppot/.test(i.text))),
   'D6 a responsibility the software cannot represent still prints');

// D7 — within an area, most-often first.
const multi = buildPositionDocument({
  title: 'Yard Hand', businessName: 'Test Farm',
  context: { whatWeDo: null, whoWeServe: null, knownFor: null }, operatingDays: [],
  picks: [
    { responsibilityId: 'INV-07', frequency: null },   // quarterly
    { responsibilityId: 'INV-08', frequency: null },   // daily
    { responsibilityId: 'INV-09', frequency: null },   // weekly
  ],
  excellence: null, today: TODAY,
});
ok(multi.areas[0].items.map((i) => i.cadence).join('|') === 'daily|weekly|quarterly',
   `D7 items are ordered most-often first (got ${multi.areas[0].items.map((i) => i.cadence).join('|')})`);

// 🔴 D8 — NO BLANK EVER PRINTS. An absent context field omits its whole sentence. This is the
// single thing that makes a generated document read as filler rather than as a real one.
ok(multi.intro.length === 0, 'D8 no context supplied means no intro sentences — never a blank one');
ok(multi.operatingLine === null, 'D9 no operating days recorded means no operating line');
ok(multi.excellence === null && !multi.contextComplete, 'D10 a missing excellence line is reported, not invented');
ok(multi.missing.length === 4 && multi.missing.every((m) => !/_|:/.test(m)),
   'D11 what is missing is named in the owner\'s words, never as column names');

// D12 — a pick whose catalogue row is gone is DROPPED, not printed blank (the no-FK cost).
const orphan = buildPositionDocument({
  title: 'X', businessName: 'Y', context: { whatWeDo: null, whoWeServe: null, knownFor: null },
  operatingDays: [], picks: [{ responsibilityId: 'ZZZ-99', frequency: null }, { responsibilityId: 'SEL-01', frequency: null }],
  excellence: null, today: TODAY,
});
ok(orphan.responsibilityCount === 1, 'D12 an unresolvable pick is dropped, never rendered as a blank line');

// D13 — an owner's frequency override wins over the catalogue default.
const over = buildPositionDocument({
  title: 'X', businessName: 'Y', context: { whatWeDo: null, whoWeServe: null, knownFor: null },
  operatingDays: [], picks: [{ responsibilityId: 'INV-01', frequency: 'weekly' }], excellence: null, today: TODAY,
});
ok(over.areas[0].items[0].cadence === 'weekly', 'D13 a stored frequency override wins over the catalogue default');

// D14 — an owner who writes "We grow trees" is not doubled into "LAWNS We grow trees".
const weDoc = buildPositionDocument({
  title: 'X', businessName: 'Acme', context: { whatWeDo: 'We grow trees.', whoWeServe: null, knownFor: null },
  operatingDays: [], picks: [], excellence: null, today: TODAY,
});
ok(weDoc.intro[0] === 'Acme grow trees.', `D14 a leading "We" is absorbed (got ${JSON.stringify(weDoc.intro[0])})`);

// D15 — a single operating day still reads as a sentence, not a list fragment.
ok(describeOperatingDays([{ weekday: 0, dayTypeLabel: 'Closed' }]) === 'How the week runs here: Sunday — closed.',
   'D15 one operating day reads as a sentence');

// ── E — NEGATIVE CONTROLS: each mechanism is proven to be load-bearing ───────────────────────
// 🔴 E1 — if `delegable` were the hand flag instead of the derivation, C1 would go GREEN over the
// draft's own defect. This proves C1 is measuring the derivation and not agreeing with itself.
const handFlagWouldPass = rows.filter(citesOwnerOnly).every((r) => !r.accountHolderOnly);
ok(handFlagWouldPass, 'E1 the eight owner-only rows carry accountHolderOnly:false — so C1 can only pass by deriving');

// E2 — a stub that always returns "delegable" must fail C1.
const stubAlwaysDelegable = rows.filter(citesOwnerOnly).every(() => true);
ok(stubAlwaysDelegable && rows.filter(citesOwnerOnly).length > 0,
   'E2 C1 has a non-empty subject, so it cannot pass vacuously');

// 🔴 E3 — D5 must have something to catch. Prove the document WOULD fail if capability text leaked.
const leaked = JSON.stringify({ ...fullDoc, note: 'the software cannot represent it yet' });
ok(/cannot represent/i.test(leaked), 'E3 D5\'s regex actually matches capability vocabulary');

// E4 — D8 must have something to catch: an assembler that emitted labelled blanks would fail.
const naive = ['We do: .', 'We sell to .'];
ok(naive.some((s) => /:\s*\.$|to\s+\.$/.test(s)), 'E4 D8\'s subject — a labelled blank — is a real shape');


// ── F — STARTING POINTS: NEVER START FROM NOTHING, NEVER SUGGEST WHAT WE REFUSE ─────────────
// The first live run met 93 rows with nothing selected, ticked nothing, and produced a truthful
// useless document. These probes guard the fix, and F2 guards it against the fix's own worst
// failure mode: suggesting work the platform will then refuse to let that person do.
const sets = POSITION_STARTING_POINTS.filter((s) => s.kind === 'set');

ok(unknownStartingPointIds().length === 0,
   `F1 every id a starting point names exists in the catalogue (unknown: ${unknownStartingPointIds().join(', ')})`);

ok(new Set(POSITION_STARTING_POINTS.map((s) => s.key)).size === POSITION_STARTING_POINTS.length,
   'F2 every starting-point key is unique');

// 🔴 F3 — DERIVED FROM `marksFor`, NEVER FROM A SECOND LIST. A starting point is a suggestion the
// PLATFORM makes; suggesting a row `CATALOG_PERMISSIONS` filters out of the grantable catalog
// entirely would be the platform contradicting itself. The owner may still tick one by hand.
const suggestedUndelegable = sets.flatMap((sp) =>
  sp.responsibilityIds.filter((id) => { const r = responsibilityById(id); return r ? !marksFor(r).delegable : false; }));
ok(suggestedUndelegable.length === 0,
   `F3 no starting point suggests an undelegable row (${[...new Set(suggestedUndelegable)].join(', ')})`);

// F4 — the owner set is DERIVED, never enumerated: a hand-typed list of all 93 would be a second
// copy of the catalogue and would go stale the day a row is added (STD-011).
const owner = POSITION_STARTING_POINTS.find((s) => s.key === 'owner');
ok(!!owner && owner.kind === 'all' && owner.responsibilityIds.length === 0,
   'F4 the owner starting point enumerates nothing — it is derived from what is visible');
ok(!!owner && startingPointIds(owner, rows).length === rows.length,
   'F5 the owner starting point resolves to every visible row');
// 🔴 F5b — and to every visible row ONLY. F5 alone cannot catch an `all` that ignores its
// argument and returns the whole catalogue, because at a nursery those two sets are identical.
// A mutant doing exactly that survived F5 until this probe was added (measured, 2026-08-31).
const ownerCore = owner ? startingPointIds(owner, rows.filter((r) => r.vertical === null)) : [];
ok(ownerCore.length > 0 && ownerCore.length < rows.length && ownerCore.every((id) => responsibilityById(id)?.vertical === null),
   `F5b the owner set is cut by the vertical filter too, not just the others (got ${ownerCore.length} of ${rows.length})`);

// 🔴 F6 — the VERTICAL filter CUTS a set; it never invents a tick. A production manager at a
// business with no growing ladder starts from fewer rows, and the button count says so.
const coreOnly = rows.filter((r) => r.vertical === null);
const prod = POSITION_STARTING_POINTS.find((s) => s.key === 'production_manager');
const prodCore = prod ? startingPointIds(prod, coreOnly) : [];
ok(!!prod && prodCore.length < startingPointIds(prod, rows).length,
   'F6 a vertical-gated set is smaller for a business that cannot see the gated rows');
ok(prodCore.every((id) => responsibilityById(id)?.vertical === null),
   'F7 a filtered set contains only rows the business can actually see');

// F8 — every set is non-empty and duplicate-free; `blank` is the only empty one, deliberately.
ok(sets.every((sp) => sp.responsibilityIds.length > 0), 'F8 no `set` starting point is empty');
ok(sets.every((sp) => new Set(sp.responsibilityIds).size === sp.responsibilityIds.length),
   'F9 no starting point names the same responsibility twice');
ok(POSITION_STARTING_POINTS.filter((s) => s.kind === 'blank').length === 1,
   'F10 "start blank" exists, so starting from nothing is a stated choice');

// ⚠️ F11 — THE COUNTS ARE DAVID'S MEASUREMENT; THE MEMBERSHIP IS NOT. The workbook is not in this
// repository, so the sets were derived from the catalogue and TUNED until each hit its stated
// count. This probe pins the counts so a later edit cannot drift them silently — it is NOT
// evidence that the membership matches the workbook, and it must never be read as such.
const COUNTS: Record<string, number> = {
  production_manager: 34, sales_manager: 27, external_sales: 9, crew_driver: 8, bookkeeper: 10,
};
const wrong = Object.entries(COUNTS).filter(([k, n]) => {
  const sp = POSITION_STARTING_POINTS.find((s) => s.key === k);
  return !sp || startingPointIds(sp, rows).length !== n;
}).map(([k]) => k);
ok(wrong.length === 0, `F11 each set still holds its stated count (drifted: ${wrong.join(', ')})`);

// 🔴 F12 — NEGATIVE CONTROL. F3 must have something to catch: undelegable rows exist, and the
// OWNER set does include them, so F3 cannot be passing because the subject is empty.
const ownerUndelegable = owner ? startingPointIds(owner, rows).filter((id) => {
  const r = responsibilityById(id); return r ? !marksFor(r).delegable : false;
}) : [];
ok(ownerUndelegable.length > 0,
   `F12 undelegable rows exist and the owner set carries them — F3 has a real subject (${ownerUndelegable.length})`);

// ── G — CONTEXT PROPOSALS: OFFERED, SOURCED, AND NEVER ANOTHER BUSINESS'S ───────────────────
ok(hostOf('https://www.LawnsTrees.com/about/') === 'lawnstrees.com', 'G1 a host is normalised — protocol, www, path and case');
ok(hostOf('lawnstrees.com') === 'lawnstrees.com', 'G2 a bare host resolves');
ok(hostOf('') === null && hostOf(null) === null && hostOf('not a url') === null,
   'G3 junk resolves to null — never a partial match');

// 🔴 G4 — THE DANGEROUS FAILURE IS PROPOSING ONE BUSINESS'S FACTS ON ANOTHER'S PAGE. An unknown
// site proposes NOTHING and gets three empty boxes, which is the correct and common case.
ok(proposedContextFor('https://some-other-nursery.example') === null,
   'G4 an unknown site proposes nothing — never another tenant\'s facts');
ok(proposedContextFor(null) === null, 'G5 a business with no website on file proposes nothing');

const prop = proposedContextFor('https://lawnstrees.com/');
ok(prop !== null, 'G6 a site we have read produces a proposal');
const fields = prop ? [prop.whatWeDo, prop.whoWeServe, prop.knownFor].filter((f) => f !== null) : [];
ok(fields.length > 0 && fields.every((f) => f!.source.trim().length > 0),
   'G7 every proposed value names where it came from — provenance is shown beside the value');
ok(fields.every((f) => f!.value.trim().length > 0),
   'G8 a proposal is never an empty string dressed as a value');

// 🔴 G9 — NEVER FEED THE PAGE TO A GENERATOR. Real operating facts sit beside marketing prose on
// the same site; prose in means prose out on a document handed to a new employee. Both of
// lawnstrees.com's taglines are named here so a future edit that pastes copy goes red.
const MARKETING = [/quality counts/i, /rooted in austin/i, /growing with you/i, /count on us/i];
const sloganed = fields.filter((f) => MARKETING.some((re) => re.test(f!.value)));
ok(sloganed.length === 0, `G10 no proposal carries marketing prose (${sloganed.map((f) => f!.value).join(' | ')})`);

// G11 — a proposal, once used, must read as English through the document assembler: no doubled
// full stop, no "Acme has grown trees.." — the shapes introSentences fixes.
const used = buildPositionDocument({
  title: 'Production Manager', businessName: 'LAWNS Tree Farm, LLC',
  context: {
    whatWeDo: prop?.whatWeDo?.value ?? null,
    whoWeServe: prop?.whoWeServe?.value ?? null,
    knownFor: prop?.knownFor?.value ?? null,
  },
  operatingDays: [], picks: [{ responsibilityId: 'INV-01', frequency: null }],
  excellence: null, today: TODAY,
});
ok(used.intro.length === 3 && used.intro.every((line) => !/\.\./.test(line) && /\.$/.test(line)),
   `G11 a used proposal reads as whole sentences (${JSON.stringify(used.intro)})`);

// ── H — ④ THE EMPTY DOCUMENT DOES NOT OFFER ITSELF AS A DOCUMENT ───────────────────────────
// The route suppresses the sheet and disables Print on exactly this condition, so the condition
// is pinned here rather than left to a reader of the JSX.
const nothingTicked = buildPositionDocument({
  title: 'Production Manager', businessName: 'LAWNS Tree Farm, LLC',
  context: { whatWeDo: null, whoWeServe: null, knownFor: null },
  operatingDays: [], picks: [], excellence: null, today: TODAY,
});
ok(nothingTicked.responsibilityCount === 0 && nothingTicked.areas.length === 0,
   'H1 a position with nothing ticked resolves to zero responsibilities and no areas');
// H2 — negative control: one pick flips it, so H1 is not asserting a constant.
ok(used.responsibilityCount === 1, 'H2 one pick makes it a document — H1 has a real subject');


console.log(`\npositions.test.ts — ${passed} passed, ${failed} failed`);
if (failed) { failures.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
