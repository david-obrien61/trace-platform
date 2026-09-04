/**
 * ── vendorIdentity — resolve a captured vendor string to a vendor row ───────────────────────────
 *
 * PURPOSE
 *   Turn the free-text vendor name on a captured document into a STABLE identity, so that
 *   "ask once, keep forever" cannot be defeated by a second spelling. `receipts.vendor` is free
 *   text and `Sudderth Brothers Contracting, Inc.` is not `Sudderth Brothers`.
 *
 *   🔴 THIS MODULE NEVER MERGES ANYTHING ON ITS OWN. It returns a verdict; the owner decides.
 *   That is D-47's second clause and R-54's whole loop — we surface, the owner decides.
 *
 * THE RULE IS D-47's, REUSED — NOT A SECOND IDENTITY RULE
 *   STANDARDS.md v2.4 (ACTIVE), earned by a nine-invoice two-month cross-billing scar:
 *     1. match on the field the system guarantees unique
 *     2. two independent fields must concur before binding — one field is a HINT, not an identity
 *     3. a stored link is a CACHE, not a fact
 *   Clause 1 is satisfiable HERE in a way it was not against QBO: `vendors` carries a unique index
 *   on (business_id, lower(btrim(name))), so within one tenant an exact name IS unique — we made it
 *   so. That is why an exact canonical-name hit LINKs rather than surfaces.
 *
 * ⚠️ THE SIGNAL CONSTRAINT, MEASURED 2026-09-02 (scripts/measure-vendor-strings.mjs)
 *   The OCR emits 17 fields across all 36 captured rows and NONE of them is a vendor email, vendor
 *   phone, vendor address or account number — the contact fields it does emit (customer_email,
 *   customer_phone) are CUSTOMER-side, because the prompt was written for sales invoices. So on a
 *   purchase invoice the second independent field is USUALLY ABSENT today.
 *   D-47 already says what to do with one signal: SURFACE, never bind. The second-signal branches
 *   below are therefore live code on a currently-rare input — they are exercised by the probes, and
 *   they start firing for real the moment an owner types an email onto a vendor row.
 *
 * DEPENDENCIES
 *   None. No DB, no Supabase, no React, no vertical import. Pure functions over plain rows.
 *
 * OUTPUTS
 *   A VendorResolution: LINK (with a vendorId) · CREATE · NEED_CONFIRMATION (with a disposition).
 *   Callers perform the write; this module performs none.
 */

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE FIELD DECLARATIONS — ONE per entity, and every reader derives from them (A4)
 * ──────────────────────────────────────────────────────────────────────────────────────────────*/

/**
 * 🔴 ONE LIST, EVERY READER — AND THE LIST IS DECLARED ONCE SO `VENDORS_SELECT` IS DERIVED FROM IT (E6).
 *
 * `/vendors`, the vendor editor and the capture path all read this table. A second hand-written
 * enumeration is how a column added to one reader reads back null forever in the other with
 * nothing able to notice — `customers` carried SIX parallel lists before this rule existed.
 *
 * ⚠️ IT WAS NOT, AND THE COMMENT ABOVE WAS TRUE ABOUT ITS INTENT AND FALSE ABOUT ITS EFFECT
 *    (tech-debt #179, filed 2026-09-04). The hand-written select named TEN columns —
 *    `id, business_id, name, email, phone, account_number, website, preferred, preference_note,
 *    notes` — while the migration that creates the table declares FOURTEEN non-timestamp columns.
 *    The four it omitted are the ADDRESS: `address_line1`, `address_city`, `address_state`,
 *    `address_zip` (20260902_vendor_identity_and_preference.sql:136-139).
 *
 *    🔴 NOTHING COULD HAVE CAUGHT IT. A column with no reader and no writer is invisible to tsc
 *    (the type declared what the list declared), to eslint, to knip, and to every probe — the
 *    only thing that finds it is a build that needs the fourth column, which is what happened.
 *    "One list, two readers" failed SILENTLY: the failure mode is not a wrong value, it is an
 *    address typed into a form reading back null forever with no error anywhere.
 *
 *    So the list is now the SOURCE and the select is COMPUTED. A column added to the table gets
 *    added HERE, once, and the select, the row type, the form and the patch builder all move
 *    together — which is what E6 asks for and what a hand-maintained string cannot give.
 */

/** Keys. Never edited, never in a patch — they scope the row (AC-3) and identify it. */
export const VENDOR_KEY_FIELDS = ['id', 'business_id'] as const;

/**
 * Editable by any active member (the `vendors_member_update` policy). `name` leads because it is
 * the identity the unique index is built on.
 */
export const VENDOR_EDITABLE_FIELDS = [
  'name',
  'email',
  'phone',
  'account_number',
  'address_line1',
  'address_city',
  'address_state',
  'address_zip',
  'website',
  'notes',
] as const;

/**
 * 🔴 OWNER-ONLY, AND THE DATABASE IS WHAT SAYS SO — not this array. The
 * `vendors_preference_owner_only` trigger refuses these two from a non-owner on INSERT and UPDATE
 * alike (§4 of the migration). This list exists so the FORM knows which controls to gate and which
 * explanation to show; it is not the enforcement and must never be mistaken for it.
 */
export const VENDOR_OWNER_ONLY_FIELDS = ['preferred', 'preference_note'] as const;

export type VendorEditableField = (typeof VENDOR_EDITABLE_FIELDS)[number];
export type VendorOwnerOnlyField = (typeof VENDOR_OWNER_ONLY_FIELDS)[number];

/** DERIVED — never hand-written again. */
export const VENDORS_SELECT = [
  ...VENDOR_KEY_FIELDS,
  ...VENDOR_EDITABLE_FIELDS,
  ...VENDOR_OWNER_ONLY_FIELDS,
].join(', ');

export const VENDOR_ALIASES_SELECT = 'id, business_id, vendor_id, alias, source';

/** What the caller should do. Mirrors CountOnceSeam's MatchOutcome idiom (§6 r8: one shape). */
export type VendorOutcome = 'LINK' | 'CREATE' | 'NEED_CONFIRMATION';

/** A vendor row as this module needs it. A superset is fine; extra fields are ignored. */
export interface VendorRow {
  id: string;
  business_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  account_number?: string | null;
  /** The four address columns the select omitted until 2026-09-04 (tech-debt #179). */
  address_line1?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  website?: string | null;
  notes?: string | null;
  preferred?: boolean | null;
  preference_note?: string | null;
}

/** An alias row — an alternate name one vendor bills under. Always a human decision. */
export interface VendorAliasRow {
  id: string;
  business_id: string;
  vendor_id: string;
  alias: string;
}

/**
 * A proposed resolution, phrased so acceptance is cheap (D-9). DATA ONLY — this module builds no
 * workflow and no UI. Deliberately the same shape as CountOnceSeam's SuggestedDisposition so the
 * platform has ONE way of saying "we are not deciding this" (§6 r8, STD-011).
 */
export interface VendorDisposition {
  /** What we propose if the owner simply confirms — the cheap-to-accept default. */
  proposed: VendorOutcome;
  /** Phrased so a tap confirms it; never a bare "is this a duplicate?". */
  question: string;
  /** The candidate vendors this could be, most-likely first. Empty when the proposal is CREATE. */
  candidates: VendorCandidate[];
  /** Why we propose what we propose. */
  reasoning: string;
}

export interface VendorCandidate {
  vendorId: string;
  name: string;
  /** Why this row is a candidate — 'name is contained in it', 'shares an email', etc. */
  why: string;
}

export interface VendorResolution {
  outcome: VendorOutcome;
  /** Set ONLY on LINK. Null on CREATE and on NEED_CONFIRMATION — nothing is bound until confirmed. */
  vendorId: string | null;
  /** Which signal(s) decided it: 'alias' | 'name' | 'name+email' | 'name+account' | 'none' | … */
  matchedOn: string;
  reasoning: string;
  /** Present only on NEED_CONFIRMATION. */
  disposition?: VendorDisposition;
}

export interface ResolveVendorInput {
  /** The vendor string exactly as captured. */
  capturedName: string | null | undefined;
  /** A second independent signal, when the document or the owner supplied one. */
  capturedEmail?: string | null;
  capturedAccountNumber?: string | null;
  /** Candidate rows — the CALLER is responsible for scoping these to one business_id (AC-3). */
  vendors: VendorRow[];
  aliases: VendorAliasRow[];
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * NORMALIZATION — two functions, and the difference between them is the whole safety argument
 * ──────────────────────────────────────────────────────────────────────────────────────────────*/

/**
 * STRICT — the ONLY normalization allowed to produce a LINK.
 *
 * 🔴 THIS MUST EQUAL THE DATABASE'S UNIQUE INDEX EXACTLY. The index is
 *   `lower(btrim(name))` (20260902_vendor_identity_and_preference.sql), and Postgres `btrim`
 *   with no second argument strips spaces from both ends and NOTHING internal. So this is
 *   `.trim().toLowerCase()` and deliberately does no more.
 *
 * ⚠️ IT DOES NOT COLLAPSE INTERNAL WHITESPACE, and that is not an oversight. If this were more
 *   aggressive than the index, the resolver would report "no existing vendor" for a name the index
 *   considers a duplicate — and the INSERT that followed would be rejected by the database on a
 *   constraint the caller was told nothing about. A resolver that disagrees with its own unique
 *   index produces a failure the user cannot act on.
 */
export function normalizeVendorName(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Corporate suffixes stripped before folding. Deliberately SHORT — every entry is a form that
 * carries no distinguishing information. A longer list starts eating words that DO distinguish
 * ("Materials" is part of Bailey Bark's identity, not noise; so is "Contracting").
 *
 * ⚠️ IDENTICAL TO `VENDOR_SUFFIXES` IN packages/cultivar-os/src/lib/vendorKey.ts, ON PURPOSE —
 * see looseVendorKey. Two folds that disagree are the obstacle R-65 names; this is the half of
 * the reconciliation that can be done from this side without editing another session's branch.
 */
const VENDOR_SUFFIXES = ['inc', 'llc', 'llp', 'ltd', 'co', 'corp', 'company', 'incorporated'];

/**
 * LOOSE — for SURFACING candidates only. NEVER used to link.
 *
 * 🔴 THIS ALGORITHM IS DELIBERATELY THE SAME AS `vendorKey()` ON MAIN, AND MY FIRST VERSION WAS
 * BOTH DIFFERENT AND WORSE. Two rules for folding one vendor name is the obstacle R-65 names as
 * the real cost of consolidating the two vendor stores. Measured over a 17-string corpus, the two
 * disagreed on three, and every disagreement was mine being wrong:
 *   · `Co-op Gardens` → `-op gardens`   (I stripped `co` ANYWHERE, so a hyphen became a word
 *                                        boundary and ate half a real word. `vendorKey`'s comment
 *                                        names this exact trap and strips from the END only.)
 *   · `H-E-B`         → `h-e-b`         (I deleted only `.` and `,`; punctuation must become a
 *                                        SPACE, or a hyphenated name folds differently to a spaced one.)
 *   · `Sudderth Brothers Contracting, Inc.` → I had `contracting` in the suffix list, which folded
 *                                        it onto `Sudderth Brothers`.
 *
 * ✏️ THAT LAST ONE ALSO CORRECTS R-65'S OWN EXAMPLE, WHICH IS WHY IT IS RECORDED RATHER THAN
 * QUIETLY FIXED. R-65 states that `vendorKey()` folds the Sudderth pair to ONE key and the strict
 * index gives TWO. Measured: `vendorKey` yields `sudderth brothers contracting` and
 * `sudderth brothers` — **TWO keys**, because `contracting` is not a corporate suffix. It was MY
 * fold that made them one. The two stores do disagree, but not in the direction the ruling records.
 *
 * 🔴 AND DROPPING `contracting` COSTS THE SUDDERTH CASE NOTHING, which is the point: the resolver
 * surfaces that pair by PREFIX CONTAINMENT (`sudderth brothers` is the start of
 * `sudderth brothers contracting`), not by suffix-stripping. The §D probes prove it still asks.
 */
export function looseVendorKey(s: string | null | undefined): string {
  const cleaned = (s ?? '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') return '';
  // Suffixes come off the END only, and repeatedly ("Foo Co, Inc." → "foo"). Stripping them
  // anywhere turns "Co-op Gardens" into "op gardens".
  let words = cleaned.split(' ');
  while (words.length > 1 && VENDOR_SUFFIXES.includes(words[words.length - 1])) {
    words = words.slice(0, -1);
  }
  return words.join(' ');
}

/** Email domain, lowercased. `office@athenstreefarm.com` → `athenstreefarm.com`. */
export function emailDomain(s: string | null | undefined): string {
  const at = (s ?? '').trim().toLowerCase().indexOf('@');
  return at === -1 ? '' : (s ?? '').trim().toLowerCase().slice(at + 1);
}

const normAcct = (s: string | null | undefined): string =>
  (s ?? '').trim().toLowerCase().replace(/[\s-]/g, '');

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE RESOLVER
 * ──────────────────────────────────────────────────────────────────────────────────────────────*/

export function resolveVendor(input: ResolveVendorInput): VendorResolution {
  const { vendors, aliases } = input;
  const captured = (input.capturedName ?? '').trim();
  const strict = normalizeVendorName(captured);

  // ── (0) Nothing to resolve. An empty vendor string is not a vendor named "" — it is an absence,
  //        and it must not create a row. D-9: an absence is never rendered as a present value.
  if (strict === '') {
    return {
      outcome: 'CREATE',
      vendorId: null,
      matchedOn: 'none',
      reasoning: 'No vendor name was captured, so there is nothing to resolve against.',
    };
  }

  const byId = new Map(vendors.map((v) => [v.id, v]));

  // ── (1) An ALIAS hit is a prior HUMAN decision being honoured. This is the "ask once, keep
  //        forever" path, and it is the reason the alias table exists.
  //        D-47 clause 3 (a stored link is a cache, not a fact) applies: an alias pointing at a
  //        vendor row that is not in the candidate set is NOT trusted — it is surfaced.
  const aliasHit = aliases.find((a) => normalizeVendorName(a.alias) === strict);
  if (aliasHit) {
    const target = byId.get(aliasHit.vendor_id);
    if (target) {
      return {
        outcome: 'LINK',
        vendorId: target.id,
        matchedOn: 'alias',
        reasoning:
          `"${captured}" was previously confirmed as another name for ${target.name}. ` +
          'Honouring that decision rather than asking again.',
      };
    }
    return {
      outcome: 'NEED_CONFIRMATION',
      vendorId: null,
      matchedOn: 'alias-dangling',
      reasoning:
        `"${captured}" is recorded as an alias, but the vendor it points to was not found. ` +
        'A stored link is a cache, not a fact (D-47) — it is not followed unverified.',
      disposition: {
        proposed: 'CREATE',
        question: `"${captured}" was linked to a vendor that no longer appears. Create it as a new vendor, or pick the right one?`,
        candidates: [],
        reasoning: 'The alias survived a vendor that did not. Re-pointing it is a decision, not a repair.',
      },
    };
  }

  // ── (2) EXACT canonical name. Unique per tenant by index, so this is D-47 clause 1 satisfied:
  //        we are matching on the field WE guarantee unique.
  const exact = vendors.filter((v) => normalizeVendorName(v.name) === strict);
  if (exact.length === 1) {
    const v = exact[0];
    const second = secondSignalAgreement(v, input);
    return {
      outcome: 'LINK',
      vendorId: v.id,
      matchedOn: second.agreed ? `name+${second.field}` : 'name',
      reasoning: second.agreed
        ? `Exact name match on ${v.name}, and the ${second.field} on the document agrees. Two independent fields concur.`
        : `Exact name match on ${v.name}. The name is unique within this business, so the match is unambiguous.`,
    };
  }

  // ⚠️ Two rows cannot share a strict name — the unique index forbids it. Reaching here means the
  //    index is missing or the caller passed rows from more than one tenant (an AC-3 violation).
  //    Refuse to pick one: an arbitrary pick IS the scar D-47 was written about.
  if (exact.length > 1) {
    return {
      outcome: 'NEED_CONFIRMATION',
      vendorId: null,
      matchedOn: 'name-collision',
      reasoning:
        `${exact.length} vendors share the name "${captured}", which the unique index should make ` +
        'impossible. Not picking one arbitrarily — that arbitrary pick is exactly the failure D-47 records.',
      disposition: {
        proposed: 'NEED_CONFIRMATION',
        question: `Several vendors are named "${captured}". Which one issued this document?`,
        candidates: exact.map((v) => ({ vendorId: v.id, name: v.name, why: 'exact name match' })),
        reasoning: 'Two records matching one guaranteed-unique field is a data fault, not an ambiguity to guess through.',
      },
    };
  }

  // ── (3) No name match. Gather everything worth ASKING about — never linking.
  const candidates: VendorCandidate[] = [];
  const seen = new Set<string>();
  const add = (v: VendorRow, why: string) => {
    if (seen.has(v.id)) return;
    seen.add(v.id);
    candidates.push({ vendorId: v.id, name: v.name, why });
  };

  // (3a) The SECOND SIGNAL matched but the name did not. 🔴 This is D-47's Terrence case and its
  //      answer is CREATE, never LINK — but the near-match is worth showing, because on the vendor
  //      side it is also the Athens/KBB shape: one operation billing under several names.
  const domain = emailDomain(input.capturedEmail);
  if (domain) {
    for (const v of vendors) if (emailDomain(v.email) === domain) add(v, `shares the email domain ${domain}`);
  }
  const acct = normAcct(input.capturedAccountNumber);
  if (acct) {
    for (const v of vendors) if (normAcct(v.account_number) === acct) add(v, `shares the account number ${input.capturedAccountNumber}`);
  }

  // (3b) LOOSE name similarity — the Sudderth case. Inference, so it may only produce a question.
  const loose = looseVendorKey(captured);
  if (loose) {
    for (const v of vendors) {
      const vl = looseVendorKey(v.name);
      if (!vl) continue;
      if (vl === loose) add(v, 'the same name once legal suffixes and punctuation are set aside');
      else if (vl.startsWith(`${loose} `) || loose.startsWith(`${vl} `)) add(v, 'one name is the start of the other');
    }
  }

  if (candidates.length === 0) {
    return {
      outcome: 'CREATE',
      vendorId: null,
      matchedOn: 'none',
      reasoning: `No existing vendor matches "${captured}" by name, alias, email domain or account number.`,
    };
  }

  const only = candidates.length === 1 ? candidates[0] : null;
  return {
    outcome: 'NEED_CONFIRMATION',
    vendorId: null,
    matchedOn: 'near-match',
    reasoning:
      `"${captured}" does not exactly match an existing vendor, but ${candidates.length} ` +
      `${candidates.length === 1 ? 'is' : 'are'} close enough to ask about. Nothing is linked until you say so.`,
    disposition: {
      proposed: 'CREATE',
      question: only
        ? `Is "${captured}" the same vendor as ${only.name}?`
        : `Is "${captured}" one of these vendors, or a new one?`,
      candidates,
      reasoning:
        'One matching field is a hint, not an identity (D-47). Confirming records an alias so this ' +
        'name is recognised next time; declining creates a separate vendor. Both are cheap; a wrong ' +
        'automatic merge is not.',
    },
  };
}

/** Does a second independent field on the document agree with this vendor row? */
function secondSignalAgreement(
  v: VendorRow,
  input: ResolveVendorInput,
): { agreed: boolean; field: string } {
  const d = emailDomain(input.capturedEmail);
  if (d && emailDomain(v.email) === d) return { agreed: true, field: 'email' };
  const a = normAcct(input.capturedAccountNumber);
  if (a && normAcct(v.account_number) === a) return { agreed: true, field: 'account' };
  return { agreed: false, field: '' };
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE WRITE PLAN — what the caller should actually do about a resolution
 * ──────────────────────────────────────────────────────────────────────────────────────────────*/

/**
 * The owner's answer to a NEED_CONFIRMATION. `null` means they have not answered yet — which is a
 * real state, not a missing value: the receipt still saves, with no vendor bound.
 */
export type VendorChoice =
  | { kind: 'same-as'; vendorId: string }   // "yes, this is that vendor" -> link AND record the alias
  | { kind: 'new' }                         // "no, it is a different firm" -> create
  | null;                                   // unanswered

export interface VendorWritePlan {
  /** Create a vendor with this name, then link the receipt to it. */
  createVendorNamed: string | null;
  /** Link the receipt to this existing vendor id. */
  linkToVendorId: string | null;
  /** Record this string as another name for `linkToVendorId`, so it is never asked again. */
  recordAlias: string | null;
  /** Why — carried to the trace log so an owner-prove can see the decision, not infer it. */
  reasoning: string;
}

const NO_WRITE = (reasoning: string): VendorWritePlan =>
  ({ createVendorNamed: null, linkToVendorId: null, recordAlias: null, reasoning });

/**
 * Turn a resolution (+ the owner's answer, if they gave one) into the writes to perform.
 *
 * 🔴 A NEED_CONFIRMATION WITH NO ANSWER WRITES NOTHING AND THE RECEIPT STILL SAVES. That is the
 * whole point of §6 rule 6 applied to identity: an unanswered identity question must never block
 * a capture. The receipt lands with `vendor_id` null — honestly unresolved, exactly as every row
 * captured before this build is — and can be resolved later. Blocking the save would trade a
 * missing link for a lost document.
 */
export function planVendorWrite(
  resolution: VendorResolution,
  choice: VendorChoice,
  capturedName: string | null | undefined,
): VendorWritePlan {
  const captured = (capturedName ?? '').trim();

  if (resolution.outcome === 'LINK' && resolution.vendorId) {
    return {
      createVendorNamed: null,
      linkToVendorId: resolution.vendorId,
      recordAlias: null,          // already known by name or by an existing alias
      reasoning: `linked by ${resolution.matchedOn}`,
    };
  }

  if (resolution.outcome === 'CREATE') {
    if (captured === '') return NO_WRITE('no vendor name captured — nothing to create');
    return {
      createVendorNamed: captured,
      linkToVendorId: null,
      recordAlias: null,
      reasoning: 'no existing vendor matched, so this is a new one',
    };
  }

  // NEED_CONFIRMATION
  if (choice === null) return NO_WRITE('identity question unanswered — receipt saves unresolved');

  if (choice.kind === 'new') {
    if (captured === '') return NO_WRITE('no vendor name captured — nothing to create');
    return {
      createVendorNamed: captured,
      linkToVendorId: null,
      recordAlias: null,
      reasoning: 'owner said this is a different vendor',
    };
  }

  // 'same-as' — link, AND record the alias. Recording it is what makes this ask ONCE rather than
  // every time; without the alias the same question returns on the next document.
  const offered = resolution.disposition?.candidates.some((c) => c.vendorId === choice.vendorId) ?? false;
  if (!offered) {
    // The chosen vendor was not among the candidates we surfaced. Refuse rather than link — a
    // choice we cannot account for is not an answer to the question we asked.
    return NO_WRITE('chosen vendor was not one of the surfaced candidates — not linking');
  }
  return {
    createVendorNamed: null,
    linkToVendorId: choice.vendorId,
    recordAlias: captured === '' ? null : captured,
    reasoning: 'owner confirmed this is another name for an existing vendor',
  };
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * DISPLAY — both vendors appear, always
 * ──────────────────────────────────────────────────────────────────────────────────────────────*/

/**
 * Display order for the vendor list.
 *
 * 🔴 PREFERRED VENDORS ARE **NOT** SORTED TO THE TOP, AND THAT IS THE POINT. A preference MARKS;
 *   it does not filter — and a sort is the quiet form of a filter. When the preferred vendor is out
 *   of stock the other one IS the answer, so ranking by preference would put the useful row below
 *   the fold on exactly the occasion it is needed. Alphabetical is neutral: both vendors sit at
 *   equal prominence and the MARK is what distinguishes them.
 */
export function orderVendorsForDisplay<T extends VendorRow>(vendors: readonly T[]): T[] {
  return [...vendors].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

/**
 * The heading for a vendor list, as a CLAIM that must hold for every row state it can contain
 * (§6 r18 — a section header is a claim, and one contradicting row makes the page say two things).
 *
 * The states enumerated: empty · none preferred · exactly one preferred · several preferred.
 * The word "Vendors" is true in all four, so it is the heading; the varying half is a SUBHEAD that
 * is conditional rather than approximate, and it never says "turn one on" to someone who may not.
 */
export function vendorListHeading(
  vendors: readonly VendorRow[],
  opts: { canSetPreference: boolean },
): { heading: string; subhead: string } {
  const preferred = vendors.filter((v) => v.preferred === true);
  if (vendors.length === 0) {
    return {
      heading: 'Vendors',
      subhead: 'No vendors yet. One is recorded the first time you capture a document from them.',
    };
  }
  if (preferred.length === 0) {
    return {
      heading: 'Vendors',
      subhead: opts.canSetPreference
        ? `${vendors.length} vendor${vendors.length === 1 ? '' : 's'}. None is marked preferred yet.`
        : `${vendors.length} vendor${vendors.length === 1 ? '' : 's'}. None is marked preferred.`,
    };
  }
  if (preferred.length === 1) {
    return {
      heading: 'Vendors',
      subhead: `${vendors.length} vendors. ${preferred[0].name} is marked preferred.`,
    };
  }
  return {
    heading: 'Vendors',
    subhead: `${vendors.length} vendors. ${preferred.length} are marked preferred.`,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * CAPTURE → VENDOR CONTACT — what the document already told us, kept instead of discarded
 * ──────────────────────────────────────────────────────────────────────────────────────────────*/

/** The vendor-side fields a captured document can carry. Shape mirrors the OCR contract. */
export interface CapturedVendorContact {
  vendor_phone?: string | null;
  vendor_email?: string | null;
  vendor_website?: string | null;
  vendor_address?: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  our_account_number?: string | null;
}

/**
 * Map what the reader found on the document onto the vendor columns, for a vendor being CREATED
 * at capture.
 *
 * 🔴 THIS EXISTS BECAUSE THE CAPTURE WAS EXTRACT-AND-DISCARD, TWICE OVER. `resolve-or-create`
 * wrote `{business_id, name}` and nothing else, so a letterhead carrying an address, a phone and
 * our account number produced a vendor row with eleven empty columns. That is the same defect
 * #257 fixed for quantity/unit_price/sku and #270 fixed for receipt_number — a value READ and
 * then thrown away one layer down, with no error and nothing to notice it. Third instance.
 *
 * ⚠️ POPULATE ON CREATE ONLY — never on a later capture, and never over an existing row. David's
 * rule for this is *"populate on create; the modal corrects it"*: a read value the owner can fix
 * beats a blank she must fill, but a second document silently rewriting a phone she corrected by
 * hand would be the machine overruling the human. An existing vendor is left exactly as it is.
 *
 * ⚠️ EVERY FIELD IS OPTIONAL AND AN ABSENT ONE IS OMITTED, not written as null or as ''. An
 * absence must stay an absence (D-9 / A9); writing '' would make "we never read one" and "the
 * document says it is blank" indistinguishable forever.
 */
export function vendorContactFromCapture(
  parsed: CapturedVendorContact | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!parsed) return out;
  const put = (col: string, raw: unknown) => {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (v !== '') out[col] = v;
  };
  put('phone', parsed.vendor_phone);
  put('email', parsed.vendor_email);
  put('website', parsed.vendor_website);
  put('account_number', parsed.our_account_number);
  const a = parsed.vendor_address;
  if (a) {
    put('address_line1', a.line1);
    put('address_city', a.city);
    put('address_state', a.state);
    put('address_zip', a.zip);
  }
  return out;
}
