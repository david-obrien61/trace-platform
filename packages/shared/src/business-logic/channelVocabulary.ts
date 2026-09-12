// ============================================================
// channelVocabulary — THE ONE TYPESCRIPT HOME FOR THE CHANNEL LIST (ledger #310 · R-150)
//
// PURPOSE:      TypeScript's half of the one-vocabulary rule. `public.channels` is the SOURCE;
//               this file is the only place the names are written in TS, and a test binds the two.
// DEPENDENCIES: none at runtime. Bound to `supabase/migrations/20260912_channels_one_vocabulary.sql`
//               by `channelVocabulary.test.ts` §A, which parses the seed and fails BOTH directions.
// OUTPUTS:      CHANNEL_NAMES · ChannelName · isChannelName · CHANNEL_SEED_MIGRATION
//
// 🔴 THE HONEST ANSWER TO "HOW DOES THE TS TYPE STAY TRUE TO THE TABLE", BECAUSE DAVID ASKED FOR
// THE ANSWER OR THE ADMISSION:
//
//   **It cannot be DERIVED. TypeScript has no way to read a database at compile time** — there is no
//   codegen step in this repo and adding one would make every build need database access. So the
//   names are, unavoidably, written down twice: once in the migration's seed and once here.
//
//   **What it CAN be is GUARDED, and that is what ships.** `channelVocabulary.test.ts` §A parses the
//   `INSERT INTO public.channels` statement out of the migration file and asserts the two lists are
//   EXACTLY equal — a name in the migration and not here FAILS, and a name here and not in the
//   migration FAILS. So this is a copy that cannot drift silently, which is the distinction that
//   matters: the defect being fixed was not "the list is written twice", it was "the list is written
//   four times and nothing notices when they disagree."
//
//   **Call it what it is: a guarded copy, not a derived type.** It is the #179 pattern — there
//   `VENDORS_SELECT` named ten columns while its migration created fourteen, and the fix was to make
//   the migration the source and a probe the binding. One copy with a red-on-drift cap is the
//   strongest thing available without codegen; claiming it is "derived" would be the kind of
//   overstatement this pass exists to remove.
//
// ⚠️ The union replaces `CampaignPost.platform`'s hand-typed `'instagram' | 'facebook' | 'sms' |
// 'email'` (shared/src/campaigns/types.ts) — the FOURTH copy, which still held the pre-8-June list
// and would have rejected `tiktok` at COMPILE time even after the database accepted it.
// ============================================================

/** The file this list is bound to. Named as data so the test cannot drift from the thing it parses. */
export const CHANNEL_SEED_MIGRATION = 'supabase/migrations/20260912_channels_one_vocabulary.sql';

/**
 * Every channel in `public.channels`, in seed order.
 *
 * Adding a channel is a MIGRATION (a row in `channels`) plus one entry here — and the test refuses
 * either without the other. It is deliberately NOT sorted alphabetically: the order mirrors the
 * seed's `sort_order`, so a reader comparing the two files reads them top to bottom.
 */
export const CHANNEL_NAMES = [
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'sms',
  'email',
] as const;

export type ChannelName = typeof CHANNEL_NAMES[number];

/**
 * Runtime narrowing for a value that arrived from outside TypeScript — a config blob, a request
 * body, a database row. The compile-time union cannot help there, and this is what replaces the
 * confidence the old hand-typed union pretended to give.
 */
export function isChannelName(v: unknown): v is ChannelName {
  return typeof v === 'string' && (CHANNEL_NAMES as readonly string[]).includes(v);
}

/**
 * A channel as the app uses it. `guidance` comes from the TABLE, not from a map in code — the
 * generator's old `CHANNEL_GUIDANCE` constant was a second thing to keep in step and is gone.
 */
export interface Channel {
  name:     ChannelName;
  kind:     string;          // 'social' | 'sms' | 'email' — drives post counts, not validation
  label:    string;
  guidance: string | null;
  active:   boolean;
}

/** The columns a reader of `channels` selects. One list, imported — never restated (A4 / #179). */
export const CHANNEL_COLUMNS = 'name, kind, label, guidance, active, sort_order';
