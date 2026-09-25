// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the day plan — one crew until the limit, a stop with no location shown not
//   guessed, and every figure taken apart so Lauren can check it.
// DEPENDENCIES: planTheDay (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { planTheDay, plantingMinutes, type DayStop } from './planTheDay';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const DEPOT = { latitude: 30.5719542, longitude: -97.9188683 };   // the LAWNS yard, located
const at = (id: string, lat: number, lng: number, trees: number, gallons: number): DayStop =>
  ({ id, name: id, latitude: lat, longitude: lng, trees, gallons });
// A fixed drive estimator so the probes test the SPLIT, not the geometry.
const flat = (_d: any, s: readonly DayStop[]) => s.length * 12;
const BASE = { depot: DEPOT, minutesPerGallon: 1, dayLimitHours: 7, driveMinutes: flat };

// ── §A · planting time is trees × gallons × minutes, and the rate is the tenant's ────────────
ok(plantingMinutes({ id: 'x', trees: 3, gallons: 90 }, 1) === 90, 'A1 90 gallons at 1 min/gal is 90 minutes');
ok(plantingMinutes({ id: 'x', trees: 3, gallons: 90 }, 2) === 180,
   '🔴 A2 THE RATE IS AN ARGUMENT, NOT A CONSTANT. LAWNS plant a gallon a minute; the next nursery will not, and 1 written into the file would be the hardcoded tenant literal §6 r12 caps a tile amber for');
ok(plantingMinutes({ id: 'x', trees: 0, gallons: 0 }, 1) === 0, 'A3 nothing to plant is no time');

// ── §B · 🔴 ONE CREW UNTIL THE DAY EXCEEDS THE LIMIT ────────────────────────────────────────
{
  const day = planTheDay({ ...BASE, stops: [at('a',30.6,-97.9,2,30), at('b',30.62,-97.88,2,30)] });
  ok(day.crews.length === 1,
     '🔴 B1 A SHORT DAY GETS ONE CREW. Not "two because there are two" — a second crew on a day one can finish is a wage spent for nothing, and Lauren has to justify it');
  ok(/One crew can do this day/.test(day.message), 'B2 …and it says so plainly');
}
{
  // Six big stops: 6×12 drive + 6×300 planting = 1872 min, far over 7h (420).
  const stops = ['a','b','c','d','e','f'].map((id, i) => at(id, 30.55 + i * 0.03, -97.95 + i * 0.04, 5, 300));
  const day = planTheDay({ ...BASE, stops });
  ok(day.crews.length === 2, 'B3 a day over the limit is proposed as two crews');
  ok(day.crews[0].stops + day.crews[1].stops === 6,
     '🔴 B4 EVERY STOP IS IN EXACTLY ONE CREW — none dropped, none planned twice');
  const gap = Math.abs(day.crews[0].totalMinutes - day.crews[1].totalMinutes);
  ok(gap <= day.crews[0].totalMinutes * 0.5, `B5 the two crews are balanced, not split 5-and-1 (gap ${gap}m)`);
}
{
  const stops = ['a','b','c','d','e','f'].map((id, i) => at(id, 30.55 + i * 0.03, -97.95 + i * 0.04, 5, 300));
  const day = planTheDay({ ...BASE, stops, maxCrews: 1 });
  ok(day.crews.length === 1 && day.crews[0].overLimit,
     '🔴 B6 WITH ONLY ONE CREW AVAILABLE THE OVERRUN IS SHOWN, NOT HIDDEN. A plan that quietly fits an impossible day into the hours available is the guess this whole build refuses');
  ok(/over the day limit/.test(day.message), 'B7 …and the sentence says to move stops or add a day');
}

// ── §C · 🔴 A STOP WITH NO LOCATION IS SHOWN, NEVER GUESSED (David 2026-09-18) ───────────────
{
  const day = planTheDay({ ...BASE, stops: [
    at('a',30.6,-97.9,2,30), { id: 'nowhere', name: '101 Crupp', trees: 2, gallons: 30 },
  ]});
  ok(day.unplaceable.length === 1 && day.unplaceable[0].id === 'nowhere',
     'C1 an unlocated stop is returned separately');
  ok(!day.crews.some(c => c.stopIds.includes('nowhere')),
     "🔴 C2 …AND IS IN NOBODY'S ROUTE. Quietly planning the placeable subset would hand Lauren a confident total for a day that has more work in it than the screen admits");
  ok(/can't be placed yet/.test(day.message), 'C3 …and the count is on the screen, in words');
}
{
  const day = planTheDay({ ...BASE, stops: [{ id: 'x', trees: 1, gallons: 10 }] });
  ok(day.crews.length === 0 && /can't be placed/.test(day.message),
     'C4 a day of only unplaceable stops plans nothing and says why — it does not render an empty, confident plan');
}
{
  const day = planTheDay({ ...BASE, depot: null, stops: [at('a',30.6,-97.9,2,30)] });
  ok(day.crews.length === 0 && /own address has no location/.test(day.message),
     '🔴 C5 NO DEPOT, NO PLAN. Everything here is measured FROM the yard; without it the honest answer names the missing fact rather than drawing a plan around a hole');
}

// ── §D · every figure shows its working (David 2026-09-24) ──────────────────────────────────
{
  const day = planTheDay({ ...BASE, stops: [at('a',30.6,-97.9,2,60), at('b',30.62,-97.88,3,90)] });
  const c = day.crews[0];
  ok(c.driveMinutes + c.plantingMinutes === c.totalMinutes,
     '🔴 D1 THE TOTAL IS ITS PARTS — drive plus planting, both carried separately. A single number Lauren cannot take apart is a number she will not trust, and she is right');
  ok(c.plantingMinutes === 150, 'D2 planting is 150 minutes: 60 + 90 gallons at one a minute');
  ok(c.trees === 5 && c.stops === 2, 'D3 …and the stop and tree counts travel with it');
  ok(/driving/.test(day.message) && /planting/.test(day.message), 'D4 the sentence names both halves');
}
{
  const est = planTheDay({ depot: DEPOT, minutesPerGallon: 1, dayLimitHours: 7,
    stops: [at('a',30.6,-97.9,2,60)] });
  ok(est.driveBasis === 'straight-line estimate' && /estimated/.test(est.message),
     "🔴 D5 A GUESSED DRIVE TIME SAYS IT IS GUESSED. With no optimiser passed the fallback is a crow's-flight estimate, and a truck never drives that — labelling it is the difference between a figure and a claim");
  const real = planTheDay({ ...BASE, stops: [at('a',30.6,-97.9,2,60)] });
  ok(real.driveBasis === 'optimiser' && !/estimated/.test(real.message),
     'D6 …and a real figure is not labelled as an estimate');
}

// ── §E · negative control ────────────────────────────────────────────────────────────────────
{
  const small = planTheDay({ ...BASE, stops: [at('a',30.6,-97.9,1,10)] });
  const big = planTheDay({ ...BASE, stops: ['a','b','c','d','e','f'].map((id,i)=>at(id,30.55+i*0.03,-97.95+i*0.04,5,300)) });
  ok(small.crews.length === 1 && big.crews.length === 2,
     '🔴 E1 NEGATIVE CONTROL: the crew count depends on the WORK, not on how many crews exist. An implementation that always proposed two — or always one — would pass half this file by accident');
}

console.log(`\nplanTheDay — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
