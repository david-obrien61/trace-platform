export {
  resolveStockLine,
  searchStockLines,
  detectSizeCollision,
  STOCK_LINE_COLUMNS,
  STOCK_LINE_IDENTITY_COLUMNS,
  stockLineColumnsFor,
} from './stockLineResolver';
export type { StockLineRow, StockLineResolution } from './stockLineResolver';
// R-11's read-honesty union, re-exported here so a resolver consumer imports the outcome type
// from the same place it imports the resolver (one import line, not two slices).
export { readOk, readFailed, readFailureMessage } from '../utils/readResult';
export type { ReadResult, ReadFailure } from '../utils/readResult';
export { variantGroupSlug, skuSizeSuffix, deriveSiblingSku, baseSkuOf, suggestSiblingSku } from './variantGroup';
export { isVarietyStub, sameSizeLabel, resolveCountTarget, SIZE_REQUIRED_MESSAGE } from './countPromote';
export type { StubCandidate, CountSibling, CountTarget } from './countPromote';
