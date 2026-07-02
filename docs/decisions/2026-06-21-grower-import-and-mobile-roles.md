# Decision Record — Grower Import, Margin Referee, and Role×Device Visibility

**Date:** 2026-06-21
**Source:** Lightning design session (2026-06-21) + grower-scan experiment
**Status:** Locked design. Docs-only record — no code, no schema, no canonical-doc edits.
**Scope note:** This record FLAGS what should later promote into MASTER_BRIEF / PLATFORM_STRATEGY / PLATFORM_AUDIT / STANDARDS / tech-debt. David decides promotion (see §4). Two-bar / RLS gates N/A (no build).

> **Why this file exists:** A long design session produced the grower-scan experiment result, a locked design for grower import, the margin referee, and role×device visibility. The reasoning is the asset — it must live in the repo, not only in chat. Written faithfully; the WHY is the point.

---

## 1. EXPERIMENT RESULT

**The scan succeeded; the import is blocked by schema.**

- **Scrape result:** 28 growers, 1378 items, **0 fabrication** (see [data/grower-scan/grower-scan-report.md](../../data/grower-scan/grower-scan-report.md)).
- **Import BLOCKED:** the schema is a **cost ledger** with no home for **sell price**, **price basis**, or **size**. There is nowhere to land a grower's published catalog without lying about what the numbers mean (writing a retail price into a cost column — see §3).

**Market read (the part the scan was really for):**
- **20 of 28 growers publish no structured data.** They are not misses — **they ARE the core market.** A grower with no structured catalog is a grower with no system; we become their system. The 8 who publish structured data are the exception, not the target.
- **100mi = a sales beachhead, not the TAM.** The 100-mile scan radius measures who we can sell to first, not the size of the opportunity.
- **Texas green industry ≈ $39B (2025).** Growers cluster near metros → a **200-mile scan would likely clear the "~100 growers to be viable" bar.** The 200mi scan is **optional, market-read only, and non-blocking** — it informs sizing, it does not gate any build.

**Viability frame (David):**
- The platform is **viable ONLY at scale.** Small-grower buyers are **capital-poor.**
- Therefore **price must be an OPERATING decision** — low monthly, reversible, near-zero switching cost — **never a CAPITAL one.** A $30K (or even $5K) ask is **dead on arrival** for this buyer.
- **Honesty is the moat:** low price + software that does the labor + **proven live on their own business** before they commit.
- **Customization-per-customer is the enemy of the scale model.** Bespoke work per customer is the same unit-economics leak as smoke — it quietly destroys the economics that only close at scale. The product must be one configurable thing, not N hand-built things.

---

## 2. LOCKED DECISIONS (each with its reasoning)

### 2.1 Cost is private; sell price is public
- **Cost is the moat** — it NEVER appears on the website.
- **Sell price is a public commodity** — everyone can see it; that's fine.
- **Price-shopping defense:** when a customer price-shops, the answer is **cost + margin**, never a **price-match.** We defend margin from a position of knowing our own floor; we never chase a competitor's number down.

### 2.2 Margin referee = cost + sell price + floor
- **Inputs:** cost, sell price, and a **floor margin** (default **40%**, owner-set, **per-line overridable**).
- **Fires only at CONFIRMED or DERIVED cost.** At **ESTIMATED or UNKNOWN** cost it says **"can't judge yet"** — it **never invents a number.**
- **Every verdict carries visible confidence.** A false "you're selling short" produced from a guessed cost **is smoke** — exactly the failure mode the whole platform is built against. Confidence is not optional decoration; it is the thing that keeps the referee honest.

### 2.3 Two-axis visibility: ROLE × CONTEXT/DEVICE
- **ROLE = the ceiling** (what a person is *permitted* to see). This is **SECURITY**, and it is **enforced at the DATA layer** — RLS / API must **not SEND** the data, not merely **not-render** it. Hiding a field in the UI while the API still ships it is not security.
- **CONTEXT / DEVICE = the focus** (what the current task *needs* on screen). This is **owner-tunable UX**, not security.
- **Mobile render = (within ceiling) AND (mobile-flagged for role).**
- **Desktop render = up to the full ceiling.**
- A **max-ceiling owner still sees a lean field screen on mobile** — the ceiling permits everything, but the device focus keeps the working screen tight.
- **This extends Ignition's existing role→field config by exactly ONE column** (the mobile flag). It is **not a new system** — it is one additive column on a pattern that already exists.

### 2.4 AI routing by KIND of cognition
- **Receipt OCR = extraction** → cheap model (**Gemini / Haiku**).
- **Cost discovery = reasoning-under-uncertainty** → **Opus.**
- Route through **AIEngine.**
- **Economics forgive Opus here:** discovery runs **once per line per grower**; OCR runs **constantly.** Paying for the expensive model on the rare, high-stakes reasoning task is correct; paying for it on the constant extraction task would not be.

### 2.5 Onboarding honesty gradient
- The tool offers to **estimate now**, OR to **walk real costs** for a confident reading — the owner's choice.
- Answering questions **visibly moves lines** ESTIMATED → DERIVED → CONFIRMED. The owner watches their own data get more trustworthy as they invest in it.
- **Declining is a valid, honestly-labeled result** — it shows the gaps rather than papering over them.
- **Receipts upgrade cost silently** (the count-once seam handles the merge). Capturing a receipt later improves the number without re-asking.
- Principle: **meet them where they are.**

### 2.6 CSV at the OCR door
- CSV dropped at the "Snap a receipt" door = **recognize + capture + offer + forward to issues@cultivar.** We acknowledge it, hold it, and route it — we do not pretend the receipt scanner ate it.
- A **parser, if ever built, is a SEPARATE Import surface** — **never welded to "Snap a receipt."** Conflating "capture a receipt image" with "import a catalog file" would lie about what each path does.

---

## 3. SCHEMA GAP (from the fit-map recon)

Source: [data/grower-scan/inventory-fit-map.md](../../data/grower-scan/inventory-fit-map.md).

**Need three additive, nullable columns** (UNKNOWN-never-zero, D-9 pattern):
- **`sell_price`** — paired, never alone.
- **`price_basis`** — the pair partner. A bare price **recreates the $175/ft lie** (a number with no unit is a fabrication waiting to happen). Price and basis must travel together.
- **`size_or_container`** — the size/container dimension.

**Both fit-map hypotheses CONFIRMED:**
- the **size ladder collides** (sizes are not a clean enum; they overlap and conflict across growers), and
- the **price basis flattens** (without basis, prices from different units are silently averaged into nonsense).

**`business_inventory.unit_cost` means COST.** Writing a **retail** price into it is a **silent lie** — this is exactly why the import is blocked and why the new columns are required rather than reusing the cost column.

**Alignment:** these ALTERs overlap the **tech-debt #42 residual** (the nullable price / `service_offerings` ALTER already noted there).

---

## 4. PROMOTION FLAGS (for David — pending, do NOT edit those docs)

These are the items in this record that are candidates to promote into the canonical docs. Listed only; David decides.

- **MASTER_BRIEF** — candidate decision entries: viability-at-scale; honesty-as-moat; operating-vs-capital pricing.
- **STANDARDS** — candidate STD entries: *margin verdict always carries confidence*; *role enforced at the data layer, not at render*.
- **PLATFORM_AUDIT** — reflect the schema gap + the additive `sell_price` / `price_basis` / `size_or_container` delta when built.
- **tech-debt #42** — note that the `sell_price` / `size` ALTER overlaps its residual (nullable price / `service_offerings` ALTER).

---

## 5. OPEN QUESTIONS AT CLOSE

- **A/B/C mobile fields → real columns** — pending David (which fields are mobile-flagged per role).
- **Pricing layer is gated above plant-tech** — confirmed (pricing builds on top of the cost/plant-tech spine, not before it).
- **200-mile scan** — queued / optional / non-blocking (market-read only).

---

*TRACE Enterprises · Built with CAI · design session 2026-06-21*
