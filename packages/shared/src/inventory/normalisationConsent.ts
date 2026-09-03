// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: find the places where one business writes one thing several ways, suggest a single
//   display for each, and let the owner decide — once, rather than being asked again on every
//   import. David's framing: this is what makes `gal` a decision Lauren makes once instead of a
//   question that returns forever.
// DEPENDENCIES: ./unitOfMeasure (parseUnitOfMeasure). Pure: no db, no network, no env, no clock
//   it was not handed, no DOM.
// OUTPUTS: GroupKind · SizeVariant · NormalisationGroup · NormalisationChoice · AuditRowInput ·
//   groupSizeVariants · auditRowFor.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A MECHANISM, NOT A VOCABULARY. THIS FILE CONTAINS NO LIST OF SIZES.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The failure mode this is most likely to be built as is a fixed taxonomy — a hardcoded map of
// `30 Gallon → 30 gal` that works at one nursery and is wrong at the next. Nothing here knows
// what a gallon is. It reads what is in THEIR data, groups the labels that mean the same thing,
// and the number of questions asked is a function of how messy their data is — a tidy catalogue
// is asked nothing at all.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 GROUPING IS BY PARSED MEANING, WHICH IS WHAT MAKES THE COSMETIC/MEANING SPLIT STRUCTURAL.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `30 gal`, `30 Gallon`, `#30` and `30G` all parse to (container, 30, gallon) — one shelf, four
// spellings, and choosing between them is a SPELLING question with an obvious default.
//
// `#3/5` parses to a RANGE (3 → 5). That is not a spelling of anything: Terry says the difference
// between a #3 and a #5 is only pot height, and whether those are ONE product or TWO is a fact
// about his business that nobody here can derive. It is asked as a MEANING question, and it never
// carries a suggestion — offering one would be answering it for him.
//
// ⚠️ The split therefore falls out of the parse rather than out of a judgement call in a
// reviewer's head, which is the only version of it that survives the next catalogue.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 AN UNRECOGNISED VALUE IS A FINDING, NOT AN ERROR — AND A BLANK IS AN ANSWER.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `2 qrt` is surfaced as *"we do not know what this is"*, with no suggestion and no correction.
// It is not highlighted red, it does not block, and declining to answer is a recorded answer
// rather than an unfinished task — a screen that treats silence as incomplete asks the same
// question forever, which is the thing this build exists to stop.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE RAW VALUE IS EVIDENCE AND IS NEVER REWRITTEN (R-50 / D-23).
// ══════════════════════════════════════════════════════════════════════════════════════════
// Nothing here returns a corrected row. A choice sets how a label is DISPLAYED; `size` keeps what
// the grower typed, exactly as `unitOfMeasure`'s projection does and for the same reason. And no
// SKU is invented — 248 of 250 rows in their pricing tab already match a QuickBooks
// `FullyQualifiedName`. Standardise the display, keep the identifier.
// ─────────────────────────────────────────────────────────────────────────────
import { parseUnitOfMeasure } from './unitOfMeasure';

export type GroupKind =
  /** Several spellings of one meaning. Has an obvious default; safe to suggest. */
  | 'spelling'
  /** The parse is a RANGE. Whether it is one product or two is theirs to say — never suggested. */
  | 'meaning'
  /** Nobody could interpret the label. A finding, not an error. */
  | 'unrecognised';

export interface SizeVariant {
  /** Verbatim, as typed. Never normalised — this is the evidence. */
  label: string;
  /** How many rows carry this exact label. */
  items: number;
}

export interface NormalisationGroup {
  /** The parsed-meaning signature these variants share. Stable across imports. */
  key: string;
  kind: GroupKind;
  /** Newest-first is meaningless here; ordered by item count, commonest first. */
  variants: SizeVariant[];
  /** Total rows across every variant — the population the question is about. */
  population: number;
  /**
   * The default we propose. `null` for `meaning` and `unrecognised`, deliberately: a suggestion
   * on a question only they can answer is us answering it and calling it a default.
   */
  suggestion: string | null;
  /** 🔴 WHY that suggestion, computed from their own data. `null` whenever suggestion is null. */
  why: string | null;
  /** One sentence, in an owner's words. */
  question: string;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The meaning signature. Identical for every spelling of one shelf. */
function meaningKey(size: string): string {
  const u = parseUnitOfMeasure(size);
  if (!u) return `unrecognised:${size.trim().toLowerCase()}`;
  return `u:${u.kind}:${u.value ?? ''}:${u.valueMax ?? ''}:${u.unit}`;
}

/**
 * Read a catalogue and return the questions worth asking.
 *
 * 🔴 ONLY GROUPS WORTH ASKING ABOUT ARE RETURNED. A meaning that is written exactly one way is
 * not a question — there is nothing to choose — so it is omitted entirely rather than returned
 * as an already-answered row. The number of questions is a function of how messy their data is,
 * which is why a clean catalogue produces an empty list rather than a page of confirmations.
 *
 * ⚠️ An `unrecognised` label IS returned even when it appears once, because it is a FINDING
 * rather than a choice — the point is that we are telling them we could not read it.
 */
export function groupSizeVariants(rows: { size: string | null | undefined }[]): NormalisationGroup[] {
  // 🔴 THE PARSE IS CARRIED, NOT RE-DERIVED FROM THE KEY. An earlier draft decided "is this a
  // range?" by pattern-matching the composed key string — which works until the key format
  // changes by one character, and then every range silently becomes a spelling question with a
  // confident suggestion attached. The classification comes from the same parse that built the
  // key, so the two cannot disagree.
  interface Bucket { counts: Map<string, number>; kind: GroupKind; }
  const groups = new Map<string, Bucket>();
  for (const r of rows) {
    const raw = (r.size ?? '').trim();
    if (!raw) continue;                       // an absent size is not a spelling question
    const u = parseUnitOfMeasure(raw);
    const k = meaningKey(raw);
    const kind: GroupKind = !u ? 'unrecognised' : (u.valueMax !== null ? 'meaning' : 'spelling');
    const g = groups.get(k) ?? { counts: new Map<string, number>(), kind };
    g.counts.set(raw, (g.counts.get(raw) ?? 0) + 1);
    groups.set(k, g);
  }

  const out: NormalisationGroup[] = [];
  for (const [key, bucket] of groups) {
    const variants: SizeVariant[] = [...bucket.counts.entries()]
      .map(([label, items]) => ({ label, items }))
      // Commonest first — and ties broken by label so the order (and therefore the suggestion)
      // is deterministic rather than dependent on catalogue order.
      .sort((a, b) => b.items - a.items || a.label.localeCompare(b.label));
    const population = variants.reduce((n, v) => n + v.items, 0);

    if (bucket.kind === 'unrecognised') {
      out.push({
        key, kind: 'unrecognised', variants, population,
        suggestion: null, why: null,
        question: `We do not know what “${variants[0].label}” means as a size. Tell us, or leave it exactly as it is — ${plural(population, 'item uses', 'items use')} it.`,
      });
      continue;
    }

    if (bucket.kind === 'meaning') {
      out.push({
        key, kind: 'meaning', variants, population,
        suggestion: null, why: null,
        question: `Is “${variants[0].label}” one product or two? ${plural(population, 'item uses', 'items use')} it. This one is not about spelling, so we have not guessed.`,
      });
      continue;
    }

    // A single spelling of a clear meaning is not a question.
    if (variants.length < 2) continue;

    const top = variants[0];
    out.push({
      key, kind: 'spelling', variants, population,
      suggestion: top.label,
      // 🔴 THE REASON IS COMPUTED FROM THEIR DATA, NOT ASSERTED. The default is theirs already —
      // we are reporting what they mostly do, not telling them what to do.
      why: `${plural(top.items, 'of your items already writes it', 'of your items already write it')} this way, out of ${population.toLocaleString()}.`,
      question: `You write this size ${variants.length} different ways. Show them all as one?`,
    });
  }

  // Most-affected first: the question worth answering is the one covering the most rows.
  return out.sort((a, b) => b.population - a.population || a.key.localeCompare(b.key));
}

/** What the owner decided. `chosen: null` means "leave it" — a recorded answer, not a gap. */
export interface NormalisationChoice {
  groupKey: string;
  suggested: string | null;
  chosen: string | null;
  population: number;
  variants: string[];
}

/**
 * The `audit_log` row for one decision.
 *
 * 🔴 IT RECORDS WHAT WAS SUGGESTED *AND* WHAT WAS CHOSEN, WHICH IS THE WHOLE POINT. "Owner chose
 * 30 Gallon" is a setting. "We suggested `30 gal`, the owner chose `30 Gallon`, applied to 214
 * items" is how the standard was ARRIVED AT — and it is the difference between a value somebody
 * can question later and one they can only wonder about.
 *
 * ⚠️ TWO THINGS, NOT ONE. This is the immutable event. The STANDARD ITSELF lives in a mutable
 * table, because an append-only log cannot express *"this is still current"* — reading the newest
 * matching row and calling it the setting is a projection that silently breaks the first time two
 * rows land out of order.
 *
 * ⚠️ NO CASUAL PII IN `detail`. Sizes and counts only; no customer, no address, no free text the
 * owner typed about a person.
 */
export interface AuditRowInput {
  businessId: string;
  actorUserId: string | null;
  choice: NormalisationChoice;
  at: Date;
}

export const NORMALISATION_AUDIT_ACTION = 'inventory.display_standard_set';

export function auditRowFor(input: AuditRowInput) {
  const { choice } = input;
  return {
    business_id: input.businessId,
    actor_user_id: input.actorUserId,
    action: NORMALISATION_AUDIT_ACTION,
    target_type: 'inventory_display_standard',
    target_id: choice.groupKey,
    outcome: 'success' as const,
    detail: {
      suggested: choice.suggested,
      chosen: choice.chosen,
      // A declined suggestion is recorded AS a decision, not as an absence — otherwise the next
      // import cannot tell "they said leave it" from "nobody asked".
      accepted: choice.chosen !== null && choice.chosen === choice.suggested,
      left_as_is: choice.chosen === null,
      population: choice.population,
      variants: choice.variants,
      decided_at: input.at.toISOString(),
    },
  };
}
