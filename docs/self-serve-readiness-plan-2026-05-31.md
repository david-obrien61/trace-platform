# Self-Serve Readiness Plan — August 2026 Europe Trip
# Cultivar OS · Scoped work items by tier
# Written: 2026-05-31 · Author: Claude Code

---

## 1. The August Constraint

In early August 2026, David and Regina join Erin in Europe for a trip of approximately 4–6 weeks — Erin finishes a three-week Alps walk, David and Regina meet her and spend two weeks traveling. The trip is explicitly a test: if TRACE can operate without David for that window, the next rotation is longer. The acquisition model has shifted from "David hand-sells to LAWNS in person" to "self-serve trial customers who never talk to David." That shift is not cosmetic — it changes the product requirements. A customer who finds cultivar-os.vercel.app while David is in a Swiss village must be able to sign up, configure the platform to reflect their actual business, run a 30-day trial, see real value, and convert to a paying customer entirely without email threads or demo calls. Every step of that journey must work on its own. This document scopes the work required to make it work before David boards the plane.

---

## 2. The Self-Serve Customer Journey, Fully Specified

Each step is stated as the customer experiences it, then what the system must do, then what currently exists, then what is missing.

---

### Step 1 — Cold arrival at cultivar-os.vercel.app

**Customer experience:** A nursery owner finds the URL — from a referral, a social post, a future built-with-CAI.com page, or direct word of mouth. They arrive expecting to understand what the product is and how to start.

**What the system must do:** Present a clear value proposition and a path to sign up. The first screen must answer "what is this?" and "what do I do next?"

**Currently built:** The app deploys from Vercel and has a login page. Authenticated routes are gated behind `PrivateRoute.tsx`. There is no public-facing landing page documented anywhere in the audit or inventory.

**Currently missing:** A landing page or clearly branded signup entry point at `/`. The current root is almost certainly the login form with no context for a cold visitor. A visitor who doesn't already know what Cultivar OS is will bounce. At minimum, the login/signup page needs the tagline, the two-sentence pitch, and a "Start your free trial" primary button.

---

### Step 2 — Signup

**Customer experience:** Enters email address, creates a password. Optionally enters their name on the same screen.

**What the system must do:** Create a Supabase auth account. Capture owner name (not currently asked at signup — email/password only). Redirect to the OnboardingWizard.

**Currently built:** Supabase email/password signup exists. Email confirmation is OFF (per CLAUDE.md). `packages/cultivar-os/src/pages/` has Login and SignUp pages (referenced in router context, not audited directly).

**Currently missing:** The signup form does not capture owner name — only email and password. Owner name is critical for personalizing the welcome email and for the businesses row. There is no redirect to OnboardingWizard after signup completion — the standard post-signup behavior is to land on the dashboard, which will show an error or empty state for a brand-new user with no businesses row.

---

### Step 3 — Onboarding wizard

**Customer experience:** Immediately after signup, walks through a 5-step wizard: WELCOME → NURSERY_SETUP (name, phone, address) → CHOOSE_PATH (4 options: Leakage, Checkout, Setup, Delivery) → PATH_EXPERIENCE → DONE. Learns what Cultivar OS does for them through the path they select. At the end, their account is configured.

**What the system must do:** Create a `businesses` row with owner_id = auth.uid(). Create a `nursery_profiles` row with default_install_price. Initialize the trial clock: set `trial_starts_at = now()` and `trial_ends_at = now() + 30 days`. Send a welcome email. Redirect to dashboard.

**Currently built:** `packages/cultivar-os/src/pages/OnboardingWizard.tsx` — all 4 paths exist (LEAKAGE, CHECKOUT, SETUP, DELIVERY). `finalize()` creates the `businesses` and `nursery_profiles` rows. Dashboard redirects to `/onboarding` when no businesses row exists.

**Currently missing:**
- `trial_starts_at` and `trial_ends_at` are not set in `finalize()`. The businesses table may not even have these columns — the `businesses_a_create_tables.sql` migration (2026-05-29) is the source of truth and would need to be audited to confirm. Either way, no trial initialization happens today.
- No welcome email is sent on wizard completion. The `notifications/templates/cultivar.ts` file has no welcome template.
- The redirect from signup → onboarding is not confirmed wired; post-signup landing may go directly to dashboard, bypassing the wizard for new accounts.

---

### Step 4 — First dashboard view (empty state)

**Customer experience:** Arrives at the dashboard after completing the wizard. Sees their nursery name, the tile grid, and metric tiles. Because they are brand new, all metrics are zero: no plants, no orders, no revenue.

**What the system must do:** Render gracefully with zero data. Guide the owner toward the first meaningful action (add a plant). Show trial countdown.

**Currently built:** `packages/cultivar-os/src/pages/Dashboard.tsx` + `packages/cultivar-os/api/dashboard.ts` — tile grid, metrics, QB reconnect banner, social drafts panel. All four tiles navigate correctly.

**Currently missing:**
- No empty state handling. When `api/dashboard.ts` returns all zeros, the UI renders zero tiles with no guidance. There is no "next step" card, no onboarding checklist, no "Add your first plant" prompt.
- No trial countdown banner. The trial clock is not initialized (Step 3 gap), so even if a banner existed there would be nothing to display.

---

### Step 5 — Adding inventory (plants)

**Customer experience:** Needs to add their actual plants to the system. Enters species name, container size, price, install price, growth timeline. The system assigns a SKU. They can then print a QR tag for each plant.

**What the system must do:** Write to the `plants` table. Auto-generate a unique SKU. Make a printable QR tag available.

**Currently built:** `plants` table exists with full schema. QR generation is at `packages/shared/src/qr/generate.ts` and `print.ts`. `PlantProfile.tsx` reads from the plants table. Tech Debt #4 (CLAUDE.md): PlantProfile.tsx line 108 hardcodes LAWNS footer — this would render the wrong nursery name for self-serve customers.

**Currently missing:** There is no plant management UI anywhere in the audit or inventory. No `/plants` page. No "Add Plant" form. No plant list view. No QR tag print workflow reachable by the owner. A self-serve customer has no path from "signed up" to "QR tag on a tree" without this. This is the single most critical functional gap for self-serve — the entire QR checkout flow is blocked by the absence of a plant creation UI.

---

### Step 6 — Connecting QuickBooks (optional but high-value)

**Customer experience:** Clicks "Connect QuickBooks" on the QB tile. Walks through OAuth. QB is now connected; invoices will auto-create on checkout.

**What the system must do:** QB OAuth flow at `/api/qbo/auth-url` → callback at `/api/qbo/callback` → stores tokens in `businesses` table. Proactive refresh before each invoice call.

**Currently built:** Full QB OAuth flow live. `packages/shared/src/quickbooks/refresh.ts` handles proactive token refresh. Amber banner in Dashboard when `qb_needs_reconnect = true`. All QB columns generalized to `accounting_type` / `accounting_token` / `accounting_refresh_token` / `accounting_token_expires_at` in the businesses table.

**Currently missing:** Nothing blocking for self-serve. QB is optional at checkout (integration failure never blocks an order per the critical rule). QB connect tile takes the user through the existing OAuth flow. This step works.

---

### Step 7 — Making the first sale (QR → addons → cart → invoice)

**Customer experience:** Customer scans QR tag on a plant. Arrives at `/plant/:sku`. Selects transport. Sees compliance prompt for netting (if self-transport). Selects add-ons. Enters their info. Reviews cart. Submits order. Sees QB invoice link on confirmation screen.

**What the system must do:** Full checkout pipeline from plant profile to order submit to QB invoice. Social media post generation fires in background.

**Currently built:** Full QR checkout flow is live end-to-end. `PlantProfile.tsx` → `AddOns.tsx` → `CustomerCapture.tsx` → `CartReview.tsx` → `Confirmation.tsx`. `api/orders/submit.ts` writes order + line items. `api/qbo/invoice/cultivar.ts` creates QB invoice. Social post generation fires and-forget. Customer email dedup working.

**Currently missing:**
- Tech Debt #4: `PlantProfile.tsx:108` hardcodes `"LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336"` in the footer. Every self-serve customer's checkout pages will show LAWNS data. Must fix before any non-LAWNS customer goes live.
- Confirmation.tsx shows "View QuickBooks sandbox preview" link regardless of QB environment (TD-5 from verification sweep — Surface Honesty violation).

---

### Step 8 — Dashboard after first sales

**Customer experience:** Returns to dashboard and sees their actual data: today's revenue, number of orders, leakage count. Tile states are accurate.

**What the system must do:** api/dashboard.ts queries orders, plants, losses filtered by business_id and date range. Returns real numbers.

**Currently built:** Dashboard metrics work (verified in 2026-05-30 state confirmation — $6,561 inventory shown correctly after businesses migration).

**Currently missing:** Nothing blocking. This step works once Step 5 (plant management) is complete and at least one order has been placed.

---

### Step 9 — Trial countdown

**Customer experience:** On the dashboard, a visible indicator shows "23 days remaining in your free trial." As the trial nears its end, the tone of the indicator shifts. The owner understands what will happen when the trial ends and has a clear path to pay.

**What the system must do:** Read `trial_ends_at` from the businesses row. Compute days remaining. Render a UI element (banner, chip, or card) when days remaining < some threshold (e.g., 14 days). Provide a "Upgrade" link.

**Currently built:** Nothing. `useModules.ts:100` has a seam (`nurseryPlan = 'starter'` hardcoded) noted in `built-inventory.md`, but no trial logic is wired.

**Currently missing:** The trial countdown UI, the data it reads from (trial_starts_at/trial_ends_at columns), and the link to a payment page. All three are absent.

---

### Step 10 — Trial expiration emails (Day 23, Day 29)

**Customer experience:** On day 23 of their trial (7 days remaining), receives a plain-text email: "Your Cultivar OS trial ends in 7 days. Here's what you've done: [N orders placed, $X in add-on revenue captured, N leakage events flagged]. Ready to keep going?" On day 29 (1 day remaining), a shorter final nudge.

**What the system must do:** Query businesses where `trial_ends_at - now()` falls within the target window. Send personalized email via Resend. Track that the email was sent (avoid duplicates). Requires a scheduled mechanism — a cron-triggered Vercel function or a GitHub Actions cron hitting an internal endpoint.

**Currently built:** `packages/shared/src/notifications/send.ts` and `queue.ts` exist. Resend is referenced. No trial-specific email templates exist yet. No cron mechanism exists.

**Currently missing:** Trial email templates. Cron mechanism. The query logic that finds businesses in the correct trial window. A sent-flag to prevent duplicate emails (or a query window that's tight enough to be safe).

---

### Step 11 — Trial expiration and upgrade prompt

**Customer experience:** Day 31. Opens dashboard. Sees a locked state — existing data is still visible but blurred, actions are disabled. A clear "Your trial has ended" message with a payment CTA. No data is lost.

**What the system must do:** `BusinessProvider` computes `isTrialExpired` (trial_ends_at < now() AND subscription_status ≠ 'active'). Dashboard renders `LockedOverlay` or an upgrade card on expiration. Data remains in the database; RLS still allows reads for the authenticated user; only write actions and new features are blocked.

**Currently built:** `LockedOverlay` component exists in `packages/shared/src/components/`. `BusinessProvider` at `packages/shared/src/context/BusinessProvider.tsx` provides business context.

**Currently missing:** `isTrialExpired` computation in BusinessProvider. `subscription_status` column on businesses table (may not exist in current migration). Dashboard response to expired state. Payment route to convert from expired → active.

---

### Step 12 — Payment (Stripe checkout → subscription)

**Customer experience:** Clicks "Upgrade" from the trial countdown or expiration screen. Lands on a payment page showing the $299/mo Cultivar OS rate (or $149/mo founding rate if David offered it). Enters card. Subscription starts. Returns to a fully unlocked dashboard.

**What the system must do:** Create a Stripe checkout session or payment intent. Redirect to Stripe-hosted checkout. Handle success webhook: update `businesses.subscription_status = 'active'` and `businesses.stripe_subscription_id`. Send receipt email. Unlock dashboard.

**Currently built:** Nothing. `SubscriptionTier` type in `packages/shared/src/supabase/types.ts` has `stripe_customer_id` and `stripe_subscription_id` fields — the schema seam exists. No Stripe calls exist anywhere in Cultivar OS. From `built-inventory.md`: "Stripe base subscription ❌ (localStorage-based, no actual billing)" for both verticals.

**Currently missing:** Everything for Stripe: env vars in Vercel, Stripe product/price created in dashboard, `/api/stripe/create-checkout-session`, `/api/stripe/webhook` endpoint, `stripe_customer_id` + `stripe_subscription_id` + `subscription_status` columns on businesses table, the Payment.tsx page, and post-payment unlock logic.

---

### Step 13 — Ongoing use: settings, QB reconnect, social, delivery

**Customer experience:** Adjusts tax rate, default install price, social media account settings. QB occasionally needs reconnect (handled by existing amber banner). Social drafts queue up, owner publishes. Delivery routes planned.

**What the system must do:** Settings page saves all fields correctly. All tiles navigate to functional pages. QB reconnect flow works.

**Currently built:** Settings page is live (packages/cultivar-os/src/pages/Settings.tsx). QB reconnect banner and flow work. Social media module is live. DeliveryRoute is live. Campaigns live.

**Currently missing:** Some settings fields may not save correctly (not all save handlers have been verified end-to-end per the drift audit). Tax rate and install price fields specifically need validation (see work items below). No inline help text explaining what each field does.

---

## 3. Work Items Required

Organized by category. Each item has: what it is, why it's necessary, where it lives, effort estimate, dependencies, risk if skipped.

---

### ONBOARDING FLOW

---

**O-1 — Landing page or branded signup entry point**

- **What it is:** A minimal home screen at the app root that names Cultivar OS, states the core value proposition in two sentences, and offers a "Start Free Trial" CTA alongside a "Log in" link.
- **Why it's necessary:** A cold visitor arriving at cultivar-os.vercel.app with no context will see a login form and leave. The product needs to answer "what is this?" before asking "who are you?"
- **Where it lives:** Modify `packages/cultivar-os/src/pages/Login.tsx` to add branding + tagline above the form, or create new `packages/cultivar-os/src/pages/Landing.tsx` with a route at `/` that redirects authenticated users to `/dashboard`.
- **Effort estimate:** 3 hours
- **Dependencies:** None.
- **Risk if skipped:** Self-serve acquisition rate is near zero. Prospects who don't already know what the product is cannot onboard themselves.

---

**O-2 — Signup form captures owner name**

- **What it is:** Add an "Owner name" required field to the signup form alongside email and password.
- **Why it's necessary:** The businesses row and welcome email both need the owner's name. Capturing it at signup avoids having to ask again in the wizard.
- **Where it lives:** `packages/cultivar-os/src/pages/SignUp.tsx` (add field + pass to Supabase user metadata or store temporarily for wizard to pick up).
- **Effort estimate:** 2 hours
- **Dependencies:** None.
- **Risk if skipped:** Welcome email addressed to "Hi," instead of "Hi Lauren,". Businesses row has blank owner_name. Minor but degrades first impression.

---

**O-3 — Signup → OnboardingWizard redirect**

- **What it is:** After successful signup, redirect to `/onboarding` instead of `/dashboard`. The redirect logic in `Dashboard.tsx` that checks for a missing businesses row does this indirectly today, but only after a failed dashboard load — the experience is an error flash, then redirect.
- **Why it's necessary:** New signups should land directly in the wizard, not see a dashboard error first.
- **Where it lives:** `packages/cultivar-os/src/pages/SignUp.tsx` — on successful Supabase signup, `navigate('/onboarding', { replace: true })`.
- **Effort estimate:** 1 hour
- **Dependencies:** None.
- **Risk if skipped:** New users see an error flash before the wizard. Feels broken. Drops trust immediately.

---

**O-4 — Welcome email on wizard completion**

- **What it is:** After `OnboardingWizard.finalize()` succeeds, send a welcome email to the owner's email address via Resend.
- **Why it's necessary:** The owner needs confirmation that their account is set up. An email is also the first touchpoint TRACE makes as a brand — a well-written welcome email sets the relationship tone.
- **Where it lives:** Add a `welcome` template to `packages/shared/src/notifications/templates/cultivar.ts`. Call `sendSilently('welcome', ...)` inside `packages/cultivar-os/src/pages/OnboardingWizard.tsx` in the `finalize()` function.
- **Effort estimate:** 3 hours
- **Dependencies:** Resend env var confirmed active (RESEND_API_KEY in Vercel). Verify before building.
- **Risk if skipped:** No welcome confirmation. Owners wonder if signup worked. Support volume increases from confused users.

---

**O-5 — Empty state in dashboard ("add your first plant")**

- **What it is:** When `api/dashboard.ts` returns metrics that are all zero, Dashboard.tsx renders a guided "Getting started" card explaining the next three steps: Add a plant, print the QR tag, make your first sale.
- **Why it's necessary:** An empty dashboard is demoralizing and confusing. New users need to know what to do next. Without guidance, churn in the first 48 hours is near-certain.
- **Where it lives:** `packages/cultivar-os/src/pages/Dashboard.tsx` — conditional rendering block when `totalRevenue === 0 && plantCount === 0`.
- **Effort estimate:** 4 hours
- **Dependencies:** Plant management UI (O-7) must exist so the "Add a plant" link goes somewhere real.
- **Risk if skipped:** Trial-to-day-7 churn rate is high. Customers who don't get value in the first week don't convert. This is the primary retention lever in the first 7 days.

---

**O-6 — Sensible defaults seeded at wizard completion**

- **What it is:** When `finalize()` creates the businesses row, also seed one default `service_offerings` row (transport_method: 'self', price: 0) and one `opportunity_items` row (netting, $10 default price) so the checkout flow has something to show before the owner has customized anything.
- **Why it's necessary:** Without defaults, the add-ons screen in checkout is empty and the compliance prompt doesn't appear. The netting prompt is the core demo mechanic — it must work out of the box.
- **Where it lives:** `packages/cultivar-os/src/pages/OnboardingWizard.tsx` in `finalize()` — additional Supabase inserts into `service_offerings` and `opportunity_items` tables.
- **Effort estimate:** 3 hours
- **Dependencies:** The `service_offerings` and `opportunity_items` tables were created in the businesses migrations (2026-05-29). Verify column names before coding.
- **Risk if skipped:** New customers' first checkout shows no add-ons and no compliance prompt. The most valuable demo mechanic is invisible. Customers don't see the netting revenue recovery they signed up for.

---

### PLANT MANAGEMENT

---

**P-1 — Plant inventory management UI**

- **What it is:** A `/plants` page showing all plants for the current business, with an "Add Plant" form. The form captures: species name, container size (gallon), price per plant, install price, and a brief care note. On save, a unique SKU is auto-generated (pattern: first-3-letters-of-species + container-size + counter, e.g., SCV-0032), the plant row is inserted into the `plants` table, and a QR tag for the new plant is downloadable/printable immediately.
- **Why it's necessary:** This is the single most critical functional gap for self-serve. The entire product value proposition — QR tag → scan → checkout → invoice — is inaccessible to a new customer who cannot add plants to their own database. There is no path from "signed up" to "making a sale" without this.
- **Where it lives:** New `packages/cultivar-os/src/pages/Plants.tsx`. New route `/plants` in `packages/cultivar-os/src/router.tsx`. Uses existing `packages/shared/src/qr/generate.ts` for QR generation and `packages/shared/src/qr/print.ts` for label output.
- **Effort estimate:** 14 hours (plant list view: 3h, add plant form: 3h, SKU generation logic: 1h, QR generate/print integration: 3h, edit/delete: 2h, "Add plant" tile or link in dashboard: 2h)
- **Dependencies:** None. plants table exists. QR modules exist.
- **Risk if skipped:** Self-serve is completely non-functional. No amount of other work matters if a new customer cannot add their own inventory. This is the highest-impact missing feature.

---

**P-2 — Fix PlantProfile.tsx hardcoded LAWNS footer**

- **What it is:** Replace the hardcoded string `"LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336"` at `packages/cultivar-os/src/pages/PlantProfile.tsx:108` with data read from the nursery/business context.
- **Why it's necessary:** Every self-serve customer's plant profile page — the page their customers scan and see — will show LAWNS's name and phone number. This is a Surface Honesty violation and a trust-destroying data error for any non-LAWNS customer.
- **Where it lives:** `packages/cultivar-os/src/pages/PlantProfile.tsx:108` — read `business.name`, `business.city`, `business.state`, `business.phone` from `useBusinessContext()`. This is Tech Debt #4 in CLAUDE.md.
- **Effort estimate:** 1 hour
- **Dependencies:** `useBusinessContext()` is already available. Read the businesses row fields.
- **Risk if skipped:** Every non-LAWNS customer's checkout footer names LAWNS. This is a product-breaking defect for self-serve.

---

### TRIAL MECHANICS

---

**T-1 — Trial clock columns on businesses table**

- **What it is:** Database migration adding `trial_starts_at timestamptz` and `trial_ends_at timestamptz` to the `businesses` table, plus `subscription_status text` defaulting to `'trial'`.
- **Why it's necessary:** None of the trial mechanics, countdown UI, or Stripe integration can work without knowing when the trial started and ends and what the current subscription state is.
- **Where it lives:** New migration file `supabase/migrations/20260601_businesses_trial_and_subscription.sql`. Apply manually in Supabase SQL editor for bgobkjcopcxusjsetfob project.
- **Effort estimate:** 2 hours (migration write + apply + verify)
- **Dependencies:** None. Businesses table exists.
- **Risk if skipped:** Everything downstream from here (countdown, emails, Stripe) is blocked.

---

**T-2 — Initialize trial clock in OnboardingWizard.finalize()**

- **What it is:** In `packages/cultivar-os/src/pages/OnboardingWizard.tsx`, after the businesses row is created, update it to set `trial_starts_at = now()` and `trial_ends_at = now() + interval '30 days'` and `subscription_status = 'trial'`.
- **Why it's necessary:** The trial clock starts from the moment the owner completes setup — not from signup. Initializing in finalize() ensures the 30-day window is accurate.
- **Where it lives:** `packages/cultivar-os/src/pages/OnboardingWizard.tsx` — inside the `finalize()` function, add a Supabase `.update()` call on the businesses row after creation.
- **Effort estimate:** 2 hours
- **Dependencies:** T-1 (columns must exist before they can be written).
- **Risk if skipped:** Trial clock is uninitialized. All countdown logic reads null and breaks. Stripe integration has no trial end date to work from.

---

**T-3 — Trial countdown visible in Dashboard**

- **What it is:** An amber banner above the tile grid in `Dashboard.tsx` showing "X days remaining in your free trial" when days remaining is ≤ 14. Includes an "Upgrade" button that links to `/subscribe`. When trial is expired and subscription_status ≠ 'active', the banner is red and says "Your trial has ended."
- **Why it's necessary:** Customers who don't know their trial is ending don't plan for it. Surprise expiration is the fastest way to lose a paying customer who intended to convert.
- **Where it lives:** `packages/cultivar-os/src/pages/Dashboard.tsx` — read `trial_ends_at` and `subscription_status` from businesses row (already loaded in loadMetrics or a new loadBusiness call). Compute days remaining. Conditional rendering of the banner.
- **Effort estimate:** 3 hours
- **Dependencies:** T-1 (columns), T-2 (data is populated), BusinessProvider should expose trial state.
- **Risk if skipped:** Customers don't know the trial is ending. Conversion rate drops. Angry surprise-expired customers who felt blindsided.

---

**T-4 — Trial expiration enforcement (locked state)**

- **What it is:** When `trial_ends_at < now()` and `subscription_status = 'trial'` (not yet paid), Dashboard renders a locked state: existing data is still visible in a blurred/muted form, but new orders cannot be submitted. An "Upgrade to continue" card is prominently displayed. No data is deleted.
- **Why it's necessary:** Without enforcement, the trial is effectively infinite. Enforcement is what converts trial users to paying customers. The existing `LockedOverlay` component in shared is designed for exactly this.
- **Where it lives:** `packages/shared/src/context/BusinessProvider.tsx` — add `isTrialExpired` computed from trial_ends_at and subscription_status. `packages/cultivar-os/src/pages/Dashboard.tsx` — wrap metric tiles and action buttons with conditional rendering based on `isTrialExpired`.
- **Effort estimate:** 5 hours
- **Dependencies:** T-1, T-2, T-3, and Stripe integration (S-1 through S-4) — enforcing expiration without a payment path is a dead end.
- **Risk if skipped:** Trial is infinite. No conversion mechanism. TRACE has no revenue.

---

**T-5 — Trial reminder email at day 23 (7 days remaining)**

- **What it is:** An automated email sent when `trial_ends_at - now()` is between 7 and 8 days. Content: personalized summary of what the customer has done in the trial (order count, revenue captured, leakage flagged), plus a clear "Upgrade" link.
- **Why it's necessary:** The day-7-remaining window is when most SaaS trials convert. A personalized "here's what you've done" email is the most effective trial-end nudge because it reflects real value delivered.
- **Where it lives:** New Vercel function `packages/cultivar-os/api/trial/reminders.ts`. Triggered by a daily cron (GitHub Actions cron targeting this endpoint, or Vercel cron if available). Queries businesses where trial_ends_at between now()+6d and now()+8d, pulls their metrics from dashboard API, sends via Resend.
- **Effort estimate:** 6 hours (cron mechanism: 2h, query logic: 1h, template: 1h, send wiring: 1h, dedup to avoid double-sending: 1h)
- **Dependencies:** T-1, T-2. Resend env var active.
- **Risk if skipped:** No proactive outreach at the most critical conversion window. Some customers who intended to convert forget. Conversion rate drops meaningfully.

---

**T-6 — Trial reminder email at day 29 (1 day remaining)**

- **What it is:** A shorter follow-up email when trial_ends_at is 1-2 days away. "Tomorrow your Cultivar OS trial ends. Don't lose your data — upgrade now."
- **Why it's necessary:** A second reminder catches people who missed the first one or who needed time to decide.
- **Where it lives:** Same cron mechanism as T-5, additional query window. Same `packages/cultivar-os/api/trial/reminders.ts` endpoint with a second email path.
- **Effort estimate:** 2 hours (reuses all T-5 infrastructure, just different window and template)
- **Dependencies:** T-5.
- **Risk if skipped:** Customers who missed the day-7 email have no safety net. Some unnecessary churn at expiration.

---

### PAYMENT INTEGRATION

---

**S-1 — Stripe account setup and Vercel env vars**

- **What it is:** Create a Stripe account (or use existing if one exists for TRACE), create a Cultivar OS product and price in the Stripe dashboard ($299/mo standard, $149/mo founding), add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Vercel cultivar-os project environment variables.
- **Why it's necessary:** All Stripe API calls require an account and keys. This is a prerequisite for everything else in this category.
- **Where it lives:** Stripe dashboard (admin task). Vercel environment settings.
- **Effort estimate:** 1 hour
- **Dependencies:** None.
- **Risk if skipped:** No payment is possible.

---

**S-2 — Stripe checkout session (payment flow)**

- **What it is:** A Vercel serverless function at `packages/cultivar-os/api/stripe/create-checkout-session.ts` that creates a Stripe Checkout session for the correct price, pre-fills the customer email, and returns the session URL. A `packages/cultivar-os/src/pages/Subscribe.tsx` page calls this endpoint and redirects to Stripe-hosted checkout.
- **Why it's necessary:** This is the payment UI. Without it, there is no way to collect money.
- **Where it lives:** New `packages/cultivar-os/api/stripe/create-checkout-session.ts`. New `packages/cultivar-os/src/pages/Subscribe.tsx`. New route `/subscribe` in router.tsx.
- **Effort estimate:** 8 hours (API handler: 2h, page: 2h, price selection logic founding vs. standard: 1h, success/cancel URL config: 1h, testing in Stripe test mode: 2h)
- **Dependencies:** S-1.
- **Risk if skipped:** No revenue collection possible. Trial remains effectively infinite for anyone who doesn't convert voluntarily via another channel.

---

**S-3 — Stripe webhook handler (subscription state)**

- **What it is:** A Vercel function at `packages/cultivar-os/api/stripe/webhook.ts` that receives Stripe webhook events: `checkout.session.completed` (set subscription_status = 'active', store stripe_customer_id and stripe_subscription_id), `customer.subscription.deleted` (set status = 'cancelled'), `invoice.payment_failed` (set status = 'past_due').
- **Why it's necessary:** Stripe calls your server to tell you what happened with the payment. Without this endpoint, the businesses table never knows a payment occurred and the dashboard stays locked.
- **Where it lives:** New `packages/cultivar-os/api/stripe/webhook.ts`. Must be registered in Stripe dashboard as a webhook endpoint. Add `STRIPE_WEBHOOK_SECRET` to Vercel env.
- **Effort estimate:** 6 hours (raw body parsing: 1h, signature verification: 0.5h, event handling for 3 event types: 2h, businesses table updates: 1h, testing with Stripe CLI: 1.5h)
- **Dependencies:** S-1, S-2. The businesses table needs `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` columns (from T-1 migration or a separate migration — confirm columns exist).
- **Risk if skipped:** Stripe charges the customer successfully but the dashboard stays locked. Customer thinks the payment didn't work. Chargebacks and panic.

---

**S-4 — Failed payment handling and grace period**

- **What it is:** When `invoice.payment_failed` webhook arrives, set `subscription_status = 'past_due'`. Dashboard shows a "Payment failed — please update your card" banner. Stripe retries automatically for 3 days. If all retries fail, Stripe sends `customer.subscription.deleted` → webhook sets status to `cancelled`. Three-day grace period (Stripe handles retry timing) means the dashboard stays functional during retry window.
- **Why it's necessary:** Cards expire. Payments fail. A customer whose payment fails needs a clear path to fix it — not an immediate lockout that makes them think they've been cancelled.
- **Where it lives:** `packages/cultivar-os/api/stripe/webhook.ts` (add past_due case). `packages/cultivar-os/src/pages/Dashboard.tsx` (add banner when subscription_status = 'past_due'). Configure Stripe to retry 3 times over 3 days in Stripe dashboard settings.
- **Effort estimate:** 3 hours (webhook case: 1h, banner: 1h, Stripe retry config: 1h)
- **Dependencies:** S-3.
- **Risk if skipped:** Failed payments result in immediate lockout. Customers who had a temporary card issue are permanently alienated. Recoverable revenue is lost.

---

**S-5 — Cancel subscription flow**

- **What it is:** A "Cancel subscription" button in the Settings page that calls `/api/stripe/cancel-subscription`. The API cancels the subscription at the end of the current billing period (not immediately). The businesses row shows subscription_status = 'cancelling'. Dashboard shows "Your subscription ends on [date]."
- **Why it's necessary:** Customers need to be able to cancel without emailing David. If they can't self-serve cancel, they may initiate a chargeback instead.
- **Where it lives:** New `packages/cultivar-os/api/stripe/cancel-subscription.ts`. Button in `packages/cultivar-os/src/pages/Settings.tsx`. Cancel confirmation modal.
- **Effort estimate:** 4 hours
- **Dependencies:** S-3 (subscription ID must be stored).
- **Risk if skipped:** Customers who want to cancel email David. During the Europe trip, there's no one to respond. They initiate chargebacks. Stripe account reputation damaged.

---

**S-6 — Receipt emails**

- **What it is:** Configure Stripe to send automated payment receipts to the customer email on successful charges.
- **Why it's necessary:** Customers expect a receipt when they pay. Business owners especially need it for their own bookkeeping.
- **Where it lives:** Stripe dashboard → Settings → Emails → "Successful payments" receipt enabled.
- **Effort estimate:** 0.5 hours (admin task only — no code)
- **Dependencies:** S-1.
- **Risk if skipped:** No paper trail for customers. Minor but creates support inquiries.

---

### CONFIGURATION / SETTINGS

---

**C-1 — Verify all Settings fields save correctly**

- **What it is:** Audit every field in `packages/cultivar-os/src/pages/Settings.tsx` and `packages/shared/src/pages/Settings.tsx` to confirm: the field has a save handler, the save handler writes to the correct column in the businesses or nursery_profiles table, the UI reflects the saved value on reload, and errors are surfaced if the save fails.
- **Why it's necessary:** Settings is a new page that hasn't been end-to-end verified. A settings field that looks editable but doesn't save is a Surface Honesty violation and will frustrate self-serve owners configuring their own accounts.
- **Where it lives:** `packages/cultivar-os/src/pages/Settings.tsx` + `packages/shared/src/pages/Settings.tsx`. Run each field through the edit → save → reload cycle.
- **Effort estimate:** 5 hours (audit + fix any broken handlers)
- **Dependencies:** None.
- **Risk if skipped:** Owners configure their tax rate or install price, it silently doesn't save, orders calculate wrong amounts. Trust-destroying.

---

**C-2 — Settings field validation**

- **What it is:** Add client-side validation to the Settings page: tax_rate must be a number between 0.00 and 0.20; phone number must be 10 digits; install_price must be a positive number; required fields (business name) cannot be blank. Show inline error messages for invalid values.
- **Why it's necessary:** Self-serve owners configure their own settings without David reviewing the values. A mistyped tax rate (e.g., 8.25 instead of 0.0825) produces wrong totals on every order until someone notices.
- **Where it lives:** `packages/shared/src/pages/Settings.tsx` + `packages/cultivar-os/src/pages/Settings.tsx`. Use existing `FormField.tsx` component from shared for consistent error display.
- **Effort estimate:** 3 hours
- **Dependencies:** C-1 (confirm which fields exist before validating).
- **Risk if skipped:** Owners configure invalid values silently. Every order in their system uses wrong math. Support nightmare when they notice months later.

---

**C-3 — Settings inline help text**

- **What it is:** Add a one-sentence explanation beneath each settings field: what it is, what units it uses, what a typical value looks like. Example under tax_rate: "Your state sales tax rate as a decimal. Texas standard rate is 0.0825 (8.25%)."
- **Why it's necessary:** Self-serve owners have no David to ask. If a field label is ambiguous, they leave it wrong. Help text reduces configuration errors and support volume.
- **Where it lives:** `packages/shared/src/pages/Settings.tsx` — add `hint` prop to `FormField.tsx` components where it doesn't already exist. `FormField.tsx` already has a hint slot.
- **Effort estimate:** 4 hours
- **Dependencies:** C-1.
- **Risk if skipped:** Increased support questions. Configuration errors from unclear field labels.

---

### CUSTOMER SUPPORT INFRASTRUCTURE

---

**CS-1 — Customer-facing FAQ (linkable, simple)**

- **What it is:** A `/help` page in the app (or a linked Notion/Google Doc page) covering the 8–10 most common questions: How do I add a plant? How do I print a QR tag? How do I connect QuickBooks? What happens when my trial ends? How do I update my tax rate? How do I cancel?
- **Why it's necessary:** During the Europe trip, there is no one to answer basic product questions via email. A well-written FAQ eliminates most support volume before it starts.
- **Where it lives:** New `packages/cultivar-os/src/pages/Help.tsx` with route `/help`. Content is mostly prose, minimal code. Or: a Notion page linked from the app — faster to write but requires updating in two places.
- **Effort estimate:** 3 hours (page: 1h, content writing: 2h)
- **Dependencies:** O-5 (empty state links to help page).
- **Risk if skipped:** David gets support emails from Switzerland. Owners who can't figure out basic steps churn.

---

**CS-2 — In-app help link visible from main pages**

- **What it is:** A "Help" link in the Dashboard header or navigation area that opens the FAQ page or sends to the support email.
- **Why it's necessary:** Owners who are confused in the middle of a task shouldn't have to open a new browser tab to find help. A visible link reduces friction from confusion to answer.
- **Where it lives:** `packages/cultivar-os/src/pages/Dashboard.tsx` — add a "?" icon or "Help" link in the header area. Two lines of code.
- **Effort estimate:** 1 hour
- **Dependencies:** CS-1.
- **Risk if skipped:** FAQ exists but is unfindable. Support volume remains high.

---

**CS-3 — Support email auto-reply configured for trip**

- **What it is:** david@trace-enterprises.com has an out-of-office auto-reply active for the trip window (early August through mid-September). Reply text: "I'm traveling in Europe with family until [return date]. For urgent platform issues, contact [Andrew's email or phone]. For everything else, I'll respond when I'm back." Configure in email client before departure.
- **Why it's necessary:** Without an auto-reply, customers who email get silence. Silence during a platform issue is the fastest trust-killer. An auto-reply sets expectations and provides an escalation path.
- **Where it lives:** Email client (Gmail, Outlook) — admin task, no code.
- **Effort estimate:** 1 hour
- **Dependencies:** Andrew's escalation path must be defined first (CS-4).
- **Risk if skipped:** Customers email David, get silence, assume the company is unresponsive or defunct. Churn.

---

**CS-4 — Escalation runbook for Andrew**

- **What it is:** A written document (can live in docs/) covering: how to check Vercel deployment logs, how to check Supabase dashboard for table errors, what constitutes an escalation vs. what to handle vs. what to defer to David's return. Specific scenarios: customer can't log in, customer's QB isn't working, customer reports wrong totals on orders, customer wants to cancel.
- **Why it's necessary:** Andrew is the operational support during the trip. Without a runbook, he doesn't know what he has access to, what tools to use, or what decisions are in his scope vs. David's.
- **Where it lives:** New `docs/runbook-august-2026.md`.
- **Effort estimate:** 4 hours (documentation, not code)
- **Dependencies:** None. Can be written independently.
- **Risk if skipped:** A real platform issue occurs while David is unavailable. Andrew doesn't know how to diagnose it. The issue persists. Customer churn.

---

### FAILURE RECOVERY

---

**F-1 — Graceful degradation audit for Supabase queries**

- **What it is:** Audit all Supabase queries in `packages/cultivar-os/src/hooks/` and `packages/cultivar-os/api/` for unhandled `.error` returns. Ensure each error case renders a human-readable message (not a blank screen or console error) with an actionable next step (e.g., "We couldn't load your plants. Try refreshing the page. If this keeps happening, contact support@trace-enterprises.com").
- **Why it's necessary:** During David's absence, there is no one to debug a customer's blank screen. Error messages that tell the customer what to do next replace what would otherwise be a support email to David.
- **Where it lives:** All files in `packages/cultivar-os/src/hooks/` and `packages/cultivar-os/api/`. Estimated 15–20 query sites.
- **Effort estimate:** 4 hours
- **Dependencies:** None.
- **Risk if skipped:** A transient Supabase error (network blip, rate limit) shows a blank screen. Customer thinks the product broke and emails David from Switzerland.

---

**F-2 — External API retry wrapper**

- **What it is:** Wrap QB API calls in `packages/cultivar-os/api/qbo/invoice/cultivar.ts` and Blotato calls in `packages/cultivar-os/api/social/publish.ts` with a single retry on timeout or 5xx. Log all failures with enough context (endpoint, business_id, error code) to diagnose from Vercel logs.
- **Why it's necessary:** External APIs have transient failures. A single retry recovers most of them. Structured logging means David or Andrew can identify what failed and for whom by reading Vercel logs without access to a customer's session.
- **Where it lives:** `packages/cultivar-os/api/qbo/invoice/cultivar.ts` and `packages/cultivar-os/api/social/publish.ts`. Simple retry wrapper (fetch with catch → retry once → log).
- **Effort estimate:** 3 hours
- **Dependencies:** None. QB refresh already handles token expiry (refresh.ts).
- **Risk if skipped:** A transient QB timeout fails the invoice creation. The customer doesn't get their invoice. They email David.

---

**F-3 — QB OAuth refresh already complete (no action)**

- `packages/shared/src/quickbooks/refresh.ts` handles proactive token refresh with 10-minute buffer. Dashboard shows amber reconnect banner when reconnection is needed. This is complete and working. No action required.

---

### MONITORING

---

**M-1 — Uptime monitoring (Better Uptime or UptimeRobot)**

- **What it is:** External uptime monitoring for cultivar-os.vercel.app. Pings the URL every 5 minutes. Sends an SMS and email alert to David's phone if the site is down for more than 5 minutes.
- **Why it's necessary:** If Vercel has an outage, David needs to know from monitoring — not from a customer email. During the trip, being woken up by an alert at 2am European time is acceptable; finding out from a churn email a week later is not.
- **Where it lives:** Better Uptime (betteruptime.com) or UptimeRobot (uptimerobot.com) — admin task, no code. Free tier is sufficient.
- **Effort estimate:** 1 hour
- **Dependencies:** None.
- **Risk if skipped:** Vercel outage goes undetected. Customers experience downtime with no one notified.

---

**M-2 — Error tracking (Sentry)**

- **What it is:** Install Sentry in the Cultivar OS frontend and Vercel API functions. Configure Sentry to capture JavaScript exceptions in the browser and unhandled errors in API routes. Send alerts to David's email when a new error type appears or when error volume spikes.
- **Why it's necessary:** When a self-serve customer hits an unhandled exception, there's no support ticket telling David about it. Sentry captures it automatically, with full stack trace, browser context, and the action the user was taking. Diagnosable from Switzerland without access to the user's session.
- **Where it lives:** `npm install @sentry/react @sentry/node` in cultivar-os package. Initialize in `packages/cultivar-os/src/main.tsx`. Wrap Vercel API handlers with Sentry. Add `SENTRY_DSN` to Vercel env vars.
- **Effort estimate:** 4 hours (install: 0.5h, frontend init: 1h, API function wrap: 1.5h, alert config: 1h)
- **Dependencies:** Sentry account (free tier is sufficient for early-stage use).
- **Risk if skipped:** Errors happen silently. A bug that's breaking checkout for every new user might not be discovered for days.

---

**M-3 — Daily metrics summary email to David**

- **What it is:** A cron-triggered Vercel function at `packages/cultivar-os/api/reports/daily.ts` that runs every morning at 7am UTC. Queries: new signups in last 24h, trial-to-paid conversions in last 24h, orders placed, total revenue, any Sentry errors in last 24h. Sends a plain-text summary to David's email.
- **Why it's necessary:** David needs to know what's happening with TRACE while hiking in the Alps. A daily email means he can check once a day in 90 seconds rather than logging into four different dashboards.
- **Where it lives:** New `packages/cultivar-os/api/reports/daily.ts`. GitHub Actions cron YAML to call it daily. Or Vercel Cron Jobs (Vercel Pro plan required — check current plan).
- **Effort estimate:** 7 hours (query logic: 2h, email template: 1h, cron mechanism: 2h, testing: 2h)
- **Dependencies:** M-2 (Sentry) for error count. Resend for delivery.
- **Risk if skipped:** David has no passive awareness of system health. He has to actively log into Vercel, Supabase, Sentry separately. Won't happen consistently during a 6-week trip.

---

**M-4 — Database backup verification**

- **What it is:** Verify that point-in-time recovery (PITR) is enabled for the bgobkjcopcxusjsetfob Supabase project. Document the recovery procedure in the runbook.
- **Why it's necessary:** Supabase Pro plan includes daily backups and PITR. If a migration gone wrong corrupts data, there must be a recovery path. Verify it exists before the trip.
- **Where it lives:** Supabase dashboard → project settings → database → backups. Admin task.
- **Effort estimate:** 0.5 hours
- **Dependencies:** None.
- **Risk if skipped:** A bad migration during the trip has no recovery path. Extremely low probability, but catastrophic if it happens.

---

### BUG FIXES

---

**B-1 — DemoQBInvoice.tsx Layna comment**

- **What it is:** Remove or replace the stale "Layna" reference in a JSX comment in `packages/cultivar-os/` (exact file TBD — likely in the QB invoice display area). "Layna" was a miscommunication from early sessions; she is not a real contact.
- **Why it's necessary:** If the comment is visible in compiled output or developer tools, it creates confusion. More importantly, it's undocumented stale state.
- **Where it lives:** Search for "Layna" in packages/cultivar-os/ to confirm the file and line. The verification sweep from 2026-05-30 identified it as DemoQBInvoice.tsx.
- **Effort estimate:** 0.5 hours
- **Dependencies:** None.
- **Risk if skipped:** Low direct risk. Stale state in codebase.

---

**B-2 — Confirmation.tsx env-aware QB link**

- **What it is:** The confirmation screen shows a "View QuickBooks sandbox preview" link regardless of the QB environment. In production (which Cultivar OS is, per the QBO_ENVIRONMENT = production setting), this link text should not say "sandbox." Update to read the QB environment and render the correct link label (or just "View QuickBooks invoice").
- **Why it's necessary:** A customer who just paid for a real transaction sees a link labeled "sandbox." Undermines trust in the QB integration. This is the Surface Honesty violation identified in the verification sweep (TD-5).
- **Where it lives:** `packages/cultivar-os/src/pages/Confirmation.tsx:190`. Conditional: if QBO_ENVIRONMENT === 'production', render "View QuickBooks invoice"; otherwise render "View QuickBooks sandbox preview."
- **Effort estimate:** 1 hour
- **Dependencies:** None.
- **Risk if skipped:** Self-serve customers see "sandbox" on their production invoice confirmation. Calls into question whether the invoice is real.

---

**B-3 — PLATFORM_STRATEGY.md PART 11 numbering collision**

- **What it is:** PLATFORM_STRATEGY.md has two sections both labeled "PART 11" — "BUILD PRIORITIES (SOLO BUILDER EDITION)" and "CANONICAL PLATFORM VOCABULARY." Renumber the second to PART 17 (it was already inserted after PART 16 on 2026-05-29).
- **Why it's necessary:** Future Claude Code sessions reading PLATFORM_STRATEGY.md will see the collision and flag it as a conflict, wasting session time on a doc error.
- **Where it lives:** `PLATFORM_STRATEGY.md` — check the current numbering and renumber the second PART 11 correctly.
- **Effort estimate:** 0.5 hours
- **Dependencies:** None.
- **Risk if skipped:** Minor confusion in future sessions.

---

**B-4 — useNursery.ts deprecation, callers migrated to useBusinessContext()**

- **What it is:** `packages/cultivar-os/src/hooks/useNursery.ts` queries the `nurseries` table directly (`.from('nurseries')`) per the 2026-05-30 drift audit. The canonical hook is now `useBusinessContext()` from BusinessProvider. Migrate all callers, then delete or stub useNursery.ts.
- **Why it's necessary:** useNursery.ts is a legacy hook from before the businesses migration. If it's still running `.from('nurseries')`, it may not pick up business_id correctly and could silently return stale data for self-serve customers.
- **Where it lives:** `packages/cultivar-os/src/hooks/useNursery.ts`. Run `grep -rn "useNursery" packages/cultivar-os/src/` to find all callers. The hook is also a re-export shim after the businesses migration — verify whether it's truly calling nurseries directly or already wrapping businessContext.
- **Effort estimate:** 4 hours (audit callers: 1h, migrate each: 2h, delete or stub: 1h)
- **Dependencies:** None.
- **Risk if skipped:** useNursery.ts silently uses stale data patterns. Self-serve customers with no nurseries table row (they have businesses rows) may get wrong context.

---

### DOCUMENTATION

---

**D-1 — Update built-inventory.md to actual state**

- **What it is:** Update `docs/built-inventory.md` to reflect the actual platform state as of 2026-05-30. Close the three "Not Yet Built" entries that are now built (OnboardingWizard, Settings page, DeliveryRoute). Add the 10+ undocumented pages from the drift audit (Orders, Campaigns, CampaignDetail, PMI, DiscoveryInspect, CompliancePrompt, BusinessProvider, service_offerings pattern, shared utilities, Ignition OnboardingWizard update).
- **Why it's necessary:** The inventory is the first thing a future Claude Code session reads to answer "was X ever built?" Three entries say "not built" for things that are built. Future sessions will rebuild them from scratch.
- **Where it lives:** `docs/built-inventory.md`.
- **Effort estimate:** 3 hours
- **Dependencies:** None.
- **Risk if skipped:** Future sessions rebuild existing features. Wasted build hours on things that exist.

---

**D-2 — Add session-end discipline to CLAUDE.md Part 9**

- **What it is:** Add two mandatory steps to CLAUDE.md Part 9 (End-of-Session Protocol): (1) Run `git diff --name-only $SESSION_START_COMMIT HEAD` against user-visible packages and verify each new file appears in built-inventory.md, and (2) Check the "Not Yet Built" table and close any entries that shipped this session.
- **Why it's necessary:** The drift audit identified that Part 9 has 7 steps and none mention the inventory. This is the structural gap that produced the 2026-05-30 drift. The fix is mechanical and cheap.
- **Where it lives:** `CLAUDE.md` Part 9 (End-of-Session Protocol).
- **Effort estimate:** 1 hour
- **Dependencies:** D-1 (inventory updated first, so Part 9 doesn't reference a stale document).
- **Risk if skipped:** Drift continues. Next drift audit finds the same problems again.

---

## 4. Priority Ordering

---

### TIER 1 — Must ship before August (blocking)

Self-serve cannot function without these. The journey has a hard stop somewhere in this list without each of them.

| Priority | Item | Why it's blocking |
|---|---|---|
| 1 | **P-1** Plant inventory management UI | Without this, a new customer cannot add plants. The entire product is inaccessible. |
| 2 | **T-1** Trial clock columns on businesses table | Every trial and payment item is blocked until this migration runs. |
| 3 | **T-2** Initialize trial clock in OnboardingWizard.finalize() | T-1 must exist first; then trial_starts_at must be set on signup. |
| 4 | **O-1** Landing page / signup clarity | Cold arrivals bounce without this. No acquisition possible. |
| 5 | **O-3** Signup → OnboardingWizard redirect | New users hit an error screen before the wizard without this. |
| 6 | **O-2** Signup captures owner name | Required for welcome email and personalization. |
| 7 | **P-2** PlantProfile.tsx hardcoded LAWNS footer fix | Every non-LAWNS customer's checkout shows LAWNS contact info. Product-breaking. |
| 8 | **B-2** Confirmation.tsx env-aware QB link | Active Surface Honesty violation visible to every paying customer. |
| 9 | **B-4** useNursery.ts deprecation | Risk of stale data for self-serve customers with no nurseries row. |
| 10 | **O-4** Welcome email on wizard completion | First communication from TRACE to the customer. Needed at wizard completion. |
| 11 | **T-3** Trial countdown visible in Dashboard | Customers need to see the countdown before emails make sense. |
| 12 | **S-1** Stripe account setup and Vercel env vars | All Stripe items blocked until this exists. Admin task — do early. |
| 13 | **S-2** Stripe checkout session | The payment flow itself. |
| 14 | **S-3** Stripe webhook handler | Without this, payment completes but the account stays locked. |
| 15 | **T-4** Trial expiration enforcement | Without enforcement, the trial is infinite. No conversion. |
| 16 | **O-5** Empty state in dashboard | New customers bounce on day 1 without guidance. |
| 17 | **O-6** Sensible defaults seeded at wizard | Netting prompt and add-ons don't appear for new accounts without defaults. |
| 18 | **B-1** DemoQBInvoice.tsx Layna comment | Low direct risk; close the open verification sweep item. |
| 19 | **B-3** PLATFORM_STRATEGY.md PART 11 numbering | Cosmetic; close the open verification sweep item. |

**Tier 1 total effort: 64 hours**

---

### TIER 2 — Should ship before August (quality)

These significantly improve the customer experience and reduce churn, but the product technically functions without them.

| Priority | Item | Why it matters |
|---|---|---|
| 1 | **T-5** Trial reminder email, day 23 | Highest-leverage conversion touchpoint. Reuses infrastructure from T-6. |
| 2 | **T-6** Trial reminder email, day 29 | Safety net for day-23 email misses. |
| 3 | **S-4** Failed payment handling | Prevents recoverable payment failures from becoming permanent churn. |
| 4 | **S-5** Cancel subscription flow | Customers who want to cancel must be able to self-serve. Otherwise chargebacks. |
| 5 | **S-6** Receipt emails | Stripe config only. No code. Do immediately after S-1. |
| 6 | **C-1** Settings fields all save correctly | Silent save failures produce wrong order math. |
| 7 | **C-2** Settings validation | Prevents tax rate misconfiguration. |
| 8 | **C-3** Settings inline help text | Reduces configuration errors and support volume. |
| 9 | **CS-1** Customer-facing FAQ | Replaces David's availability during the trip. |
| 10 | **CS-2** In-app help link | Makes FAQ discoverable at the moment of confusion. |
| 11 | **CS-3** Support email auto-reply | Sets expectations during the trip. Admin task. |
| 12 | **F-1** Database error graceful degradation | Transient errors show actionable messages instead of blank screens. |
| 13 | **F-2** External API retry wrapper | Transient QB/Blotato failures auto-recover. |
| 14 | **D-1** Update built-inventory.md | Future sessions don't rebuild existing features. |
| 15 | **D-2** CLAUDE.md Part 9 session-end discipline | Prevents the next drift audit finding the same problems. |

**Tier 2 total effort: 41 hours**

---

### TIER 3 — Should ship before August (resilience)

These protect against failures and give David visibility during the trip. The product operates without them, but David is flying blind.

| Priority | Item | Why it matters |
|---|---|---|
| 1 | **CS-4** Escalation runbook for Andrew | Andrew cannot support without this. |
| 2 | **M-1** Uptime monitoring | Outages alert David before customers notice. Admin task. |
| 3 | **M-4** Database backup verification | Confirm recovery path exists. Admin task. |
| 4 | **M-2** Sentry error tracking | Silent bugs become visible. Most valuable monitoring item. |
| 5 | **M-3** Daily metrics email to David | Passive awareness from Europe. 7am UTC, plain text. |

**Tier 3 total effort: 25 hours**

---

### TIER 4 — Deferred to post-August (explicit)

See Section 6.

---

## 5. Effort Total

| Tier | Hours |
|---|---|
| **Tier 1 (blocking)** | **64** |
| **Tier 1 + Tier 2 (blocking + quality)** | **105** |
| **Tier 1 + Tier 2 + Tier 3 (blocking + quality + resilience)** | **130** |

**Available build capacity:**
- 60 days × 4 hours/day = 240 hours total
- Minus non-build time (customer conversations, family time, rest, Lauren follow-up, MicroGrant Sniper session, Andrew coordination): ~60 hours
- **Net available: 180 hours**

**Assessment:**
- Tier 1 alone (64h) is achievable in roughly 16 focused 4-hour sessions — well within 60 days.
- Tier 1+2+3 combined (130h) leaves a 50-hour buffer against the 180-hour net capacity. That buffer accounts for iteration, debugging, Stripe test mode complexity, unexpected edge cases, and any items that take longer than estimated.
- The two highest-risk items by effort are **Stripe integration (S-1 through S-5, approximately 22 hours combined)** and **Plant inventory management (P-1, 14 hours)**. Both should be started early to leave iteration time.

**Tier 1+2+3 fits within 180 hours with a meaningful buffer. No items need to move from Tiers 1–3 based on capacity alone.** The risk is execution discipline, not hours — David needs roughly 3 four-hour sessions per week across 10 weeks to deliver everything in Tiers 1–3.

---

## 6. What Gets Deferred and Why

The following are explicitly out of scope before August. Each is a real initiative; none is being cancelled. All are deferred to post-return.

**Multi-vertical discovery engine (builtwithcai.com unified surface)**
Reason: Requires the discovery engine to handle multiple vertical contexts, a pain-point library with real library entries, the two-pass inspection architecture, and a login transition from discovery to vertical. Combined build estimate: 40–60 hours. This is important to the long-term vision but does nothing for Cultivar OS self-serve conversion, which is the August goal.

**Hollow shell with visual mockup generation**
Reason: The hollow shell — generating a mock-up of how TRACE would address an unmatched pain point — requires the discovery engine to be production-ready first, plus Claude-generated UI mockup content. This is a 2–3 session build after the discovery engine is stable. Deferred to post-August.

**Full pain-point library beyond Cultivar's current four paths**
Reason: The four existing paths (LEAKAGE, CHECKOUT, SETUP, DELIVERY) cover the Cultivar demo. Expanding the library to other verticals or other Cultivar pains is post-August discovery-engine work.

**Tailwind deprecation in Ignition OS (Tech Debt #14)**
Reason: Ignition OS is off-limits this session per CLAUDE.md Part 7. The Tailwind → inline conversion requires touching all 27 Ignition module files (~2100 lines). Trigger: when an Ignition module moves to shared. That trigger is not expected pre-August.

**KINNA-OS Phase 1**
Reason: The August 1 hard deadline for the Back to School event is real and pre-dates the Europe trip. KINNA-OS Phase 1 is a separate parallel workstream (managed by Regina as anchor customer). Its critical path (Oasis API access, QR check-in, TEFAP eligibility engine) is independent of the Cultivar self-serve work. Do not conflate the two deadlines.

**Conduit OS, CoolRunnings (new vertical builds)**
Reason: Both require the shared platform foundation to be stable (verticalConfig.ts master switch, configureAuth() unified, shared onboarding shell). These are not complete per the audit (current extracted reuse ~19%). Post-August, after the shared foundation is proven through Cultivar self-serve.

**Customer directory UI (Lauren/future customers)**
Reason: The customers table exists and dedup works. A browse/search UI is post-demo. This is quality-of-life for Lauren, not blocking for self-serve trials.

**Follow-up engine, online shop, contractor portal**
Reason: These are dashboard tiles in the "available" state. They do not block self-serve trial mechanics or payment. Post-August.

**Business insights tile, seasonal perishable module**
Reason: Phase 1 features. Not needed for a 30-day trial to demonstrate core value or for a prospect to convert to paying.

**builtwithcai.com polished marketing surface**
Reason: builtwithcai.com is the long-term discovery surface and product marketing site. The pre-August priority is the in-app self-serve flow. Once that works, marketing traffic has somewhere good to land. Build the destination before the highway.

---

## 7. Honest Assessment

Tier 1 is achievable in 60 days. The 64-hour estimate for the blocking items is realistic; Stripe integration and plant management (the two largest items at 22h and 14h respectively) are not speculative — both are well-scoped with existing infrastructure to build on. The 50-hour buffer between Tier 1+2+3 and the 180-hour capacity net is genuine cushion, not padding — it will be consumed by iteration on Stripe test mode, edge cases in plant management (what happens when a SKU collides, what happens to plant events for non-LAWNS plants), and the reality that 4-hour focused sessions are not guaranteed every day across 60 days for a person who is also managing customer conversations, family operations, and the active question of what Andrew does for the next 90 days. The one honest risk: if Stripe integration runs significantly over (to 30+ hours, which it can if webhook testing surfaces edge cases), it starts to crowd Tier 2, and the trial email reminders and cancel flow may slip to post-August. That is an acceptable outcome — the product still works, customers can still pay, and David can handle one-off support by email during the trip at reduced volume. The items that absolutely must not slip are P-1 (plant management — without it the product is inaccessible to self-serve customers), T-1 and T-2 (trial clock — without these, Stripe has no state to read), and S-2 and S-3 (checkout and webhooks — without these, there is no revenue). Everything else is leverage on conversion rate and customer experience. Start with those five, get them working end-to-end in a test account before building anything else, and the rest of the plan falls into place.

---

*TRACE Enterprises · Built with CAI*
*Self-serve readiness plan for Cultivar OS — August 2026 Europe trip*
*Written by Claude Code · 2026-05-31*
*Review: David O'Brien · Audience: David + future Claude Code sessions*
