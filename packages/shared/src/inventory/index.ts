export {
  resolveStockLine,
  searchStockLines,
  detectSizeCollision,
  STOCK_LINE_COLUMNS,
  STOCK_LINE_IDENTITY_COLUMNS,
} from './stockLineResolver';
export type { StockLineRow, StockLineResolution } from './stockLineResolver';
export { variantGroupSlug, skuSizeSuffix, deriveSiblingSku, baseSkuOf, suggestSiblingSku } from './variantGroup';
export { isVarietyStub, sameSizeLabel, resolveCountTarget, SIZE_REQUIRED_MESSAGE } from './countPromote';
export type { StubCandidate, CountSibling, CountTarget } from './countPromote';
