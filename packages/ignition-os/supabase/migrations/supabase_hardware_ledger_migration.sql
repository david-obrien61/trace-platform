-- MIGRATION: Hardware Ledger Extension
-- Extends tools table with PMI tracking columns
-- Creates tool_signout_log for custody audit trail
-- Re-runnable: all statements are guarded

ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS pmi_interval_days  integer,
  ADD COLUMN IF NOT EXISTS last_pmi_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_assigned_tech text;

CREATE TABLE IF NOT EXISTS tool_signout_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tool_id           uuid        REFERENCES tools(id) ON DELETE SET NULL,
  tool_name         text        NOT NULL,
  tech_name         text        NOT NULL,
  job_id            uuid        REFERENCES jobs(id) ON DELETE SET NULL,
  action            text        NOT NULL CHECK (action IN ('CHECKED_OUT','CHECKED_IN','ACKNOWLEDGED')),
  is_manager_bypass boolean     NOT NULL DEFAULT false,
  bypass_by         text,
  bypass_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_signout_log_shop_id_idx ON tool_signout_log(shop_id);
CREATE INDEX IF NOT EXISTS tool_signout_log_tool_id_idx ON tool_signout_log(tool_id);
CREATE INDEX IF NOT EXISTS tool_signout_log_job_id_idx  ON tool_signout_log(job_id);

ALTER TABLE tool_signout_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all" ON tool_signout_log;
CREATE POLICY "pilot_all" ON tool_signout_log FOR ALL USING (true) WITH CHECK (true);
