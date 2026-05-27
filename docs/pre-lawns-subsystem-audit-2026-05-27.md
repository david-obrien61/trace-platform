# Pre-LAWNS Subsystem Verification Audit
**Date:** 2026-05-27  
**Auditor:** Claude Code (Session K)  
**Scope:** Cultivar OS demo-critical subsystems only. Ignition OS is out of scope.  
**Method:** Static code tracing — every code path verified end-to-end from UI trigger through API → external service → DB → response. Surface Honesty applied as the audit lens: assume nothing works until the path is traced.  
**No code was modified.**

---

## 1. Executive Summary

**Status: GO-WITH-CAVEATS**

The core demo flow — QR scan → plant profile → checkout → QB invoice → dashboard — is genuinely wired end-to-end and produces real data in Supabase and QuickBooks. The chassis is solid. There are no broken paths in the checkout itself.

**What could visibly fail in front of Lauren and Terry:**

1. If SCV-0031 was left in `status='reserved'` from a prior demo run, the "Add to cart" button will not appear. The demo dies at step 2.
2. The QB environment is currently `QBO_ENVIRONMENT=sandbox`. The QB invoice URL on the confirmation screen links to Intuit's sandbox app, not LAWNS's real QB. Clicking it during the demo opens an Intuit sandbox session that shows fake data. This is confusing unless explained.
3. Social post generation will silently fail until two database migrations are manually applied in Supabase (BLOCKER #1 and #2 from CLAUDE.md are still pending). No social drafts will appear in the dashboard after a demo order.
4. Email confirmation is structurally broken: the confirmation screen says "Invoice sent to [email]" but no email is ever actually delivered. `sendSilently` is called client-side; `RESEND_API_KEY` is not exposed to the browser; the notification system silently enters demo mode (console log only). No `RESEND_API_KEY` or `FROM_EMAIL` env var is configured in Vercel. This is not a crash — the order completes — but if Lauren or Terry ask "did my email arrive?", the answer is no.

None of these are blocking if handled correctly. The worst plausible outcome is: demo plant is reserved, button is missing, and you're fumbling to fix it in Supabase's SQL editor in front of Terry. That's the scenario to prevent.

---

## 2. Subsystem-by-Subsystem Detail

---

### Subsystem 1 — QR Scan → Plant Profile Load

**Wiring status:** Fully wired

**What works:**  
`usePlant.ts` makes two real Supabase queries: `plants` (by `tag_id`, case-insensitive) and `plant_events` (by `plant_id`, ordered by `occurred_at`). A third query fetches `availableCount`. All three are live DB queries — no seed JSON, no hardcoded fallbacks. `PlantTimeline.tsx` renders directly from the `events` array returned from Supabase; if `events.length === 0` it renders nothing. Both data sources are real.

**What's questionable:**  
The hook writes plant data to localStorage with a 24-hour TTL (`plant_cache:SCV-0031`). On first render, if a cache entry exists, it seeds the initial state from cache and then fires a network fetch. This means if a plant was scanned earlier today (e.g., pre-demo prep), the cached state shows instantly before the network response arrives. If the plant's DB status was `available` when cached but is now `reserved` after a prior checkout, the profile will briefly flash the "Add to cart" button before the network response overwrites it. This is visual flicker, not a data integrity issue — the network result always wins.

**What's broken:**  
`PlantProfile.tsx:108` hardcodes the nursery footer: `"LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336"`. This is literal string, not from the database. The phone number embedded there should be verified against LAWNS's actual number before the meeting — it may be wrong.

**Demo risk level:** LOW — provided SCV-0031 is in `status='available'` before the demo.

**Recommended action:** Reset `SCV-0031` to `status='available'` and clear any demo test orders from prior sessions. Clear the `plant_cache:SCV-0031` key from localStorage in the demo browser before sitting down.

---

### Subsystem 2 — Cart → Checkout → Order Submission

**Wiring status:** Fully wired for DB writes; partially wired for cart persistence.

**What works:**  
Cart lives in Zustand (`useCart.ts`) — in-memory, no localStorage. Customer info, plant, quantity, addons, and transport option are held in memory throughout the flow. On submission, `useSubmitOrder.ts` POSTs to `/api/orders/submit`, which runs server-side with the Supabase service key. The API:
- Finds or creates a customer record by email (dedup by email is fully implemented — see finding below)
- Calculates subtotal, tax, addons, install amounts, leakage flag
- Creates an `orders` row
- Creates an `order_items` row
- Creates `order_addons` rows for netting and any "always" addons
- Updates `plants.status` to `reserved`
- Returns `orderId`, `invoiceNumber`, `total`, `subtotal`, `taxAmount`

All DB writes are in a try/catch; any failure throws and returns a 500, which the frontend shows as a visible error on CartReview (the red error box). The order does not partially commit — if any step fails, the error is surfaced.

**Critical correction from TRACE_PLATFORM_AUDIT.md:**  
TRACE_PLATFORM_AUDIT.md line 135 states: "No lookup — always creates new customer row." **This is wrong as of May 23.** `api/orders/submit.ts` lines 34–75 perform an email-based dedup: if a customer with the same email exists for this nursery, it reuses that row and updates their name/phone/address. Multiple demo checkouts with the same email will not create duplicate "Terry" rows. The audit doc is stale on this point.

**What's questionable:**  
Cart state is in-memory only. A mid-checkout browser refresh destroys the cart and returns the user to the dashboard (via the `if (!item)` guard in CartReview). During a demo, if someone accidentally refreshes the page between the Add-Ons screen and the Review screen, the cart is gone. Risk is low if the demo is controlled, but worth knowing.

**Demo risk level:** LOW — provided the demo browser is not accidentally refreshed mid-flow.

**Recommended action:** Demo in a dedicated browser tab. Warn Lauren/Terry not to hit refresh during checkout.

---

### Subsystem 3 — Netting Prompt Logic

**Wiring status:** Fully wired

**What works:**  
The netting prompt in `AddOns.tsx` uses the `trigger_rule === 'transport=self'` addon from the Supabase `addons` table. Pre-selected is determined by the `pre_selected` boolean in the DB row. If the DB addon is loaded, toggling the prompt updates `nettingDeclined` in the cart, and on submission `submit.ts` conditionally inserts into `order_addons` at lines 149–157 only when `nettingActive === true` (i.e., transport is self and netting was not declined). A netting decline is recorded in `orders.netting_declined` and appears in the QB invoice as a $0 declined line.

**What's questionable:**  
`AddOns.tsx` lines 38–41 provide a fallback: if the DB addons have not loaded yet (loading state), `nettingPrice` defaults to `$10` and `nettingId` defaults to `'__netting__'`. In this fallback state, the netting checkbox still works visually, but the `nettingDbAddon` is null, so nothing is written to `order_addons` at checkout (the insert block at `submit.ts:149` requires `nettingDbAddon` to be non-null). The plant's netting price would still be applied to the subtotal (correct), but the `order_addons` row would be missing.

For the demo: addons should load quickly from Supabase. If the addons table has a row for netting with `trigger_rule='transport=self'`, `pre_selected=true`, and `active=true` for `DEMO_NURSERY_ID`, this path is fine. If the addons table is empty or the row is missing, the fallback activates.

**Demo risk level:** LOW — if the addons table is correctly seeded. Verify the netting addon row exists before the demo.

**Recommended action:** In Supabase SQL editor, run `SELECT * FROM addons WHERE nursery_id = 'a1b2c3d4-0000-0000-0000-000000000001';` and confirm a row with `trigger_rule = 'transport=self'`, `pre_selected = true`, `active = true` exists.

---

### Subsystem 4 — QB Invoice Auto-Creation

**Wiring status:** Fully wired for token refresh; partially wired for environment.

**What works:**  
`api/qbo/invoice/cultivar.ts` is the most complete serverless function in the codebase. It:
- Calls `refreshQBToken()` (from `packages/shared/src/quickbooks/refresh.ts`) proactively at the top of every handler call
- Refreshes the token if it's within 10 minutes of expiry, writes the new token back to Supabase
- Sets `qb_needs_reconnect=true` and returns null if the refresh token is dead
- Fetches the order, customer, order items, and order addons from Supabase
- Finds or creates a QB customer by email (dedup)
- Builds QB line items for plant, addons, transport/install, and tax
- POSTs to QuickBooks API and writes the `qb_invoice_id` and `qb_invoice_url` back to the order
- Returns the invoice ID, DocNumber, and URL to the frontend
- Never throws to the order flow — the try/catch in `useSubmitOrder.ts` wraps the QB call non-blocking

Token refresh is correctly implemented: the `refresh.ts` function checks `qb_token_expires_at`, refreshes if missing or within 10 minutes, and handles dead refresh tokens by setting `qb_needs_reconnect=true` in Supabase. The Dashboard amber banner triggers from this flag.

**What's broken — QB environment mismatch (MEDIUM risk):**  
`QBO_ENVIRONMENT=sandbox` is set in Vercel per CLAUDE.md. This means all QB API calls go to `sandbox-quickbooks.api.intuit.com`. The invoice URL on the Confirmation screen will link to `app.sandbox.qbo.intuit.com/app/invoice?txnId=...` — Intuit's sandbox environment, not LAWNS's real QuickBooks account. Clicking "View invoice in QuickBooks" during the demo opens the Intuit sandbox, which requires an Intuit Developer account login, and shows test data — not LAWNS data.

MASTER_BRIEF Part 11 states Cultivar-OS has production approval (✅ May 22, 2026), so production mode IS available. But the env var is not flipped.

Two acceptable paths:
- **Option A (Demo in sandbox):** Pre-connect the QB tile to Intuit's sandbox in the demo browser. The confirmation screen shows a real invoice URL — it links to sandbox QB. On the demo laptop, be logged into the sandbox QB account so clicking the link shows a real-looking invoice. Brief Lauren: "In production, this links directly to your QuickBooks — we're in the test environment today."
- **Option B (Flip to production before demo):** Change `QBO_ENVIRONMENT=production` in Vercel, swap in LAWNS's actual QB credentials (production `QBO_CLIENT_ID` and `QBO_CLIENT_SECRET`), redeploy. The demo then creates an actual invoice in LAWNS's real QB. This is the most impressive path but requires LAWNS's production QB app access.

**Additional finding — callback.ts fallback company name:**  
`callback.ts` line 54: `let companyName = 'QuickBooks Sandbox';` — the fallback company name shown in the "QuickBooks Connected!" popup after OAuth is the literal string "QuickBooks Sandbox". If running in production mode, the company name is fetched from the QB API and will show the correct company name. But if the API call fails for any reason, it falls back to "QuickBooks Sandbox" even in production mode. Non-blocking for demo, mildly confusing.

**Confirmed: order completes if QB fails:**  
`useSubmitOrder.ts` lines 63–81 wrap the QB call in a try/catch and only log warnings on failure. The order writes to Supabase regardless of QB result. The confirmation screen shows "Invoice will sync to QuickBooks shortly" if QB failed, and the demo QB fallback link (`/demo/quickbooks-invoice`) is always available. This is correct non-blocking behavior.

**Demo risk level:** MEDIUM — the sandbox vs. production mismatch is a presentation issue, not a technical failure. Manage it with a brief or by switching to production mode.

**Recommended action:** Decide before the demo whether to use sandbox (with pre-connected Intuit dev account) or production (requires LAWNS QB production app credentials). If sandbox: pre-connect, test the invoice link in the demo browser. If production: flip env var, redeploy, test full checkout.

---

### Subsystem 5 — Customer Capture and Dedup

**Wiring status:** Fully wired

**What works:**  
`CustomerCapture.tsx` validates first name, last name, and email (required); phone, address, city, state, zip are optional. On submit, the customer object is saved to the Zustand cart and the user navigates to CartReview. At order submission, `submit.ts` performs email-based dedup: lines 34–46 query `customers` by `nursery_id` and `email`. If found, it updates the row with the new contact info and reuses the ID. If not found, it inserts a new row.

**Dedup behavior:**  
Multiple demo orders using the same email address (e.g., `david_obrien2016@outlook.com`) will all map to the same customer row. The name and phone are updated on each order, not duplicated. Lauren will see one customer record regardless of how many demo runs are performed.

**No blast radius concern:**  
The TRACE_PLATFORM_AUDIT.md warning about "five Terry rows" is no longer accurate. Dedup was implemented in the May 23 session.

**Gap (post-demo):**  
There is no customer lookup at the CustomerCapture form — a returning customer who types their email doesn't see their prior address or phone pre-filled. The form always starts blank (unless the cart has a saved customer from navigating back). This is a usability gap, not a demo-critical bug.

**Demo risk level:** NONE

**Recommended action:** None before demo. Document the customer lookup gap as a post-demo task.

---

### Subsystem 6 — Email Confirmation via Resend

**Wiring status:** Structurally broken — email is never actually delivered

**What appears to work:**  
`useSubmitOrder.ts` calls `sendSilently({vertical: 'cultivar', templateId: 'order_confirmation', ...})` after a successful order. The shared `notifications/templates/cultivar.ts` has an `order_confirmation` template. `sendSilently` is fire-and-forget (no await). The order flow completes regardless.

**What's actually broken:**  
`sendSilently` is called from `useSubmitOrder.ts`, which is a client-side React hook running in the browser. `send.ts` resolves `RESEND_API_KEY` via `process.env.RESEND_API_KEY`. In the Vite browser bundle, `process.env` variables without the `VITE_` prefix are NOT exposed. `RESEND_API_KEY` has no `VITE_` prefix. Therefore `resendKey = undefined`.

`send.ts` line 133: `const isDemo = config.demoMode || (!resendKey && !twilioSid);` evaluates to `true`. The function logs the notification to the browser console and returns `{ success: true, channel, demo: true }`. No HTTP call to Resend is ever made.

Additionally: `RESEND_API_KEY` and `FROM_EMAIL` do not appear in the CLAUDE.md Vercel env vars list, the `.env.example` file, or any other configuration document. Email was never provisioned for this project.

**Visible symptom:**  
`Confirmation.tsx` line 88 always renders: `"Invoice sent to {email}"` — regardless of whether an email was sent. Every customer on every demo order sees this text. No email arrives.

**Is this a demo-critical failure?** Probably not. The demo playbook doesn't include checking the customer's inbox. But if Lauren or Terry say "let me check my email," nothing will be there. Brief accordingly: "In production, this triggers an email with their invoice — we'll set that up during onboarding."

**Demo risk level:** MEDIUM — visible lie on the confirmation screen ("Invoice sent to..."). Low likelihood of being challenged at the demo; medium impact if it is.

**Recommended action:** Before the demo, mentally note that email is not wired. Do not let a customer check their inbox expecting a confirmation email. If the topic arises, position it as a "production onboarding step." Do not attempt to wire email before the demo — it requires a server-side API route, not a client-side hook, plus Resend account setup.

---

### Subsystem 7 — Tile State Transitions

**Wiring status:** Partially wired — state reads from DB correctly; navigation is a stub

**What works:**  
`useModules.ts` makes three real Supabase queries in parallel: nurseries (for `qb_realm_id`), nursery_modules (for `enabled`, `configured`, `config` per module), and modules (for `name`, `description`, `tier_required`). Module tile states are derived from real DB data:
- **QB tile:** `active` if `qb_realm_id` is non-null in the nurseries row; `available` otherwise. Real DB check.
- **Social tile:** `active` if `nursery_modules` row has `enabled=true AND configured=true`; `available` otherwise. Real DB check.
- **Other available tiles:** `available` unless `tier_required='growth'` (then `locked`). 
- **Social draft badge count:** Derived from `socialDrafts.length`, which comes from a real Supabase query.

**Confirmed hardcode:**  
`useModules.ts` line 100: `const nurseryPlan = 'starter'; // post-demo: fetch from subscription table`. This string is compared against `tier_required` values from the modules table. Any module with `tier_required='growth'` shows as locked. Any module with `tier_required='starter'` or null shows as available/active based on the nursery_modules row. The `'starter'` hardcode is acknowledged tech debt per CLAUDE.md.

**What's broken — tile navigation:**  
`Dashboard.tsx` line 289–291: `function handleNavigate(_key: string) { // post-demo: route to module-specific pages }` — the handler is an explicit empty stub. Tapping any `active` state tile (QR Checkout, QuickBooks, Social when enabled) does nothing. The tile appears interactive (box shadow, green dot, cursor: pointer) but produces no response. This is the Surface Honesty violation logged in TRACE_PLATFORM_AUDIT.md.

**Demo risk level:** MEDIUM — tapping an active tile silently does nothing. If Lauren or Terry tap a tile expecting navigation, nothing happens. No error, no feedback.

**Recommended action:** Per Surface Honesty, brief Lauren/Terry before showing the dashboard: "These tiles are your active modules. You'll navigate through the scan flow directly — we'll be adding tap-to-history in the next build." This is the language already scripted in the audit doc's "suggested language" section.

---

### Subsystem 8 — Dashboard Metrics

**Wiring status:** Fully wired — all metrics from real Supabase queries

**What works:**  
`Dashboard.tsx` `loadMetrics()` function runs 5 parallel Supabase queries using the ANON key (client-side):
- `nurseries` — for nursery name and `qb_needs_reconnect` flag
- `plants` filtered by `status='available'` — for plant count and inventory value sum
- `orders` filtered by `created_at >= today` — for today's order count and revenue
- `orders` filtered by `transport_method='install'` and `created_at >= week_start` — for installs this week
- `orders` filtered by `leakage_flag=true` and `created_at >= week_start` — for leakage count this week

All five are real DB queries. Metrics update on `loadMetrics()` call (Refresh data button). Nursery name (`nurseryName`) defaults to `'LAWNS Tree Farm'` in initial state (Dashboard.tsx line 72) before the DB response arrives — this is a correct initial value, overwritten when the nursery query returns.

**Architectural note — api/dashboard.ts is not used:**  
`packages/cultivar-os/api/dashboard.ts` (and its root re-export at `api/dashboard.ts`) exists as a serverless function but is NOT called by Dashboard.tsx. The dashboard runs its own direct Supabase queries. The API endpoint exists but is effectively unused in the current implementation. This is not a bug, just dead code. If it were ever called, its leakage count would differ from the Dashboard's (the API counts all-time leakage; the dashboard counts this week only).

**Demo risk level:** NONE — metrics are live and correct.

**Recommended action:** Run one complete test order before the meeting to seed real "Today's sales" data on the dashboard. The demo impact is higher when Lauren sees a real order count.

---

### Subsystem 9 — Social Post Generation and Publish (Blotato)

**Wiring status:** Partially wired — BLOCKED by two unapplied database migrations

**What works:**  
`api/social/generate-posts.ts` calls the real Anthropic Claude API (`claude-sonnet-4-6`) with system prompt caching via `cache_control: { type: 'ephemeral' }`. The user prompt includes plant species, container size, customer first name, month, and addons purchased. It generates 3 posts (educational, customer_story, seasonal) as a JSON array and inserts them into `social_drafts`. `ANTHROPIC_API_KEY` is confirmed set in Vercel. The module-enabled check (nursery_modules query) is real.

`api/social/publish.ts` calls the real Blotato API at `https://backend.blotato.com/v2/posts` with the `blotato-api-key` header. `BLOTATO_API_KEY` is confirmed set in Vercel. On success, updates `social_drafts.status='published'`. On failure, updates to `status='failed'` and returns `ok:false`.

**What's blocked — unapplied DB migrations:**  
Per CLAUDE.md BLOCKER #1 and BLOCKER #2, two migrations have NOT been applied in Supabase:

1. `supabase/migrations/20260522_social_drafts_add_order_post_type.sql` — adds `order_id` and `post_type` columns to `social_drafts`. Without this migration, `generate-posts.ts` tries to insert `order_id` and `post_type` into columns that don't exist. Supabase returns an error. No posts are created.

2. `supabase/migrations/20260522_social_drafts_add_failed_status.sql` — adds `'failed'` to the `social_drafts_status_check` constraint. Without this, the failure path in `generate-posts.ts` (which tries to insert `status='failed'`) also fails silently.

Until both migrations are applied, social post generation silently fails every time an order is placed. No error is shown to the user; no posts appear in the dashboard.

**What's questionable — Blotato platform hardcode:**  
`generate-posts.ts` line 130: `platform: 'instagram'` is hardcoded. `publish.ts` line 54: `const platform = (draft.platform as string) || 'instagram'`. Blotato's API requires `platform` in `content` and `targetType` in `target` to match. All generated posts are marked `instagram` regardless of which platforms Lauren configured in the Social Setup wizard. If LAWNS only has a Facebook account connected to Blotato, publishing will fail.

**Demo risk level:** HIGH for social post generation (blocked by unapplied migrations). MEDIUM for Blotato publish (requires correct Blotato account ID and platform match).

**Recommended action (HIGH):**  
Apply both migrations before any demo run:
```sql
-- BLOCKER 1
ALTER TABLE social_drafts
  ADD COLUMN order_id  uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN post_type text CHECK (post_type IN ('educational','customer_story','seasonal'));

-- BLOCKER 2
ALTER TABLE social_drafts DROP CONSTRAINT IF EXISTS social_drafts_status_check;
ALTER TABLE social_drafts ADD CONSTRAINT social_drafts_status_check
  CHECK (status IN ('draft', 'published', 'failed'));
```
Then run a test order and verify 3 rows appear in `social_drafts`. If social is not ready for demo, hide the social module tile entirely by setting `enabled=false` in the `nursery_modules` row for `social_media`.

---

### Subsystem 10 — Auth Path

**Wiring status:** Fully wired — no async bugs found

**What works:**  
`lib/auth.ts` uses `configureAuth({ strategy: 'email', ... })` from the shared package. The `buildEmailAuth` function in `configureAuth.tsx`:
- `signIn`: calls `await supabase.auth.signInWithPassword({ email, password })` synchronously. No unawaited promise. Returns `{ error: error?.message }`.
- `useSession`: calls `supabase.auth.getSession()` in a `useEffect`, wires `onAuthStateChange` subscription, returns session.
- `PrivateRoute`: shows a loading skeleton while `loading=true`, then either renders `<Outlet />` or redirects to `/login`. No race condition.
- `signOut`: calls `await supabase.auth.signOut()` then navigates.

**Comparison to Ignition OS bug:**  
The Ignition OS voice audit found `authenticate()` called without `await` in `App.js`, making `if (user)` always truthy (a Promise is truthy). No analogous bug exists in Cultivar OS. All async auth calls are properly awaited or handled via subscription callbacks.

**Email confirmation is OFF:**  
Per CLAUDE.md: "Auth: email/password, email confirmation OFF" for the cultivar-os Supabase project. Login works immediately after account creation. `configureAuth.tsx` lines 121–126 handle the case where email confirmation IS required (shows a "Check your email" screen), but that path won't trigger for cultivar-os.

**RLS note:**  
The `nursery_modules` and `modules` tables use loose RLS policies (`authenticated_select_nursery_modules` — allows any authenticated user to read any nursery's modules). Per CLAUDE.md and the tech debt log, this is intentional for demo. It means any logged-in user can see any nursery's module config. Post-demo fix: scope to `owner_id = auth.uid()` once `nurseries.owner_id` is populated.

**Demo risk level:** NONE

**Recommended action:** None before demo. Verify login works with `david_obrien2016@outlook.com` before sitting down with Lauren and Terry.

---

### Subsystem 11 — Mobile Responsiveness

**Wiring status:** Partially wired — checkout flow is mobile-ready; dashboard is not fully tested

**What works:**  
`index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. The `globals.css` `.page` class uses `max-width: 480px; margin: 0 auto` — a mobile-first centered layout. All checkout pages (PlantProfile, AddOns, CustomerCapture, CartReview, Confirmation) use this `.page` wrapper. Buttons use `.btn` with `min-height: 48px; width: 100%` — mobile-friendly tap targets. The checkout flow is designed for mobile use.

**What's NOT implemented:**  
The CLAUDE.md active tasks list "Mobile responsive fix: tile grid desktop only (768px+)" as an open task. However, looking at `TileGrid.tsx`, there is no 768px gate. The tile grid renders on all screen sizes: 4 columns at <640px, 6 columns at ≥640px, 8 columns at ≥1024px. On a phone, 4 tiles of 72px each display fine horizontally. The open task was apparently written before the tile grid was built and may not reflect the actual behavior.

**Dashboard mobile behavior:**  
Dashboard.tsx uses `max-width: 640px; margin: 0 auto` for the main content area. On a phone, the metric cards display in a 2×2 grid using flexbox. The tile grid shows below. No bottom navigation exists (noted as BUILD NEW in TRACE_PLATFORM_AUDIT.md).

**Cannot determine from code alone:**  
Whether the dashboard looks polished on a 375px-wide phone screen (iPhone SE) vs. a 428px screen (iPhone 14 Pro Max) cannot be verified without a runtime test. The CSS structure looks mobile-aware but has never been reported as tested.

**Demo risk level:** LOW — the QR scan and checkout flow (the primary demo path) was designed mobile-first. The dashboard is less certain on smaller screens. The demo playbook uses a phone to scan the QR; the dashboard is shown on a laptop.

**Recommended action:** Before the demo, load `cultivar-os.vercel.app/plant/SCV-0031` on the actual demo phone. Run through the checkout flow on the phone. Separately, load the dashboard on the laptop. This is the runtime verification no code audit can substitute for.

---

## 3. HIGH Risk Items

### HIGH-1: SCV-0031 May Be in `status='reserved'`

**Why:** Every completed checkout calls `submit.ts` line 169–173: `UPDATE plants SET status='reserved'` on the purchased plant. Any prior demo run that went all the way to the Confirmation screen will have left SCV-0031 in `reserved` state. The `PlantProfile.tsx` only renders the "Add to cart" button when `plant.status === 'available'`. A reserved plant shows "This plant is reserved" and no button.

**Symptom:** Navigate to `cultivar-os.vercel.app/plant/SCV-0031` and see a grey "This plant is reserved" message instead of the Add to Cart button.

**Fix:** In Supabase SQL editor: `UPDATE plants SET status='available', updated_at=now() WHERE tag_id='SCV-0031';`

**Estimated fix time:** 2 minutes. Apply immediately before any demo run.

---

### HIGH-2: Social Draft Migrations Not Applied

**Why:** BLOCKER #1 and BLOCKER #2 from CLAUDE.md remain unapplied. `generate-posts.ts` inserts `order_id` and `post_type` columns that don't exist yet; the insert fails silently. `publish.ts`'s error path tries to insert `status='failed'` which violates the existing constraint; that also fails silently. The result: no social drafts ever appear after an order.

**Symptom:** Submit an order, wait 10 seconds, load the dashboard — no social drafts panel appears. The Social tile shows a badge count of 0.

**Fix:** Apply both SQL blocks in Supabase SQL editor. Full SQL is in CLAUDE.md under "⚠️ Pending manual steps (David)." Verify with: `SELECT id, post_type, status, content FROM social_drafts ORDER BY created_at DESC LIMIT 5;`

**Estimated fix time:** 5 minutes. Apply before any demo run. If social is not working after the fix, set `nursery_modules` `enabled=false` for `social_media` so the tile shows as `available` rather than appearing active with no output.

---

### HIGH-3: QB Environment Is Sandbox — Demo Will Show Sandbox Invoice URL

**Why:** `QBO_ENVIRONMENT=sandbox` in Vercel. All QB API calls target `sandbox-quickbooks.api.intuit.com`. The "View invoice in QuickBooks" link on the Confirmation screen opens `app.sandbox.qbo.intuit.com`. This requires an Intuit Developer sandbox login — not LAWNS's real QB account.

**Symptom:** After a checkout, clicking "View invoice in QuickBooks" opens Intuit's sandbox environment. If not pre-authenticated in the demo browser, it shows an Intuit login screen (not QB). Even if logged in to sandbox QB, the company shown is the Intuit test company, not LAWNS.

**Two acceptable resolutions:**
1. **Sandbox demo (lower effort):** Pre-log the demo browser into Intuit's sandbox QB account before the meeting. Show the invoice there. Brief Lauren: "In production this links to your actual QuickBooks — today we're working with a test environment." The demo QB fallback link (`/demo/quickbooks-invoice`) is always available as a visual substitute.
2. **Production QB (higher impact):** Before the demo, change `QBO_ENVIRONMENT=production` in Vercel, swap to LAWNS's actual production QB credentials, redeploy, reconnect the QB tile. Invoice creation will write to LAWNS's real QB. This is the magic moment.

**Estimated fix time:** 15 minutes for Option 2 (env var flip + redeploy + QB reconnect). Requires LAWNS's production QB app access.

---

### HIGH-4: Hardcoded Nursery Phone Number in Plant Profile Footer

**Why:** `PlantProfile.tsx` line 108: `LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336`. This is a literal string, not from the database. If LAWNS's actual phone number is different, the footer is wrong.

**Symptom:** Scan SCV-0031. Scroll to the bottom of the plant profile. See the footer with the hardcoded phone number. If the number is wrong, it's visible in the demo.

**CLAUDE.md** lists LAWNS's contact as "Terry: owner" and "Lauren Bishop: manager" but does not confirm the LAWNS store phone number. The TRACE phone is `(512) 456-3632`. Verify which phone number belongs at the LAWNS nursery.

**Estimated fix time:** 2 minutes to update the hardcode once the correct number is confirmed. However, this requires a code change and redeployment — do not do this during the demo session.

---

## 4. Pre-Demo Fix List

Prioritized. Estimated time assumes someone who knows the system.

| Priority | Fix | Where | Time |
|---|---|---|---|
| 🔴 1 | Reset SCV-0031, NCM-0042, MS30-001 to `status='available'` | Supabase SQL editor | 2 min |
| 🔴 2 | Apply BLOCKER #1 migration (add order_id, post_type to social_drafts) | Supabase SQL editor | 3 min |
| 🔴 3 | Apply BLOCKER #2 migration (add 'failed' to social_drafts constraint) | Supabase SQL editor | 2 min |
| 🔴 4 | Verify social post generation end-to-end (place test order, check social_drafts) | Browser + Supabase | 5 min |
| 🟡 5 | Decide QB environment: sandbox (pre-login to sandbox) or production (flip env var + redeploy) | Vercel dashboard | 15 min |
| 🟡 6 | Verify QB connection in demo browser (QB banner shows "connected") | Browser | 2 min |
| 🟡 7 | Confirm netting addon row exists in addons table | Supabase SQL editor | 2 min |
| 🟡 8 | Clear localStorage `plant_cache:SCV-0031` in demo browser before sitting down | Browser devtools | 1 min |
| 🟡 9 | Verify login with `david_obrien2016@outlook.com` works on demo device | Browser | 1 min |
| 🟡 10 | Load `/plant/SCV-0031` on the demo phone — confirm "Add to cart" appears | Demo phone | 2 min |
| 🟢 11 | Confirm LAWNS phone number and fix PlantProfile.tsx footer if wrong | Code + deploy | 15 min |
| 🟢 12 | Full demo run-through on demo devices end-to-end — timed | Browser + phone | 20 min |

**Total estimated time (1–10):** ~33 minutes of focused work before the meeting.

---

## 5. Hide-the-Feature Recommendations

Per Surface Honesty: every element must be WORKS, LABELED, or HIDDEN. Items that appear active but might fail silently are the failure mode to prevent.

### Social Module — HIDE if migrations not applied

**If BLOCKER #1 and BLOCKER #2 are not applied before the demo:** Hide the Social tile by setting `nursery_modules.enabled=false` for `social_media`. The tile will show as `available` with an "Enable" button. The tile will not appear to be active. No social drafts panel will appear. The module will not generate a false impression that social is working.

To hide: `UPDATE nursery_modules SET enabled=false, configured=false WHERE nursery_id='a1b2c3d4-0000-0000-0000-000000000001' AND module_key='social_media';`

**Justification:** An active tile with zero output is worse than an available tile with a clear "Enable" path. Lauren will not have a Blotato account anyway — social is a future step for LAWNS.

### Active Tile Navigation — LABEL (brief, don't hide)

Active tiles (QR Checkout, QuickBooks, Social if enabled) have a green dot and box shadow but do nothing when tapped. This is the most notable Surface Honesty violation in the current codebase.

**Recommended handling:** Before showing the dashboard, say: "The tile grid shows you what's active. The action happens through the scan flow you just saw — each tile will get its own detail page in the next sprint." Do not hide the tiles — they correctly show which modules are live, which is useful context for Lauren.

### "Enable" buttons on Online Shop, Follow-Up, Delivery — LABEL

These tiles show "Enable" buttons that do nothing (`handleEnable()` only handles `'social_media'`). If Lauren clicks "Enable" on the Online Shop or Delivery tile, nothing happens.

**Recommended handling:** When walking through the dashboard, say: "These are the modules we'll add after you're live — I can show you what the Online Shop looks like." Do not attempt to click these during the demo. If Lauren clicks one, say "That's still being built — let me walk you through what's live."

### "Disconnect" button on QB banner — brief, don't use

The QB banner's "Disconnect" button resets local state only — it does not revoke the token. If someone clicks it by accident, the token is still valid in Supabase. Clicking "Connect QuickBooks" immediately re-completes. This is a PARTIAL state, not broken. Brief: do not demo this button; it's intentionally low-priority until the QB management page is built.

---

## 6. Items That Cannot Be Determined From Code Alone

These require a runtime test to verify. They become the **runtime verification checklist** to run before sitting down with Lauren and Terry.

| # | What to verify | How to verify |
|---|---|---|
| 1 | SCV-0031 status is 'available' and shows "Add to cart" | Navigate to `/plant/SCV-0031`, confirm button appears |
| 2 | QB is connected in the demo browser (QB banner shows green ✓) | Load `/dashboard`, check banner state |
| 3 | QB invoice creation produces a real invoice URL on the Confirmation screen | Place a test order end-to-end, click the QB link |
| 4 | Social drafts appear after an order (only after migrations applied) | Place test order, wait ~5 seconds, refresh dashboard, check drafts panel |
| 5 | Blotato Publish button sends a post to LAWNS's social account | Click Publish on a draft, verify in LAWNS's Instagram/Facebook account |
| 6 | `ANTHROPIC_API_KEY` is valid and Claude responds within 3 seconds | Place test order, watch Vercel function logs |
| 7 | `RESEND_API_KEY` and `FROM_EMAIL` are NOT configured → email is not sent | Place test order with your own email, confirm no email arrives |
| 8 | Dashboard metrics reflect real data after a test order | Place test order, click Refresh data, confirm Today's sales increments |
| 9 | Login with `david_obrien2016@outlook.com` works on demo device | Load `/login`, sign in, reach `/dashboard` |
| 10 | Phone checkout flow works on the demo phone (specific device + browser) | Load `/plant/SCV-0031` on the demo phone, complete checkout |
| 11 | QB popup is not blocked by the demo browser | Click "Connect QuickBooks" from dashboard, verify popup opens |
| 12 | Addons table has a seeded netting row with `trigger_rule='transport=self'` | `SELECT * FROM addons WHERE nursery_id='a1b2c3d4-...' AND trigger_rule='transport=self';` |
| 13 | Social_drafts table has `order_id` and `post_type` columns (migration applied) | `SELECT column_name FROM information_schema.columns WHERE table_name='social_drafts';` |
| 14 | PlantProfile.tsx footer phone number matches LAWNS's actual number | Confirm with David: is (512) 450-3336 the LAWNS nursery phone? |

---

*Audit produced by Claude Code — Session K — 2026-05-27. No code modified.*  
*TRACE Enterprises · Built with CAI*
