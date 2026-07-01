// ============================================================
// assets — shared asset-capture primitives (general `business_`-layer).
// PURPOSE:  Barrel for the vertical-agnostic pieces of the capture→value→manage
//           asset pipeline. First consumer = Cultivar AssetCapture. The
//           orchestration + UI live in the app (dependency locality: compression,
//           supabase client, and the OCR endpoint are app-resident); this shared
//           slice is the reusable NET-NEW half — device-side blob hold for the
//           dead-zone path (recon #4, 2026-07-01).
// DEPENDENCIES: see assetBlobStore header.
// OUTPUTS:  the pending-asset blob store + its record type.
// ============================================================

export {
  putPendingAsset,
  listPendingAssets,
  deletePendingAsset,
  countPendingAssets,
} from './assetBlobStore';
export type { PendingAssetCapture } from './assetBlobStore';
