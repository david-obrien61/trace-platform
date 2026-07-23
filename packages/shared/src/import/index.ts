// The CSV catalog-import pure core — parse, map, resolve. No DB, no React (reconcileMath shape).
// The write orchestration lives in the consuming app (cultivar-os/src/pages/importWrites.ts),
// because only it holds supabase + the session actor.
export { parseCsv, type ParsedCsv } from './parseCsv';
export {
  mapColumns, duplicateSpineTargets, SYNONYMS, SPINE_FIELDS,
  type ColumnMapping, type SpineField, type MapTarget, type Rung,
} from './columnMap';
export {
  resolveImportPlan, planAgainstLot, projectRows, parseQty, parsePrice,
  type ImportPlan, type ImportRowPlan, type ImportVerdict, type MappedRow, type FieldDelta,
} from './importPlan';
