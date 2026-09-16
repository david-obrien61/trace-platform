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
// 🔴 THE FIGURES CAN BE WITHHELD, AND A WITHHELD READ LOOKS LIKE AN EMPTY ONE.
//   `business_operations_config` is gated `settings:read` (20260905_production_planning.sql), and
//   STAFF hold no `settings:*` string (tech-debt #188). Under RLS their read returns NO ROW — the same
//   answer as "nothing stored" — so the page would silently print the platform defaults for the
//   yard person while the owner's stored ratio is different. So the permission, not the row, decides:
//   a viewer without `settings:read` gets the defaults AND `figures: 'defaults_withheld'`, and the
//   page says so. Filed as tech-debt #309 (whether staff should read these four figures is a policy
//   question, and a policy is not changed inside a print view).
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

export async function readLoadListSettings(businessId: string, canReadSettings: boolean): Promise<LoadListSettingsRead> {
  const [ladderRead, opsRes] = await Promise.all([
    loadContainerLadder(businessId),
    canReadSettings
      ? supabase.from('business_operations_config').select('config').eq('business_id', businessId).maybeSingle()
      : Promise.resolve(null),
  ]);

  let ladder: Ladder = [];
  let sizes: SizesState;
  let sizesMessage: string | null = null;
  if (ladderRead.phase === 'failed') { sizes = 'failed'; sizesMessage = ladderRead.message; }
  else { ladder = ladderRead.rungs; sizes = ladderRead.rungs.length ? 'loaded' : 'none'; }

  let figures: FiguresState;
  let stored: Partial<OperationsConfig> | null = null;
  if (!opsRes) figures = 'defaults_withheld';
  else if (opsRes.error) figures = 'defaults_read_failed';
  else if (!opsRes.data) figures = 'defaults_nothing_stored';
  else { figures = 'stored'; stored = (opsRes.data.config ?? null) as Partial<OperationsConfig> | null; }

  const ops = resolveConfig(stored, null, false).ops;
  console.log('[TRACE:LOADLIST] settings read', {
    businessId, sizes, rungs: ladder.length, figures,
    mixRatio: ops.installMixContainerVolumesPerTree, ropeFeetPerTPost: ops.ropeFeetPerTPost,
    bubblersPerTree: ops.bubblersPerTree, deerFenceTPostsPerTree: ops.deerFenceTPostsPerTree,
  });
  return { settings: { ladder, ops }, sizes, sizesMessage, figures };
}
