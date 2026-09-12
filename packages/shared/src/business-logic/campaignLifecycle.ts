/**
 * ── campaignLifecycle — EDIT SCOPE, CANCEL, APPEND, and the honest post claim ──────────────
 *
 * PURPOSE:      The three rulings David made on 2026-09-12, as pure functions a test can drive:
 *                 · R-145 EDIT SCOPE  — edit is DATES and FOCUS only, and only BEFORE publication.
 *                 · R-146 CANCEL      — the verb that replaces delete; the row stays and carries state.
 *                 · R-147 APPEND      — "Generate more posts for this campaign" appends to THAT campaign.
 *               Plus the claim that hid R-147's defect for three hours: a zero-post campaign read
 *               "All posts published ✓" on the list.
 * DEPENDENCIES: none. No database, no React, no fetch — every function here is total and pure so the
 *               rulings can be proven without a session, a tenant, or a deploy.
 * OUTPUTS:      Decisions as VALUES (`{allowed, reason}`), never thrown errors and never a boolean
 *               whose false case has no explanation (D-9 — a refusal must say what it knows).
 *
 * WHY THIS FILE EXISTS. The lifecycle was missing and the missing half got IMPERSONATED by the path
 * that existed: the "Generate more posts for this campaign" button took the CREATE branch, minted a
 * second campaign and navigated onto it, and the list rendered the zero-post orphan as
 * "All posts published ✓" — so two duplicate "arbor day" rows went unnoticed for three hours
 * (`user_stories.md:1148-1153`). A lifecycle written as prose in a component is a lifecycle nobody
 * can test; these are the rules, in one place, asked by every surface.
 *
 * 🔴 THE HONESTY CONSTRAINT THAT SHAPES THE REFUSAL COPY. `campaign_posts.status='published'` is set
 * by the `copy-post` action, whose own comment reads "Mark as reviewed — owner copied it, NOT
 * auto-published". So `published` means SHE COPIED IT OUT OF TRACE. It does NOT mean the text reached
 * a feed, and it does not mean the text that reached the feed is the text we hold — she may edit it
 * after pasting. The *Truth in advertising* story states the limit in its own words
 * (`user_stories.md:1250-1252`): "the record captures what LEFT TRACE, not what was published … This
 * is not a record of publication and must never be labelled as one." The refusal below therefore
 * claims only what we know, and names cancel-and-restart as the route out.
 */

// ── R-145 · EDIT SCOPE ────────────────────────────────────────────────────────────────────────────

/**
 * The ONLY fields an edit may touch. David's ruling: "limited to DATES and FOCUS".
 *
 * ⚠️ `description` is NOT here, deliberately. It is the field an ASK currently lives in (the ask has
 * no column of its own — `campaign_call_to_action` is named in the story's PIECES and does not
 * exist), and the ask is explicitly a separate pass. `name` is not here either: renaming is identity,
 * not dates and not focus. Both are flagged to David rather than decided here.
 */
export const CAMPAIGN_EDITABLE_FIELDS = ['start_date', 'end_date', 'target_category'] as const;
export type CampaignEditableField = typeof CAMPAIGN_EDITABLE_FIELDS[number];

export interface PostStatusLike { status: string }

export interface EditLock {
  locked: boolean;
  /** How many posts the owner has copied out of TRACE. Drives the copy; never presented as "live". */
  copiedCount: number;
  /** Present ONLY when locked. Says what we know, never that anything reached a feed. */
  reason?: string;
  /** The route out, per R-145: answered and restarted, not silently rewritten. */
  route?: 'cancel-and-restart';
}

/**
 * A campaign locks to editing once ANY of its posts has been copied out of TRACE.
 *
 * The wording is load-bearing. We do NOT say "these are live", "already published to your feed", or
 * "your customers have seen this" — TRACE cannot know any of those. We say what the record actually
 * holds: she copied N of them, and we cannot see what happened next.
 */
export function campaignEditLock(posts: readonly PostStatusLike[]): EditLock {
  const copiedCount = posts.filter(p => p.status === 'published').length;
  if (copiedCount === 0) return { locked: false, copiedCount: 0 };
  return {
    locked: true,
    copiedCount,
    reason:
      `You have copied ${copiedCount} of these ${copiedCount === 1 ? 'posts' : 'posts'} out of TRACE. ` +
      `TRACE cannot see where a copied post went, or whether you changed it after pasting it — so it ` +
      `cannot know what is out there now. Changing the dates or the focus would leave this record ` +
      `disagreeing with whatever your customers are reading. Cancel this campaign and start a new one, ` +
      `so the record and the public version stay in step.`,
    route: 'cancel-and-restart',
  };
}

/** Is this specific field one an edit may touch at all? Scope, independent of the lock. */
export function isEditableCampaignField(field: string): field is CampaignEditableField {
  return (CAMPAIGN_EDITABLE_FIELDS as readonly string[]).includes(field);
}

export interface EditPlan {
  allowed: boolean;
  /** Only the in-scope, actually-changed fields. Empty when there is nothing to write. */
  patch: Partial<Record<CampaignEditableField, string | null>>;
  reason?: string;
}

/**
 * Build the UPDATE for an edit, or refuse with a reason.
 *
 * Refuses for three distinct causes, each with its own words — a single "cannot edit" would make a
 * scope problem and a publication lock indistinguishable to the person reading the screen.
 */
export function campaignEditPlan(args: {
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  posts: readonly PostStatusLike[];
}): EditPlan {
  const lock = campaignEditLock(args.posts);
  if (lock.locked) return { allowed: false, patch: {}, reason: lock.reason };

  const outOfScope = Object.keys(args.proposed).filter(k => !isEditableCampaignField(k));
  if (outOfScope.length > 0) {
    return {
      allowed: false,
      patch: {},
      reason:
        `An edit can change the dates and the focus. It cannot change ${outOfScope.join(', ')}. ` +
        `To change that, cancel this campaign and start a new one.`,
    };
  }

  const patch: Partial<Record<CampaignEditableField, string | null>> = {};
  for (const f of CAMPAIGN_EDITABLE_FIELDS) {
    if (!(f in args.proposed)) continue;
    const next = normaliseField(args.proposed[f]);
    if (next !== normaliseField(args.current[f])) patch[f] = next;
  }

  if (Object.keys(patch).length === 0) {
    // A Save that changes nothing is not an error and must not report one (STD-023 / R-110's class:
    // never tell an owner something was saved when nothing was written).
    return { allowed: false, patch: {}, reason: 'Nothing changed.' };
  }

  // Dates that cross are refused HERE rather than by the database, so the owner reads a sentence
  // instead of a constraint violation.
  const start = patch.start_date !== undefined ? patch.start_date : normaliseField(args.current.start_date);
  const end   = patch.end_date   !== undefined ? patch.end_date   : normaliseField(args.current.end_date);
  if (start && end && start > end) {
    return { allowed: false, patch: {}, reason: 'The end date is before the start date.' };
  }

  return { allowed: true, patch };
}

function normaliseField(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ── R-146 · CANCEL ────────────────────────────────────────────────────────────────────────────────

/**
 * The live vocabulary. `'cancelled'` is already in the CHECK constraint
 * (`20260529_campaigns.sql:15`) and already renders red (`Campaigns.tsx` statusColor) — nothing ever
 * wrote the value. This is the writer.
 */
export const CAMPAIGN_CANCELLED = 'cancelled';

export interface CancelPlan {
  allowed: boolean;
  nextStatus?: typeof CAMPAIGN_CANCELLED;
  reason?: string;
}

/**
 * Cancel is shelving, and the row STAYS — that is the entire reason delete was scoped out
 * ("a deleted campaign destroys its own history, and the history is the product",
 * `user_stories.md:1160`). So cancel never removes, never hides, and is refused where it would
 * rewrite something that already happened.
 */
export function campaignCancelPlan(campaign: { status: string }): CancelPlan {
  if (campaign.status === CAMPAIGN_CANCELLED) {
    return { allowed: false, reason: 'This campaign is already cancelled.' };
  }
  if (campaign.status === 'completed') {
    return {
      allowed: false,
      reason:
        'This campaign already finished. Cancelling it would say it never ran — and next season the ' +
        'record of what you ran is the point. It stays as completed.',
    };
  }
  return { allowed: true, nextStatus: CAMPAIGN_CANCELLED };
}

// ── R-147 · APPEND ────────────────────────────────────────────────────────────────────────────────

export interface AppendPlan {
  /** 'append' rides the existing campaign. 'create' mints one. The defect was doing the latter. */
  mode: 'append' | 'create';
  /** Present on append ONLY. The campaign the new posts belong to. */
  campaignId?: string;
  /** Append NEVER navigates: the owner is already on the campaign they asked about. */
  navigate: boolean;
}

/**
 * The whole of R-147, as one decision. The button reads "Generate more posts for THIS campaign" and
 * must do that: same campaign row, same URL, more posts.
 *
 * `navigate` is part of the plan rather than left to the caller because navigating away IS the defect
 * the owner experienced — two identical rows three hours apart, each one a silent walk onto a new
 * campaign. A plan that got the table right and still moved the user would reproduce the symptom.
 */
export function campaignAppendPlan(campaignId: string | null | undefined): AppendPlan {
  const id = typeof campaignId === 'string' ? campaignId.trim() : '';
  if (id === '') return { mode: 'create', navigate: true };
  return { mode: 'append', campaignId: id, navigate: false };
}

// ── THE CLAIM THAT HID IT ─────────────────────────────────────────────────────────────────────────

export type PostClaimTone = 'empty' | 'ready' | 'partial' | 'done';
export interface PostClaim { tone: PostClaimTone; text: string }

/**
 * What a campaign row on the list may truthfully say about its posts.
 *
 * 🔴 THE DEFECT THIS REPLACES, exactly: the old branch asked `draft_count > 0`, then
 * `status === 'draft'`, and ELSE said "All posts published ✓". `draft_count` counts only posts with
 * status 'draft' and NO TOTAL WAS EVER FETCHED — so the final branch meant "no drafts, and not a
 * draft campaign", which is true of a finished campaign and FALSE of a campaign with no posts at all.
 * A campaign with zero posts and status 'active' claimed every post was published. §6 r18: a claim
 * must hold for every row the branch can contain.
 *
 * THE FIX IS THE TOTAL. `total === 0` is answered FIRST and on its own, before status is consulted at
 * all — a campaign with no posts says it has no posts, whatever its status. This is also what lets
 * cancel ship: a cancelled zero-post campaign would otherwise read "All posts published ✓" beneath a
 * red CANCELLED chip, one card contradicting itself.
 *
 * ⚠️ RESIDUAL, NAMED NOT FIXED: the word "published" in the done case is itself the overclaim this
 * file's header describes — it means COPIED. Renaming it is a vocabulary change across the detail
 * page too (`publishedCount`, the per-post "Published" chip), which is not one of the three rulings.
 * Flagged to David; deliberately not taken here.
 */
export function campaignPostClaim(counts: {
  total: number;
  draft: number;
  published: number;
}): PostClaim {
  const { total, draft, published } = counts;

  if (total <= 0) return { tone: 'empty', text: 'No posts yet — open to generate' };
  if (draft > 0)  return { tone: 'ready', text: `${draft} post${draft === 1 ? '' : 's'} ready to review →` };
  if (published >= total) {
    return { tone: 'done', text: `All ${total} post${total === 1 ? '' : 's'} published ✓` };
  }
  // Posts exist, none is a draft, and not all are published — 'scheduled' / 'failed' / 'reviewed'
  // live in the CHECK too. Say the arithmetic rather than rounding it to either end.
  return { tone: 'partial', text: `${published} of ${total} posts published` };
}
