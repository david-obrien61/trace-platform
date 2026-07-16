/**
 * ── qbo/customerIdentity — the THREE-WAY rule for TRACE customer → QBO customer · D-47 ──
 *
 * PURPOSE      Decide, from the QBO candidate set, whether a TRACE customer LINKS to an
 *              existing QBO customer, gets a NEW one CREATED, or is a real ambiguity the
 *              OWNER must resolve. This is the ONE resolution path (STD-011); the caller
 *              owns the IO (querying QBO, creating), this owns the DECISION.
 * DEPENDENCIES ../utils/personName (personNamesMatch — reuses the #61 token-set engine).
 * OUTPUTS      QboMatchVerdict — { action: 'link'|'create'|'surface', qbCustomerId?, rule,
 *              reason, emailHits, nameHits } for the [TRACE:QBO] trail.
 *
 * THE SCAR (2026-07-15, PROVEN LIVE — tech-debt #53):
 *   The old matcher keyed on EMAIL ALONE — `select * from Customer where PrimaryEmailAddr
 *   = '<email>'` → `Customer[0]` — with no name comparison. TRACE "TERRENCE OBRIEN" /
 *   david_obrien2016@outlook.com bound to QBO customer 81 = "Andrew O'Brien" because they
 *   share an email. NINE real invoices over two months were billed to Andrew. It was silent
 *   because every TRACE surface showed the correct customer; it only surfaced when David
 *   opened QuickBooks and read the name.
 *
 * THE ROOT ASYMMETRY (the lesson this file encodes):
 *   QBO enforces DisplayName UNIQUE. QBO does NOT enforce unique email. Families share an
 *   email; an office shares one across staff. TRACE matched on the ONE field QBO permits to
 *   collide and ignored the ONE it guarantees. An external system's identity key must be
 *   matched on the field that system GUARANTEES unique — never on one it permits to collide.
 *
 * THE SAFETY HIERARCHY (David's ruling — do not re-litigate):
 *   Mis-billing is CATASTROPHIC (money, trust, legal). A duplicate QBO customer is ANNOYING
 *   and fixable. Therefore EVERY ambiguous case resolves toward CREATE or SURFACE — NEVER
 *   toward a guessed link. Two independent fields must concur before we bind an identity.
 *
 *   | email match | name match | action                                                  |
 *   |-------------|------------|---------------------------------------------------------|
 *   | yes         | yes        | LINK    — two independent fields concur, safe           |
 *   | no          | no         | CREATE  — new party                                     |
 *   | YES         | NO         | CREATE  — ← the Terrence case. NEVER link.             |
 *   | no          | YES        | SURFACE — could be a 2nd David Smith; owner decides    |
 */

import { personNamesMatch } from '../utils/personName';

/** A QBO Customer as far as identity resolution cares. */
export interface QboCustomerCandidate {
  id: string;
  displayName: string | null;
  email: string | null;
}

/** What the TRACE side knows about the party. */
export interface TraceParty {
  name: string | null;   // the DisplayName we would use — "TERRENCE OBRIEN"
  email: string | null;
}

export type QboMatchAction = 'link' | 'create' | 'surface';

export interface QboMatchVerdict {
  action: QboMatchAction;
  /** Set ONLY when action === 'link'. */
  qbCustomerId?: string;
  /** Which row of the three-way table fired — for the [TRACE:QBO] trail. */
  rule: string;
  /** Owner-actionable prose. On 'surface' this is what the push refuses WITH. */
  reason: string;
  emailHits: QboCustomerCandidate[];
  nameHits: QboCustomerCandidate[];
}

/** Email equality: case-fold + trim. QBO does not guarantee case consistency. */
function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? '').trim().toLowerCase();
  const nb = (b ?? '').trim().toLowerCase();
  if (!na || !nb) return false; // absence is not agreement (D-9)
  return na === nb;
}

function describe(c: QboCustomerCandidate): string {
  return `"${c.displayName ?? '(no name)'}" (QBO id ${c.id}, ${c.email ?? 'no email'})`;
}

/**
 * Resolve a TRACE party against the QBO candidate set.
 * `candidates` MUST be the UNION of the by-email and by-DisplayName queries — resolving
 * against only one of them would reintroduce the single-field blindness that caused the scar.
 */
export function resolveQboCustomerMatch(
  trace: TraceParty,
  candidates: QboCustomerCandidate[],
): QboMatchVerdict {
  const emailHits = candidates.filter(c => emailsMatch(c.email, trace.email));
  const nameHits  = candidates.filter(c => personNamesMatch(c.displayName, trace.name));

  // ── Both fields concur ON THE SAME RECORD → the only safe LINK. ────────────────────────
  const concur = candidates.filter(c => emailsMatch(c.email, trace.email) && personNamesMatch(c.displayName, trace.name));

  if (concur.length === 1) {
    return {
      action: 'link', qbCustomerId: concur[0].id, rule: 'email-yes/name-yes → LINK',
      reason: `Email and name both match ${describe(concur[0])}.`,
      emailHits, nameHits,
    };
  }
  if (concur.length > 1) {
    // QBO's unique-DisplayName should make this impossible; if it happens, it is a real
    // ambiguity and we must not pick one arbitrarily (that arbitrary [0] pick IS the scar).
    return {
      action: 'surface', rule: 'multiple records match BOTH email and name → SURFACE',
      reason: `${concur.length} QuickBooks customers match this customer's name AND email: ${concur.map(describe).join('; ')}. `
            + `TRACE will not guess which one to bill. Merge or rename them in QuickBooks, then push again.`,
      emailHits, nameHits,
    };
  }

  // ── No single record concurs. ─────────────────────────────────────────────────────────
  // The name is TAKEN by a record whose email disagrees. We cannot LINK (that is the
  // cross-identity bug) and we cannot CREATE (QBO enforces unique DisplayName → 6240).
  // This is a genuine ambiguity → the owner decides. Covers both "no-email/name-yes" and
  // the split case where email matches record A while the name matches record B.
  if (nameHits.length > 0) {
    return {
      action: 'surface', rule: 'name-yes/email-no → SURFACE (owner must resolve)',
      reason: `QuickBooks already has ${nameHits.map(describe).join('; ')} with this customer's name, but a different email `
            + `(TRACE has "${trace.email ?? 'no email'}"). This may be the same person with an updated email, or a different `
            + `person with the same name — TRACE will not guess. Resolve it in QuickBooks (correct the email, or rename one), then push again.`,
      emailHits, nameHits,
    };
  }

  // ── The Terrence case: the email collides but the name disagrees. NEVER link. ──────────
  if (emailHits.length > 0) {
    return {
      action: 'create', rule: 'email-YES/name-NO → CREATE (never link — the Terrence rule)',
      reason: `Email matches ${emailHits.map(describe).join('; ')}, but the name does not. QBO does not enforce unique email `
            + `(families and offices share one), so an email match alone is not identity — creating a new QuickBooks customer instead.`,
      emailHits, nameHits,
    };
  }

  // ── Nothing matched → a new party. ────────────────────────────────────────────────────
  return {
    action: 'create', rule: 'email-no/name-no → CREATE (new party)',
    reason: 'No QuickBooks customer matches this customer by email or name.',
    emailHits, nameHits,
  };
}
