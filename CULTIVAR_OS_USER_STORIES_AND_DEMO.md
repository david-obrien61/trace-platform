# Cultivar OS — User Stories & Demo Scenes
**LAWNS Tree Farm LLC · May 25, 2026**
**Built with CAI · TRACE Enterprises**

> This document captures every user story discussed and the
> complete demo script with scene-by-scene playbook.
> Read this before the LAWNS meeting. Practice the scenes out loud.

---

## PART 1 — USER STORIES

### How to read these stories

Each story follows this format:
```
AS A [who]
WHEN [situation]
I WANT [action or outcome]
SO THAT [why it matters]
ACCEPTANCE CRITERIA: [what done looks like]
PHASE: [demo / phase 1 / phase 2]
```

---

## EPIC 1 — PLANT DISCOVERY (QR Scan)

### US-001 — Customer scans a plant tag
```
AS A customer walking the nursery lot
WHEN I see a plant I like and scan its QR tag with my phone
I WANT to see everything about that plant immediately
SO THAT I can make a buying decision without finding a staff member

ACCEPTANCE CRITERIA:
  ✅ Page loads in under 3 seconds on mobile
  ✅ Shows: species name, common name, container size
  ✅ Shows: price (plant only) and price with installation
  ✅ Shows: plant age (today minus arrived_at, formatted naturally)
  ✅ Shows: full growth timeline from arrival to today
  ✅ Shows: quantity selector (default 1)
  ✅ Works offline after first load (cached)
  ✅ No app download required

PHASE: Demo — must work May 25
```

### US-002 — Customer views plant growth timeline
```
AS A customer considering a large tree purchase
WHEN I open the plant profile
I WANT to see the plant's journey from seedling to today
SO THAT I understand the investment and trust the quality

ACCEPTANCE CRITERIA:
  ✅ Timeline shows each container progression as a dated step
  ✅ Example SCV-0031: seedling → 4in → 3gal → 15gal → 30gal
  ✅ Each step shows approximate date
  ✅ Age calculation: "4 years, 2 months in cultivation"
  ✅ Visual — not just a list

PHASE: Demo — must work May 25
```

### US-003 — Customer selects quantity
```
AS A customer who wants multiple trees
WHEN I view a plant profile
I WANT to select how many I want
SO THAT I can add them all to one order

ACCEPTANCE CRITERIA:
  ✅ Default quantity: 1
  ✅ Max quantity: count of same species + container available
  ✅ Price updates in real time as quantity changes
  ✅ "Add to cart" navigates to add-ons screen

PHASE: Demo — must work May 25
```

---

## EPIC 2 — ADD-ONS (The Regina Problem)

### US-004 — Netting prompt fires for self-transport
```
AS A customer who is transporting trees themselves
WHEN I reach the add-ons screen
I WANT to be clearly offered protective netting
SO THAT I don't drive 40 minutes home and regret not buying it

ACCEPTANCE CRITERIA:
  ✅ Transport toggle shown: "I'll take them home" vs
     "LAWNS is delivering/installing"
  ✅ When self-transport selected:
     - Netting card appears immediately
     - Red border (#A32D2D), amber background
     - Pre-checked by default
     - Description: "Protects branches and bark on the 
       drive home. Applied before loading."
     - Price: $20 total for both trees ($10/tree)
  ✅ Netting is UNMISSABLE on mobile — cannot be scrolled past
     without seeing it
  ✅ When delivery/install selected: netting hidden

PHASE: Demo — must work May 25
THE STORY: This is the Regina moment. The entire demo pivots here.
```

### US-005 — Customer sees sized add-ons at checkout
```
AS A customer buying a 30-gallon tree
WHEN I reach the add-ons screen
I WANT to see the right amount of planting accessories
  automatically sized for my tree
SO THAT I don't have to guess what I need

ACCEPTANCE CRITERIA:
  ✅ Planting mix quantity auto-calculated for container size
     30-gal → 2 cubic feet, priced accordingly
  ✅ Mulch ring sized to canopy spread
     30-gal → "3-inch depth, 4-foot ring"
  ✅ Fertilizer spike shown with urgency copy:
     "Goes in the planting hole — cannot add after planting"
  ✅ Bamboo water gauge offered
  ✅ Tree wrap offered
  ✅ Each item has a description that creates urgency or clarity
  ✅ Pre-selected items default to checked

PHASE: Phase 1 — mention at demo, build after signing
```

### US-006 — Customer reviews and adjusts cart
```
AS A customer who has selected plants and add-ons
WHEN I reach the cart review screen
I WANT to see a clear summary with correct math
SO THAT I can confirm before submitting

ACCEPTANCE CRITERIA:
  ✅ Each plant as a line item: name, container, qty, price
  ✅ Each add-on as a line item: name, qty, price
  ✅ Subtotal calculated correctly
  ✅ Tax: subtotal × 0.0825 (or nursery-configured rate)
  ✅ Total = subtotal + tax
  ✅ Math matches what will appear in QuickBooks
  ✅ Can go back and change add-ons

PHASE: Demo — must work May 25
```

---

## EPIC 3 — CHECKOUT (The Invisible Invoice)

### US-007 — Customer captures contact info
```
AS A customer ready to complete a purchase
WHEN I reach the customer info screen
I WANT to enter my details quickly
SO THAT I receive my invoice and the nursery has my record

ACCEPTANCE CRITERIA:
  ✅ Required: first name, last name, email
  ✅ Optional: phone, address
  ✅ Email validated before proceeding
  ✅ If email already exists in system:
     finds existing customer record
  ✅ Form works on mobile keyboard
  ✅ No account creation required — guest checkout

PHASE: Demo — must work May 25
```

### US-008 — Invoice appears in QuickBooks automatically
```
AS LAWNS owner Layna
WHEN a customer completes checkout on their phone
I WANT the invoice to appear in QuickBooks immediately
  without anyone typing anything
SO THAT my books are always current and I never miss an invoice

ACCEPTANCE CRITERIA:
  ✅ Order saved to Supabase on checkout submit
  ✅ QB invoice created via API within 5 seconds
  ✅ Invoice has correct line items:
     - Plant: species name, container, qty, unit price
     - Each add-on as a separate line
  ✅ Tax calculated and applied correctly (8.25%)
  ✅ Customer record created or matched in QB
  ✅ Invoice total matches cart total exactly
  ✅ qb_invoice_url stored on order record
  ✅ Confirmation page shown to customer

DEMO MOMENT: Open QB on laptop immediately after customer
submits. Invoice is already there. "You didn't type anything."

PHASE: Demo — must work May 25
```

### US-009 — Customer receives confirmation
```
AS A customer who just completed a purchase
WHEN checkout is successful
I WANT confirmation that my order was received
SO THAT I know the invoice is coming and what I paid

ACCEPTANCE CRITERIA:
  ✅ Confirmation screen shows order summary
  ✅ Message: "Invoice sent to your email"
  ✅ Shows: order total, plants purchased, add-ons
  ✅ Shows: QB invoice link if available
  ✅ No account required — they're done

PHASE: Demo — must work May 25
```

### US-010 — Leakage flag set on orders with no add-ons
```
AS LAWNS owner Layna
WHEN a customer buys a 15-gallon or larger tree
  AND selects zero add-ons
I WANT that order flagged as a missed upsell
SO THAT I can see the pattern and fix it

ACCEPTANCE CRITERIA:
  ✅ leakage_flag = true when:
     any plant is 15gal+ AND order_addons count = 0
  ✅ leakage_flag = false otherwise
  ✅ Flagged orders visible on dashboard
  ✅ Leakage alert shows: "X orders this week — 
     est. $Y in missed add-ons"

PHASE: Demo — dashboard shows this
```

---

## EPIC 4 — OWNER DASHBOARD

### US-011 — Owner logs in and sees today
```
AS LAWNS owner Layna
WHEN I log in to the dashboard
I WANT to see what happened today at a glance
SO THAT I know my business without running reports

ACCEPTANCE CRITERIA:
  ✅ Login: email + password → Supabase auth
  ✅ Redirects to /dashboard after login
  ✅ Dashboard shows:
     - Plants tracked (total in inventory)
     - Live inventory value (sum of available plant prices)
     - Today's sales (orders created today)
     - Installs this week (orders with transport=install)
     - Leakage alerts if any flagged orders today
  ✅ Data is real — from Supabase, not mocked
  ✅ Works on desktop and mobile

PHASE: Demo — must work May 25
```

### US-012 — Leakage alert surfaces on dashboard
```
AS LAWNS owner Layna
WHEN I open my dashboard on a day when a customer
  bought trees without add-ons
I WANT to see the missed revenue opportunity
SO THAT I can understand the real cost of not offering add-ons

ACCEPTANCE CRITERIA:
  ✅ Alert appears when any leakage_flag=true orders exist
  ✅ Shows count: "3 sales this week with no add-ons"
  ✅ Shows estimated missed revenue:
     count × average add-on value
  ✅ Links to order detail

DEMO MOMENT: Show this after the checkout demo.
"This is what Regina's order would have flagged."

PHASE: Demo — must work May 25
```

---

## EPIC 5 — POST-SALE SERVICE ENGINE

### US-013 — No-purchase follow-up fires within days
```
AS LAWNS owner/manager Lauren
WHEN a customer completes a purchase
  AND did NOT add fertilizer at checkout
I WANT the system to automatically schedule a follow-up
  within 1-5 days (configurable)
SO THAT we capture the upsell before they buy it elsewhere

ACCEPTANCE CRITERIA:
  ✅ Follow-up queued automatically at order creation
  ✅ Delay: configurable per item (default 3 days)
  ✅ Follow-up appears in Lauren's action queue on fire date
  ✅ Shows: customer name, what they bought, what they skipped
  ✅ Outreach options: email / SMS / manual call
  ✅ Self-serve booking link included in message
  ✅ Status tracked: pending → sent → opened → booked /
     declined / no_response

PHASE: Phase 1
```

### US-014 — Purchase reorder follow-up fires at configured interval
```
AS LAWNS owner/manager Lauren
WHEN a customer DID purchase fertilizer at checkout
I WANT the system to schedule a reorder follow-up
  at the product's configured interval (default 180 days)
SO THAT we get repeat revenue without manually tracking it

ACCEPTANCE CRITERIA:
  ✅ Follow-up queued at order creation
  ✅ Delay: configurable per item (180 days default)
  ✅ Message tone: "Time to reapply — your trees were
     planted 6 months ago today"
  ✅ Offer: reorder delivery + optional spreading service
  ✅ Same status tracking as US-013

PHASE: Phase 1
```

### US-015 — Customer self-books a service slot
```
AS A customer who received a follow-up email or SMS
WHEN I want to schedule a service visit
I WANT to see available time slots and book one myself
  without calling the nursery
SO THAT I can schedule at my convenience

ACCEPTANCE CRITERIA:
  ✅ Booking link in email/SMS opens on phone
  ✅ Shows available slots for customer's area
  ✅ Customer selects:
     - Time slot
     - Service type: delivery only OR delivery + spreading
  ✅ Booking confirmed instantly
  ✅ Lauren notified of new booking
  ✅ Invoice created in QB on booking confirmation
  ✅ Customer receives confirmation SMS/email

PHASE: Phase 1
```

### US-016 — Lauren sees follow-up queue on dashboard
```
AS LAWNS manager Lauren
WHEN I open my dashboard
I WANT to see all pending follow-ups that need action today
SO THAT I never miss a follow-up opportunity

ACCEPTANCE CRITERIA:
  ✅ Follow-up queue tile on dashboard
  ✅ Shows: overdue, due today, due this week
  ✅ Each item shows: customer, item, days since purchase,
     trigger reason
  ✅ One-tap to send email/SMS from queue
  ✅ One-tap to mark as called/declined

PHASE: Phase 1
```

---

## EPIC 6 — SERVICE CONFIGURATION (Lauren builds it herself)

### US-017 — Manager creates a new service item
```
AS LAWNS manager Lauren
WHEN I want to add a new post-sale service offering
I WANT to create it myself with triggers and timing
  without calling a developer
SO THAT I can build our service business at my own pace

ACCEPTANCE CRITERIA:
  ✅ Settings → Post-Sale Services → Add New Item
  ✅ Lauren enters:
     - Item name (e.g. "Fertilizer")
     - Description
     - Delivery price
     - Spreading price (optional)
  ✅ Lauren adds triggers:
     - Event: declined / purchased / tree purchased
     - Delay: [X] days
     - Seasonal condition: active months (optional)
     - Message template
  ✅ Item saved and active immediately
  ✅ New orders from this point forward trigger it
  ✅ No code change required

PHASE: Phase 1
```

### US-018 — Manager configures global window settings
```
AS LAWNS owner Layna
WHEN I set up the seasonal module
I WANT to configure the lifecycle windows for my operation
  (prime window, aging window, discount threshold)
  so that the system reflects how MY nursery works

ACCEPTANCE CRITERIA:
  ✅ Settings → Seasonal Module → Batch Windows
  ✅ Every window value is editable:
     - Arrival age (days old when received)
     - Prime window: day X to day Y
     - Aging window: day X to day Y
     - Discount trigger day
     - Default discount percentage
     - Discount trigger: auto / suggest / manual
     - Write-off day
     - Write-off action: alert only / auto write-off
  ✅ Changes apply immediately to new batches
  ✅ Existing batches recalculated on next morning run
  ✅ Per-item overrides available

PHASE: Phase 1
```

---

## EPIC 7 — SEASONAL PERISHABLE MODULE

### US-019 — Staff logs incoming seasonal batch
```
AS LAWNS staff member
WHEN a new delivery of seasonal plants arrives
I WANT to log the batch quickly
SO THAT the 14-day clock starts and inventory is accurate

ACCEPTANCE CRITERIA:
  ✅ Settings → Seasonal → Log Arrival
  ✅ Select item type (Tomato Celebrity, etc.)
  ✅ Enter quantity received
  ✅ Arrival date defaults to today
  ✅ Batch code auto-generated (TOM-052602)
  ✅ Status set to 'prime' automatically
  ✅ Clock starts — dashboard shows batch immediately

PHASE: Phase 1
```

### US-020 — Dashboard shows aging alerts each morning
```
AS LAWNS owner Layna or manager Lauren
WHEN I open the dashboard any morning
I WANT to see which batches need attention today
SO THAT I never discover dead plants — I prevent them

ACCEPTANCE CRITERIA:
  ✅ Seasonal tile shows:
     🔴 ACTION REQUIRED — discount or write-off due
     ⚠️  WATCH — entering aging window
     ✅ PRIME — selling well
     📦 INCOMING — ordered, not yet arrived
  ✅ Each batch shows:
     - Days in inventory vs configured window
     - Quantity remaining
     - Daily sales rate and projected days to sellout
  ✅ One-tap approve discount from tile
  ✅ One-tap log deaths from tile

PHASE: Phase 1
```

### US-021 — Lauren logs plant deaths
```
AS LAWNS manager Lauren
WHEN plants in a batch die
I WANT to log them quickly with a reason
SO THAT inventory is accurate and we learn what's killing them

ACCEPTANCE CRITERIA:
  ✅ [ Log Deaths ] button on batch tile
  ✅ Enter quantity, select reason:
     heat / overwater / underwater / disease /
     freeze / pest / unknown
  ✅ Optional photo
  ✅ batch.quantity_died updates immediately
  ✅ Remaining quantity recalculated
  ✅ Death reason tracked for annual analysis

PHASE: Phase 1
```

### US-022 — System generates seasonal order recommendation
```
AS LAWNS owner Layna
WHEN I'm preparing to order next week's seasonal stock
I WANT the system to recommend quantities
  based on last year's sales data
SO THAT I stop guessing and stop over/under ordering

ACCEPTANCE CRITERIA:
  ✅ Seasonal → Order Planner screen
  ✅ For each item shows:
     - Last year's quantity sold
     - Recommended order (weighted avg + death buffer)
     - Confidence level (high/medium/low/no data)
  ✅ Quantities are editable before placing order
  ✅ Recommendation logic:
     weighted 3-year average (50% most recent)
     + average death rate buffer
  ✅ First season: "No data yet — enter your estimate"
     System starts collecting from this point forward

PHASE: Phase 1 — data collects immediately on launch
```

---

## EPIC 8 — CONTRACTOR PORTAL

### US-023 — Contractor browses connected nursery inventory
```
AS A landscape contractor
WHEN I log in to the contractor portal
I WANT to see what's available at my connected nurseries
SO THAT I can plan jobs and place orders without calling

ACCEPTANCE CRITERIA:
  ✅ Contractor logs in once — sees all connected nurseries
  ✅ Search across all nurseries simultaneously
  ✅ Filter by: species, container, price, distance, nursery
  ✅ Each result shows:
     - Nursery name and distance
     - Plant details
     - Contractor price (per their negotiated tier)
  ✅ "Place order" on any item

PHASE: Phase 2
```

### US-024 — Nursery approves contractor connection
```
AS LAWNS owner Layna
WHEN a contractor requests to connect with LAWNS
I WANT to review and approve the connection
  and set their pricing terms
SO THAT I control who sees my inventory and at what price

ACCEPTANCE CRITERIA:
  ✅ Layna receives notification of connection request
  ✅ Reviews contractor: name, license, service area
  ✅ Sets pricing tier: retail / trade / wholesale / custom
  ✅ Sets payment terms: prepay / net-15 / net-30
  ✅ Approves or declines
  ✅ Contractor notified of decision

PHASE: Phase 2
```

---

## EPIC 9 — INTEGRATION CONFIGURATION

### US-025 — Owner connects QuickBooks at onboarding
```
AS LAWNS owner Layna
WHEN I set up Cultivar OS for the first time
I WANT to connect my existing QuickBooks account
  in a few clicks
SO THAT invoices flow to QB automatically from day one

ACCEPTANCE CRITERIA:
  ✅ Onboarding Step 5 shows accounting options
  ✅ QuickBooks shown as recommended
  ✅ "Connect QuickBooks" → OAuth flow
  ✅ Returns to app after authorization
  ✅ Connection confirmed with green checkmark
  ✅ Test invoice created and verified
  ✅ Skip option available — app works without QB

PHASE: Demo — QB connected before May 25 meeting
```

### US-026 — Owner switches accounting provider
```
AS A nursery owner who switches from QuickBooks to Xero
WHEN I go to Settings → Integrations
I WANT to disconnect QB and connect Xero
  without losing any order history
SO THAT my accounting system reflects my business

ACCEPTANCE CRITERIA:
  ✅ Settings → Integrations shows current connections
  ✅ Disconnect QB — tokens cleared, flag set
  ✅ Connect Xero — OAuth flow
  ✅ Historical orders in Cultivar OS unchanged
  ✅ New orders forward to Xero
  ✅ Warning shown: historical QB invoices not migrated

PHASE: Phase 2
```

---

## EPIC 10 — BUSINESS INSIGHTS

### US-027 — Owner sees add-on performance metrics
```
AS LAWNS owner Layna
WHEN I open Business Insights
I WANT to see which add-ons are being accepted and declined
SO THAT I can improve how we offer them

ACCEPTANCE CRITERIA:
  ✅ Add-on acceptance rate per item (% of orders it appeared in
     where it was selected)
  ✅ Revenue generated per add-on this season
  ✅ Leakage: revenue left on table (declined add-ons × price)
  ✅ Trend: improving or declining week over week
  ✅ Best day / worst day for add-on capture

PHASE: Phase 1
```

### US-028 — Owner sees follow-up conversion metrics
```
AS LAWNS owner Layna
WHEN I open Business Insights → Post-Sale Services
I WANT to see how our follow-up program is performing
SO THAT I know if the service route is worth running

ACCEPTANCE CRITERIA:
  ✅ Follow-ups sent, opened, booked, completed
  ✅ Revenue captured from follow-ups
  ✅ No-purchase follow-up conversion rate
  ✅ Reorder follow-up conversion rate
  ✅ Insight: which trigger converts better

PHASE: Phase 1
```

### US-029 — Owner sees seasonal performance
```
AS LAWNS owner Layna
WHEN the season closes
I WANT to see what sold, what died, and what was wasted
SO THAT next year's order is data-driven

ACCEPTANCE CRITERIA:
  ✅ Sell-through rate per item
  ✅ Death rate per item + breakdown by reason
  ✅ Discount rate: what % moved at discount
  ✅ Cost of losses (deaths × unit cost)
  ✅ Recommendation: increase / decrease / stable for next year
  ✅ AI insight: actionable pattern from the data

PHASE: Phase 1
```

---

## PART 2 — THE DEMO SCRIPT

### Pre-Demo Setup (night before)

```
PHYSICAL ITEMS TO BRING:
  ✅ Laptop — QB sandbox open in browser, logged in
  ✅ Phone — cultivar-os.app loaded, QR scanner ready
  ✅ 3 printed QR tags:
       SCV-0031 — Shoal Creek Vitex 30-gal
       NCM-0042 — Natchez Crape Myrtle 45-gal
       MS30-001 — Mexican Sycamore 30-gal
  ✅ Invoice #3648.380 printed — Regina & David O'Brien
       MS30 + VSC30 — $920.13 PAID — Employee: Lauren Bishop

SYSTEM STATE — verify night before:
  ✅ cultivar-os.app/plant/SCV-0031 loads on phone
  ✅ SCV-0031 shows Vitex data + 4-year timeline
  ✅ Add-ons screen shows netting (red border)
  ✅ Checkout flow completes without errors
  ✅ QB sandbox dashboard loads — invoices list visible
  ✅ Layna's login works: layna@lawnstrees.com
  ✅ Dashboard shows LAWNS data
  ✅ Do a full run-through — time it — must be under 4 minutes
  ✅ Do it again
```

---

### SCENE 1 — THE OPENING (2 minutes)

**Setting:** You're at the table. Layna and Lauren are across from you.
Before you say anything, place invoice #3648.380 on the table face up.
Their nursery name. Their employee's name. Their trees.

**You say:**

> "Before I show you anything — I want to ask you one question."

*Pause. Let them look at the invoice.*

> "How does a customer find out what a 45-gallon Crape Myrtle
>  costs and when you can plant it?"

*Let them answer. Don't rush it. Their answer tells you everything
about their current pain. Common answers:*

- "They ask us" → "What if they're here when you're busy?"
- "We have price tags" → "What if they want more than the price?"
- "They call ahead" → "What if it's after hours?"

*Nod. Then:*

> "I want to show you what a customer experiences
>  when they scan the tag on one of your trees."

---

### SCENE 2 — THE QR SCAN (1 minute)

**Pull out your phone. Hold it up so they can see the screen.**

> "This is the Shoal Creek Vitex out on your lot right now.
>  Same tag that's already on the plant."

*Scan SCV-0031. The plant profile opens.*

> "Everything they need to decide — species, size, price,
>  installation cost, age — right here."

*Scroll slowly through the timeline.*

> "Four years. This tree has been on your property for
>  four years. That's the story of the plant — from
>  a 4-inch pot to a 30-gallon specimen. A customer
>  who sees this doesn't ask why it costs $400.
>  They understand why it's worth $400."

*Let that sit for a second.*

> "Now watch what happens when they want to buy it."

---

### SCENE 3 — THE NETTING MOMENT (2 minutes)

**This is the emotional center of the demo. Take your time.**

*Tap "Add to cart." Transport toggle appears.*

> "They say they're taking it home themselves."

*Tap "I'll transport myself." The netting prompt appears —
red border, amber background, pre-checked.*

> "Before we go further — I need to tell you about
>  something that happened when we were here."

*Put the phone down.*

> "When David bought those two trees —"

*Point to the invoice.*

> "— your team was wonderful. Lauren helped load them.
>  And two minutes after we pulled out of the parking lot,
>  Lauren came out and offered the netting."

*Pause.*

> "Regina was already in the truck. The trees were loaded.
>  We said no — not because we didn't want it. Because
>  we'd already committed to leaving."

*Pause again.*

> "She drove home on back roads at 25 miles an hour
>  for 40 minutes. Worried the whole way.
>  The netting was $20 for both trees."

*Pick up the phone. Show the netting prompt.*

> "This prompt appears the moment a customer says
>  they're taking the tree themselves. It's pre-checked.
>  It's impossible to miss. They see it before they
>  enter their name. Before they pay.
>  Before they pull the truck around."

*Look at Layna.*

> "Regina's order would have been $940 instead of $920.
>  That's not the point. The point is she would have
>  driven home at 55 miles an hour."

---

### SCENE 4 — THE CHECKOUT FLOW (1 minute)

**Move quickly through this — it should feel effortless.**

*Add netting + compost. Tap "Review cart."*

> "She adds compost — best applied in the planting hole,
>  right now, not later. Cart shows the total with tax."

*Tap through to customer capture.*

> "Name, email. That's it. Optional phone and address."

*Enter a test email. Tap "Submit order."*

> "She hits submit."

*Immediately open your laptop.*

---

### SCENE 5 — THE QB MOMENT (30 seconds)

**This is the magic. Do not rush it. Let the silence work.**

*Navigate to QB sandbox → Invoices. The invoice is there.*

> "QuickBooks."

*Turn the laptop so they can see.*

*Say nothing for 3 full seconds.*

> "You didn't type anything. Lauren didn't call the office.
>  The invoice wrote itself. You were outside the whole time."

*Scroll through the invoice line items.*

> "Species. Container size. Compost. Netting.
>  Tax calculated. Customer email on the invoice.
>  Exactly what was in the cart. Nothing added.
>  Nothing missing."

---

### SCENE 6 — THE DASHBOARD (1 minute)

**Hand the laptop to Layna.**

> "Log in."

*She logs in as layna@lawnstrees.com.*

> "This is your view. Every plant you have —
>  tracked. Live inventory value. Today's sales.
>  And this —"

*Point to the leakage alert.*

> "Every time a customer buys a large tree
>  and doesn't add anything — the system flags it.
>  Not to embarrass anyone. To show you the pattern.
>  Last week, three customers left without a single add-on.
>  That's an estimated $180 that stayed in their wallets."

*Pause.*

> "The system doesn't judge. It just shows you
>  what's happening so you can decide what to do about it."

---

### SCENE 7 — THE FUTURE (don't build it — describe it)

**This is where you plant seeds for Phase 1 features.
Describe them in one sentence each. Don't demo them.**

> "After a customer buys a tree and skips the fertilizer —
>  three days later, the system sends them a message:
>  'We're in your area Tuesday — want us to bring it?'
>  Lauren configured that herself. No developer needed."

> "When a customer buys tomatoes every spring —
>  the system remembers. In October it asks them
>  if they want to hold their usual order.
>  Layna knows what to order before she calls her supplier."

> "When Lauren is on a service run and she's already
>  at a customer's property — the system prompts her
>  to check the other trees in the yard while she's there.
>  Every visit becomes an opportunity."

*One beat.*

> "That's Phase 1. It builds itself as you use it."

---

### SCENE 8 — THE CLOSE

**No slides. No pitch deck. Just this.**

*Slide the invoice back across the table.*

> "You were our first customer."

*Point to Lauren's name on the invoice.*

> "Lauren wrote this up. She knows what this took.
>  She knows what gets missed."

*Look at Layna.*

> "We want you to be our founding customer.
>  $149 a month. Locked forever — that price
>  never goes up regardless of what we build next.
>  You're the business that shapes how this gets built."

*Stop talking.*

*Let her respond.*

---

### HANDLING OBJECTIONS

**"We already have a system for this"**
> "What does it do when a customer scans a plant tag
>  and wants to buy it without finding anyone?"
> — The silence is the answer.

**"We're not very tech-savvy"**
> "Regina used this on her phone. She didn't download
>  anything. She didn't create an account.
>  She just scanned a tag."

**"What does it cost after the founding rate?"**
> "We're at $149 for founding customers. The standard
>  rate will be $299. You'll never see that number
>  as long as you're a customer."

**"Can we think about it?"**
> "Of course. While you're thinking — can I leave
>  these three tags with you? Put them on any plant
>  on your lot. Show your customers. See what they say.
>  We'll talk next week."

**"What happens to our data if we cancel?"**
> "It's yours. Every order, every plant record, every
>  customer — export any time. We don't hold data hostage."

**"Does it work with our QuickBooks?"**
> "You confirmed QuickBooks Online when we were here.
>  The demo you just saw was your QuickBooks sandbox.
>  The connection is already mapped to your account."

---

### TIMING GUIDE

```
Scene 1 — Opening + question:          2 min
Scene 2 — QR scan + timeline:          1 min
Scene 3 — Netting + Regina story:      2 min  ← the emotional peak
Scene 4 — Checkout flow:               1 min
Scene 5 — QB moment:                   30 sec ← the magic
Scene 6 — Dashboard:                   1 min
Scene 7 — Future features:             1 min
Scene 8 — Close:                       1 min
Buffer for questions during:           2 min
─────────────────────────────────────────────
Total:                                ~11 min

Target: under 12 minutes before Q&A.
If they're engaged and asking questions — that's good.
Let it run. Don't rush to the close.
```

---

### WHAT NOT TO DO

```
❌ Don't show features that aren't built yet
❌ Don't use the word "software" in the first 5 minutes
❌ Don't talk about other verticals or the platform
❌ Don't show slides
❌ Don't apologize for anything being in beta
❌ Don't ask "does that make sense?" — it's a confidence killer
❌ Don't rush Scene 3 — the Regina story IS the demo
❌ Don't fill silence after Scene 5 — let QB speak
❌ Don't pitch price before Scene 8
❌ Don't leave without a next step — yes, or a date to follow up
```

---

### IF SOMETHING BREAKS

**QR scan doesn't load:**
> "Signal in here is a little rough — let me pull it up
>  directly." Type cultivar-os.app/plant/SCV-0031 manually.

**QB doesn't show the invoice immediately:**
> "It usually appears in about 30 seconds — 
>  let me show you the dashboard while it syncs."
> Then come back to QB. It will be there.

**Login fails:**
> "Let me log in from here." Use your own credentials
>  if Layna's don't work — you have owner access.

**Anything else breaks:**
> Stay calm. "Let me show you this on my phone instead."
>  The story doesn't change. The technology is a prop.
>  The story is the product.

---

## PART 3 — USER STORY STATUS TRACKER

Use this to track what's built before the demo.

| Story | Description | Status | Demo? |
|---|---|---|---|
| US-001 | QR scan → plant profile | ⬜ In progress | ✅ Required |
| US-002 | Growth timeline | ⬜ In progress | ✅ Required |
| US-003 | Quantity selector | ⬜ In progress | ✅ Required |
| US-004 | Netting prompt | ⬜ In progress | ✅ Required |
| US-006 | Cart review | ⬜ In progress | ✅ Required |
| US-007 | Customer capture | ⬜ In progress | ✅ Required |
| US-008 | QB invoice auto-creation | ⬜ In progress | ✅ Required |
| US-009 | Confirmation screen | ⬜ In progress | ✅ Required |
| US-010 | Leakage flag | ⬜ In progress | ✅ Required |
| US-011 | Owner dashboard | ⬜ In progress | ✅ Required |
| US-012 | Leakage alert | ⬜ In progress | ✅ Required |
| US-005 | Sized add-ons | ⬜ Not started | 🗣️ Mention only |
| US-013 | No-purchase follow-up | ⬜ Not started | 🗣️ Mention only |
| US-014 | Reorder follow-up | ⬜ Not started | 🗣️ Mention only |
| US-015 | Customer self-booking | ⬜ Not started | 🗣️ Mention only |
| US-017 | Manager creates service item | ⬜ Not started | 🗣️ Mention only |
| US-019 | Log seasonal batch | ⬜ Not started | 🗣️ Mention only |
| US-022 | Seasonal order recommendation | ⬜ Not started | 🗣️ Mention only |
| US-023 | Contractor portal | ⬜ Not started | ❌ Don't mention |
| US-025 | QB onboarding connect | ✅ Configured | ✅ Required |

---

## PART 4 — POST-DEMO NEXT STEPS

### If Layna says yes:

```
1. Sign founding customer agreement on the spot
   (have a simple one-page agreement ready)
2. Connect her real QB account (not sandbox)
3. Set up layna@lawnstrees.com as owner account
4. Walk through onboarding together — 20 minutes
5. Leave the 3 QR tags — put them on real plants
6. Schedule a 30-day check-in
```

### If Layna says "let me think about it":

```
1. Leave the 3 QR tags — "put them on any plants,
   show your customers this week"
2. Ask: "What would make you feel confident saying yes?"
3. Listen. That answer is your Phase 1 roadmap.
4. Set a specific follow-up date before you leave
5. Send a follow-up email that evening — 
   subject: "Your plants are live"
   body: The three URLs. Nothing else.
```

### The follow-up email if she asks to think:

```
Subject: Your plants are live

Layna,

cultivar-os.app/plant/SCV-0031
cultivar-os.app/plant/NCM-0042
cultivar-os.app/plant/MS30-001

Show anyone who picks up a plant tag this week.

David
```

---

*Cultivar OS · LAWNS Tree Farm LLC · May 25, 2026*
*Built with CAI · TRACE Enterprises*
*cultivar-os.app · builtwithcai.com*

*Practice Scene 3 out loud three times before you go.*
*The Regina story is the demo. Everything else is evidence.*
