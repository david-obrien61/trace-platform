// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the roster files a customer where a contacts app would (David's ruling,
//   2026-09-22) — surname where one exists, the name itself for a business, the LAST WORD for a
//   person the import recorded as one string, and the filing token visible in bold.
// DEPENDENCIES: personName (pure) + alphaIndex (pure).
// OUTPUTS: assertions only.
//
// 🔴 EVERY FIXTURE BELOW IS A REAL LAWNS ROW, READ LIVE 2026-09-22, SHAPE AND ALL. The rule was
// reversed once already because it was reasoned about instead of measured; these are the rows it
// has to survive, including the ones whose `customer_type` is simply wrong.
// ─────────────────────────────────────────────────────────────────────────────
import { customerFilingName, customerFilingParts, customerFilingSortKey } from './personName';
import { alphaKeyFor } from './alphaIndex';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };
const key = (c: Parameters<typeof customerFilingName>[0]) => alphaKeyFor(customerFilingName(c));

// 🔴 THE GRID'S OWN COMPARATOR, NOT `localeCompare`. DataSheet sorts with `va < vb ? -1 : ...`,
// plain code-unit order. My first pass compared with `localeCompare` and it disagreed with the
// real thing — ICU treats the NUL separator as IGNORABLE, so "ray\0molly" was compared as
// "raymolly" and Rayburn sorted first. A probe that models a comparator the product does not use
// proves nothing about the product (§6 r19: a double must behave like the real system).
const gridCmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ── §A · RULE 1 — a surname wins wherever it is present, whatever the type says ──────────────
ok(customerFilingName({ first_name: 'Aaron', last_name: 'Harlan', customer_type: 'person' }) === 'Harlan',
   'A1 a person with a surname files under it');
ok(key({ first_name: 'Aaron', last_name: 'Harlan', customer_type: 'person' }) === 'H',
   'A2 …so Aaron Harlan is under H, not A');
ok(customerFilingName({ first_name: 'Aaron', last_name: 'Hunt', customer_type: 'organization' }) === 'Hunt',
   '🔴 A3 A SURNAME IS TRUSTED OVER `customer_type` — "Aaron Hunt" is stored as an ORGANIZATION on LAWNS; the type column is wrong on ~466 of 522 such rows, and the surname is the better evidence');

// ── §B · 🔴 RULE 4 — DAVID'S WORKED EXAMPLE, AND ITS REAL STORED SHAPE ───────────────────────
// Measured live: organization_name = 'Jim & Virginia Patskowski', first_name NULL, last_name NULL.
// A first-word rule files it under J; the type column calls it a company. It must be P.
{
  const row = { customer_type: 'organization', organization_name: 'Jim & Virginia Patskowski', display_name: 'Jim & Virginia Patskowski', first_name: null, last_name: null };
  ok(customerFilingName(row) === 'Patskowski', `B1 🔴 DAVID'S EXAMPLE: "Jim & Virginia Patskowski" files under Patskowski (${customerFilingName(row)})`);
  ok(key(row) === 'P', 'B2 🔴 …which puts it under P — the outcome he named');
  const p = customerFilingParts(row, '');
  ok(p.before === 'Jim & Virginia ' && p.filing === 'Patskowski' && p.after === '',
     `B3 🔴 AND THE ROW SHOWS WHY: the surname is the bold run, so a reader finding it under P can see the reason (before="${p.before}" bold="${p.filing}")`);
}
ok(key({ customer_type: 'organization', organization_name: 'Barb & Mark Gleinser' }) === 'G',
   'B4 a couple recorded as one string files under the shared surname — G, not B');
ok(key({ customer_type: 'organization', organization_name: 'Tony Matson' }) === 'M',
   'B5 a person typed as a company still files under their surname');

// ── §C · RULE 3 — a business files under its own name ────────────────────────────────────────
ok(key({ customer_type: 'organization', organization_name: 'A.J. Landscaping' }) === 'A',
   'C1 a business files under its own first letter, not its last word');
ok(key({ customer_type: 'organization', organization_name: 'ABC Home and Pest Services' }) === 'A', 'C2 …including a long one');
ok(key({ customer_type: 'organization', organization_name: 'City of Lakeway' }) === 'C',
   'C3 a municipality is a business, not a person called Lakeway');
ok(key({ customer_type: 'organization', organization_name: 'Aarons Lawn Service' }) === 'A', 'C4 …and a lawn service');

// ── §D · RULE 2 — a leading article is ignored, and still shown ──────────────────────────────
{
  const row = { customer_type: 'organization', organization_name: 'The Tree Place' };
  ok(customerFilingName(row) === 'Tree Place', 'D1 "The Tree Place" files under Tree Place');
  ok(key(row) === 'T', 'D2 …so it sits under T');
  const p = customerFilingParts(row, '');
  ok(p.before === 'The ' && p.filing === 'Tree Place',
     '🔴 D3 THE ARTICLE IS STILL SHOWN, JUST NOT COUNTED — "The" renders before the bold run rather than disappearing from the row');
}
ok(key({ customer_type: 'organization', organization_name: 'The Grass Patch Inc.' }) === 'G', 'D4 a real LAWNS row: The Grass Patch Inc. under G');
ok(customerFilingName({ customer_type: 'organization', organization_name: 'The' }) === 'The',
   'D5 stripping that would leave nothing does not strip — "The" alone still files under T');

// ── §E · one-name people, and the nothing-known case ─────────────────────────────────────────
ok(key({ first_name: 'Aaron', customer_type: 'person' }) === 'A', 'E1 a one-name person files under that name — 39 LAWNS rows');
ok(customerFilingName({ first_name: null, last_name: null, customer_type: 'person' }) === '', 'E2 nothing known answers empty');
ok(key({ first_name: null, last_name: null, customer_type: 'person' }) === '#',
   '🔴 E3 …and an unnamed record gets a REAL bucket rather than vanishing from every letter (D-9)');
ok(customerFilingName(null) === '' && customerFilingName(undefined) === '', 'E4 a missing record does not throw');

// ── §F · the bold run refuses to guess ───────────────────────────────────────────────────────
{
  // A REACHABLE mixed row: an organization that also carries a surname. It DISPLAYS as the company
  // ("Acme Landscaping") and FILES under the surname, so the filing token is genuinely absent from
  // what the row shows. My first fixture for this could not happen — the filing name is normally
  // derived from the displayed name, so it is always findable; that probe passed for the wrong
  // reason until I made the case real.
  const p = customerFilingParts({ customer_type: 'organization', organization_name: 'Acme Landscaping', last_name: 'Okonsky' }, '');
  ok(p.filing === '' && p.before === 'Acme Landscaping',
     `🔴 F1 WHEN THE FILING TOKEN IS NOT IN THE DISPLAYED NAME, NOTHING IS BOLDED — a bold run on the wrong word asserts a reason that is not the real one, which is worse than no bold at all (got before="${p.before}" bold="${p.filing}")`);
}

// ── §G · the sort key orders the list the way the sections group it ──────────────────────────
{
  const rows = [
    { first_name: 'Molly', last_name: 'Ray' },
    { first_name: 'Aaron', last_name: 'Rayburn' },
    { first_name: 'Zoe', last_name: 'Ray' },
  ];
  const sorted = [...rows].sort((a, b) => gridCmp(customerFilingSortKey(a), customerFilingSortKey(b)));
  ok(sorted[0].last_name === 'Ray' && sorted[1].last_name === 'Ray' && sorted[2].last_name === 'Rayburn',
     '🔴 G1 A SHORT SURNAME NEVER SORTS INTO THE MIDDLE OF A LONGER ONE — both Rays come before Rayburn, which is what the NUL separator buys');
  ok(sorted[0].first_name === 'Molly' && sorted[1].first_name === 'Zoe',
     'G2 …and within one surname the order is the displayed name, so it is stable between renders rather than whatever the sort happened to do');
}
ok(customerFilingSortKey({ first_name: 'Aaron', last_name: 'Harlan' }).startsWith('harlan'),
   'G3 the sort key leads with the filing token, so the list order and the section headings cannot disagree');

// 🔴 G4 — THE DEFECT THIS PROBE EXISTS TO HAVE CAUGHT. An accented surname must sort INSIDE its
// own letter. Unfolded, code-unit order puts every accented character above 'z', so the row lands
// after every Z name and the grid emits a second heading for its letter at the bottom of the list.
{
  const nunez = customerFilingSortKey({ first_name: 'Ana', last_name: 'Ñuñez' });
  const zeta  = customerFilingSortKey({ first_name: 'Zoe', last_name: 'Zimmer' });
  ok(gridCmp(nunez, zeta) === -1,
     `🔴 G4 "Ñuñez" SORTS BEFORE "Zimmer" UNDER THE GRID'S OWN COMPARATOR — unfolded it sorts after every Z while its section says N, which renders a SECOND N heading at the end of the roster`);
  ok(alphaKeyFor(customerFilingName({ first_name: 'Ana', last_name: 'Ñuñez' })) === 'N',
     'G5 …and its section is N, so the heading and the position now agree — one fold, both callers');
}

// ── §H · 🔴 NEGATIVE CONTROL — the reversed rule would fail these ────────────────────────────
ok(key({ first_name: 'Aaron', last_name: 'Harlan' }) !== 'A',
   '🔴 H1 THE FIRST-NAME RULE IS GONE: this assertion is the one the earlier build would have failed, and it fails again the moment someone files people under their first name');
ok(key({ customer_type: 'organization', organization_name: 'Jim & Virginia Patskowski' }) !== 'J',
   '🔴 H2 …and a first-WORD rule, which is what a naive organization branch does, files David\'s example under J');

console.log(`\ncustomerFiling — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
