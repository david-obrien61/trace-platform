// ============================================================
// siteKey — A BASELINE KEY THAT SURVIVES AN EDIT ABOVE THE SITE
// PURPOSE:      Tech-debt #78, fixed. The ratchet caps keyed their baselines on `path:line`, so
//               ANY edit that shifted a line — a comment, an import, a blank line — reported the
//               same site as a NEW violation. On 2026-07-31 it fired THREE TIMES IN ONE DAY across
//               `verify-zero-row-writes` and `verify-field-lists`, each time re-baselined.
//
// 🔴 WHY THAT IS A DEFECT AND NOT AN ANNOYANCE (David's ruling, 2026-08-01):
//   **A RATCHET THAT CRIES WOLF TEACHES REFLEXIVE RE-BASELINING, AND A REFLEXIVE RE-BASELINE IS
//   HOW A REAL VIOLATION GETS ABSORBED.** Three times that day the correct response was "re-lock
//   it." The fourth time there may be something in it — and it will be re-locked the same way.
//   The cost was never the minutes; it was the habit the tool was training.
//
// THE KEY: `path::binding#table.verb` (+ `@2`, `@3` … when one file repeats that triple).
//   · binding — the nearest ENCLOSING/PRECEDING named declaration. Measured before it was chosen:
//     **all 167 candidate sites in the repo resolve one, zero failures.** Destructuring targets
//     (`const { data } = …`) deliberately do NOT match, so a site lands on the real surrounding
//     function rather than on a throwaway local.
//   · table  — from the nearest preceding `.from('x')`. **4 of 167 sites have none in window**
//     (the chain is built across statements). Those get `?` — a STATED fallback, not a silent one.
//   · verb   — update | delete | upsert | select. Cheap, and it keeps two different mutations on
//     one table inside one function apart.
//   · @n     — source-order ordinal, and ONLY within an identical (binding, table, verb) triple.
//
// WHAT STILL RE-KEYS A SITE, stated because a key nobody understands is re-baselined blindly:
//   · renaming the enclosing function — that IS a change of identity; re-declare it.
//   · adding or removing a SIBLING site in the same triple, which shifts the @n ordinals after it.
//     Rare, and it is a real edit to the code the baseline is about.
//   What no longer re-keys it: comments, imports, blank lines, or any edit above the site.
//
// SCOPE: line NUMBERS are still reported to the human (`path:line` in the output) — they are just
// no longer the IDENTITY. Reading a line number off a report is useful; keying a baseline on one
// is what created #78.
// DEPENDENCIES: none (node stdlib, no imports at all).
// OUTPUTS:      siteKey(...) → string · assignOrdinals(sites) → mutates `.key` in place.
// ============================================================

/**
 * Nearest preceding named declaration. Deliberately NOT a parser: these caps read text (the same
 * constraint capF/capG/capQ carry), and a nearest-declaration walk resolved every real site.
 *
 * Matches `function f(`, `export async function f(`, `const f = `, and a bare `f(...) {` method.
 * Does NOT match `const { a, b } = …` — a destructuring target is a local, not a surface, and
 * keying on it would put two adjacent writes under `data` and `error`.
 *
 * 🔴 CONTROL-FLOW KEYWORDS ARE SKIPPED, and the first run is why: the bare-method alternative
 * happily matched `if (…) {` and `for (…) {`, so **38 of the first 120 keys read `::if#` or
 * `::for#`** — stable, but naming the wrong thing and hiding the function the site is actually in.
 * A key a human cannot read is a key that gets re-baselined without being read, which is the very
 * habit #78 exists to break. Skipping them walks on to the real enclosing declaration.
 */
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'try', 'else', 'do', 'return', 'await',
  'function', 'typeof', 'new', 'delete', 'in', 'of', 'case', 'with', 'yield',
]);
const DECL = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=|^[ \t]*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;

export function bindingAt(src, idx) {
  let name = null;
  DECL.lastIndex = 0;
  let m;
  while ((m = DECL.exec(src)) !== null) {
    if (m.index > idx) break;
    const found = m[1] || m[2] || m[3];
    if (found && !KEYWORDS.has(found)) name = found;
  }
  return name ?? '<module>';
}

/** The table the chain is on — nearest preceding `.from('x')` inside a generous window. */
export function tableAt(src, idx, window = 400) {
  const back = src.slice(Math.max(0, idx - window), idx);
  const all = [...back.matchAll(/\.from\(\s*['"`]([a-z_0-9]+)['"`]/g)];
  return all.length ? all[all.length - 1][1] : '?';
}

/** The stable identity of one site. Ordinals are applied afterwards by assignOrdinals. */
export function siteKey(path, src, idx, verb) {
  return `${path}::${bindingAt(src, idx)}#${tableAt(src, idx)}.${verb}`;
}

/**
 * Disambiguate repeats IN SOURCE ORDER. Called once over all sites after they are collected, so a
 * second `update` on the same table in the same function becomes `…@2` rather than colliding.
 * Mutates each site's `.key`.
 */
export function assignOrdinals(sites) {
  const seen = new Map();
  for (const s of sites) {
    const n = (seen.get(s.key) ?? 0) + 1;
    seen.set(s.key, n);
    if (n > 1) s.key = `${s.key}@${n}`;
  }
  return sites;
}
