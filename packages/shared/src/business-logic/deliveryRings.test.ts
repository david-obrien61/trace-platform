// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the rings — above all that "outside every ring" produces NO price, and that an
//   address with no coordinate is not reported as outside (they are different problems).
// DEPENDENCIES: deliveryRings (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { distanceMiles, ringFor, orderedRings, impliedMiles, proposeRingsFromCharges, resolveServiceArea, tripChargeFor } from './deliveryRings';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

// The LAWNS yard and a real Georgetown delivery street, both measured 2026-09-24.
const DEPOT = { latitude: 30.5719542, longitude: -97.9188683 };   // 400 Honey Comb Mesa, Leander
const GEORGETOWN = { latitude: 30.6551, longitude: -97.7267 };    // 153 Twin Creekview Ln
const RINGS = [
  { outer_radius_miles: 7, charge: 50, active: true },
  { outer_radius_miles: 14, charge: 100, active: true },
  { outer_radius_miles: 21, charge: 150, active: true },
];

// ── §A · distance ───────────────────────────────────────────────────────────────────────────
{
  const d = distanceMiles(DEPOT, GEORGETOWN);
  ok(d !== null && d > 12 && d < 14,
     `A1 Leander→Georgetown is about 13 straight-line miles (got ${d?.toFixed(2)})`);
  ok(distanceMiles(DEPOT, DEPOT) === 0, 'A2 the depot is zero miles from itself');
}
ok(distanceMiles(DEPOT, null) === null,
   '🔴 A3 NO COORDINATE RETURNS null, NOT 0 — "at the depot" and "we have no idea" must never be the same value, and 0 would put every unlocated address inside the cheapest ring');
ok(distanceMiles(DEPOT, { latitude: NaN, longitude: 0 }) === null, 'A4 a NaN coordinate is not a location');

// ── §B · 🔴 BEYOND THE LAST RING: SHOW, DON'T PRICE ─────────────────────────────────────────
{
  const v = ringFor(DEPOT, { latitude: 31.9, longitude: -97.9 }, RINGS);   // ~92 miles north
  ok(v.ring === null,
     '🔴 B1 AN ADDRESS BEYOND EVERY RING GETS NO RING — there is deliberately no "everywhere else" charge, because inventing a number for a place the owner never priced would read as a quote');
  ok(v.miles !== null && /outside your delivery rings/.test(v.message),
     'B2 …and it says so, with the distance, so the owner can decide');
  ok(!/\$/.test(v.message), 'B3 …and names no money at all');
}
{
  const v = ringFor(DEPOT, null, RINGS);
  ok(v.ring === null && v.miles === null,
     'B4 an address with no coordinate gets no ring either');
  ok(/don't know where this address is/.test(v.message) && !/outside/.test(v.message),
     "🔴 B5 …BUT IT IS A DIFFERENT SENTENCE. 'Outside your rings' sends the owner to set a charge; 'we don't know where this is' sends them to check the address. Collapsing the two sends someone hunting for a ring when the real problem is a typo");
}

// ── §C · the bands are derived from the order ───────────────────────────────────────────────
{
  const v = ringFor(DEPOT, GEORGETOWN, RINGS);
  ok(v.ring?.outer_radius_miles === 14,
     'C1 13 miles falls in the 14-mile ring, not the 7 and not the 21 — the SMALLEST ring that contains it wins');
  ok(v.ring?.charge === 100, 'C2 …and it carries that ring\'s charge');
}
{
  // Shuffled input must give the same answer — the bands come from ordering, never from row order.
  const shuffled = [RINGS[2], RINGS[0], RINGS[1]];
  ok(ringFor(DEPOT, GEORGETOWN, shuffled).ring?.outer_radius_miles === 14,
     '🔴 C3 ROW ORDER CANNOT CHANGE THE ANSWER — the same rings in a different order give the same ring. A lookup that walked the array as given would price by whatever the database returned first');
}
{
  const withRetired = [...RINGS, { outer_radius_miles: 1, charge: 0, active: false }];
  ok(ringFor(DEPOT, { latitude: 30.575, longitude: -97.92 }, withRetired).ring?.outer_radius_miles === 7,
     'C4 a retired ring is not used — an address half a mile out takes the 7-mile ring, not the inactive 1-mile one');
  ok(orderedRings(withRetired).length === 3, 'C5 …and it is not in the list at all');
}
{
  const exact = ringFor(DEPOT, DEPOT, [{ outer_radius_miles: 7, charge: 50, active: true }]);
  ok(exact.ring !== null, 'C6 the depot itself is inside the first ring');
}

// ── §D · ⚠️ THE LOADED MILE IS AN OPEN QUESTION — both readings are carried, neither defaulted ─
{
  ok(impliedMiles(50, 3.5, 'round-trip') === 50 / 3.5 / 2, 'D1 $50 at $3.50 round-trip is ~7.1 miles out');
  ok(impliedMiles(50, 3.5, 'one-way') === 50 / 3.5, 'D2 …and ~14.3 miles read as one-way');
  ok(impliedMiles(50, 3.5, 'one-way') !== impliedMiles(50, 3.5, 'round-trip'),
     "🔴 D3 THE TWO READINGS GIVE DIFFERENT ANSWERS, WHICH IS WHY NOTHING HERE PICKS ONE. docs/RULINGS.md carries 'the definition of a loaded mile' in David's OWED queue; defaulting it in code would answer his question for him, which step 10 forbids by name");
  ok(impliedMiles(50, 0, 'one-way') === null, 'D4 a zero rate implies nothing — no division by zero dressed as a radius');
}

// ── §E · a proposal is not a decision ───────────────────────────────────────────────────────
{
  // The real shape, measured 2026-09-24: 403 of 566 trip-charge lines are $50.
  const obs = [
    ...Array(403).fill({ charge: 50 }),
    ...Array(60).fill({ charge: 100 }),
    ...Array(20).fill({ charge: 150 }),
    { charge: 87.31 },                    // one odd invoice
  ];
  const p = proposeRingsFromCharges(obs, 3.5, 'round-trip');
  ok(p.length === 3,
     'E1 three rings are proposed from the three charges that recur — one odd invoice is not a delivery area');
  ok(p.every(r => !obs.some(o => o.charge === 87.31 && r.charge === 87.31)),
     'E2 …and the one-off is not among them');
  ok(p[0].outer_radius_miles === 7.1 && p[0].charge === 50,
     `E3 the $50 ring lands at ~7.1 miles (got ${p[0]?.outer_radius_miles})`);
  ok(p.every(r => /seeded from \d+ invoice/.test(r.origin_note)),
     '🔴 E4 EVERY PROPOSAL SAYS WHERE IT CAME FROM — "seeded from 403 invoices" is what keeps a proposal and a decision from looking alike on the screen');
  ok(p.every(r => /not a measured distance/.test(r.origin_note)),
     '🔴 E5 …AND ADMITS IT IS ARITHMETIC, NOT HISTORY. These radii are derived from what was CHARGED, which assumes the rate held. Until the bulk geocode supplies real distances, presenting this as measured history would be the exact dressing-up this build exists to prevent');
  ok(p[0].outer_radius_miles < p[1].outer_radius_miles && p[1].outer_radius_miles < p[2].outer_radius_miles,
     'E6 proposals come back smallest-first, ready to read as bands');
}
{
  ok(proposeRingsFromCharges([], 3.5, 'round-trip').length === 0,
     'E7 no history proposes nothing — an empty seed is a fine answer, and the table ships empty on purpose');
  ok(proposeRingsFromCharges([{ charge: 0 }, { charge: -5 }], 3.5, 'round-trip').length === 0,
     'E8 a zero or negative charge is not a ring');
}

// ── §F · negative control — the verdict must depend on the DISTANCE ─────────────────────────
{
  const near = ringFor(DEPOT, { latitude: 30.58, longitude: -97.92 }, RINGS);
  const far = ringFor(DEPOT, { latitude: 32.5, longitude: -97.92 }, RINGS);
  ok(near.ring?.outer_radius_miles === 7 && far.ring === null,
     '🔴 F1 NEGATIVE CONTROL: two addresses differing ONLY in how far away they are get opposite verdicts. An implementation that returned the first ring regardless — the obvious wrong one — would pass B1 by accident and price every far delivery at the near rate');
}

// ── §G · THE SERVICE AREA — what a DELIVERY field may offer ─────────────────────────────────
{
  const a = resolveServiceArea({ rings: RINGS, marginMiles: 5 });
  ok(a.source === 'ring' && a.radiusMiles === 26,
     'G1 the OUTER ring wins — 21 miles plus a 5-mile margin. The owner said where they deliver; nothing beats that');
  ok(/21-mile/.test(a.note), 'G2 …and the note says where the number came from');
}
{
  const a = resolveServiceArea({ rings: [], deliveredMiles: [4, 18.2, 9], marginMiles: 5 });
  ok(a.source === 'seeded' && a.radiusMiles === 23.2,
     'G3 with no rings it seeds from the FARTHEST real delivery plus the margin');
  ok(/seeded from 3 past deliveries/.test(a.note),
     '🔴 G4 …AND SAYS IT IS SEEDED. A proposal that reads like a decision is the thing the ring migration was rewritten to avoid');
}
{
  const a = resolveServiceArea({ rings: [], deliveredMiles: [], marginMiles: 5 });
  ok(a.radiusMiles === null && a.source === 'none',
     "🔴 G5 NO RINGS AND NO LOCATED HISTORY MEANS NO BOUNDARY — measured 2026-09-24, LAWNS has 0 of 66 stops and 0 of 1,497 addresses with a coordinate, so this is TODAY'S real state. Inventing a radius here would silently refuse real customers, which is worse than ranking badly and much harder to notice");
  ok(/not limited/.test(a.note), 'G6 …and the screen is told, because a field that quietly stops restricting looks like one that is');
}
{
  const tight = resolveServiceArea({ rings: [], deliveredMiles: [18.2], marginMiles: 0 });
  const loose = resolveServiceArea({ rings: [], deliveredMiles: [18.2], marginMiles: 5 });
  ok(tight.radiusMiles === 18.2 && loose.radiusMiles === 23.2,
     '🔴 G7 THE MARGIN IS THE CALLER\'S, not a constant. A boundary drawn exactly at the farthest past delivery refuses the next customer one street beyond it — and the first person living further out than anyone so far is a SALE, not an error');
}
{
  // NEGATIVE CONTROL — the source must depend on the DATA, not on which branch runs first.
  const ring = resolveServiceArea({ rings: RINGS, deliveredMiles: [99], marginMiles: 5 });
  const seed = resolveServiceArea({ rings: [], deliveredMiles: [99], marginMiles: 5 });
  ok(ring.source === 'ring' && seed.source === 'seeded' && ring.radiusMiles !== seed.radiusMiles,
     '🔴 G8 NEGATIVE CONTROL: the same history with and without rings resolves differently. An implementation that always seeded, or always used the ring, would pass half of these by accident');
}

// ── §H · THE TRIP CHARGE — three outcomes that must never collapse into two ─────────────────
const NEAR = { latitude: 30.58, longitude: -97.92 };
const FAR  = { latitude: 31.9,  longitude: -97.9  };
{
  const c = tripChargeFor({ depot: DEPOT, address: NEAR, rings: RINGS, flatAmount: 40, located: true });
  ok(c.amount === 50 && c.source === 'ring', 'H1 inside a ring, the ring is charged — not the flat rate');
}
{
  const c = tripChargeFor({ depot: DEPOT, address: FAR, rings: RINGS, flatAmount: 40, located: true });
  ok(c.amount === null && c.source === 'outside-rings',
     '🔴 H2 BEYOND THE LAST RING IS NOT PRICED — the owner has not priced that distance, and inventing a number would read as a quote');
  ok(/set a charge/.test(c.why) && !/\$/.test(c.why), 'H3 …it asks for a charge and names no money');
}
{
  const c = tripChargeFor({ depot: DEPOT, address: FAR, rings: [], flatAmount: 40, located: true });
  ok(c.amount === 40 && c.source === 'flat-no-rings',
     "🔴 H4 NO RINGS IS NOT 'OUTSIDE THE RINGS', AND THIS IS THE ONE THAT PROTECTS TODAY'S MONEY. To a tenant with no rings configured, EVERY address is outside them — collapsing these two would strip the delivery charge from every order the day this ships, before a single ring exists");
}
{
  const c = tripChargeFor({ depot: DEPOT, address: null, rings: RINGS, flatAmount: 40, located: false });
  ok(c.amount === null && c.source === 'unlocated', 'H5 an unplaceable address is never priced (2026-09-18)');
  ok(/Saved and flagged/.test(c.why), 'H6 …but it is saved, and says so');
}
{
  const c = tripChargeFor({ depot: DEPOT, address: null, rings: [], flatAmount: 40, located: false });
  ok(c.amount === 40,
     '🔴 H7 …UNLESS THERE ARE NO RINGS. A tenant billing a flat rate never needed a location to do it, so an unplaceable address must not strip a charge that has nothing to do with distance');
}
{
  const a = tripChargeFor({ depot: DEPOT, address: NEAR, rings: RINGS, flatAmount: 40, located: true });
  const b = tripChargeFor({ depot: DEPOT, address: FAR,  rings: RINGS, flatAmount: 40, located: true });
  ok(a.amount === 50 && b.amount === null,
     '🔴 H8 NEGATIVE CONTROL: the same rings and the same flat rate, differing only in WHERE the address is, produce different money. An implementation returning the flat amount regardless would pass H1 by accident');
}

// ── §J · WHICH RING, AND THE CHIP THE CHARGE LINE SHOWS ─────────────────────────────────────
// David's card: a located Hutto address on Trip Charge reads "ring 4 — 30.x mi" beside $250.
// LAWNS's seeded rings — radius = charge ÷ $3.50 ÷ 2 (round trip), `20260925d`.
const FOUR = [
  { outer_radius_miles: 7.1,  charge: 50,  active: true },
  { outer_radius_miles: 14.3, charge: 100, active: true },
  { outer_radius_miles: 21.4, charge: 150, active: true },
  { outer_radius_miles: 35.7, charge: 250, active: true },
];
// Hutto TX from the Leander yard. ⚠️ **22.3 STRAIGHT-LINE MILES, MEASURED HERE, NOT 30.** This
// fixture was first written asserting ring 3 on a guess of ~19 miles and the arithmetic refused
// it; the guess was corrected to the measurement rather than the other way round.
// 🔴 AND IT SETTLES SOMETHING ABOUT DAVID'S OWN CARD, which reads *"$250 (ring 4) with 'ring 4 —
// 30.x mi'"*: the RING and the MONEY are exactly right, and the DISTANCE is not what this screen
// can show. 30-odd miles is the ROAD — what a truck drives, round the lake and down the county
// road. We measure the crow's flight, which is 22.3, and the file header forbids presenting one
// as the other. So the chip will read "ring 4 — 22.3 mi" and the card's mileage needs amending,
// or road distance needs to become a decision (a different API, and David's to take).
const HUTTO = { latitude: 30.5427, longitude: -97.5464 };
{
  const v = ringFor(DEPOT, HUTTO, FOUR);
  ok(v.ordinal === 4 && v.ring?.charge === 250,
     `J1 the ordinal counts from the yard — Hutto lands in ring 4 of four, at $250 (got ring ${v.ordinal}, ${v.miles?.toFixed(1)} mi)`);
}
{
  // 🔴 THE ORDINAL IS A POSITION, NOT AN IDENTITY. Retire the innermost ring and the SAME
  // address is one ring lower — which is why nothing stores this number.
  const withoutInner = FOUR.slice(1);
  const v = ringFor(DEPOT, HUTTO, withoutInner);
  ok(v.ordinal === 3 && v.ring?.charge === 250,
     `🔴 J2 THE SAME ADDRESS AND THE SAME RING, ONE FEWER RING INSIDE IT: ring 4 becomes ring 3, and the CHARGE does not move. A stored ordinal would have survived the edit that invalidated it (got ${v.ordinal})`);
}
{
  const v = ringFor(DEPOT, { latitude: 31.9, longitude: -97.9 }, FOUR);
  ok(v.ordinal === null && v.ring === null,
     'J3 beyond the last ring there is no ordinal — a number here would name a ring that does not exist');
}
{
  const v = ringFor(DEPOT, null, FOUR);
  ok(v.ordinal === null && v.miles === null, 'J4 no coordinate, no ordinal and no distance');
}
{
  const c = tripChargeFor({ depot: DEPOT, address: HUTTO, rings: FOUR, flatAmount: 50, located: true });
  ok(c.label !== null && /^ring 4 — \d+\.\d mi$/.test(c.label!),
     `🔴 J5 THE CHIP IS THE SHAPE DAVID ASKED FOR — "ring N — NN.N mi" (got ${JSON.stringify(c.label)})`);
  ok(/straight-line/.test(c.why),
     '🔴 J6 …AND THE SENTENCE UNDER IT SAYS STRAIGHT-LINE. The chip has no room for the word; dropping it from BOTH would be the promise this file forbids');
}
{
  // Both renderings come from ONE verdict, so they cannot disagree about which ring it is.
  const c = tripChargeFor({ depot: DEPOT, address: HUTTO, rings: FOUR, flatAmount: 50, located: true });
  const v = ringFor(DEPOT, HUTTO, FOUR);
  ok(c.label === `ring ${v.ordinal} — ${v.miles?.toFixed(1)} mi` && c.amount === v.ring?.charge,
     'J7 the chip, the distance and the money all come from the same verdict');
}
{
  // NEGATIVE CONTROL — every non-ring outcome has NO chip. A label built unconditionally would
  // put "ring null — NaN mi" under a suppressed charge.
  const outside = tripChargeFor({ depot: DEPOT, address: { latitude: 31.9, longitude: -97.9 }, rings: FOUR, flatAmount: 50, located: true });
  const nolocate = tripChargeFor({ depot: DEPOT, address: null, rings: FOUR, flatAmount: 50, located: false });
  const norings = tripChargeFor({ depot: DEPOT, address: HUTTO, rings: [], flatAmount: 50, located: true });
  ok(outside.label === null && nolocate.label === null && norings.label === null,
     '🔴 J8 NEGATIVE CONTROL: outside-rings, unlocated and flat-no-rings carry NO chip — only a real ring names one');
}

console.log(`\ndeliveryRings — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
