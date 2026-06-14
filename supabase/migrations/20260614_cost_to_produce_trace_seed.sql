-- Migration: Cost-to-Produce — TRACE tenant-zero config seed
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Run in Supabase SQL editor → bgobkjcopcxusjsetfob project
-- Date: 2026-06-14
--
-- WHAT THIS DOES
--   Seeds ONE business_modules row (module_key='cost_to_produce') with TRACE's real
--   tenant-zero numbers so the Cost-to-Produce tile computes real output day one and
--   David can tune it. DATA-ONLY: inserts into the existing business_modules table.
--   NO schema change (no table/column/policy/constraint/trigger touched) — so the
--   schema-verification gate does not apply; the verification is the computed numbers
--   (see scripts/verify-cost-to-produce.ts output in the handoff).
--
--   Idempotent: ON CONFLICT updates config and (re)enables the module.
--   NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- ⚠️ [NEEDS DAVID] BEFORE RUNNING — confirm the TARGET business:
--   This seeds the TRACE Enterprises tenant-zero business (the self/general tenant,
--   customer-month denominator). The resolver below picks the business by
--   business_type='general' first, else name ILIKE 'TRACE%'. If your TRACE row uses a
--   different business_type/name, set @target by hand (uncomment the explicit block).
--
-- ⚠️ [NEEDS DAVID] DATA FLAGS embedded in the config:
--   - Claude Pro $17/mo is marked CONFIRMED but may be Pro Max (~$100). Verify + edit.
--   - Labor hours = 0 (so labor contributes $0 until you set it). Set hours in Settings.
--   - Hardware / Claude API / 6 domains / Blotato / Resend / Twilio are UNKNOWN (no $).
--
-- ⚠️ [NEEDS DAVID] RLS: tuning this config from the Settings UI requires you to be an
--   ACTIVE row in business_members for this business (business_modules RLS is
--   membership-scoped, no owner fallback). If saving from Settings fails, add yourself
--   as a member of the TRACE business. (This SQL seed bypasses RLS — runs as the editor.)

DO $$
DECLARE
  v_business_id uuid;
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
        { "label": "Claude Pro (incl. Claude Code)", "amount": 17, "period": "monthly", "confidence": "CONFIRMED", "note": "may be Pro Max ~$100 — David verify current plan" },
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
  -- Resolve the TRACE tenant-zero business.
  SELECT id INTO v_business_id FROM businesses WHERE business_type = 'general' ORDER BY created_at LIMIT 1;
  IF v_business_id IS NULL THEN
    SELECT id INTO v_business_id FROM businesses WHERE name ILIKE 'TRACE%' ORDER BY created_at LIMIT 1;
  END IF;

  -- Explicit override — uncomment and set if the resolver picks the wrong row:
  -- v_business_id := '________-____-____-____-____________'::uuid;

  IF v_business_id IS NULL THEN
    RAISE NOTICE 'Cost-to-Produce seed SKIPPED: no business_type=general or name ILIKE TRACE%% found. Set v_business_id by hand.';
    RETURN;
  END IF;

  INSERT INTO business_modules (business_id, module_key, enabled, configured, config)
  VALUES (v_business_id, 'cost_to_produce', true, true, v_config)
  ON CONFLICT (business_id, module_key)
  DO UPDATE SET config = EXCLUDED.config, enabled = true, configured = true;

  RAISE NOTICE 'Cost-to-Produce seeded for business_id=%', v_business_id;
END $$;

-- ============================================================
-- VERIFICATION (run after) — confirms the row landed:
--   SELECT business_id, module_key, enabled, configured,
--          config->'locations'->0->'recurring' AS recurring
--   FROM business_modules WHERE module_key = 'cost_to_produce';
--
-- Expected: enabled=true, configured=true, 10 recurring lines (4 priced, 6 UNKNOWN).
-- The tile then computes loaded floor $40.00/mo → price at N=1/5/20/100 (40% margin),
-- with 6 UNKNOWN costs surfaced (never zeroed).
-- ============================================================
