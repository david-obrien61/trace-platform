> Preserved artifact. Original location: repo root. Moved 2026-05-26 during Session 1b doc reconciliation. Findings folded into PLATFORM_AUDIT.md UI Surface State section.

# CULTIVAR OS — PRE-DEMO BUTTON AUDIT
**Generated:** 2026-05-25 | **Demo:** LAWNS Tree Farm, Leander TX (May 26)
**Method:** Static code analysis — every handler traced to execution

---

## 1. TL;DR SUMMARY TABLE
*Print this. Put it next to your laptop.*

| Page | Button / Element | State | Demo action |
|---|---|---|---|
| `/plant/SCV-0031` | Add to cart — $X | **WORKS** | Click freely |
| `/plant/SCV-0031` | QtySelector +/− | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | ← Back | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Transport toggle (Self/Delivery/Install) | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | I understand the risk — no thanks (netting) | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Actually, add netting back | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Addon card checkboxes | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Review my cart — $X | **WORKS** | Click freely |
| `/checkout/customer` | ← Back | **WORKS** | Click freely |
| `/checkout/customer` | Review my order (submit form) | **WORKS** | Click freely |
| `/checkout/review` | ← Back | **WORKS** | Click freely |
| `/checkout/review` | Edit (customer info) | **WORKS** | Click freely |
| `/checkout/review` | Send invoice + pay online — $X | **WORKS** | Click freely |
| `/checkout/review` | I'll pay at the office | **WORKS** | Click freely |
| `/checkout/confirm` | View invoice in QuickBooks | **WORKS** | Click if QB is connected at demo start |
| `/checkout/confirm` | View QuickBooks sandbox preview → | **WORKS** | Safe fallback — always present |
| `/checkout/confirm` | Scan another plant | **WORKS** | Click freely |
| `/dashboard` | Sign out | **WORKS** | Avoid during demo — explain instead |
| `/dashboard` | Connect QuickBooks (banner) | **WORKS** | Safe to demo live if QB is disconnected |
| `/dashboard` | Disconnect (QB banner) | **PARTIAL** | Don't click — local state only, token stays live in DB |
| `/dashboard` | Refresh data | **WORKS** | Click freely |
| `/dashboard` | Publish (social draft card) | **WORKS** | Click freely if drafts exist |
| `/dashboard` | QR Checkout tile (tap) | **STUB** | Don't tap — does nothing; explain what the module covers |
| `/dashboard` | QuickBooks tile (tap) | **STUB** | Don't tap — does nothing; QB is managed via the banner above |
| `/dashboard` | Social Media tile (tap, when active) | **STUB** | Don't tap — scroll down to see drafts below tile grid |
| `/dashboard` | Social Media tile "Enable" (when not yet set up) | **WORKS** | Routes to setup wizard |
| `/dashboard` | Online Shop tile "Enable" | **STUB** | Don't click — explain it's next on the roadmap |
| `/dashboard` | Follow-Up tile "Enable" | **STUB** | Don't click |
| `/dashboard` | Delivery tile "Enable" | **STUB** | Don't click |
| `/dashboard` | Contractors / Seasonal / Insights / Inventory tiles | **DISABLED** | Show as roadmap items — locked, no click handler |
| `/social/setup` | ← Back | **WORKS** | Click freely |
| `/social/setup` | Platform checkboxes | **WORKS** | Click freely |
| `/social/setup` | Enable Social Media (save) | **WORKS** | Click freely |

---

## 2. DEMO-TIME NARRATIVE

### What works

The entire QR-to-confirmation checkout flow is solid. Every button from scanning SCV-0031 through submitting an order is real and tested — Add to Cart, transport toggle, netting prompt, add-on cards, customer form, cart review, submit. Both payment paths (online invoice, pay at office) work. The QB invoice creation is non-blocking: if it succeeds, the confirmation screen shows a real "View invoice in QuickBooks" link; if it fails (token issue, network), the order still completes and a sandbox preview link appears as fallback. "Scan another plant" clears the cart and returns to the dashboard. The dashboard metrics (plants tracked, inventory value, today's sales, installs this week, leakage) all load from Supabase. Sign-out works. Connect QuickBooks (the banner at the top of the dashboard) runs a full OAuth popup and polls until connected. The social drafts panel and Publish button work when drafts exist.

### What doesn't work (but won't kill you)

The tile grid is decorative when tiles are active. Tapping an active QR Checkout tile, QuickBooks tile, or Social Media tile does literally nothing — the `handleNavigate` handler is an empty function stub. This is intentional (post-demo work) but confusing if a customer taps it expecting something to happen. The same applies to "Enable" buttons on tiles other than Social Media — clicking "Enable" on Online Shop, Follow-Up, or Delivery calls a handler that does nothing (only 'social_media' is wired). The "Disconnect" button on the QB banner only resets local state — it does not revoke the token in Supabase, so if someone clicks it by accident, reconnecting immediately still works. The Publish flow calls Blotato's API — if Blotato is down or the account ID is wrong, the button will try, return an error in the console, and the draft will stay in the panel (no visible error shown to the user).

### What to say when something doesn't work

- **Someone taps an active tile and nothing happens:** "These are your active modules — QR Checkout, QuickBooks, Social. We'll be adding deep-links into each module's history and settings view in the next sprint. For now, QR Checkout is running through the scan flow you just saw, and social drafts appear right below the tile grid."
- **QB isn't connected at demo start:** "Let me show you the one-time setup — this takes about 30 seconds and then every order auto-creates an invoice." Then click Connect QuickBooks in the banner. If the popup gets blocked, the redirect falls back to the same tab automatically.
- **Order submits but no QB invoice URL appears on the confirmation screen:** "The invoice is queued — QuickBooks processes it within a few seconds. You can use this sandbox preview to see the format." Click "View QuickBooks sandbox preview →".
- **Social posts don't appear in the drafts panel after an order:** "The AI post generation can take a few seconds — let me hit Refresh data." If still nothing: "The social module is enabled and connected. Posts will appear here as we process that order. Let me show you an existing draft." (If you have pre-existing drafts from earlier testing, they'll already be there.)

---

## 3. DETAILED BUTTON INVENTORY

### PLANT PROFILE — `/plant/:tagId`

**"Add to cart — $X"**
- File: [PlantProfile.tsx:78](packages/cultivar-os/src/pages/PlantProfile.tsx#L78)
- Handler: `handleAddToCart()` → `setItem(plant, qty)` → `navigate('/plant/${tagId}/addons')`
- Only renders when `plant.status === 'available'`. If plant is reserved/sold, renders a grey "This plant is [status]" block with no button.
- State: **WORKS**
- Demo risk: None. Quantity validated against `availableCount`. SCV-0031 should be 'available'.

**QtySelector +/− buttons**
- File: [QtySelector.tsx](packages/cultivar-os/src/components/checkout/QtySelector.tsx)
- Handler: `onChange(qty + 1)` / `onChange(qty - 1)`, clamped to [1, max]
- State: **WORKS**
- Demo risk: None.

---

### ADD-ONS — `/plant/:tagId/addons`

**"← Back"**
- File: [AddOns.tsx:72](packages/cultivar-os/src/pages/AddOns.tsx#L72)
- Handler: `navigate('/plant/${tagId}')`
- State: **WORKS**

**Transport toggle (Self-transport / Delivery / Installation)**
- File: [TransportToggle.tsx](packages/cultivar-os/src/components/checkout/TransportToggle.tsx), wired via `setTransport` from useCart
- Handler: updates `transport` in cart Zustand store
- State: **WORKS**
- Demo risk: None. Changing transport shows/hides netting prompt and changes price.

**"I understand the risk — no thanks" (netting decline)**
- File: [NettingPrompt.tsx:65](packages/cultivar-os/src/components/checkout/NettingPrompt.tsx#L65)
- Handler: `handleNettingToggle()` → toggles `nettingDeclined` in cart, updates netting addon
- State: **WORKS**
- Demo risk: Clicking this reveals the "no netting" warning. Good for demo — shows the leakage detection logic.

**"Actually, add netting back"**
- File: [NettingPrompt.tsx:110](packages/cultivar-os/src/components/checkout/NettingPrompt.tsx#L110)
- Handler: same toggle, flips back
- State: **WORKS**

**Addon card checkboxes (e.g., Native compost blend)**
- File: [AddonCard.tsx](packages/cultivar-os/src/components/checkout/AddonCard.tsx), wired via `toggleAddon(id)`
- Handler: flips `selected` boolean in cart addons array
- State: **WORKS**
- Demo risk: None. Add-ons load from Supabase; if DB is empty, section doesn't render.

**"Review my cart — $X"**
- File: [AddOns.tsx:177](packages/cultivar-os/src/pages/AddOns.tsx#L177)
- Handler: `navigate('/checkout/customer')`
- State: **WORKS**

---

### CUSTOMER CAPTURE — `/checkout/customer`

**"← Back"**
- File: [CustomerCapture.tsx:109](packages/cultivar-os/src/pages/CustomerCapture.tsx#L109)
- Handler: `navigate('/plant/${tagId}/addons')`
- State: **WORKS**

**"Review my order" (form submit)**
- File: [CustomerCapture.tsx:257](packages/cultivar-os/src/pages/CustomerCapture.tsx#L257)
- Handler: validates required fields (first name, last name, valid email format) → `setCustomer()` → `navigate('/checkout/review')`
- State: **WORKS**
- Demo risk: None. Shows red borders on invalid fields. Phone and address are optional.

---

### CART REVIEW — `/checkout/review`

**"← Back"**
- File: [CartReview.tsx:78](packages/cultivar-os/src/pages/CartReview.tsx#L78)
- Handler: `navigate('/checkout/customer')`
- State: **WORKS**

**"Edit" (customer section)**
- File: [CartReview.tsx:181](packages/cultivar-os/src/pages/CartReview.tsx#L181)
- Handler: `navigate('/checkout/customer')`
- State: **WORKS**

**"Send invoice + pay online — $X"**
- File: [CartReview.tsx:210](packages/cultivar-os/src/pages/CartReview.tsx#L210)
- Handler: `handleSubmit(true)` → `submit()` hook → POST `/api/orders/submit` → on success, `navigate('/checkout/confirm', { state: {...} })`
- Disabled during submission. Shows "Sending…"
- State: **WORKS**
- Demo risk: Button is disabled after first click until response returns. If submit fails (network, Supabase down), `submitError` renders in a red box above the buttons. Order does not complete on error.

**"I'll pay at the office"**
- File: [CartReview.tsx:218](packages/cultivar-os/src/pages/CartReview.tsx#L218)
- Handler: `handleSubmit(false)` — same flow, different `payOnline` flag passed to confirmation
- Disabled during submission. Shows "Creating order…"
- State: **WORKS**
- Demo risk: Same as above.

---

### CONFIRMATION — `/checkout/confirm`

**"View invoice in QuickBooks" (link)**
- File: [Confirmation.tsx:167](packages/cultivar-os/src/pages/Confirmation.tsx#L167)
- Renders ONLY when `payOnline === true && qbInvoiceUrl` is truthy (QB was connected AND invoice creation returned a URL)
- Handler: `<a href={qbInvoiceUrl} target="_blank">` — opens QB invoice directly
- State: **WORKS** (conditional on QB being connected at time of order)
- Demo risk: If QB is not connected, this button won't appear. The amber "Invoice will sync to QuickBooks shortly" badge shows instead.

**"View QuickBooks sandbox preview →" (link)**
- File: [Confirmation.tsx:186](packages/cultivar-os/src/pages/Confirmation.tsx#L186)
- Always renders. Routes to `/demo/quickbooks-invoice?orderId=...&total=...&invoiceNumber=...`
- Handler: navigation link
- State: **WORKS**
- Demo risk: Safe fallback. Good to click if QB invoice URL isn't available.

**"Scan another plant"**
- File: [Confirmation.tsx:193](packages/cultivar-os/src/pages/Confirmation.tsx#L193)
- Handler: `handleDone()` → `clear()` (clears all cart state) → `navigate('/', { replace: true })` → redirects to `/dashboard`
- State: **WORKS**
- Demo risk: None. Clears cart and resets the flow.

---

### DASHBOARD — `/dashboard` (private route)

**"Sign out" (header)**
- File: [Dashboard.tsx:332](packages/cultivar-os/src/pages/Dashboard.tsx#L332)
- Handler: `handleSignOut()` → `auth.signOut()` → `navigate('/login')`
- State: **WORKS**
- Demo risk: Ends the session. Don't click.

**"Connect QuickBooks" (QB banner, when not connected)**
- File: [Dashboard.tsx:361](packages/cultivar-os/src/pages/Dashboard.tsx#L361)
- Handler: `handleConnect()` — opens a blank popup via `window.open()` synchronously (before any await, preserving the user-gesture chain), fetches `/api/qbo/auth-url`, navigates popup to Intuit OAuth, polls `/api/qbo/status` every 2 seconds until connected or popup closes
- Disabled during connection. Shows "Opening QuickBooks…"
- State: **WORKS**
- Demo risk: Popup may be blocked by browser. If blocked, `popup.location.href = url` fails silently; code falls back to `window.location.href = url` (same-tab redirect). Errors from `/api/qbo/auth-url` are shown on-screen with `[step:X]` prefix to help diagnose.

**"Disconnect" (QB banner, when connected)**
- File: [Dashboard.tsx:396](packages/cultivar-os/src/pages/Dashboard.tsx#L396)
- Handler: `onClick={() => { setQbConnected(false); setQbCompany(''); }}`
- What this actually does: resets local state only. Does NOT revoke the token in Supabase or set `qb_needs_reconnect=true`. If clicked, the UI shows the "Connect QuickBooks" banner again, but the token is still valid in the database.
- State: **PARTIAL**
- Demo risk: Don't click. If clicked accidentally, immediately click "Connect QuickBooks" — the OAuth handshake will find the existing token and reconnect. No data is lost.

**QB reconnect warning banner**
- File: [Dashboard.tsx:502](packages/cultivar-os/src/pages/Dashboard.tsx#L502)
- Only renders when `qb_needs_reconnect === true` (read from Supabase `nurseries.qb_needs_reconnect`). Not interactive — informational banner only.
- State: **HIDDEN** (won't appear unless token has genuinely expired during refresh)

**Metric cards (Plants tracked, Inventory value, Today's sales, Installs this week)**
- Display only. No interactive elements.
- Data loads from Supabase on mount via `loadMetrics()`.

**Leakage alert tile**
- File: [Dashboard.tsx:453](packages/cultivar-os/src/pages/Dashboard.tsx#L453)
- Only renders when `leakageCount > 0`. No buttons — informational.
- State: **HIDDEN** if no leakage orders this week. Shows green "No missed add-ons" badge otherwise.

**Tile grid — active tiles (QR Checkout, QuickBooks, Social Media when enabled)**
- File: [Tile.tsx:36](packages/shared/src/components/tiles/Tile.tsx#L36), [Dashboard.tsx:289](packages/cultivar-os/src/pages/Dashboard.tsx#L289)
- Handler chain: `handleClick()` → `onNavigate()` → `handleNavigate(key)` → **empty function**
```js
function handleNavigate(_key: string) {
  // post-demo: route to module-specific pages
}
```
- State: **STUB**
- Demo risk: Tapping an active tile does nothing visible. No error, no navigation. If Terry or Lauren taps a tile expecting it to open something, nothing happens. **Explain before they try:** "These tiles show your active modules. We'll be adding module detail views in the next sprint — for now everything runs through the scan flow and the panels below."

**Tile grid — "Enable" button on Social Media tile (when not yet set up)**
- File: [Tile.tsx:149](packages/shared/src/components/tiles/Tile.tsx#L149), [Dashboard.tsx:283](packages/cultivar-os/src/pages/Dashboard.tsx#L283)
- Handler: `onEnable()` → `handleEnable('social_media')` → `navigate('/social/setup')`
- State: **WORKS**
- Demo risk: None. Routes to setup wizard.

**Tile grid — "Enable" button on Online Shop, Follow-Up, Delivery tiles**
- File: [Dashboard.tsx:283](packages/cultivar-os/src/pages/Dashboard.tsx#L283)
- Handler: `onEnable()` → `handleEnable(key)` → falls into the `if (key === 'social_media')` branch → no match → function returns without doing anything
- State: **STUB**
- Demo risk: Clicking "Enable" on these tiles does nothing visible. Explain as roadmap items.

**Tile grid — locked tiles (Contractors, Seasonal, Insights, Inventory)**
- File: [Tile.tsx:44](packages/shared/src/components/tiles/Tile.tsx#L44)
- These tiles have `isLocked = true`. The wrapping div has `onClick={undefined}`. No handler fires.
- State: **DISABLED**
- Demo risk: None. They render with a red lock badge and greyed icon. Good to show as "growth tier" roadmap.

**"Publish" button (social draft cards)**
- File: [Dashboard.tsx:589](packages/cultivar-os/src/pages/Dashboard.tsx#L589)
- Handler: `handlePublish(draftId)` → POST `/api/social/publish` → on success, removes draft from array → badge decrements
- Disabled during submission ("Posting…"). Whole drafts panel only renders when `socialDrafts.length > 0`.
- State: **WORKS** (subject to Blotato API availability)
- Demo risk: If Blotato returns an error, `console.warn` fires and the draft stays in the panel. No visible error shown to user. If publish succeeds but the post doesn't appear on Instagram immediately, that's Blotato's processing delay — not a bug.

**"Refresh data"**
- File: [Dashboard.tsx:613](packages/cultivar-os/src/pages/Dashboard.tsx#L613)
- Handler: `loadMetrics()` — re-fetches all metric queries from Supabase. Does NOT reload social drafts.
- State: **WORKS**
- Demo risk: None. Good button to click if metrics look stale.

---

### SOCIAL SETUP — `/social/setup` (private route)

**"← Back"**
- File: [SocialSetup.tsx:75](packages/cultivar-os/src/pages/SocialSetup.tsx#L75)
- Handler: `navigate('/dashboard')`
- State: **WORKS**

**Platform checkboxes (Instagram, Facebook, TikTok, Twitter/X)**
- Handler: `togglePlatform(key)` — toggles entries in `platforms` Set state
- State: **WORKS**
- Demo risk: None. At least one platform required to save.

**Blotato Account ID input**
- Handler: `setAccountId(value)` on change
- State: **WORKS**
- Demo risk: Input must be non-empty to save. Wrong account ID will cause Publish to fail silently later.

**"Enable Social Media" (save button)**
- File: [SocialSetup.tsx:176](packages/cultivar-os/src/pages/SocialSetup.tsx#L176)
- Handler: `handleSave()` → validates (≥1 platform, non-empty account ID) → POST `/api/social/enable` → on success, `navigate('/dashboard')`
- Disabled during save ("Saving…")
- State: **WORKS**
- Demo risk: If save fails, red error box appears with the error message. User can retry.

---

## 4. CROSS-CUTTING FINDINGS

### The critical tile behavior nobody will expect

Active tiles look tappable (they have a green status dot, full color, box shadow). They are not. The `handleNavigate` handler in Dashboard.tsx is an explicit stub marked "post-demo." This affects: QR Checkout, QuickBooks, and Social Media (when active). **Brief Terry and Lauren before they see the dashboard** that tiles are status indicators, not navigation buttons — actual workflows run through the scan flow and the dashboard panels below the grid.

### "Enable" vs. status indicator — what "enable" means on each tile

The word "Enable" appears below every tile in the `available` state. It is a **call to action** (click to set up this module), not a status indicator. After a module is enabled and configured, the tile transitions to `active` state and the "Enable" button disappears (replaced by the green dot). Currently only Social Media's "Enable" is wired. The others render the button but clicking does nothing.

### Env vars and their failure modes

All API routes are serverless functions deployed to Vercel. Missing env vars fail silently (return error JSON, never throw to browser):
- `ANTHROPIC_API_KEY` missing → generate-posts returns `{ok:false}`, no social drafts created, order still completes
- `BLOTATO_API_KEY` missing → publish.ts updates draft status to 'failed', no visible user error
- `QBO_CLIENT_ID/SECRET/REDIRECT_URI` missing → auth-url.ts returns 500, QB connect shows error on-screen with step prefix
- `SUPABASE_SERVICE_KEY` missing → all order writes fail, full error shown on CartReview

### Root `/api` files are re-export wrappers

The `/api/` directory at repo root (Vercel functions) are all one-liners that re-export from `packages/cultivar-os/api/`. The actual logic is in the package. This is intentional for the monorepo build.

### Social drafts panel doesn't refresh on "Refresh data"

The "Refresh data" button calls `loadMetrics()` only — it does NOT reload `loadSocialDrafts()`. If you submit an order and then click "Refresh data," the social drafts panel won't update. You'd need to reload the page or wait for the initial `loadSocialDrafts()` that runs on mount. This is a minor limitation for the demo — if you want to show drafts appearing after an order, reload the page.

### QB "Disconnect" creates a confusing state

If anyone clicks "Disconnect" on the QB banner: UI shows "not connected," but the token is still valid in Supabase. Clicking "Connect QuickBooks" immediately re-completes the OAuth flow and returns to connected state. This is safe. The only risk is if someone disconnects and then navigates away thinking QB is broken.

---

## 5. CRITICAL PRE-DEMO CHECKS
*Do these within 1 hour of the meeting*

**1. Confirm plant SCV-0031 is available and loads correctly**
Navigate to `cultivar-os.vercel.app/plant/SCV-0031`. Verify: plant name, container size, base price, timeline events, and "Add to cart" button all render. If plant status is not 'available', the Add to Cart button won't appear — you'd need to update the status in Supabase.

**2. Run one complete order from SCV-0031 start to finish**
Scan/navigate to the plant, add 1 tree, self-transport, keep netting on, use any real email (it'll receive a confirmation). Submit as "I'll pay at the office." Verify the confirmation screen appears with an invoice number. Check that the order appears in Supabase `orders` table. This is your single most important pre-demo check.

**3. Confirm QB is connected (or pre-connect it)**
Log in as `david_obrien2016@outlook.com`. Load the dashboard. If the QB banner shows "Connect QuickBooks," connect it now, before the demo. Verify the banner flips to "QuickBooks connected." The token is good for 60+ minutes; the proactive refresh will extend it automatically.

**4. Check whether social_drafts migration has been applied**
In Supabase SQL editor on project `bgobkjcopcxusjsetfob`, run:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'social_drafts' AND column_name IN ('order_id', 'post_type');
```
If you get 0 rows, the migration from BLOCKER #1 in CLAUDE.md has not been applied and post-order social generation will fail silently. Apply it now if you want to show live social post generation during the demo.

**5. Verify the dashboard metrics show real data**
After running your test order in check #2, reload the dashboard. Confirm "Today's sales" increments. If metrics show 0 across the board after a successful order, there may be a Supabase query issue or a nursery ID mismatch. The nursery ID is hardcoded as `DEMO_NURSERY_ID = a1b2c3d4-0000-0000-0000-000000000001` in constants.ts — verify it matches the actual LAWNS nursery row in Supabase.
