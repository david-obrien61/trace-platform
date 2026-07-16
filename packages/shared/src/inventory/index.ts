export {
  resolveStockLine,
  searchStockLines,
  detectSizeCollision,
  STOCK_LINE_COLUMNS,
  STOCK_LINE_IDENTITY_COLUMNS,
} from './stockLineResolver';
export type { StockLineRow, StockLineResolution } from './stockLineResolver';
export { variantGroupSlug, skuSizeSuffix, deriveSiblingSku } from './variantGroup';
export { isVarietyStub, sameSizeLabel, baseSkuOf, resolveCountTarget } from './countPromote';
export type { StubCandidate, CountSibling, CountTarget } from './countPromote';
