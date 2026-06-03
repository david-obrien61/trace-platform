# Onboarding Flow Findings — Real User Testing
**Date:** 2026-06-03  
**Type:** Discovery document — real user testing findings  
**Tester:** David O'Brien  
**Verticals tested:** Ignition OS (ignition-os.vercel.app), Cultivar OS (cultivar-os.vercel.app)  
**Status:** Findings documented; fixes required

---

## Section 1: Test methodology

David navigated to both Ignition OS and Cultivar OS as a fresh user to evaluate the join experience. Goal: identify gaps between the two verticals' onboarding and find bugs before customer-facing launch.

This was real user testing — not a scripted QA pass, but a genuine attempt to sign up as a new customer would. Findings reflect what an actual new customer would encounter today.

---

## Section 2: Ignition OS findings

### Test flow attempted

1. Visit ignition-os.vercel.app
2. Click "Get Started" on landing screen
3. Step 1 of 3: Enter shop info (Dave's Auto Shop, David O'Brien, 703-689-1808, 770 County Road 284)
4. Step 2 of 3: Enter owner account (trace_ent@outlook.com, password)
5. Step 3 of 3: Set PIN (4 digits, confirm 4 digits)
6. Click "Launch Ignition OS"

### Result

**ERROR — "Could not create owner account: Could not find the table 'public.shop_members' in the schema cache"**

On retry: "User already registered"

### Diagnosis

- Auth user was created in Supabase (hence "already registered" on retry) — the signup transaction got partway through
- `shop_members` table either doesn't exist in the Ignition Supabase project (ufsgqckbxdtwviqjjtos), or the API is pointing at the wrong project, or the table name doesn't match what the code expects
- The shop creation transaction failed mid-way, leaving the auth user in an orphaned state — account exists but no shop record attached

### Likely cause

The multi-tenant extraction work on June 2 dropped old Ignition team tables (`shop_members`, `shop_invites`, `teams`, `member_devices`, `pin_resets`) from ufsgqckbxdtwviqjjtos via migration `20260602_ignition_drop_team_tables.sql`. The Ignition OS onboarding code (`OnboardingWizard.jsx`) still references `shop_members` for the owner registration step. The table no longer exists.

### Verification needed

1. Does Ignition Supabase project still have a `shop_members` table? (Run: `SELECT * FROM shop_members LIMIT 1` in ufsgqckbxdtwviqjjtos SQL editor)
2. What does `packages/ignition-os/modules/OnboardingWizard.jsx` reference in its finalize step?
3. Should Ignition now write to `business_members` (shared table in bgobkjcopcxusjsetfob) instead of `shop_members`?

### Impact

**Critical.** No new Ignition customer can sign up. The vertical is non-functional for new customer acquisition.

---

## Section 3: Cultivar OS findings — existing owner login

### Test flow attempted

1. Visit cultivar-os.vercel.app
2. Sign in with david_obrien2016@outlook.com (existing OWNER of LAWNS)

### Result

Signed in successfully, taken directly to LAWNS dashboard. ✅

### Findings

- David was pre-seeded as OWNER of LAWNS via SQL insert (June 2 session)
- The new-owner onboarding flow was NOT triggered because David already exists as a user with a linked business
- New-owner flow is **untested end-to-end for Cultivar**

**Settings page observations (visible as owner):**
- Business Profile: LAWNS Tree Farm LLC, 512-450-3336, 400 Honeycomb Mesa, Leander TX 78641, lawnstrees.com, tax rate 0.0825 ✅
- Accounting: QuickBooks connected ✅
- Services: transport options with install pricing ✅
- Add-ons: netting, compost, bio-stimulant, root guarantee ✅
- Nursery Settings: Default Install Price $225.00/plant ✅

**Missing from Settings:**
- Team Management / Member invitation section — built June 2 as `TeamSection` in `packages/cultivar-os/src/pages/Settings.tsx`
- No visible way to invite Erin or other team members through the UI
- The feature either isn't deployed, isn't rendering, or is blocked by a permission check

### Impact

**High.** The multi-tenant team management feature shipped June 2 is not visible to the owner. Erin can't be invited through the UI. Fallback: share a direct `/join` URL with invite token, or use SQL insert.

---

## Section 3.5: Cultivar OS new-owner signup test (second pass)

### Test flow attempted

1. Visit cultivar-os.vercel.app
2. Click "New nursery? Create account"
3. Enter business name: TRACE Tree Sales
4. Enter email: trace_ent@outlook.com
5. Enter password
6. Click "Create account"

### Result

**ERROR — "User already registered"**

### Why

trace_ent@outlook.com was used in Section 2's Ignition signup attempt. Even though that signup failed at the `shop_members` step, the Supabase auth user was successfully created. That orphaned auth user now blocks any new signup attempt with the same email across the entire TRACE platform (correct behavior — one auth identity per email). But the error message gives no recovery path.

### Additional finding: Cultivar signup form is missing critical data

Cultivar's current signup form asks for:
- Business name
- Email
- Password

Cultivar's signup form does NOT ask for:
- Owner's name
- Phone number
- Business address
- Tax rate
- Website URL (needed to trigger discovery scrape)
- Any vertical-specific configuration

This conflicts with David's minimum first-day data collection principle (captured Wednesday morning): "What's the minimum we can get the first day first screen if they have a website — if they don't, the second screen — we definitely want to do the first scrape and then the second scrape underneath it."

A new owner completing the current signup will land in a dashboard with an empty Business Profile. They'll have to immediately navigate to Settings to add data the platform needs to function.

**Compare to Ignition:** Ignition's Step 1 collects shop name, owner name, phone, and address before creating the account. Cultivar's equivalent collects only business name. That's the inconsistency.

### Impact

**High.** Two compounding problems:

1. Email collisions between verticals (and from failed partial signups) leave users stuck with no clear recovery path
2. Cultivar signup doesn't collect the data needed to actually onboard a real nursery — owner lands in an empty state

### Recommended fixes (priority order)

**1. Add owner data collection to Cultivar signup.**  
Match the depth of Ignition's Step 1: business name, owner name, phone, address. Optionally website URL to trigger the discovery scrape on a subsequent step.

**2. Better error handling for email collisions.**  
"User already registered" is ambiguous. Should distinguish:
- "This email exists in our system. Sign in instead." (with link to sign-in)
- "This email started a signup that didn't complete. Recover your account?" (with recovery link)
- Currently both cases surface the same generic error

**3. Onboarding completion check.**  
After signup, check whether the business profile is complete. If not, route through profile completion before showing the dashboard. Don't dump new owners into an empty state.

**4. Same shape as Ignition.**  
The platform should have one onboarding flow shape across all verticals. Different gesture layers (PIN vs. passkey vs. email/password) but the same data collection structure. Currently Ignition is 3 steps; Cultivar is 1 step. That gap is the core inconsistency.

---

## Section 3.6: Cleanup needed in Supabase auth

The orphaned `trace_ent@outlook.com` auth user from the failed Ignition signup needs cleanup:

- **Option A (quick):** Delete the auth user manually in Supabase ufsgqckbxdtwviqjjtos SQL editor so the email can be reused for testing
- **Option B (correct):** Build a recovery flow so users in this state can complete signup without support intervention

For immediate testing, David should use a different email for further signup tests until this is resolved.

---

## Section 4: Navigation inconsistency between verticals

Ignition OS landing page header shows: `HOME | ABOUT | CONTRACTORS | HOMEOWNERS | PROJECTS`

Cultivar OS does not have equivalent navigation chrome.

This violates the 80/20 platform architecture principle. The shared chrome (navigation, header, common controls) should be consistent across verticals. Only vertical-specific content (pages, tiles, modules) should differ.

### Impact

**Medium.** Customer experience is inconsistent across verticals. A customer who encounters both verticals would feel like they're using two different products rather than one platform in two configurations.

---

## Section 5: Gesture layer inconsistency (expected vs. unexpected)

Ignition requires PIN setup as Step 3 of onboarding. Cultivar uses email/password without PIN.

This IS intentional per the "Auth Layer vs. Gesture Layer" design principle locked June 2. Each vertical chooses its gesture layer based on use case. Ignition's PIN is documented as Honest Debt — the legacy pattern, not the platform standard.

However, the **onboarding flow shape** should be consistent even where the **gesture-layer content** differs. Ignition has 3 steps; Cultivar has 1 step (effectively). That's a shape mismatch, not just a content difference.

**Recommendation:** Cultivar onboarding should include a parallel "set up your login method" step — defaulting to passkey or staying at email/password — so the flow shape matches Ignition even though the content differs.

---

## Section 6: What this testing proved

1. Found a **critical Ignition bug** blocking all new customer signups
2. Revealed that **Cultivar new-owner onboarding is untested end-to-end**
3. Documented **navigation inconsistencies** that violate platform architecture
4. Confirmed **TeamSection isn't visible in production** despite being built
5. Identified **Cultivar signup data gap** — not collecting what a new nursery needs to operate
6. Validated the re-demo and behavioral telemetry principle — real-user testing found what scripted demos would miss

---

## Section 7: Required follow-up actions

### Immediate (before Erin's onboarding call)

- Note the issues; don't try to fix during the call
- Document for Erin: she may see unexpected things — that's the test data we want
- Use a clean email for Erin's invite that hasn't been used in any prior signup attempt

### This week

1. Fix Ignition `shop_members` schema issue — update `OnboardingWizard.jsx` to reference `business_members` (shared table) or recreate `shop_members` if that's the right architecture decision
2. Verify `TeamSection` is deployed and visible in Cultivar Settings — check if it's blocked by a permission check or simply not rendering
3. Test Cultivar onboarding with a completely fresh email to see actual new-owner flow
4. Audit navigation chrome consistency between verticals
5. Resolve orphaned `trace_ent@outlook.com` auth user in Supabase

### Next 30 days

1. Establish onboarding testing protocol — every release should include a "fresh new user creates account from scratch" test on both verticals
2. Document the expected onboarding flow shape so all verticals implement it consistently
3. Add owner data collection (name, phone, address) to Cultivar signup
4. Improve error messages for email collision and incomplete signup states
5. Capture the navigation chrome pattern as a shared component requirement

---

## Section 8: Connection to TRACE principles

| Finding | Principle |
|---|---|
| Re-demo isn't possible if the onboarding flow is broken | **Re-demo capability** — only works if the product actually matches the demo flow |
| Errors found via clicking, not logs | **Behavioral telemetry** — if active, telemetry would have pinpointed the exact Supabase query failure and table reference |
| Platform has real gaps; iteration continues | **"Just a movie" principle** — the errors are data, not defeat |
| "It just works" isn't yet true for new signups | **Apple model** — not ready for customer acquisition at scale until new-owner flow is clean |
| Navigation divergence, onboarding shape divergence, signup data divergence | **80/20 platform architecture** — the 80% shared layer isn't fully shared yet; these are the visible gaps |

---

*Source: Real user testing by David O'Brien, 2026-06-03.*  
*Both verticals tested: ignition-os.vercel.app and cultivar-os.vercel.app.*  
*Errors documented as-found. No fixes attempted during testing.*
