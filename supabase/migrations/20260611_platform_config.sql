-- TRACE Platform — Infrastructure Configuration Table
-- AC-1: ✅ No vertical nouns. platform_config is shared infrastructure.
-- AC-2: ✅ No authenticated-user SELECT policy intentionally — this is operator config, not tenant data.
--          Service key (server-side) bypasses RLS. No client-side read path.
-- STD-008: Apply in bgobkjcopcxusjsetfob Supabase SQL editor, then run VERIFICATION QUERY below.

-- Create the platform_config table
CREATE TABLE IF NOT EXISTS platform_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS — no user-facing policies. Server-side service key bypasses RLS.
-- WHY: platform_config holds infrastructure values (model names, feature flags).
-- Not tenant-scoped data. An authenticated browser session must NOT be able to read
-- or write this table (AC-2). Service key reads only on the server.
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Seed OCR model names
-- These are the values deployed after the gemini-2.0-flash deprecation (2026-06-11).
-- To swap the primary model without a code deploy: UPDATE platform_config SET value='...' WHERE key='ocr_primary_model';
-- That row-edit is the ONLY change needed. ocr.ts reads this on every request.
INSERT INTO platform_config (key, value, description) VALUES
  (
    'ocr_primary_model',
    'gemini-2.5-flash',
    'Primary OCR provider model for receipt scanning. Edit this row to swap models without a code change. Format: Google model name used in /v1beta/models/{name}:generateContent endpoint.'
  ),
  (
    'ocr_fallback_model',
    'claude-haiku-4-5-20251001',
    'Fallback OCR provider model if primary fails. Edit this row to swap models without a code change. Format: Anthropic model ID string passed to claude.messages.create({ model }).'
  )
ON CONFLICT (key) DO NOTHING;

-- VERIFICATION QUERY: expect 2 rows — ocr_fallback_model + ocr_primary_model
-- SELECT key, value FROM platform_config WHERE key IN ('ocr_primary_model', 'ocr_fallback_model') ORDER BY key;
