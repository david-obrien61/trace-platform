-- Migration: Cost-to-Produce — RESTORE recurring cost lines destroyed by the truncation bug
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Target business: 45830ba7-9961-403f-b048-77f022fb48dc (TRACE tenant-zero)
-- Date: 2026-06-14
--
-- WHY
--   The Cost-to-Produce config panel silently truncated business_modules.config.recurring[]
--   from 10 lines to 2 on a save (load returned short → save overwrote — see commit
--   "fix(cost-to-produce): panel load dropped lines + save truncated recurring[]"). The panel
--   bug is fixed FIRST (load hardened + save refuses to shrink); this restores the 8 lost lines.
--
--   Restores the canonical 10-line array, PRESERVING David's confirmed edits:
--     • Claude Pro = $100 / CONFIRMED  (was seeded $17 "may be Pro Max"; David confirmed $100)
--     • Gemini     = $20  / CONFIRMED
--   The other 8 lines are the original seed (20260614_cost_to_produce_trace_seed.sql).
--
--   DATA-ONLY: updates one existing business_modules row's config jsonb. NO schema change
--   (no table/column/policy/constraint/trigger) — schema-verification gate does not apply.
--   Idempotent: re-running re-applies the same 10-line array. NEVER EDIT APPLIED MIGRATIONS.
--
-- ⚠️ MUST run AFTER the panel fix is deployed — otherwise the next save can truncate again.

DO $$
DECLARE
  v_business_id uuid := '45830ba7-9961-403f-b048-77f022fb48dc';
  v_config jsonb := $json$
{
  "version": 1,
  "unitLabel": "customer-month",
  "denominators": [1, 5, 20, 100],
  "margin": {
    "baseline": 0.40,
    "tiers": [
      { "name": "walk-in", "marginOverride": 0.40, "isDefault": true },
      { "name": "friends-family", "marginOverride": 0.20 },
      { "name": "contractor", "marginOverride": 0.30 }
    ]
  },
  "priceReference": 149,
  "locations": [
    {
      "id": "base",
      "name": "TRACE (base)",
      "kind": "base",
      "overheadPerUnit": 0,
      "labor": { "rate": 75, "hours": 0, "period": "monthly", "confidence": "CONFIRMED" },
      "recurring": [
        { "label": "Claude Pro (incl. Claude Code)", "amount": 100, "period": "monthly", "confidence": "CONFIRMED" },
        { "label": "Gemini Advanced", "amount": 20, "period": "monthly", "confidence": "CONFIRMED" },
        { "label": "TX sales tax on AI subs", "amount": 3, "period": "monthly", "confidence": "DERIVED" },
        { "label": "Infrastructure (Vercel/Supabase/GitHub)", "amount": 0, "period": "monthly", "confidence": "CONFIRMED", "note": "free tier" },
        { "label": "CoolRunnings hardware", "amount": null, "period": "monthly", "confidence": "UNKNOWN" },
        { "label": "Claude API usage", "amount": null, "period": "monthly", "confidence": "UNKNOWN" },
        { "label": "6 domains (GoDaddy)", "amount": null, "period": "annual", "confidence": "UNKNOWN" },
        { "label": "Blotato", "amount": null, "period": "monthly", "confidence": "UNKNOWN" },
        { "label": "Resend", "amount": null, "period": "monthly", "confidence": "UNKNOWN" },
        { "label": "Twilio", "amount": null, "period": "monthly", "confidence": "UNKNOWN" }
      ]
    }
  ]
}
  $json$::jsonb;
BEGIN
  UPDATE business_modules
     SET config = v_config, enabled = true, configured = true
   WHERE business_id = v_business_id AND module_key = 'cost_to_produce';

  IF NOT FOUND THEN
    INSERT INTO business_modules (business_id, module_key, enabled, configured, config)
    VALUES (v_business_id, 'cost_to_produce', true, true, v_config);
  END IF;

  RAISE NOTICE 'Cost-to-Produce restored to 10 recurring lines for business_id=%', v_business_id;
END $$;

-- ============================================================
-- VERIFICATION (run after):
--   SELECT jsonb_array_length(config->'locations'->0->'recurring') AS lines
--   FROM business_modules
--   WHERE business_id = '45830ba7-9961-403f-b048-77f022fb48dc'
--     AND module_key = 'cost_to_produce';
--   Expected: 10 (Claude Pro $100, Gemini $20, TX tax $3, Infra $0, + 6 UNKNOWN).
-- ============================================================
