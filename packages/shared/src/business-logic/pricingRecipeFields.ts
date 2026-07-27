// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      THE ONE list of what "the pricing recipe" actually is — the confidential fields
//               a tax-rate write must not touch, a projection must redact, and a future recipe
//               writer must gate. Field PATHS, read from the TYPE and a live config row.
// DEPENDENCIES: none (data only). Mirrors CostToProduceConfig in ./CostToProduce.ts.
// OUTPUTS:      PRICING_RECIPE_PROTECTED_PATHS, TAX_RATE_PATH, jsonbPath()
//
// 🔴 WHY THIS FILE EXISTS — A GUARD THAT CANNOT FAIL IS NOT A GUARD.
// Spec §5 named the protected fields in prose as "baseline margin, reference price, markup", and
// when that prose was turned into key checks it became `baselineMargin`, `referencePrice`,
// `markup`, `discountTypes`. Checked against the live config 2026-07-27, THREE OF THE FOUR DO NOT
// EXIST:
//   baselineMargin  → the real path is NESTED: margin.baseline
//   referencePrice  → the real key is priceReference (the words are reversed)
//   markup          → EXISTS NOWHERE. Not in the type, not in a live row, not in any migration.
//   discountTypes   → correct
// So `config ? 'baselineMargin'` returned false whether or not the recipe had been damaged. The
// tax writer's actual behaviour was proven clean by diffing the WHOLE config, which is why this
// was a latent trap rather than a live defect — but the flag beside that diff was theatre.
//
// 🔎 ROOT CAUSE, found 2026-07-27 — THE GUARD WAS WRITTEN AGAINST THE SHAPE OF THE ANSWER, NOT
// THE SHAPE OF THE THING BEING PROTECTED. `baselineMargin` DOES exist — on
// `CostToProduceResult` (./CostToProduce.ts:376), the COMPUTED OUTPUT. So does `priceReference`.
// The protected thing is `CostToProduceConfig`, the STORED INPUT, where the same two facts are
// `margin.baseline` and `priceReference`. Two of the four names were lifted from the wrong
// interface. `markup` came from neither — the only `markup` in the repo is
// packages/ignition-os/modules/IgnitionProt.jsx:266, A DIFFERENT VERTICAL'S pricing model.
//
// SAME FAMILY as verify-financial-permissions.mjs asserting against business ids that do not
// exist: an assertion written from a DOCUMENT instead of from the DATA. Provenance for every path
// below is CostToProduceConfig (./CostToProduce.ts) plus David's live config read.
//
// ⚠️ THE SPEC'S LIST WAS ALSO INCOMPLETE, not merely misspelt. `margin.tiers`, `denominators` and
// `locations` are the tier overrides, the sensitivity knob and the cost structure — every bit as
// confidential as the baseline, and never named. A projection built from the old list would have
// protected three phantoms AND left margin.baseline, the tiers and the whole cost structure
// exposed.
// ─────────────────────────────────────────────────────────────────────────────

/** jsonb path segments for each protected field, deepest-first order irrelevant. */
export const PRICING_RECIPE_PROTECTED_PATHS: string[][] = [
  ['margin', 'baseline'],   // the R/Y/G threshold — was documented as `baselineMargin`
  ['margin', 'tiers'],      // per-tier overrides — never named by the spec
  ['priceReference'],       // was documented as `referencePrice`
  ['discountTypes'],        // the only one the spec had right
  ['denominators'],         // the sensitivity knob
  ['locations'],            // the cost structure itself
];

/** The ONE field a tax write may change. Everything else in the config is the recipe. */
export const TAX_RATE_PATH: string[] = ['taxRate'];

/** `['margin','baseline']` → `{margin,baseline}` — for `config#>>'{…}'` in SQL/verifies. */
export const jsonbPath = (path: string[]): string => `{${path.join(',')}}`;
