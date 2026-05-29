-- ─────────────────────────────────────────────────────────────────────────────
-- IGNITION OS — Labor Phases Migration
-- Add `phase` column to `labor_entries` to distinguish EVAL vs REPAIR time
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE labor_entries 
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'REPAIR';

-- Ensure existing entries are defaulted to 'REPAIR' 
-- Future entries will explicitly specify 'EVAL' or 'REPAIR'

-- ─────────────────────────────────────────────────────────────────────────────
