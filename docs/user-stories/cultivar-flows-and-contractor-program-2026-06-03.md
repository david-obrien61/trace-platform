# Cultivar OS — User Stories: Delivery Module, Contractor Program, Customer Purchase Flows
**Date:** 2026-06-03  
**Type:** Working product specification — subject to refinement  
**Status:** Specification (not built)  
**Source:** Back-porch thinking sessions, David O'Brien

---

## Section 1: Document purpose

This document captures user stories and configuration specifications for Cultivar OS covering:
- Delivery module configuration
- Contractor onboarding and verification
- Contractor program monetization
- Online customer purchase flow
- In-person customer flow (QR code at nursery)
- Delivery routing intelligence

These are **working specifications subject to refinement** as product development proceeds. They represent design intent, not built features. As features are implemented, `docs/built-inventory.md` and `PLATFORM_AUDIT.md` capture what actually ships — this document is the authoritative source for what these flows are *supposed to do*.

**When referencing these flows:** Point to specific sections in this document rather than duplicating content in PLATFORM_STRATEGY.md or elsewhere. When a section is implemented, add a note to that section indicating the implementation date and relevant files.

---

## Section 2: Delivery module configuration

### Current state (as of 2026-06-03)

No customer-facing delivery scheduling exists. Owner manages delivery routing manually via the `/deliveries` page (multi-stop Google Maps URL, SMS-to-driver). No delivery date on orders. No owner-configured delivery schedule. See `docs/built-inventory.md` gaps: "Delivery address persistence" and "Delivery date scheduling."

### Desired configuration capabilities

**Owner configures delivery schedule at the business level:**
- Default schedule (e.g., 5 days a week, 6 days a week)
- Custom schedule (e.g., "We only deliver Tuesdays and Thursdays")
- Configuration can be changed at any time
- Configuration can be overridden for specific orders

**Owner-facing visibility:**
- Current delivery configuration displayed prominently in owner dashboard
- Owner can see at a glance which days they've committed to deliver
- Override option clearly available without navigating into settings

**Customer-facing experience:**
- Customer sees only available delivery days based on owner configuration
- Customer picks from available days when scheduling delivery
- Algorithm considers customer location (zip code, address) to suggest optimal slots
- Example: "Nothing available Tuesday in your area, but we have a Thursday slot because we're already delivering nearby"

**Optional future enhancement (default off):**
Allow customers to self-schedule delivery without owner approval. Owners can enable when they're ready for that level of automation. This gate protects smaller operations from overcommitting on delivery capacity.

### Implementation notes

- Requires `delivery_date` column on `orders` (not yet written)
- Requires delivery schedule config in `businesses` or `nursery_profiles` table
- Routing intelligence (Section 7) is the connective tissue for the customer-facing slot availability

---

## Section 3: Contractor onboarding and verification user story

### User story

*"As a contractor, I want to register with LAWNS (or any nursery using Cultivar) so that I can receive contractor pricing and benefits."*

### Flow

1. Contractor goes to nursery's website or app
2. Contractor clicks "Become a Contractor" (or equivalent CTA)
3. Contractor fills out registration form:
   - Business name
   - Contact name
   - Business address
   - Phone number
   - Email
   - Business type (landscaper, builder, designer, property manager, etc.)
   - Business verification documents (license, insurance, EIN, or similar)
4. Submission goes to nursery owner for review
5. Owner reviews submission, verifies the contractor is legitimate
6. Owner approves and assigns contractor to a tier
7. Contractor receives notification (SMS or email) that they've been approved
8. Contractor can now access contractor pricing on any subsequent order

### Tier structure

- **Tier 1:** 10% discount on all products
- **Additional tiers:** TBD — could be volume-based, loyalty-based, or category-specific

### Owner controls

- Owner defines tier discount percentages and eligibility criteria
- Owner can promote or demote contractors between tiers
- Owner can suspend contractor status if business relationship changes
- Owner sees activity history per contractor: total spend, order frequency, last purchase

### Implementation note

PLATFORM_STRATEGY.md references "Phase 3 (contractor portal)" and PLATFORM_AUDIT.md lists `contractor_tiers` as a FLEET-tier BUILD NEW item. This section is the detailed specification for that feature. When built, update PLATFORM_STRATEGY.md Phase 3 to reference this document.

---

## Section 4: Contractor program configuration options

### Notification system

- Contractors get notified via SMS or email when a new app version is available
- Notification links directly into the app
- App displays contractor-tier pricing on all product pages

### Monetization model options

**Option A — Free contractor access**
- All approved contractors get app access with their tier discount at no charge
- Nursery owner pays no per-contractor fee
- Revenue model: nursery captures margin on contractor purchases

**Option B — Paid contractor access ($4.99/month or similar)**
- Contractor pays small monthly fee for access to better pricing
- Contractor saves more than the fee through discount (10% on $1,000/month = $100 saved vs. $4.99 fee)
- Symbiotic: contractor saves money, nursery captures fee income and automated contractor relationship management

**Option C — Tiered with free entry**
- Tier 1 (basic discount) is free
- Tier 2+ requires monthly subscription for better discounts
- Contractors self-select into the tier that matches their purchase volume

**Recommendation:** Ship with Option A (free) initially. Low barrier to enrollment builds contractor base. Once contractor volume justifies it, migrate to Option B or C with existing contractors grandfathered.

---

## Section 5: Cultivar customer flow — online purchase

### User story

*"As a customer browsing a nursery's online inventory, I want to see what's available and purchase items easily."*

### Flow

1. Customer goes to nursery's public-facing page
2. Customer sees inventory grid (plants, products, services)
3. Customer clicks an item to see details
4. Item details show description, photos, care information
5. **Pricing gate:** Customer cannot see price until they create a cart with basic info
6. Cart creation requires:
   - Name
   - Address
   - Zip code
7. Once in the cart, customer sees:
   - Item prices
   - Delivery options (pickup, delivery, delivery with planting service)
   - Just-in-time cross-sell offers (see below)
8. Customer selects delivery or pickup:
   - **If pickup:** selects time window from available slots
   - **If delivery:** system shows available delivery days based on owner configuration AND customer zip code routing
   - **If delivery with planting:** additional cost shown, schedule coordinated with planting team
9. Customer reviews cart with all charges visible
10. Customer pays online OR selects "pay at pickup/delivery"
11. Order submitted, customer receives confirmation

### Just-in-time offerings principle

At each step, relevant offerings appear in context:

| Trigger | Offering |
|---|---|
| Selecting a large tree | Netting prompt (Texas law — legally required for transport) |
| Selecting any plant | Fertilizer and soil amendment offer |
| Selecting delivery | Planting service offer |
| Selecting pickup | Reminder about transport considerations (truck/trailer required for large specimens) |

These are **not aggressive upsells**. They are operationally necessary additions the customer is likely to need and might forget. The decline tracking (when a customer explicitly says no) feeds back into owner intelligence about cross-sell effectiveness.

### Implementation note

The current Cultivar OS checkout (`CartReview.tsx`, `useSubmitOrder.ts`) handles in-person QR-scan orders. The online purchase flow extends this for customers who arrive via web, not QR code. The pricing gate (cart required before prices show) is new behavior not yet implemented.

---

## Section 6: Cultivar customer flow — in-person at nursery (the LAWNS experience)

### User story

*"As a customer visiting LAWNS to look at trees, I want to learn about each tree, decide what I want, and complete the purchase efficiently — without needing to find a staff member for every question."*

### Flow

1. Customer arrives at LAWNS, parks
2. Customer walks among the trees
3. Each tree has a QR code attached (currently live — e.g., `cultivar-os.vercel.app/plant/SCV-0031`)
4. Customer scans QR code with their phone
5. App opens and displays tree details:
   - Species name
   - Care information
   - Mature size
   - Photos
6. **Geolocation-aware pricing (configuration option):**
   - If customer is detected at LAWNS location (geofence), price is automatically visible
   - If not at location (browsing remotely), price requires cart creation as in online flow
7. Customer adds tree to cart from QR code scan
8. Customer continues walking, scanning other trees, building cart
9. When ready to check out:
   - Cart shows all selected trees with prices
   - Delivery vs. pickup option
   - Just-in-time cross-sells (netting, fertilizer, planting service, delivery)
10. Customer selects fulfillment:
    - **Delivery only:** schedule from available slots based on owner's delivery configuration
    - **Delivery with planting:** additional cost, scheduled with planting team
    - **Customer pickup:** take immediately or schedule pickup time window
11. Customer submits order
12. **Two payment paths:**
    - **Pay online via app:** completes in the app
    - **Pay in office:** walks to front, staff has order details on screen

13. **Pay in office sub-flow:**
    - Lauren has order on screen (synced from customer's cart submission)
    - Lauren may ask additional questions for customer relations
    - Customer pays via kiosk mode on Lauren's tablet/POS
    - Transaction completes and marks the order as paid

14. Customer receives receipt and delivery/pickup confirmation

### Why the QR + geolocation pattern matters

- Customers self-serve on tree information without requiring staff presence
- Pricing is contextual: in-store sees prices immediately; remote browsing requires cart
- Reduces "what's this tree?" interruptions to LAWNS staff
- Captures customer interest data: which trees were scanned but not purchased (future intelligence)
- Enables efficient walk-through experience at large nurseries with extensive inventory spread across acreage

### Pay-in-office sync question (open)

How does the customer's mobile cart sync to Lauren's POS for the pay-in-office flow? Options:
- Order appears in the nursery's dashboard order queue the moment the customer submits
- Lauren searches by customer name or order number
- A printed QR or order number the customer can show

This is an open question noted in Section 9.

---

## Section 7: Delivery routing intelligence

Connective tissue that makes the flows above actually work at scale.

### Owner configures

- **Delivery days:** which days of the week they deliver (e.g., Tuesday and Thursday only)
- **Delivery zones:** zip codes they serve
- **Vehicle capacity per day:** how many deliveries / total weight or volume per run
- **Crew availability per day:** affects how many deliveries can be scheduled

### System calculates per customer

- Which delivery days are theoretically available (matches owner's schedule)
- Which days have remaining capacity
- Which days have nearby deliveries already scheduled (routing efficiency bonus)
- Recommended slot based on all the above

### Customer sees

- Available delivery days (filtered by owner schedule, capacity, and zone)
- Estimated delivery window (morning/afternoon based on routing)
- Reason for unavailable days when relevant ("We don't deliver to your area on Tuesdays")

### Owner sees

- Daily delivery manifest with auto-suggested routes
- Capacity utilization per day
- Override capability per customer delivery
- Communication trigger if delivery needs to shift (SMS or email to customer)

---

## Section 8: Configuration philosophy across all these flows

A consistent pattern runs through delivery, contractor program, and customer flows:

**Defaults are opinionated.**  
A new nursery owner signing up gets a working configuration out of the box. No setup required to start operating.

**Configuration is available.**  
Owner can adjust any default: delivery days, contractor tiers, geolocation pricing, just-in-time offerings — all configurable.

**Configuration is visible.**  
Owner can always see current configuration without hunting through settings. Dashboard surfaces "you're currently configured for X" in the relevant operational context.

**Configuration changes propagate immediately.**  
No "save and apply" friction. Change is live the moment the owner sets it.

This is the Apple model: opinionated defaults, customization available but never required, and the configuration itself never gets in the way of operating the business.

---

## Section 9: Open questions

These are noted for future product discussions and are not blockers to this specification.

1. **Contractor loyalty bonuses:** Should the contractor program include annual volume bonuses or only monthly tier discounts?

2. **Geolocation pricing opt-out:** How does this work for owners who prefer pricing always visible (e.g., smaller nurseries with no remote browsing concern)?

3. **Price visibility threshold:** Per-customer (based on account type)? Per-business config? Fully configurable?

4. **Pay-in-office sync:** How does the customer's mobile cart reach Lauren's screen? Order queue by submission? Search by name? Printed order number?

5. **Decline tracking visibility:** Should customers see that their netting declination was noted? "We noted you declined netting; would you like a reminder before pickup?" Is this helpful or intrusive?

6. **Multi-tree cart limits:** For the in-person walk-through at LAWNS, should there be quantity limits per cart to prevent abuse?

7. **Contractor program monetization timing:** At what contractor volume does the switch from Option A (free) to Option B or C become worth the friction?

---

## Section 10: Connection to TRACE principles

| Flow element | TRACE principle |
|---|---|
| Just-in-time offerings | **Time Back** — reduces customer cognitive load while capturing revenue the nursery would otherwise miss |
| Configuration philosophy (defaults + customization) | **Apple model** — opinionated defaults, optional customization, no required configuration before operation |
| Geolocation pricing | **Operational intelligence** — contextual experience based on where the customer is physically located |
| Contractor verification | **Covenant** — relationships are real, not transactional; nursery owns the contractor relationship and controls tier assignment |
| Cross-sell decline tracking | **Audit-anchored pricing** — measure what customers decline to understand actual cross-sell effectiveness |
| Pay-in-office flow | **Lauren's ROI** — staff time is captured in structured workflow, not ad-hoc conversation; Lauren still has a human touchpoint without managing the transaction manually |

---

## Conflicts and reconciliation needed

**PLATFORM_STRATEGY.md — Phase 3 (contractor portal)**  
PLATFORM_STRATEGY.md mentions "Phase 3 (contractor portal)" under the accounting adapter roadmap section (line ~1116). That reference is minimal — no flow description, no tier structure. This user stories document is the detailed specification for that feature. No content conflict, but PLATFORM_STRATEGY.md should be updated to cross-reference this document when contractor portal enters active development.

**PLATFORM_AUDIT.md — Contractor management**  
Lists `contractor_tiers` as a "FLEET tier | BUILD NEW" item. This document specifies what `contractor_tiers` should support. No conflict; the audit entry should eventually reference this document's Section 3 and 4.

**docs/built-inventory.md — Online Shop (stub)**  
Built inventory notes "Online Shop | Cultivar OS | Tile exists, Enable stub. Next roadmap item." Section 5 of this document is the user story for what the Online Shop tile leads into. No conflict — the inventory captures current state (stub), this document captures intended behavior. When implemented, update built-inventory.md to mark Online Shop as built and reference Sections 5 and 6.

**docs/built-inventory.md — Delivery gaps**  
Built inventory notes "Delivery address persistence" and "Delivery date scheduling" as unbuilt gaps. Sections 2 and 7 of this document specify the full delivery scheduling experience those gaps are blocking. No conflict — same direction, this document adds the full UX context around the capability gaps.

**QR checkout flow (current behavior)**  
Current Cultivar OS checkout assumes customer arrives via QR scan at the nursery. Section 6 specifies the intended full in-person experience including geolocation pricing, multi-tree cart building, and pay-in-office flow. The current checkout is a partial implementation of this spec. No contradiction; current implementation is a subset.

---

*Working specification. Update in place as product thinking evolves. Do not create a replacement document — revise this one.*  
*See docs/runbooks/cultivar-user-stories-capture-2026-06-03.md for process notes.*
