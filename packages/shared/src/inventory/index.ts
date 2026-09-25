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
export {
  parseUnitOfMeasure, unitColumnsFor, withUnitColumns, findMultiUnitGroups, summariseUnits,
  UNIT_COLUMNS, UNIT_KINDS,
} from './unitOfMeasure';
export type { UnitKind, UnitParse, UnitColumns, MultiUnitGroup, MultiUnitCandidate, UnitSummary, UnitSummaryRow } from './unitOfMeasure';

// The container ladder — a container size is a rung, not a number (ledger #326).
export {
  foldLabel, numericKeysOf, resolveRung, rungsAbove, nextRung, validateLadder, handlingFor,
  sameSizeOnLadder, largestRung, activeRungs, LADDER_FIELDS, LADDER_SELECT, rungFromRow, ladderCoverage,
  caliperText, standardCaliperHeightInches, CALIPER_STANDARD,
} from './containerLadder';
export type { Rung, Ladder, RungResolution, LadderConflict, LadderRow, LadderCoverage } from './containerLadder';
export { RETIRED_COLUMN, onlyLiveInventory, RETIRED_HIDDEN_NOTE } from './retiredFilter';
export type { LiveFilterable } from './retiredFilter';
export { shapeCollisionKey, findShapeCollisions, collisionReason, moneyAtStake } from './shapeCollision';
export type { ShapeCandidate, ShapeCollision } from './shapeCollision';

// One item, held in one unit, sold in several — the item-master / unit-of-measure standard.
// A missing conversion REFUSES; it never falls back to 1:1 (ledger #409).
export {
  drawForSale, chainProblem, onHandInBase, inDisplayUnit, proposeSaleUnits,
  SALE_UNIT_COLUMNS, SALE_UNIT_SELECT,
} from './saleUnits';
export type { SaleUnit, SaleUnitResolution, OnHandInBase, SaleUnitProposal } from './saleUnits';
// What one install consumes, as configuration rather than code (ledger #411).
// 🔴 It DECLARES and EVALUATES a mapping; `loadList.ts` remains the one place the install
// arithmetic lives. An unlinked component is REPORTED, never skipped.
export { evaluateKit, kitProblem, KIT_RULES, KIT_COLUMNS, KIT_SELECT } from './installKit';
export type { KitRule, KitComponent, StopKitFacts, KitLine, KitEvaluation } from './installKit';
