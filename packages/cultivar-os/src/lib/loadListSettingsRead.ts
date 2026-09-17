// ============================================================
// loadListSettingsRead — the two reads the load list multiplies by (ledger #343).
//
// PURPOSE:      The load list holds no numbers of its own. The per-SIZE figures are the ladder's
//               (`loadContainerLadder`); the per-TREE figures are the Operations config. This reads
//               both and says, separately, what state each one came back in — because each state
//               prints a different sentence on a piece of paper nobody can click on.
//
// 🔴 THREE STATES FOR THE SIZES, AND THEY MUST NOT COLLAPSE:
//   `failed` — we do not know which sizes exist. Every tree prints unresolved AND the page says the
//              read failed; nothing is computed against a ladder we never saw.
//   `none`   — the read worked and this nursery has set up no sizes. A different sentence, pointing
//              at Settings → Container sizes.
//   `loaded` — the ladder, retired rungs included (they still resolve, R-133).
//
// 🔴 THE FIGURES ARE READ THROUGH `get_planting_materials`, SO STAFF SEE THE NURSERY'S OWN NUMBERS.
//   `business_operations_config` is gated `settings:read`, and STAFF hold no `settings:*` string
//   (tech-debt #188) — so a direct table read gave the yard person NO ROW, the same answer as
//   "nothing saved", and the page printed the standard figures. David, 2026-09-17: staff may READ the
//   four planting figures. The function (20260916_container_ladder_install_t_posts.sql §3) returns
//   exactly those to any ACTIVE member and nothing else from the row (tech-debt #309, resolved):
//     NULL → refused (not a member) · {} → nothing saved · keys → the saved figures.
//   Each answer prints a different sentence, and a refusal is never read as "nothing saved".
//
// DEPENDENCIES: ./supabase · ./containerLadderRead · @trace/shared/production.
// OUTPUTS:      LoadListSettingsRead · readLoadListSettings.
// INSTRUMENTATION (STD-003): [TRACE:LOADLIST] — ON.
// ============================================================
import { supabase } from './supabase';
import { loadContainerLadder } from './containerLadderRead';
import { resolveConfig, type OperationsConfig } from '@trace/shared/production';
import type { Ladder } from '@trace/shared/inventory';
import type { LoadListSettings } from './loadList';

export type SizesState = 'loaded' | 'none' | 'failed';
export type FiguresState = 'stored' | 'defaults_nothing_stored' | 'defaults_withheld' | 'defaults_read_failed';

export interface LoadListSettingsRead {
  settings: LoadListSettings;
  sizes: SizesState;
  sizesMessage: string | null;
  figures: FiguresState;
}

export async function readLoadListSettings(businessId: string): Promise<LoadListSettingsRead> {
  const [ladderRead, opsRes] = await Promise.all([
    loadContainerLadder(businessId),
    supabase.rpc('get_planting_materials', { p_business_id: businessId }),
  ]);

  let ladder: Ladder = [];
  let sizes: SizesState;
  let sizesMessage: string | null = null;
  if (ladderRead.phase === 'failed') { sizes = 'failed'; sizesMessage = ladderRead.message; }
  else { ladder = ladderRead.rungs; sizes = ladderRead.rungs.length ? 'loaded' : 'none'; }

  let figures: FiguresState;
  let stored: Partial<OperationsConfig> | null = null;
  const got = opsRes.data as Record<string, unknown> | null;
  if (opsRes.error) figures = 'defaults_read_failed';
  else if (got === null) figures = 'defaults_withheld';
  else if (Object.keys(got).length === 0) figures = 'defaults_nothing_stored';
  else { figures = 'stored'; stored = got as Partial<OperationsConfig>; }

  const ops = resolveConfig(stored, null, false).ops;
  console.log('[TRACE:LOADLIST] settings read', {
    businessId, sizes, rungs: ladder.length, figures, figuresError: opsRes.error?.message ?? null,
    mixRatio: ops.installMixContainerVolumesPerTree, ropeFeetPerTPost: ops.ropeFeetPerTPost,
    bubblersPerTree: ops.bubblersPerTree, deerFenceTPostsPerTree: ops.deerFenceTPostsPerTree,
  });
  return { settings: { ladder, ops }, sizes, sizesMessage, figures };
}
