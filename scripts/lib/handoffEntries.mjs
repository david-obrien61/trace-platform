// ============================================================
// handoffEntries — WHAT A §3 ENTRY IS, AND WHICH LEDGER ROWS IT CLAIMS
// PURPOSE:      The parsing both handoff caps depend on, in ONE place:
//               `verify-handoff-retention.mjs` (§3 N=3, archive duplicates, every row has an
//               entry) and `verify-register-blocks.mjs` (every flagged row has a register block).
// 🔴 WHY IT IS SHARED AND NOT COPIED (§6 r8). The two caps must agree on what "an entry" is and
//               which rows it CLAIMS. If one read claims from the first bold run and the other from
//               the whole heading, "this row has an entry" would mean two different things in two
//               caps that are both green — the drift this repo keeps paying for. Extracted
//               unchanged from verify-handoff-retention.mjs (ledger #339); that script's 20
//               self-test probes are what prove the extraction changed no behaviour.
// DEPENDENCIES: none.
// OUTPUTS:      section3 · entries · ledgerCloseOutIds · claimedIds
// ============================================================

/** §3 runs from the HANDOFF heading to the next top-level `## ` heading. */
export function section3(md) {
  const start = md.search(/^## 3\. HANDOFF/m);
  if (start === -1) return null;
  const rest = md.slice(start + 1);
  const nextTop = rest.search(/^## \d+\./m);
  return nextTop === -1 ? rest : rest.slice(0, nextTop);
}

/**
 * Entries as {heading, body}. An entry is moved VERBATIM, so a merge artefact is a
 * byte-identical COPY — heading AND body.
 *
 * 🔴 COMPARE THE WHOLE ENTRY, NOT THE HEADING. The first version of this check
 * compared headings alone and immediately reported a false positive it could not
 * have distinguished: two DIFFERENT 2026-06-09 sessions share the title
 * "THUNDER: Ignition OS Reality Audit → STD-010 + built-inventory update" —
 * 161 lines and 97 lines, different work, legitimately both in the archive.
 * A same-day second session reusing a title is ordinary; a byte-identical copy is
 * the defect. Keying on the heading would have made this check cry wolf on real
 * history, and a check that cries wolf gets deleted — which is how the thing it
 * guards starts failing again.
 */
export function entries(block) {
  const out = [];
  const re = /^### (.+)$/gm;
  const marks = [...block.matchAll(re)];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : block.length;
    out.push({ heading: marks[i][1].trim(), text: block.slice(start, end) });
  }
  return out;
}

export function ledgerCloseOutIds(md) {
  return [...md.matchAll(/^\| \*\*#(\d+)\*\* \|/gm)].map(m => m[1]);
}

/** Ledger ids an entry CLAIMS — from its headline's first bold run, TECH-DEBT excluded. */
export function claimedIds(heading) {
  const bold = heading.match(/\*\*([\s\S]*?)\*\*/);
  if (!bold) return [];
  return [...bold[1].matchAll(/(TECH-DEBT\s+)?#(\d+)\b/gi)].filter(m => !m[1]).map(m => m[2]);
}
