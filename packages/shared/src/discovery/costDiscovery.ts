/**
 * ── COST-DISCOVERY (cost-to-produce extraction, reasoning-under-uncertainty) ──────
 *
 * PURPOSE: Drive a question flow that REASONS about a grower's cost-to-produce for a
 *   single inventory line (e.g. "30-gal Live Oak") and writes
 *   business_inventory.unit_cost + cost_confidence. Each owner answer re-runs the
 *   reasoning, so confidence SHARPENS as inputs accumulate — typically ESTIMATED
 *   (a stated guess) → DERIVED (computed from confirmed inputs). Routed to Opus
 *   (reasoning-under-uncertainty) via the existing per-capability model routing,
 *   per-business override still honored (capabilities.ts `discovery_cost` + execute.ts).
 *
 *   This mirrors the catalog-discovery cut (catalog.ts) — same honest-extractor
 *   posture, pointed at COST instead of price/variety. It is a new capability +
 *   wiring, NOT a schema change: business_inventory.unit_cost (nullable) and
 *   cost_confidence (CONFIRMED|DERIVED|ESTIMATED|UNKNOWN) already exist
 *   (20260612_business_assets_inventory_cost_confidence.sql).
 *
 * DEPENDENCIES:
 *   - executeCapability('discovery_cost', …) — the shared AI gateway (Opus).
 *   - business_inventory (live, tenant-scoped) — the write target.
 *
 * HONESTY CONTRACT (the real risk surface — enforced in CODE, not just the prompt):
 *   1. NEVER writes 'CONFIRMED'. CONFIRMED is reserved for receipt-linked cost only
 *      (D-9, the count-once seam). `guardReasoning` REJECTS (raises) any model output
 *      that attempts CONFIRMED; the writer guard rejects it again at the DB boundary.
 *   2. NEVER fabricates a number to fill a gap. A missing/invalid/non-positive cost
 *      collapses to UNKNOWN (null) — unknown stays UNKNOWN.
 *   3. ESTIMATED = the owner's stated guess. DERIVED = computed from other confirmed
 *      inputs (and carries the derivation). A DERIVED claim with no derivation is
 *      demoted to ESTIMATED — a guess is never dressed up as a derivation.
 *   4. A declined or unanswerable question leaves the line WHERE IT WAS, honestly
 *      labeled — `applyCostReasoning` makes NO write when the turn is UNKNOWN.
 *
 * Instrumentation: emits [TRACE:COSTDISC] (turn / guard / apply). ON by default per
 *   the standing owner instruction — do NOT disable any emit until owner-proven.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { executeCapability } from '../ai/execute';

/** The full four-value enum as it lives on business_inventory.cost_confidence. */
export type InventoryCostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';
/** What this capability is ALLOWED to produce — CONFIRMED is structurally excluded. */
export type DiscoveredCostConfidence = 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';

/** Thrown when the model (or a caller) attempts to claim CONFIRMED — receipt-grade
 *  cost the reasoning layer is forbidden from asserting. */
export class CostConfidenceViolation extends Error {
  constructor(attempted: string) {
    super(`cost-discovery may never claim CONFIRMED (receipt-linked only, D-9) — got "${attempted}"`);
    this.name = 'CostConfidenceViolation';
  }
}

/** A business_inventory line we are reasoning a cost for. */
export interface CostDiscoveryLine {
  id:                string;                       // business_inventory.id
  businessId:        string;                       // tenant scope (RLS / write predicate)
  name:              string;                       // e.g. "30-gal Live Oak"
  category:          string | null;
  currentCost:       number | null;                // existing unit_cost, if any
  currentConfidence: InventoryCostConfidence | null;
}

/** One question the flow asks the owner. */
export interface CostQuestion {
  id:     string;                                  // stable key, e.g. 'acquisition' | 'grow_time'
  prompt: string;                                  // the human-facing question
}

/** One owner answer. Empty/whitespace text === declined / unanswerable. */
export interface CostAnswer {
  questionId: string;
  text:       string;
}

/** The model's reasoning, AFTER the code honesty-guard. */
export interface CostReasoning {
  cost:        number | null;                      // null = could not determine → UNKNOWN
  confidence:  DiscoveredCostConfidence;
  basis:       string;                             // the "why" — narrative, surfaced to the owner
  derivation:  string | null;                      // the computation, present only for DERIVED
}

/** One turn of the flow: the current best reasoning + the next question (or done). */
export interface CostTurn {
  reasoning:    CostReasoning;
  nextQuestion: CostQuestion | null;               // null = the model has enough; ready to apply
  needMore:     boolean;
}

/** Raw shape the model returns — never trusted directly; passed through guardReasoning. */
interface RawCostReasoning {
  cost?:         number | string | null;
  confidence?:   string;
  basis?:        string;
  derivation?:   string | null;
  needMore?:     boolean;
  nextQuestion?: { id?: string; prompt?: string } | null;
}

const TRACE = '[TRACE:COSTDISC]';

// ── Prompt (mirrors catalog.ts honesty posture, pointed at COST) ────────────────────

const COST_DISCOVERY_SYSTEM = `You are a cost-to-produce reasoning assistant for TRACE, a platform for owner-operated small businesses (e.g. a tree nursery). You help an owner arrive at the cost to PRODUCE one unit of a specific inventory line. You reason; you do not invent.

You output a current best cost estimate AND drive a short question flow that sharpens it.

HARD HONESTY RULES — these are not negotiable:
- You MUST NEVER claim "CONFIRMED". CONFIRMED is reserved for cost backed by an actual receipt, which you do not have. Your only valid confidence values are "ESTIMATED", "DERIVED", or "UNKNOWN".
- "ESTIMATED" = the owner gave you a stated guess, or you reasoned a ballpark from category knowledge the owner confirmed. It is honest but soft.
- "DERIVED" = you COMPUTED the cost from other inputs the owner CONFIRMED (e.g. liner cost + months in pot × monthly carrying cost + materials). Only use DERIVED when you can show the arithmetic, and put that arithmetic in "derivation".
- NEVER label a guess "DERIVED" to make it look stronger. If you cannot show the computation, it is "ESTIMATED".
- NEVER fabricate a number to fill a gap. If you genuinely cannot estimate, set "cost" to null and "confidence" to "UNKNOWN". Unknown stays unknown.
- If the owner declines or cannot answer, do NOT guess past it — keep the current confidence honest and either ask a different question or stop.

QUESTION FLOW:
- Ask ONE focused question at a time that would most improve the estimate (acquisition/liner cost, months in production, materials, labor, losses/shrink, etc.).
- Set "needMore": true and provide "nextQuestion" while another answer would meaningfully sharpen the estimate.
- Set "needMore": false and "nextQuestion": null once you have enough to stand behind the figure (or once it is clear no further answer will help).

Return ONLY valid JSON. No markdown fences, no prose outside the JSON.`;

export function buildCostPrompt(line: CostDiscoveryLine, answers: CostAnswer[]): string {
  const qa = answers.length
    ? answers.map(a => `- [${a.questionId}] answer: ${a.text.trim() ? `"${a.text.trim()}"` : '(declined / no answer)'}`).join('\n')
    : '(no answers yet — this is the first turn)';

  return `Inventory line we are costing:
- name: ${line.name}
- category: ${line.category ?? '(unknown)'}
- current recorded cost: ${line.currentCost == null ? 'none' : `$${line.currentCost}`} (confidence: ${line.currentConfidence ?? 'UNKNOWN'})

Owner's answers so far:
${qa}

Reason about the cost to PRODUCE one unit of this line. Return JSON:
{
  "cost": number or null,            // best current per-unit cost-to-produce, or null if genuinely unknowable
  "confidence": "ESTIMATED" | "DERIVED" | "UNKNOWN",
  "basis": "one or two sentences explaining your reasoning, grounded in what the owner actually told you",
  "derivation": "the explicit arithmetic if and only if confidence is DERIVED, else null",
  "needMore": true or false,
  "nextQuestion": { "id": "short_stable_key", "prompt": "the single next question to ask the owner" } or null
}
Remember: never "CONFIRMED"; never a fabricated number; a guess is "ESTIMATED", not "DERIVED".`;
}

// ── The code honesty-guard (the real enforcement, independent of the prompt) ─────────

function toFiniteCost(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(/[^0-9.\-]/g, '')) : (v as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n <= 0) return null;                          // 0 / negative is not a real cost — never write it
  return Math.round(n * 100) / 100;
}

/**
 * guardReasoning — enforce the honesty contract in CODE, not just the prompt.
 * - REJECTS (raises CostConfidenceViolation) any attempt to claim CONFIRMED.
 * - Collapses a missing/invalid/non-positive cost to UNKNOWN (never fabricate).
 * - Demotes DERIVED-without-derivation to ESTIMATED (a guess is never a derivation).
 * Pure + synchronous so it is trivially testable.
 */
export function guardReasoning(raw: RawCostReasoning): CostReasoning {
  const claimed = (raw.confidence ?? '').toString().trim().toUpperCase();

  // RULE 1 — never CONFIRMED. Reject loudly; the caller decides how to surface it.
  if (claimed === 'CONFIRMED') {
    console.log(JSON.stringify({ tag: TRACE, phase: 'guard:reject-confirmed', claimed }));
    throw new CostConfidenceViolation(claimed);
  }

  const cost = toFiniteCost(raw.cost);
  let confidence: DiscoveredCostConfidence =
    claimed === 'DERIVED' ? 'DERIVED' : claimed === 'ESTIMATED' ? 'ESTIMATED' : 'UNKNOWN';
  let derivation = (raw.derivation ?? '').toString().trim() || null;

  // RULE 2 — never fabricate: no real number ⇒ UNKNOWN regardless of what was claimed.
  if (cost == null) {
    if (confidence !== 'UNKNOWN') {
      console.log(JSON.stringify({ tag: TRACE, phase: 'guard:no-number-to-unknown', claimed: confidence }));
    }
    confidence = 'UNKNOWN';
    derivation = null;
  } else if (confidence === 'DERIVED' && !derivation) {
    // RULE 3 — a DERIVED claim with no shown arithmetic is just a guess → ESTIMATED.
    console.log(JSON.stringify({ tag: TRACE, phase: 'guard:derived-without-derivation-to-estimated' }));
    confidence = 'ESTIMATED';
  }
  // A non-DERIVED row never carries a derivation.
  if (confidence !== 'DERIVED') derivation = null;

  return {
    cost: confidence === 'UNKNOWN' ? null : cost,
    confidence,
    basis: (raw.basis ?? '').toString().trim() || 'no basis given',
    derivation,
  };
}

// ── Drive one turn ───────────────────────────────────────────────────────────────

export interface CostTurnOpts {
  apiKey:      string;
  businessId?: string;
  supabase?:   SupabaseClient;                     // enables per-business model override
  /** Injectable for tests/proofs — defaults to the real AI gateway. */
  _execute?:   (capabilityKey: string, opts: any) => Promise<any>;
}

/**
 * reasonCostTurn — one turn of the flow. Calls Opus with the line + answers so far,
 * runs the honesty-guard, and returns the current reasoning plus the next question.
 * Each successive call (with one more answer) typically sharpens ESTIMATED → DERIVED.
 */
export async function reasonCostTurn(
  line: CostDiscoveryLine,
  answers: CostAnswer[],
  opts: CostTurnOpts,
): Promise<CostTurn> {
  const execute = opts._execute ?? executeCapability;
  console.log(JSON.stringify({ tag: TRACE, phase: 'turn:start', line: line.name, answers: answers.length }));

  const raw: RawCostReasoning = await execute('discovery_cost', {
    businessId: opts.businessId,
    supabase:   opts.supabase,
    system:     COST_DISCOVERY_SYSTEM,
    user:       buildCostPrompt(line, answers),
    apiKey:     opts.apiKey,
  });

  const reasoning = guardReasoning(raw ?? {});

  // The model asks for more only while it both says so AND supplies a real question.
  const q = raw?.nextQuestion;
  const nextQuestion: CostQuestion | null =
    q && (q.prompt ?? '').toString().trim()
      ? { id: (q.id ?? 'next').toString().trim() || 'next', prompt: q.prompt!.toString().trim() }
      : null;
  const needMore = raw?.needMore === true && nextQuestion != null;

  console.log(JSON.stringify({
    tag: TRACE, phase: 'turn:done',
    cost: reasoning.cost, confidence: reasoning.confidence, needMore, hasNext: nextQuestion != null,
  }));

  return { reasoning, nextQuestion, needMore };
}

// ── Write the reasoned cost back to business_inventory ───────────────────────────

/**
 * costReasoningToInventoryUpdate — pure mapper from reasoning → the column patch.
 * Returns null when there is NOTHING honest to write (UNKNOWN / no number) so the
 * caller leaves the line untouched. Belt-and-suspenders: re-rejects CONFIRMED.
 */
export function costReasoningToInventoryUpdate(
  reasoning: CostReasoning,
): { unit_cost: number; cost_confidence: 'DERIVED' | 'ESTIMATED' } | null {
  // The type system already excludes CONFIRMED, but reasoning may arrive untyped at runtime.
  if ((reasoning.confidence as string) === 'CONFIRMED') {
    throw new CostConfidenceViolation('CONFIRMED');
  }
  if (reasoning.confidence === 'UNKNOWN' || reasoning.cost == null) return null;
  return { unit_cost: reasoning.cost, cost_confidence: reasoning.confidence };
}

export interface ApplyResult {
  updated:    boolean;
  unitCost:   number | null;
  confidence: InventoryCostConfidence;
  reason:     string;                              // why we wrote / why we left it alone
}

/**
 * applyCostReasoning — write the reasoned cost to business_inventory, tenant-scoped.
 * - UNKNOWN / no number → NO write; the line is left exactly where it was (honest).
 * - ESTIMATED / DERIVED → update unit_cost + cost_confidence on (id, business_id).
 * Never writes CONFIRMED; never writes a fabricated/zero number.
 */
export async function applyCostReasoning(
  line: CostDiscoveryLine,
  reasoning: CostReasoning,
  supabase: SupabaseClient,
): Promise<ApplyResult> {
  const patch = costReasoningToInventoryUpdate(reasoning);

  if (!patch) {
    console.log(JSON.stringify({ tag: TRACE, phase: 'apply:left-as-is', line: line.name, reason: 'unknown-or-no-number' }));
    return {
      updated: false,
      unitCost: line.currentCost,
      confidence: line.currentConfidence ?? 'UNKNOWN',
      reason: 'reasoning was UNKNOWN — line left where it was, no fabricated cost written',
    };
  }

  const { error } = await supabase
    .from('business_inventory')
    .update({ unit_cost: patch.unit_cost, cost_confidence: patch.cost_confidence })
    .eq('id', line.id)
    .eq('business_id', line.businessId);     // tenant predicate — never cross-tenant

  if (error) {
    console.log(JSON.stringify({ tag: TRACE, phase: 'apply:error', line: line.name, error: error.message }));
    return {
      updated: false,
      unitCost: line.currentCost,
      confidence: line.currentConfidence ?? 'UNKNOWN',
      reason: `write failed: ${error.message}`,
    };
  }

  console.log(JSON.stringify({
    tag: TRACE, phase: 'apply:wrote', line: line.name,
    unit_cost: patch.unit_cost, cost_confidence: patch.cost_confidence,
  }));
  return {
    updated: true,
    unitCost: patch.unit_cost,
    confidence: patch.cost_confidence,
    reason: `wrote ${patch.cost_confidence} cost $${patch.unit_cost}`,
  };
}
