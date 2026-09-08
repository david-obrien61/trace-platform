// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the ONE definition of "these records look like the same party", across THREE axes —
//   a shared email, a shared phone, or the same name — returned as GROUPS with their members and
//   the axis each group was found on. Used by the books review (to SIZE the problem in somebody
//   else's QuickBooks) and by the `/customers` roster (to MARK it in our own table), so the report
//   that sends Lauren to a screen and the screen she lands on cannot disagree about what a
//   duplicate is.
// DEPENDENCIES: ../utils/personName (personNameTokenSet · personNamesMatch — the #61 token-set
//   engine, reused and never re-implemented) · ../quickbooks/customerList (normEmail · normPhone —
//   the same normalisers the QuickBooks read already sizes duplicates with).
//   Pure: no db, no network, no clock, no DOM.
// OUTPUTS: DUP_AXES · DuplicateAxis · PartyCandidate · DuplicateGroup · DuplicatePartyTally ·
//   nameBucketKey · findDuplicateParties · tallyDuplicateParties.
// STORY: *David rehearses the import on a saved copy* (`user_stories.md`, ARC: ocr-doc-routing).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 IT IS A UNION, AND THE UNION IS THE WHOLE POINT — `max()` WAS UNDERSTATING IT BY A FIFTH.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `summariseCustomers` returns two INDEPENDENT tallies — records sharing an email, records sharing
// a phone — and the rule that read them took `Math.max(byEmail, byPhone)` with the comment *"a
// customer entered twice usually shares BOTH, so adding them would double-count."* Both halves of
// that were reasoned from counts alone, because counts are all that read had:
//   · **ADDING them is wrong** — it double-counts every record that shares both. That part held.
//   · **`max()` is ALSO wrong**, and in the same direction as a lie: it silently discards every
//     record that shares a phone with one person and nothing with anyone else. On LAWNS the two
//     tallies are 54 and (smaller), and **the actual union of the email and phone axes is 72
//     records** [STATED — measured by a prior session against the 2026-09-03 capture; this build
//     could not re-measure it, see the header of `booksFindings.ts`].
// **Neither sum nor max can be computed from two counts. A union needs the ROWS**, which is why
// this file takes rows and the old rule took a breakdown.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE NAME AXIS IS EXACT TOKEN-SET EQUALITY, NOT SIMILARITY, AND SAYING SO IS LOAD-BEARING.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `personNamesMatch` elides apostrophes, ignores order, drops middle initials and then compares the
// token SETS for equality. So it finds `Spannaus` / `Spannaus` and `Sarah Wilson` / `Sarah Wilson`
// — two records with one name and no shared email or phone, invisible to the other two axes — and
// it does **NOT** find `Nicholas` / `Nicolas`, `Zach` / `Zack`, `Rebeca` / `Rebecca` or
// `Turnstile` / `Turnstyle`, because a one-letter difference is a different token.
//
// ⚠️ **THAT LIMIT IS DECLARED RATHER THAN QUIETLY ACCEPTED, AND NO FUZZY MATCHER IS ADDED HERE.**
// Edit distance would find those four and would also merge `Sarah Wilson` with `Sara Wilson`, who
// may be two people. A duplicate is fixable and a wrong merge is not (*Dave's Tree Service*,
// `user_stories.md`), so widening the identity rule is DAVID'S RULING, not a helper's default.
// What this file does instead is REPORT the axis each group was found on, so a reader can see that
// the name axis is doing exact matching and ask for more if they want it.
//
// ⚠️ **AND NOTHING HERE MERGES, WRITES OR DECIDES.** It groups and it says why. Every consumer
// renders the groups and stops (R-54: we surface, the owner decides).
// ─────────────────────────────────────────────────────────────────────────────
import { personNameTokenSet, personNamesMatch } from '../utils/personName';
import { normEmail, normPhone } from '../quickbooks/customerList';

/** The three ways two records can look like one party. The keys ARE the reported axis names. */
export const DUP_AXES = {
  email: 'a shared email address',
  phone: 'a shared phone number',
  name:  'the same name',
} as const;
export type DuplicateAxis = keyof typeof DUP_AXES;

/**
 * The minimum a record must offer. `label` is what a SCREEN shows and is never printed on paper
 * (see `booksReport.ts` — the report carries counts, the screen carries rows).
 */
export interface PartyCandidate {
  id: string;
  label: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

export interface DuplicateGroup<T extends PartyCandidate> {
  /** Stable within one call: the smallest member id, so a re-render cannot re-order the groups. */
  key: string;
  members: T[];
  /** Every axis that put two of these members together. Ordered as `DUP_AXES` is declared. */
  axes: DuplicateAxis[];
}

export interface DuplicatePartyTally {
  /** How many GROUPS — the number of merges an owner would have to consider. */
  groups: number;
  /** How many RECORDS sit in one — the size of the problem, and the number a person cares about. */
  recordsInvolved: number;
  /** The largest single group, so "72 records, worst case 4 on one number" is sayable. */
  largestGroup: number;
  /** Records reachable on each axis INDIVIDUALLY. These OVERLAP — they do not add up to the union,
   *  and that is exactly why the union is computed from rows rather than from these three. */
  byAxis: Record<DuplicateAxis, number>;
}

/**
 * The name axis's bucket key: the record's identity tokens, sorted and joined.
 *
 * 🔴 THIS IS `personNamesMatch` EXPRESSED AS A KEY, NOT A SECOND MATCHING RULE. Two names produce
 * the same key exactly when `tokenSetsEqual` would return true for them, which is what makes the
 * O(n) bucketing below equivalent to the O(n²) pairwise comparison — and there is a probe that
 * holds the two to each other over a table of pairs rather than leaving it to this comment.
 *
 * Returns `null` for a name with no identity tokens: an empty set never matches anything (D-9 —
 * absence of a name is not agreement between names), and a shared empty bucket would merge every
 * unnamed record into one imaginary person.
 */
export function nameBucketKey(raw: string | null | undefined): string | null {
  const set = personNameTokenSet(raw);
  if (set.size === 0) return null;
  return [...set].sort().join(' ');
}

/** Disjoint-set over record INDEXES. Three axes, one union — that is the whole algorithm. */
function makeUnionFind(n: number) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) { const next = parent[i]; parent[i] = r; i = next; }
    return r;
  };
  return { find, union: (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; } };
}

/**
 * Group records that look like the same party, across all three axes at once.
 *
 * 🔴 TRANSITIVE BY CONSTRUCTION, AND THAT IS A DECISION RATHER THAN AN ARTEFACT OF THE ALGORITHM.
 * If A and B share a phone and B and C share a name, all three land in ONE group. An owner
 * deciding whether to merge needs to see the whole cluster — showing her A+B and separately B+C
 * asks her to make the same decision twice with half the evidence each time, and the second
 * decision would be made against a record the first one may already have removed.
 */
export function findDuplicateParties<T extends PartyCandidate>(rows: T[]): DuplicateGroup<T>[] {
  const uf = makeUnionFind(rows.length);
  // Which axis joined which pair. Recorded as the union happens, because after the fact a group
  // cannot say WHY its members are together — and "why" is the only part an owner can argue with.
  const axisEdges: { a: number; b: number; axis: DuplicateAxis }[] = [];

  const bucketBy = (axis: DuplicateAxis, keyOf: (r: T) => string | null) => {
    const buckets = new Map<string, number[]>();
    rows.forEach((r, i) => {
      const k = keyOf(r);
      if (k === null || k === '') return;
      const list = buckets.get(k);
      if (list) list.push(i); else buckets.set(k, [i]);
    });
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      for (let i = 1; i < list.length; i++) {
        axisEdges.push({ a: list[0], b: list[i], axis });
        uf.union(list[0], list[i]);
      }
    }
  };

  // Declared order == `DUP_AXES` order, so a group's `axes` array reads the same way every time.
  bucketBy('email', r => normEmail(r.email ?? null));
  bucketBy('phone', r => normPhone(r.phone ?? null));
  bucketBy('name',  r => nameBucketKey(r.name ?? null));

  const byRoot = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const root = uf.find(i);
    const list = byRoot.get(root);
    if (list) list.push(i); else byRoot.set(root, [i]);
  });

  const axesOfRoot = new Map<number, Set<DuplicateAxis>>();
  for (const e of axisEdges) {
    const root = uf.find(e.a);
    let s = axesOfRoot.get(root);
    if (!s) { s = new Set(); axesOfRoot.set(root, s); }
    s.add(e.axis);
  }

  const order = Object.keys(DUP_AXES) as DuplicateAxis[];
  const groups: DuplicateGroup<T>[] = [];
  for (const [root, idxs] of byRoot) {
    if (idxs.length < 2) continue;
    const members = idxs.map(i => rows[i]);
    const axes = order.filter(a => axesOfRoot.get(root)?.has(a));
    groups.push({
      key: members.map(m => m.id).sort()[0],
      members,
      axes,
    });
  }
  // Biggest cluster first — the merge with the most records behind it is the one worth opening
  // ([[R-66]]'s shape: order by what it is worth, not by the order rows happened to arrive in).
  return groups.sort((x, y) => y.members.length - x.members.length || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}

/**
 * The sizing an owner reads: groups, records, worst cluster, and the three single-axis counts.
 *
 * ⚠️ `byAxis` COUNTS RECORDS REACHABLE ON THAT AXIS ALONE AND THE THREE OVERLAP. They are reported
 * so a reader can see WHICH axis is carrying the finding — on LAWNS the name axis contributes
 * groups the other two cannot see at all — and they must never be added together to reach the
 * union. `recordsInvolved` is the union and is the only total.
 */
export function tallyDuplicateParties<T extends PartyCandidate>(rows: T[]): DuplicatePartyTally {
  const groups = findDuplicateParties(rows);
  const byAxis = { email: 0, phone: 0, name: 0 } as Record<DuplicateAxis, number>;
  const single = (axis: DuplicateAxis, keyOf: (r: T) => string | null) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = keyOf(r);
      if (k === null || k === '') continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let n = 0;
    for (const c of counts.values()) if (c > 1) n += c;
    byAxis[axis] = n;
  };
  single('email', r => normEmail(r.email ?? null));
  single('phone', r => normPhone(r.phone ?? null));
  single('name',  r => nameBucketKey(r.name ?? null));

  return {
    groups: groups.length,
    recordsInvolved: groups.reduce((n, g) => n + g.members.length, 0),
    largestGroup: groups.reduce((n, g) => Math.max(n, g.members.length), 0),
    byAxis,
  };
}

/**
 * 🔴 THE EQUIVALENCE THE BUCKETING RESTS ON, EXPORTED SO A PROBE CAN HOLD IT RATHER THAN A COMMENT.
 * True when the key-based grouping and the canonical pairwise matcher agree about this pair.
 * A probe walks a table of pairs — including the four one-letter cases this axis deliberately does
 * NOT match — and fails if the two ever disagree.
 */
export function nameAxisAgreesWithMatcher(a: string | null, b: string | null): boolean {
  const ka = nameBucketKey(a), kb = nameBucketKey(b);
  const bucketed = ka !== null && ka === kb;
  return bucketed === personNamesMatch(a, b);
}
