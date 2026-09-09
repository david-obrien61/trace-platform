/**
 * ── pricingConfigMerge — a Save may not delete a key it does not own ──────────────────────────
 *
 * 🔴 THE DEFECT THIS FILE EXISTS FOR. `business_pricing_config.config` is one jsonb column shared
 * by four screens, and the Cost-to-Produce panel replaces the WHOLE column. It used to rescue
 * three named keys — `discountTypes`, `pricingTiers`, `aiBiEnabled` — and drop everything else.
 * `taxRate` was not among them, and LAWNS's 8.25% rate prints on every invoice a customer reads.
 *
 * ⚠️ AND THE FIRST THING THIS FILE HAD TO GET RIGHT WAS THAT THE WIPE IS CONDITIONAL. On a
 * parseable config the rate survived — not because anything preserved it, but because
 * `parseConfig` is a CAST and the stored keys rode along in memory. §E asserts that accident
 * exists and §F asserts it fails, because a fix justified by the wrong mechanism is a fix nobody
 * can maintain. The live reproduction is scripts/rls/pricing-config-clobber.rls.mjs.
 *
 * §A the owned set is DERIVED, both directions · §B unowned keys are carried · §C owned keys are
 * replaced WHOLESALE so a deletion sticks · §D a stale copy can't overwrite a fresher neighbour ·
 * §E/§F the old behaviour, reproduced and asserted to lose the rate · §G garbage input ·
 * §H the probes REACH the panel (tech-debt #182).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/pricingConfigMerge.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { COST_PANEL_OWNED_KEYS, mergeOwnedOverConfig, describeCarry } from './pricingConfigMerge';
import { EMPTY_COST_CONFIG } from './CostToProduce';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

/** A stored config in LAWNS's real SHAPE — the cost recipe plus three keys the panel never owns. */
const stored = (): Record<string, unknown> => ({
  version: 1,
  unitLabel: 'tree',
  denominators: [1, 5, 20, 100],
  margin: { baseline: 0.4, tiers: [{ name: 'standard', marginOverride: 0.4, isDefault: true }] },
  priceReference: null,
  locations: [
    { id: 'default', name: 'Primary', kind: 'base', recurring: [], overheadPerUnit: 0 },
    { id: 'second', name: 'Back field', kind: 'base', recurring: [], overheadPerUnit: 4 },
  ],
  taxRate: 0.0825,
  discountTypes: [{ name: 'CD10%', percent: 10 }],
  production: { potPrice: 3.25 },
});

/** What the panel holds in memory after an edit: the cost shape, one location removed. */
const editedOneLocation = (): Record<string, unknown> => ({
  ...JSON.parse(JSON.stringify(EMPTY_COST_CONFIG)),
  unitLabel: 'tree',
  locations: [{ id: 'default', name: 'Primary', kind: 'base', recurring: [], overheadPerUnit: 0 }],
});

// ══ §A — THE OWNED SET IS DERIVED FROM THE SHAPE, BOTH DIRECTIONS ═══════════════════════════
// #179: a declarative list that does not match what it describes is invisible to every tool we
// own, so the list is asserted against its source in both directions rather than eyeballed.
{
  const shapeKeys = Object.keys(EMPTY_COST_CONFIG).sort();
  const owned = [...COST_PANEL_OWNED_KEYS].sort();
  ok(owned.join(',') === shapeKeys.join(','),
     `A1 owned set === EMPTY_COST_CONFIG's keys (owned=${owned.join('|')} shape=${shapeKeys.join('|')})`);
  ok(!COST_PANEL_OWNED_KEYS.includes('taxRate'),
     'A2 taxRate is NOT owned by the cost panel — it is the tax field\'s, and that is the whole defect');
  ok(!COST_PANEL_OWNED_KEYS.includes('discountTypes') && !COST_PANEL_OWNED_KEYS.includes('production'),
     'A3 discountTypes and production are not owned either');
  ok(COST_PANEL_OWNED_KEYS.length >= 6, 'A4 the owned set is non-trivial');
  ok(Object.isFrozen(COST_PANEL_OWNED_KEYS), 'A5 the owned set cannot be mutated by a caller');
}

// ══ §B — UNOWNED KEYS ARE CARRIED THROUGH ═══════════════════════════════════════════════════
{
  const cur = stored();
  const next = mergeOwnedOverConfig(cur, editedOneLocation());
  ok(next.taxRate === 0.0825, 'B1 🔴 taxRate SURVIVES the save');
  ok(JSON.stringify(next.discountTypes) === JSON.stringify(cur.discountTypes),
     'B2 discountTypes survives, byte-identical');
  ok(JSON.stringify(next.production) === JSON.stringify(cur.production),
     'B3 production survives — a key that was on NO preserve list');

  // The one that matters most: a key invented after this code was written.
  const withFuture = { ...stored(), somethingNobodyHasWrittenYet: { a: 1 } };
  const n2 = mergeOwnedOverConfig(withFuture, editedOneLocation());
  ok(JSON.stringify(n2.somethingNobodyHasWrittenYet) === '{"a":1}',
     'B4 🔴 a key this code has never heard of survives — the point of inverting the enumeration');

  const lost = Object.keys(cur).filter(k => !(k in next));
  ok(lost.length === 0, `B5 NO top-level key is lost (lost=${lost.join('|') || 'none'})`);
}

// ══ §C — OWNED KEYS ARE REPLACED WHOLESALE, SO A DELETION STICKS ════════════════════════════
// The constraint that rules out a deep merge: the panel must be able to REMOVE something it owns.
{
  const cur = stored();
  const next = mergeOwnedOverConfig(cur, editedOneLocation());
  ok(Array.isArray(next.locations) && (next.locations as unknown[]).length === 1,
     'C1 🔴 the deleted second location STAYS deleted — owned keys are replaced, never merged');
  ok((next.locations as Array<{ id: string }>)[0].id === 'default', 'C2 the surviving location is the right one');
  ok(next.unitLabel === 'tree', 'C3 an owned scalar takes the edited value');
  ok(JSON.stringify(next.margin) === JSON.stringify(EMPTY_COST_CONFIG.margin),
     'C4 an owned object is replaced wholesale by the edited one, not merged into the stored one');
}

// ══ §D — A STALE COPY OF A NEIGHBOUR'S KEY CANNOT OVERWRITE A FRESHER ONE ═══════════════════
// The panel carries unowned keys in memory (parseConfig is a cast). If the merge took them from
// the SCREEN rather than the fresh read, a panel opened before /discounts saved would write the
// old discount config back — one clobber traded for another.
{
  const freshFromDb = { ...stored(), taxRate: 0.0925, discountTypes: [{ name: 'NEW', percent: 5 }] };
  const staleScreen = { ...editedOneLocation(), taxRate: 0.0825, discountTypes: [{ name: 'OLD', percent: 10 }] };
  const next = mergeOwnedOverConfig(freshFromDb, staleScreen);
  ok(next.taxRate === 0.0925, 'D1 🔴 the FRESH taxRate wins over the screen\'s stale copy');
  ok(JSON.stringify(next.discountTypes) === '[{"name":"NEW","percent":5}]',
     'D2 the fresh discountTypes wins too — unowned keys come from the read, never from the screen');
}

// ══ §E — THE ACCIDENT: on a parseable config the OLD code preserved taxRate by pass-through ═══
// Stated as an assertion because the fix's justification depends on it. If this is false, the
// reported "one Save deletes the rate" was live for every owner and the history is different.
{
  const oldPreserveList = (current: Record<string, unknown>, edited: Record<string, unknown>) => {
    const preserved: Record<string, unknown> = {};
    for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled']) {
      if (current[k] !== undefined) preserved[k] = current[k];
    }
    return { ...edited, ...preserved };
  };
  // A parseable config: the panel's in-memory object IS the stored object (the cast keeps its keys).
  const inMemoryAfterCast = stored();
  const oldResult = oldPreserveList(stored(), inMemoryAfterCast);
  ok(oldResult.taxRate === 0.0825,
     'E1 the OLD code kept taxRate when the config parsed — by unknown-key pass-through, not by design');
}

// ══ §F — …AND IT FAILS THE MOMENT THE PANEL FALLS BACK TO EMPTY_COST_CONFIG ═════════════════
{
  const oldPreserveList = (current: Record<string, unknown>, edited: Record<string, unknown>) => {
    const preserved: Record<string, unknown> = {};
    for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled']) {
      if (current[k] !== undefined) preserved[k] = current[k];
    }
    return { ...edited, ...preserved };
  };
  // The fallback: an unparseable/locationless config makes the panel load EMPTY_COST_CONFIG, which
  // carries no taxRate at all. Reproduced live in pricing-config-clobber.rls.mjs §C7.
  const fallback = JSON.parse(JSON.stringify(EMPTY_COST_CONFIG)) as Record<string, unknown>;
  const oldResult = oldPreserveList(stored(), fallback);
  ok(oldResult.taxRate === undefined, 'F1 🔴 THE WIPE — the old code loses taxRate on the fallback path');
  ok(oldResult.production === undefined, 'F2 🔴 …and production with it');

  const newResult = mergeOwnedOverConfig(stored(), fallback);
  ok(newResult.taxRate === 0.0825, 'F3 ✅ the new code keeps it on the SAME input');
  ok(JSON.stringify((newResult as { production: { potPrice: number } }).production) === '{"potPrice":3.25}',
     'F4 ✅ …and production too');
}

// ══ §G — GARBAGE AND ABSENCE ════════════════════════════════════════════════════════════════
{
  const edited = editedOneLocation();
  for (const [label, bad] of [['null', null], ['a string', 'nope'], ['an array', [1, 2]], ['undefined', undefined]] as const) {
    const next = mergeOwnedOverConfig(bad, edited);
    ok(Object.keys(next).sort().join(',') === [...COST_PANEL_OWNED_KEYS].sort().join(','),
       `G1 ${label} current ⇒ exactly the owned keys, nothing invented`);
  }
  // A tenant with no config row yet: nothing to carry, and creating the row is correct.
  const created = mergeOwnedOverConfig({}, edited);
  ok(created.taxRate === undefined, 'G2 an absent row does not gain a fabricated taxRate (no default is invented)');

  // An owned key the screen is not carrying leaves the stored value ALONE. Writing `undefined`
  // over it would serialise to a deletion — the same defect one field in.
  const partial = { unitLabel: 'shrub' } as Record<string, unknown>;
  const kept = mergeOwnedOverConfig(stored(), partial);
  ok(kept.unitLabel === 'shrub', 'G1b an owned key the screen DOES carry is written');
  ok(Array.isArray(kept.locations) && (kept.locations as unknown[]).length === 2,
     '🔴 G1c an owned key the screen is NOT carrying keeps its stored value, never `undefined`');
  ok(!Object.keys(kept).some(k => kept[k] === undefined),
     'G1d no key is written as undefined (jsonb would drop it — a silent deletion)');

  const rep = describeCarry(stored(), mergeOwnedOverConfig(stored(), edited));
  ok(rep.dropped.length === 0, `G3 describeCarry reports NOTHING dropped (${rep.dropped.join('|') || 'none'})`);
  ok(rep.ownedMissing.length === 0, `G4 …and no owned key missing from the payload`);
  ok(rep.carried.sort().join(',') === 'discountTypes,production,taxRate',
     `G5 …and names exactly what it carried (${rep.carried.sort().join(',')})`);
  // The reporter must be able to SEE a drop, or it is decoration (§6 r19).
  const bad = describeCarry(stored(), { version: 1 });
  ok(bad.dropped.includes('taxRate'), 'G6 🔴 describeCarry CAN report a drop — it is not a rubber stamp');
}

// ══ §H — THE PROBES REACH THE PANEL, NOT ONLY THE LIBRARY (tech-debt #182) ══════════════════
// Everything above would stay green if CostToProduceSettings never called this function. The
// defect lived in the WIRING, so the wiring is what gets asserted.
{
  const panel = readFileSync('packages/shared/src/components/CostToProduceSettings.tsx', 'utf8');
  ok(/mergeOwnedOverConfig\s*\(\s*latestCfg\?\.config/.test(panel),
     'H1 🔴 the panel builds its payload with mergeOwnedOverConfig, from the FRESH re-read');
  ok(!/for\s*\(\s*const\s+k\s+of\s*\[\s*'discountTypes'/.test(panel),
     'H2 🔴 the enumerated preserve list is GONE from the panel');
  ok(!/\{\s*\.\.\.baseConfig,\s*\.\.\.preserved\s*\}/.test(panel),
     'H3 the old payload expression is gone');
  // ⚠️ Asserting the IDENTIFIER is not enough — an import line alone satisfies that, and a mutant
  // that replaced the call with a hardcoded `{carried:[],dropped:[]}` survived on exactly that.
  ok(/describeCarry\s*\(\s*latestCfg\?\.config\s*,\s*configToWrite\s*\)/.test(panel),
     'H4 the write REPORTS what it carried and dropped, computed from the real payload (STD-003)');
  ok(/\[TRACE:COST\] config write/.test(panel), 'H5 …and emits it on by default');
}

console.log(`pricingConfigMerge: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
