-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VENDOR IDENTITY AND THE PREFERRED VENDOR — Option C
-- 2026-09-02 · David's ruling: "Terry sets preferred vendor in a screen, not necessarily by item —
--              both items were the same tree, the quality was different."
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes. (CLAUDE.md §6 r1.)
--
-- ── WHAT THIS IS FOR, IN TERRY'S TERMS ──────────────────────────────────────────────────────────
-- Terry buys the same tree from two vendors. A is cheaper and the stock is lower quality; B costs
-- more and is better. "Quality" is not a field on anything — it is his judgement from having bought
-- from both. Measured from invoices already captured: 100-gallon Eagleston Holly, KBB $450 in April
-- against Enchanted $725 in June, 61% apart. A system that knew only price would route to KBB every
-- time.
--
-- 🔴 THE NOTE IS THE ASSET. THE FLAG IS NOT. `preferred` tells Lauren which row to look at;
--    `preference_note` tells her WHY — and why is what she needs when B is out of stock.
--
-- ⚠️ Ignition captured exactly this judgement and threw it away: `priority`, owner-set, labelled
--    "1=Highest" in the UI, and swept across 94 files it has ZERO sorts, ZERO comparisons and ZERO
--    reads that change a decision (the only vendor-picking code is `vendors[idx % vendors.length]`,
--    IgnitionPort.jsx:128). The intent was written down 2026-05-07 in almost R-54's words —
--    "owner-set preference — could be relationship, price, proximity, or ANY UNSTATED REASON"
--    (CAI-archive/handoff_parts_sourcing.md, Task 1). That is why `preference_note` is FREE TEXT
--    and is never derived from price, lead time, or any number in the data.
--
-- ── WHY A TABLE AT ALL: THE MEASUREMENT ─────────────────────────────────────────────────────────
-- `receipts.vendor text` (20260612_receipts.sql:17) is the ONLY vendor storage in the platform —
-- 116 migrations swept, two `vendor` hits, that column and a deferred note. Identity today is
-- lowercased-trimmed string equality inside CountOnceSeam.ts:306, the seam whose whole job is
-- preventing double-count. `Sudderth Brothers Contracting, Inc.` ≠ `Sudderth Brothers`.
--
-- 🔴 RE-MEASURED LIVE 2026-09-02 before this file was written (scripts/measure-vendor-strings.mjs),
--    because the Stage 0 recon cited spellings from the discovery doc and said plainly it had NOT
--    queried the database. R-26 exempts nobody. What the census actually found:
--      · 36 receipt rows across 3 tenants (NOT the 17 of #252 — Lauren is still uploading)
--      · 8 distinct vendor strings; LAWNS (ed2e5933) holds 17 rows / 4 distinct vendors
--      · norm() collapses: 0.  prefix-contained pairs: 0.
--    ✏️ SO THE DUPLICATE-SPELLING PROBLEM IS NOT YET IN THE DATA. `Sudderth Brothers` (the
--    shorthand), `Mcgill Farms`/`McGill` and the trailing-space `Top Notch ` are on PAPER invoices
--    David holds, not in `receipts`. This table is built BEFORE the corruption arrives, not after —
--    which is the cheap moment, and the reason the unique indexes below can land at all (contrast
--    tech-debt #58/#143, where the durable index cannot land until live rows are settled).
--
-- ── THE IDENTITY RULE IS D-47's, REUSED VERBATIM — NOT A SECOND RULE ────────────────────────────
-- STANDARDS.md v2.4, ACTIVE: "external identity resolves on the field the external system
-- guarantees unique · AMBIGUITY NEVER AUTO-LINKS · a stored link is a cache, not a fact." Paid for
-- by a nine-invoice, two-month cross-billing scar (docs/decisions/2026-07-16-...-D47.md).
--
-- 🔴 AND THE CENSUS FOUND THE CONSTRAINT THAT DECIDES THE RESOLVER'S BEHAVIOUR TODAY.
--    `ocr_raw` stores the RAW PROVIDER ENVELOPE (top-level keys: candidates/responseId/
--    modelVersion/usageMetadata, or model/usage/stop_reason), not a parsed receipt. Digging into
--    the model's own text output across all 36 rows, the OCR emits 17 fields — vendor, date,
--    due_date, delivery_date, customer_name, customer_phone, customer_email, bill_to, ship_to,
--    line_items, subtotal, tax, amount, category, payment_method, receipt_number, customer_kind —
--    and there is NO vendor_email, NO vendor_phone, NO vendor_address, NO account_number. The
--    contact fields that exist are CUSTOMER-side, because the prompt was written for sales
--    invoices where the customer is the other party. On a PURCHASE invoice the vendor is the other
--    party and none of its contact detail is extracted. Measured: account/customer-number mentions
--    0 of 35; emails 1 of 35, and that one is `tasgrower@hotmail.com`, a customer_email.
--
--    ✏️ SO THE TWO SIGNALS THE BUILD RANKS STRONGEST — email domain and per-vendor account number —
--    ARE NOT AVAILABLE FROM CAPTURED DATA TODAY. `office@athenstreefarm.com`, the evidence that
--    Athens and KBB are one operation, is on a PAPER invoice, not in `receipts`.
--
--    D-47 already prescribes the right behaviour for a one-signal world, which is why no second
--    rule is needed: ONE matching field is a hint, not an identity → SURFACE for the owner. The
--    columns below (email, phone, account_number, address_*) exist so a SECOND signal CAN exist —
--    supplied by the owner, or by a future OCR change — at which point the same resolver starts
--    LINKING without a line of it being rewritten.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────────────────────────
--   NEW TABLES:    vendors, vendor_aliases
--   NEW COLUMN:    receipts.vendor_id (nullable, FK, ON DELETE SET NULL)
--   NEW FUNCTION:  enforce_vendor_preference_is_owner_only (trigger fn)
--   NEW TRIGGER:   vendors_preference_owner_only
--   NOT TOUCHED:   receipts.vendor (TEXT) — KEPT, never replaced. R-50 forbids retro-classifying a
--                  stored row and THE CAPTURED STRING IS EVIDENCE. Nothing below reads or rewrites
--                  it; the list still renders it exactly as captured.
--   NOT ADDED:     cost_objects.vendor_id — see the CLOSING NOTE. Deliberate, with a reason.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. vendors
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- AC-1: no vertical noun. A vendor is a vendor in every vertical; `business_id` scopes the row and
-- the tenant's own vertical is a value elsewhere, never encoded here.
CREATE TABLE IF NOT EXISTS vendors (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             text        NOT NULL,

  -- ── identity signals (D-47's "second independent field"). Owner-supplied today; see the header:
  --    the OCR emits none of these for the VENDOR side. Nullable, and honestly empty until typed.
  email            text,
  phone            text,
  account_number   text,        -- OUR customer number WITH them (Greenleaf 62171). ⚠️ identifies a
                                -- RELATIONSHIP, not a company — two of our accounts can name one firm.
  address_line1    text,
  address_city     text,
  address_state    text,
  address_zip      text,
  website          text,

  -- ── the judgement. OWNER-SET ONLY, enforced by trigger in §4 (not by a column grant — owner and
  --    manager are both `authenticated`, so a GRANT cannot tell them apart).
  preferred        boolean     NOT NULL DEFAULT false,
  preference_note  text,        -- 🔴 THE ASSET. Free text, never derived. "Stock quality is better."

  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN vendors.preferred IS
  'Owner-set judgement (R-54: we surface, the owner decides). NEVER derived from price, lead time '
  'or any number in the data — Terry prefers the dearer vendor because the stock is better, and a '
  'price-derived flag would invert his decision. Owner-only via the vendors_preference_owner_only '
  'trigger; a manager may read it and may not set it.';
COMMENT ON COLUMN vendors.preference_note IS
  'WHY this vendor is preferred, in the owner''s words. Free text, never derived. This is the '
  'succession asset: "buy the cedars from B" lives in Terry''s head, and the flag alone does not '
  'carry it. Lauren needs the reason when the preferred vendor is out of stock.';
COMMENT ON COLUMN vendors.account_number IS
  'OUR customer number with this vendor (e.g. Greenleaf 62171; Ignition called it accountNum). '
  'A strong disambiguator, but it identifies the RELATIONSHIP not the company — one firm can issue '
  'us two account numbers, and two firms under one owner can share none.';

-- One vendor per name per tenant. Safe to land TODAY because `vendors` starts empty — contrast
-- tech-debt #58/#143, where the durable unique index cannot land until live rows are settled.
CREATE UNIQUE INDEX IF NOT EXISTS vendors_business_name_uidx
  ON vendors (business_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS vendors_business_preferred_idx
  ON vendors (business_id, preferred);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. vendor_aliases — the "also known as" list, from the BUY side
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- David's ruling (docs/discovery/2026-08-27-29-lawns-discovery.md:392): "a business needs an
-- 'also known as' list captured at setup." §10 of that doc is OUR four billing names on THEIR
-- invoices; §11 is the same relation read from the other end — "Athens / KBB / KBE are one
-- operation … the vendor-side mirror of the same problem." One mechanism, both directions.
CREATE TABLE IF NOT EXISTS vendor_aliases (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_id    uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  alias        text        NOT NULL,
  -- how this alias came to be known. 'owner' = typed deliberately; 'capture' = confirmed by a
  -- human at capture time. NEVER written by an inference: nothing auto-merges (D-47).
  source       text        NOT NULL DEFAULT 'owner'
               CHECK (source IN ('owner', 'capture')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendor_aliases IS
  'Alternate names one vendor bills under. Athens Tree Farm / KBB Tree Farm LLC / KBE Trucking LLC '
  'are one operation at adjacent addresses on one road. A row here is ALWAYS a human decision — '
  'the resolver surfaces a candidate and never writes an alias on its own (D-47: ambiguity never '
  'auto-links).';

-- An alias resolves to exactly ONE vendor within a tenant, or "ask once, keep forever" asks twice.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_aliases_business_alias_uidx
  ON vendor_aliases (business_id, lower(btrim(alias)));

CREATE INDEX IF NOT EXISTS vendor_aliases_vendor_idx ON vendor_aliases (vendor_id);

-- ⚠️ DELIBERATELY NOT ENFORCED IN SQL: an alias that equals a DIFFERENT vendor's canonical name.
-- A cross-table exclusion needs a trigger, and it would turn a genuine ambiguity into a hard write
-- refusal at capture. D-47 says ambiguity SURFACES for the owner rather than being auto-resolved,
-- so the resolver reports "this string matches vendor X's name AND vendor Y's alias" and asks.
-- Enforcing it here would replace a question to the owner with an error the owner cannot answer.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. receipts.vendor_id — the link. THE TEXT COLUMN IS KEPT.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS receipts_vendor_id_idx ON receipts (vendor_id);

COMMENT ON COLUMN receipts.vendor_id IS
  'Resolved vendor identity. NULLABLE and null on every pre-existing row — a receipt captured '
  'before this migration was never resolved by a human, and R-50 forbids retro-classifying a '
  'stored row. ON DELETE SET NULL: deleting a vendor must never destroy the receipt. '
  '🔴 receipts.vendor (text) is KEPT ALONGSIDE THIS and is still what the list renders — the '
  'captured string is EVIDENCE of what the document said, which a resolved id is not.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. THE PREFERENCE IS OWNER-ONLY — enforced, not merely un-offered
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHY A TRIGGER AND NOT A POLICY OR A GRANT:
--   · A GRANT UPDATE (col) cannot work — owner and manager are both the `authenticated` role, so a
--     column grant cannot tell them apart.
--   · An RLS policy is row-level, not column-level: a manager legitimately UPDATEs a vendor row
--     (fixing a misspelt name, adding the phone number off an invoice), so the row must be
--     writable by her while TWO of its columns must not be.
-- Hiding the control in the UI is not enforcement (§1.6 item 4: server-side, not merely hidden).
CREATE OR REPLACE FUNCTION public.enforce_vendor_preference_is_owner_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Nothing to guard unless a preference field actually changed. IS DISTINCT FROM is null-safe,
  -- so setting a note from NULL to a value is caught, and so is clearing it back to NULL.
  IF NEW.preferred IS NOT DISTINCT FROM OLD.preferred
     AND NEW.preference_note IS NOT DISTINCT FROM OLD.preference_note THEN
    RETURN NEW;
  END IF;

  -- auth.uid() IS NULL = the SQL editor / a service-key path. Permitted, and it mirrors the
  -- existing funnel precedent (20260723_permission_funnel.sql:144-147). Named here so it is a
  -- recorded decision rather than an accident: a seed or a support fix is not a manager.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = NEW.business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION
      'vendor preference is owner-only: preferred / preference_note may be changed only by the '
      'business owner (vendor %, business %)', NEW.id, NEW.business_id
      USING ERRCODE = '42501';   -- insufficient_privilege — the same code a policy refusal raises
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_preference_owner_only ON vendors;
CREATE TRIGGER vendors_preference_owner_only
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_preference_is_owner_only();

-- INSERT is guarded too: a manager creating a vendor at capture must not smuggle in a preference.
CREATE OR REPLACE FUNCTION public.enforce_vendor_preference_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.preferred IS NOT TRUE AND NEW.preference_note IS NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = NEW.business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION
      'vendor preference is owner-only: a new vendor may not be created already preferred '
      '(business %)', NEW.business_id
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_preference_owner_only_insert ON vendors;
CREATE TRIGGER vendors_preference_owner_only_insert
  BEFORE INSERT ON vendors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_preference_on_insert();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. RLS — AC-2 (business_id membership) + AC-3 (tenant isolation absolute)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 A MANAGER MUST BE ABLE TO READ THIS, or Terry's requirement fails on its own terms —
--    "if Terry is not on site, Lauren knows who to order from instead of choosing by lowest price."
--
-- ⚠️ `customers` is OWNER-ONLY (customers_business_owner, FOR ALL). That policy is NOT copied here,
--    deliberately: a customer roster and a vendor list have different readers.
--
-- ⚠️ AND THIS SURFACE DOES NOT GATE ON `costs:read`. A vendor's NAME is not its cost basis, and
--    binding the two would put the preferred mark behind the confidential-cost gate — the gate that
--    is a known live defect (a manager who may take orders and may not see cost basis cannot
--    capture a customer invoice, §3 2026-09-02). Lauren would lose sight of the mark this build
--    exists to show her.
--
-- WHY MEMBERSHIP AND NOT A NEW PERMISSION STRING: a vendor row is exactly as sensitive as the
-- receipt it was resolved from, and `receipts` is membership-scoped (20260612_receipts.sql:47).
-- Minting `vendors:read` would need the manifest, the funnel and the capQ ratchet (tech-debt
-- #88/#90) to say the same thing membership already says. Standard-by-value (§6 r10): the lighter
-- form suffices; the trigger in §4 carries the one distinction that actually matters.
ALTER TABLE vendors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_aliases ENABLE ROW LEVEL SECURITY;

-- ── vendors ────────────────────────────────────────────────────────────────────────────────────
CREATE POLICY vendors_owner_all ON vendors
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = vendors.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE id = vendors.business_id AND owner_id = auth.uid()));

CREATE POLICY vendors_member_select ON vendors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM business_members
             WHERE business_id = vendors.business_id AND user_id = auth.uid() AND active = true));

CREATE POLICY vendors_member_insert ON vendors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM business_members
             WHERE business_id = vendors.business_id AND user_id = auth.uid() AND active = true));

-- A member may correct a vendor row (a misspelt name, the phone off an invoice). The preference
-- columns are carved out by the §4 trigger, not by this policy — see the WHY above.
CREATE POLICY vendors_member_update ON vendors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM business_members
             WHERE business_id = vendors.business_id AND user_id = auth.uid() AND active = true))
  WITH CHECK (
    EXISTS (SELECT 1 FROM business_members
             WHERE business_id = vendors.business_id AND user_id = auth.uid() AND active = true));

-- ⚠️ NO member DELETE policy — deletion is owner-only via vendors_owner_all. Fail-closed on the one
--    verb that destroys history, and a vendor with receipts pointing at it should be corrected or
--    merged, not removed by whoever is nearest.

-- ── vendor_aliases ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY vendor_aliases_owner_all ON vendor_aliases
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = vendor_aliases.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE id = vendor_aliases.business_id AND owner_id = auth.uid()));

CREATE POLICY vendor_aliases_member_select ON vendor_aliases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM business_members
             WHERE business_id = vendor_aliases.business_id AND user_id = auth.uid() AND active = true));

-- A member confirms an alias at capture ("yes, Sudderth Brothers is Sudderth Brothers Contracting,
-- Inc."). That is a human decision at the moment of capture, which is exactly when it is cheapest
-- and most reliable to make — and it is why source='capture' exists as a distinct provenance.
CREATE POLICY vendor_aliases_member_insert ON vendor_aliases
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM business_members
             WHERE business_id = vendor_aliases.business_id AND user_id = auth.uid() AND active = true));

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. updated_at
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS vendors_updated_at ON vendors;
CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- CLOSING NOTE — ANSWERING 20260615_cost_objects_rename_and_node_schema.sql:80-84
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- That file deferred `cost_objects.vendor_id` with a stated condition: "Adding them now = an
-- always-null pile with no writer. Honest-debt note: add alongside the PROJECT/PRODUCT build."
--
-- ANSWER: NOT ADDED, AND THE CONDITION HAS NOT LAPSED. This build gives `cost_objects` no vendor
-- writer — it writes `vendors`, `vendor_aliases` and `receipts.vendor_id`, and touches no cost row.
-- Adding the column now would reproduce precisely the always-null pile the note warns about, and
-- it would be worse than in June: `cost_objects.receipt_id` is 0 of 5 populated and
-- `business_inventory.receipt_id` is 0 of 447 (tech-debt #144), so the join that would carry a
-- vendor onto a cost row is itself unwritten by anything.
--
-- ✏️ The note is therefore ANSWERED rather than left silently stale, and the trigger for revisiting
-- it is now precise instead of vague: add `cost_objects.vendor_id` when the cost-assignment build
-- gives it a writer — i.e. when #144's seam is populated — NOT when "the PROJECT/PRODUCT build"
-- happens, which is a different milestone that would not have supplied a writer either.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run in the Supabase SQL editor after applying — schema-verification gate, §9)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- (A) both tables exist with RLS ENABLED:
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('vendors','vendor_aliases');           -- expect 2 rows, both t
--
-- (B) the policies landed (7 total):
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('vendors','vendor_aliases') ORDER BY tablename, policyname;
--   -- expect vendors: owner_all(ALL) member_select(SELECT) member_insert(INSERT) member_update(UPDATE)
--   --        vendor_aliases: owner_all(ALL) member_select(SELECT) member_insert(INSERT)
--
-- (C) receipts.vendor SURVIVES and vendor_id joined it:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name='receipts' AND column_name IN ('vendor','vendor_id');
--   -- expect BOTH rows: vendor text YES, vendor_id uuid YES
--
-- (D) the unique indexes are case- and whitespace-insensitive:
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename IN ('vendors','vendor_aliases') AND indexname LIKE '%uidx';
--   -- expect both defs to contain lower(btrim(...))
--
-- (E) the preference trigger exists on BOTH verbs:
--   SELECT tgname FROM pg_trigger WHERE tgrelid='vendors'::regclass AND NOT tgisinternal;
--   -- expect vendors_preference_owner_only, vendors_preference_owner_only_insert, vendors_updated_at
--
-- (F) every pre-existing receipt is UNRESOLVED, not silently classified (R-50):
--   SELECT count(*) FILTER (WHERE vendor_id IS NULL) AS unresolved, count(*) AS total FROM receipts;
--   -- expect unresolved = total (36 = 36 at the time of writing)
