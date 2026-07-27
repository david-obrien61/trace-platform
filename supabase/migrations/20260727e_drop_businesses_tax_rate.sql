-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727e — DROP `businesses.tax_rate` (David's ruling: config wins). SEED FIRST.
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres — **ONLY AFTER the seed ships** (seedPricingConfig, wired into both create
-- paths in this same commit). ORDER MATTERS AND THIS IS WHY:
--
-- Dropping the column before a seed exists does not break anything TODAY — nothing reads it. But
-- it removes the last place a tax rate is written down for a tenant with no config row, and every
-- NEW tenant would land in 'not_identified' with no path out except someone remembering to type a
-- rate into Settings. Seed first, then drop, and neither step is ever the only thing standing.
--
-- THE DISAGREEMENT THIS ENDS (David found it, 2026-07-27):
--   businesses.tax_rate  → 0.0825 on ALL THREE tenants (numeric NOT NULL)
--   config->>'taxRate'   → 0.076 on f7ec5d67, NULL on the other two
-- Two stores, one money fact, already disagreeing by 0.65 percentage points on the live tenant.
--
-- WHY CONFIG WINS AND THE COLUMN GOES:
--   · `get_business_tax_rate` READS config. `set_business_tax_rate` WRITES config. Neither has
--     ever touched the column, so the column can only ever go stale — and had.
--   · Nothing reads it. CORPUS: packages/cultivar-os/src, packages/cultivar-os/api,
--     packages/shared/src, scripts — every hit is a COMMENT saying "NOT businesses.tax_rate"
--     (CartReview.tsx:38, submit.ts:280, Settings.tsx:227) plus a form field of that name that
--     reads config.taxRate. D-40 migrated every reader and left the column behind.
--   · Making it the SEED SOURCE instead would institutionalise the disagreement rather than end
--     it: two writable representations, one authoritative, both plausible to the next reader.
--     STD-011 — one representation of one fact, and this one is money on a customer invoice.
--
-- ⚠️ NOT REVERSIBLE BY RE-ADDING THE COLUMN. The VALUES go with it. If the config row for a
-- tenant is missing or has a null taxRate, that tenant's rate is not recoverable from here — run
-- the pre-check below and write down anything that surprises you BEFORE dropping.

-- ── PRE-CHECK — the two stores, side by side, one row per tenant. RUN IT AND READ IT.
--    EXPECT: every business with a non-null column value ALSO has a config value you are content
--    to keep, or is a tenant you do not care about. A row with a column value and a NULL config
--    value is a rate about to be forgotten.
-- SELECT b.id, b.name, b.tax_rate AS column_value,
--        pc.config->>'taxRate'    AS config_value,
--        (pc.business_id IS NULL) AS has_no_config_row
--   FROM public.businesses b
--   LEFT JOIN public.business_pricing_config pc ON pc.business_id = b.id
--  ORDER BY b.name;

BEGIN;

ALTER TABLE public.businesses DROP COLUMN IF EXISTS tax_rate;

COMMIT;

-- ── V1 — NEGATIVE: the column is gone. EXPECT 0 rows.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='businesses' AND column_name='tax_rate';

-- ── V2 — the surviving store answers for every tenant. EXPECT one row per business; a NULL
--    taxrate is CORRECT and honest for a tenant whose owner has not set one (it renders the
--    redline), but `has_no_config_row` must be FALSE everywhere once the seed has shipped.
-- SELECT b.name, pc.config->>'taxRate' AS taxrate, (pc.business_id IS NULL) AS has_no_config_row
--   FROM public.businesses b
--   LEFT JOIN public.business_pricing_config pc ON pc.business_id = b.id
--  ORDER BY b.name;
