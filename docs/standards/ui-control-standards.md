# UI Control Standards — the bar every platform control meets

**Last updated: 2026-09-03**
**Status: BINDING (CLAUDE.md §6 rules 13–15). Rendered board: [/ui-standards.html](../../ui-standards.html) (pure renderer of the compliance manifest).**

This is the **bar**, not a found-issue log. Each entry states the industry-standard behavior a
platform control MUST implement and the common pattern it descends from. Every control we build is
**measured against this spec** — the rendered compliance board shows control × standard as
✅ meets / 🟡 partial / 🔴 missing, so where a control falls short it is a KNOWN gap on the board,
never a silent one.

These are patterns users already expect from any competent data app (a spreadsheet, an admin
console, a CRM grid). We are not inventing them — we are holding our controls to them. Divergence
in either direction (below the bar, or gold-plating above our scope) requires an explicit recorded
decision per the standard-by-value rule (CLAUDE.md §6 r10).

The shared controls that carry these standards:
- **`packages/cultivar-os/src/components/datasheet/DataSheet.tsx`** — the ONE grid engine (inventory / assets / customers inherit).
- **`packages/cultivar-os/src/components/datasheet/systemManagedFields.ts`** — the field-display lock registry.
- **`DataSheet.tsx → sheetStyles.modal`** — the shared modal/sheet convention.

---

## 1. DATA GRID (the DataSheet)

Every grid rendering business rows MUST have:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| G1 | **Sticky header row** — column headers stay visible while the body scrolls vertically. | Every spreadsheet / data grid (Excel freeze-header, AG-Grid, Google Sheets). | You lose track of which column is which the moment the header scrolls off. |
| G2 | **Reachable horizontal scrollbar** — the h-scrollbar lives on a viewport-bounded box, reachable WITHOUT scrolling past every row. | Bounded scroll container (all grid libraries scroll the grid, not the page). | The defect that started this: a wide 111-row grid forced a scroll to the very bottom to find the h-scrollbar. |
| G3 | **Frozen identifier column** — the leading name/id column pins on horizontal scroll. | Excel "Freeze first column", AG-Grid pinned columns. | Scroll right on a wide grid and you no longer know which row you're editing. |
| G4 | **Sortable columns** — click a header to sort asc/desc, with a visible sort indicator. | Every list/table UI. | Finding a row in 100+ without sort is a linear scan. |
| G5 | **Column show/hide** — a menu to toggle non-essential columns off. | Admin consoles, AG-Grid column tool panel. | A wide grid on a laptop needs the operator to trim to what they care about. |
| G6 | **Search / filter** — a global text search + (where a status field exists) a quick status filter. | Every CRM/inventory list. | Scanning by eye doesn't scale past a screenful. |
| G7 | **Density for 100+ rows** — compact rows + a bounded scroll box that handles hundreds of rows without paginating away context. | Data-grid density modes. | The real inventory is 111 rows today and grows. |
| G8 | **Per-cell inline edit with a clear editable-vs-readonly affordance** — editable cells look editable (input chrome); non-editable cells are visibly distinguished (see §3). | Spreadsheet in-cell editing. | An edit surface must not make you guess which cells accept input. |
| G9 | 🔴 **DEFAULT SORT IS THE MOST RECENT RECORD DATE FIRST: the date the document or event itself carries, NOT the row's creation timestamp**, unless a clause here names another. Where the record's own date is absent, the row falls back to its capture timestamp for POSITION and **says on its face that it has no date** — a missing date is never silently rendered as a real one (D-9 / A9, *absent is not empty*). | Every records list a business operator reads — a bank statement, a ledger, an invoice register — is ordered by the date on the paper. | 🔴 **The two differ, and the difference is not cosmetic: the owner reasons in DOCUMENT time and the database records CAPTURE time.** On LAWNS's live 17 receipts they disagree — the **2026-07-02** bwi invoice was captured AFTER the **2026-07-29** one — so a `created_at` sort puts July 2nd above July 29th and the list contradicts the paper it is a list of. Ruled by David 2026-09-03. |

**Current implementation:** `DataSheet.tsx` implements G1–G8. G1 (sticky `<thead>` + box-shadow underline that survives `border-collapse`), G2 (bounded `overflow:auto` + `maxHeight:calc(100vh-280px)` scroll box), G3 (leading `frozen:true` run pinned `position:sticky;left:…` with cumulative offsets + right-edge shadow), G4 (`sortable`/`sortVal` + arrow), G5 (`Columns` menu over `hideable` cols), G6 (global search + optional `statusFilter`), G7 (compact rows in the bounded box), G8 (inline `TextCell`/`NumberCell`/`AmountCell`/`SelectCell` + the §3 lock affordance).

🔴 **G9 IS NEW (2026-09-03) AND IS NOT YET MET ANYWHERE — it is a KNOWN RED, not an assumed green.** It landed as a ruling, so every list surface now owes an answer to it. First application: `ReceiptsList` moved from `created_at` to `receipts.date` in the same pass that recorded the clause (③ follows ①), and **its owner-test CARD 1 flipped `covered` → `owed`** because the surface moved — the prior proof read *"newest capture first"* and cited capture timestamps, so it proved the ordering this clause replaces. `DataSheet`'s own consumers (inventory / assets / customers) are **unaudited against G9** and are the next sweep.

**⚠️ THE QUESTION G9 CLOSES, RECORDED SO IT DOES NOT RETURN: "unreviewed-first" IS NOT AN ALTERNATIVE TO THIS — IT IS AN UNBUILDABLE ASK.** It was put to David on 2026-09-03 as a choice against newest-first. **It needs a column that does not exist.** Measured live 2026-09-01 and recorded at [R-50]: *"`receipts` has 21 columns and NONE of `origin`/`shape`/`source`/`doc_type`/`document_type`/`kind`"* — and `reconcile_status` is the verdict the platform **banked at capture time**, not a review state a human sets. There is no reviewed/unreviewed bit on any receipt. **A sort order cannot be chosen over a field the table does not have**, and offering it as an option invites a ruling that no build can honour.

**Known gap (on the board):** G7 is met by a bounded scroll box, NOT row virtualization — fine at 111 rows and into the low thousands; if a grid ever holds tens of thousands, virtualization becomes the next rung (deferred, standard-by-value — not worth it at current scale).

---

## 2. MODAL / DIALOG

Every modal/dialog/sheet MUST have:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| M1 | **Centered** — floats centered on every viewport (not a bottom-anchored sheet, unless a deliberate documented mobile-list-add exception). | Standard modal dialog (every design system). | David flagged off-center checkout/add modals; convention **A "always center"** was adopted for the platform. |
| M2 | **Required-field validation, surfaced** — a blank required field BLOCKS save with a visible inline message + red border; NEVER a silently-greyed button and NEVER a silent save. | Form validation UX (the FIX 5 pattern). | Surface Honesty (D-9): a save that does nothing with no explanation is a lie. |
| M3 | **Escape-to-close** — `Esc` dismisses the modal. | Standard dialog affordance (WAI-ARIA dialog). | A trapped user with no keyboard exit is a dead end. |
| M4 | **Backdrop-click behavior defined** — clicking the backdrop either dismisses or is explicitly inert; not accidental. | Modal convention. | Ambiguous backdrop behavior loses in-progress input or traps the user. |
| M5 | **Focus management** — focus moves into the dialog on open and is restored on close (ideally trapped within). | WAI-ARIA dialog pattern. | Keyboard/AT users otherwise stay stranded behind the modal. |

**Current implementation:** M1 met — the shared `sheetStyles.modal` is centered (the 3 datasheet add-sheets: Add Inventory / Add Customer / Add Asset) AND the four former own-copy bottom-sheets are now centered too (OperatingCosts, ProjectsManager, InventoryCount, ConflictDialog — this pass). M2 met on the reference surfaces (Settings service editor, Add Inventory — the FIX 5 `validateXForm` + red-border + inline-message shape) and is the pattern other forms copy.

**Known gaps (on the board):** M3 (escape-to-close), M4 (defined backdrop behavior — inconsistent: some sheets dismiss on backdrop, some don't), and M5 (focus management / focus-trap) are NOT yet implemented platform-wide. They are honest amber/red on the compliance board — the next modal rung — not silently assumed done.

---

## 3. FIELD DISPLAY (editable vs system-managed)

Every field a grid or form displays MUST declare its editability honestly:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| F1 | **Editable fields show an edit affordance** — an input/control the user can obviously act on. | Direct-manipulation UI. | A field that IS editable must look it. |
| F2 | **System-managed / computed fields show a LOCKED affordance WITH explanation** — a clickable lock whose popover says WHAT sets the field and WHY it isn't editable. NEVER silently greyed, absent, or dead. | Read-only field affordances + Surface Honesty (D-9). | A non-editable field must read as "system-managed, with a reason," never as a broken/hidden edit. |
| F3 | **The locked set is a single canonical registry** — one source decides which fields lock, so every grid that shows a system field locks it identically. | Single-source-of-truth config. | Prevents the same field being editable on one grid and locked on another (drift). |

**Current implementation:** F1 met (inline cell inputs). F2 met — `DataSheet.tsx` renders a clickable 🔒 in the header of any system-managed column with a `position:fixed` explanation popover. F3 met — `systemManagedFields.ts` (`SYSTEM_MANAGED_FIELDS` + `lockInfoFor()`) is the SOLE source; keys match DB field names across the three configs, so one flat registry covers all grids.

**Deliberate exclusion (documented, not an oversight):** `cost_confidence` / `estimated_value_confidence` are derived-by-default BUT manually overridable on the reconcile grids → genuinely editable there → NOT auto-locked. A read-only surface can still force the lock per-column via `systemManaged: true`.

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| F4 | **A document field is a REFERENCE, not an upload target** — unless TRACE extracts data from the document, or is passing it through to the system that is its record. Otherwise the field holds a link/number + the facts we answer questions from, and the UI says whose copy is authoritative. | MASTER_BRIEF § *TRACE Is Not a Record System* (ruled 2026-07-29). | TRACE connects systems; it does not become the filing cabinet for someone else's paperwork. An upload control implies we are the record — a promise we then owe forever. |

**F4 applied (the two live cases):** the tax-exemption **certificate** is the customer's proof in the customer's own drive → the customer form holds `tax_exempt_cert_ref` + `tax_exempt_expires` and states so in copy; the upload shell was **removed, feature ruled out, not deferred**. A **receipt image** IS in transit (extract → QuickBooks) → staged, not stored, and the storage-vs-record inversion is tracked on the `user_stories.md` gap.

---

## 4. RECORD EDITING (one record, one edit surface)

Every record a user can edit MUST satisfy:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| E1 | **ONE RECORD, ONE EDIT SURFACE** — a given field of a record is editable in exactly ONE component. A second surface over the same record is a re-use of the first (mounted in context), never a second implementation. | STD-011 (one representation of one fact); the #119 "one customer form" pattern. | Two edit surfaces drift. The moment one gains a field or a rule, the other is quietly wrong, and nobody finds out from the code. |
| E2 | **ONE COMMIT MODEL PER SURFACE — the datasheet/form commit rule. THE SHAPE DECIDES, AND THE SHAPE IS THE UNIT OF WORK.** A **datasheet cell** commits immediately on change (per-cell write, no Save) — the CELL is the unit of work. A **panel where the WHOLE RECORD is the unit of work is a FORM**: it buffers every field and commits on ONE explicit Save. A surface applies its model to **every field group AND every mode** — **create and edit are the same record shape and MUST NOT differ in commit model.** | Spreadsheet vs. dialog conventions; users read the model once and generalize it. | A field group — or a mode — that commits differently from the surface around it loses data silently, because the user was told, correctly, how that surface saves. |
| E3 | **The copy states the model and the surface implements it** — "Changes save automatically" is a claim about every field on that surface, and it must be true of every field on that surface. | D-9 Surface Honesty. | Copy is the only place the commit model is visible. Copy that outruns the implementation is the most trusted lie on the screen. |
| E4 | **The unchanged-check reads the PERSISTED value, never the on-screen working copy.** A surface that keeps one state object for both is structurally incapable of detecting a change. | The two-value form pattern (working copy vs. last-saved). | Coercing against the working copy asks "does what I typed equal what I typed?" — always yes, always skip, and every field silently writes nothing. |
| E5 | **A write that changed nothing MUST NOT report success** — a mutation reports success only on evidence it landed (affected-row count), not merely on the absence of an error. | STD-023 (*a guard the write does not depend on is advice, not a gate*); tech-debt #74. | A PostgREST UPDATE matching zero rows returns NO error. Under a policy the caller can't satisfy, every save "succeeds" and nothing is written. |
| E6 | **One declarative field list per record — including the writers that have no UI.** The columns selected, the type, the editable set and the form's rendered groups derive from ONE source, not from lists hand-maintained in parallel. **This clause explicitly binds non-panel writers** (server-side resolvers, upsert helpers, ingest paths): they are OUT of E1/E2 **by rule, not by omission** — a machine writer has no shape, so the commit rule cannot apply to it — but they consume the SAME field list, because that is where their drift actually happens. | Single-source-of-truth config (the F3 pattern, applied to fields rather than locks). | Parallel field lists are how a field gets added to the form, the type and the grid — and missed in the select, so it silently reads back null. A machine writer with its own list is the same defect with no screen to notice it on. |

### E2 — the worked example (the case that makes the rule look inconsistent)

**Tier and Status are editable BOTH as roster grid cells AND as controls inside the customer form, and they commit differently in each. That is CORRECT, not a compromise.** On the grid the **cell** is the unit of work — the owner is re-tiering one customer in a list of many, and a Save button per row would be absurd. In the form the **record** is the unit of work — the owner opened one customer to revise it as a whole, and a half-applied revision is the thing to prevent. Same field, two commit models, **decided by where the user is standing.**

This is the example to reach for when E2 reads as self-contradictory: the rule is not "one model per field," it is **one model per surface, chosen by that surface's unit of work.**

### E2 — why one Save, and not per-field auto-save (recorded 2026-07-29)

Two consequences that are easy to miss, and that decided the ruling:

1. **Cancel currently implies discard and means "stop, keeping every write so far."** On a per-field auto-save panel there is **no way to back out of a partial edit** — the X reads as "discard my changes" and is in fact "commit everything up to here." Nobody had named this. One Save makes Cancel mean what the control has always looked like it means.
2. **One Save dissolves the atomic-write special case.** `commitExemption` exists ONLY because everything around it is per-field — the tax set has to be written as a unit, so it needed its own atomic path. Under one Save, **every** multi-field invariant is atomic by construction, and the special case stops being needed rather than being maintained.

**Current implementation (customers — the reference record):** E1 **NOT met** — `CustomerPartyEditor` is the one full editor (roster Add + roster Edit + `CustomerDetail` all mount it), but `CustomerEditModal` + `CustomerFields` are a SECOND 8-field editor (from `DeliverySchedule`) and `CustomerCapture` is a THIRD (checkout). **E2 NOT met** — corrected 2026-07-29, having been recorded as met **in error** the day before. The Tax group's own Save button was removed (a real fix, intra-mode), but the surface still carries **two commit models by MODE**: `mode='create'` buffers to one "Save Customer" INSERT, `mode='edit'` auto-saves per field — the same component, the same 18 fields, the same dialog, differing only by a prop. The original E2 text said "every field group," which is the loophole that admitted it; the rule now binds modes explicitly. E3 met. E4 met (`draft` working / `saved` persisted, split). E5 **NOT met anywhere** — no write on this record checks affected rows. E6 **NOT met** — **six** parallel field lists.

**Known gaps (on the board):** E1 (three editors), E2 (create vs. edit commit models), E5 (platform-wide — no mutation checks affected rows), E6 (six parallel field lists, incl. the non-panel `customerUpsert`). All KNOWN amber/red, not silently assumed done. **The ruled fix is ONE form component, one field list, one commit** — create and edit collapse, and E1 is satisfied rather than restated.

---

## 5. SECTION HEADERS (a header is a claim about every row beneath it)

**S1 — A SECTION HEADER'S CLAIM MUST HOLD FOR EVERY ROW THE SECTION CAN CURRENTLY CONTAIN.**
A header is not decoration; it is an assertion the reader applies to everything under it. If one row
contradicts it, the header is false for that row and the page has told the reader two things at once.

**Both directions are the same lie, and both have now happened on one screen (2026-08-02):**
- A header saying **"nothing to do"** above a row that HAS something to do.
  *Included* read *"Part of TRACE. No extra cost, nothing to buy"* directly above Contractors, which
  carried a `Turn on` button — and a green check, the glyph meaning *done*, beside it.
- A header **telling the reader to act** when nothing is left to act on, or when they may not.
  *Available* read *"Turn one on and it works immediately"* to a MANAGER, whose every row below read
  `Owner only`. The inverse of the first, on the same page, found by sweeping for the first.

**THEREFORE:**
1. **Enumerate the row states a section can hold, and check the header against each.** Not against
   the common case — against the ones the section can *currently* contain.
2. **A header whose claim is true only sometimes is CONDITIONAL, not approximate.** *Included*'s
   second sentence now appears only while an optional module is off; with nothing left to switch on
   it would be telling the owner to do something already done.
3. **Headers are permission-aware wherever they name an action**, because the same rows carry
   different controls for different roles (the six-state ruling, applied to copy).
4. 🔴 **A PER-ROW GLYPH MUST NOT RESTATE WHAT THE HEADER ALREADY SAID.** The header carries the
   section's shared fact; the glyph must carry what distinguishes THIS row — otherwise it is a second
   representation of one fact (**STD-011**), and the redundant copy is the one that goes wrong. On
   the Contractors card the check restated *included* (which the header had said) instead of carrying
   *on/off* (which only the row knew), and that is exactly why it could contradict the button.

**WHY THIS IS A STANDARD AND NOT A BUG REPORT:** the defect is the six-state ruling's own class —
*a control saying one thing while the state says another* — arriving in COPY rather than in a
control, and it appeared inside the first surface built under that ruling. Reviewing controls without
reviewing the sentences above them leaves half the surface unchecked.

**Enforcement:** review-only. No cap reads prose, and one that tried would be reading intent. The
mechanical half is the sweep: when a section gains a row state it did not have, re-read its header.

## 6. DATA READS (a failed read must not be indistinguishable from an empty one)

✅ **BINDING — ruled 2026-08-23, recorded here 2026-09-03. It read `DRAFT — DAVID RULES` for eleven days AFTER the ruling that settled it, and that staleness is itself the finding.**

David ruled it on **2026-08-23**, and the ruling did not merely approve the draft — it changed its
form: *"**READ HONESTY IS A TYPE, NOT A DISCIPLINE — THE DRAFT RULE IS RULED IN SHAPE, AND THE
SHAPE IS A DISCRIMINATED UNION**"* (`docs/RULINGS.md`, 2026-08-23). A rule enforced by the type
system cannot be forgotten by a tired author; a rule enforced by discipline can.

**It has SHIPPED in that shape since 2026-09-01** — `ReceiptsList.tsx` carries the three-arm union
verbatim (`{phase:'loading'} | {phase:'failed';message} | {phase:'loaded';model}`), with the reason
written beside it: *"a failed read that renders as 'no receipts' is a confident false statement
about the tenant's data."* The screen renders **"Could not read receipts — … This is a failed read,
NOT an empty list: how many receipts exist is unknown right now."**

🔴 **A DOC SECTION STILL READING `DRAFT — DAVID RULES` AFTER BOTH THE RULING AND THE BUILD THAT
SATISFIES IT IS [R-26] IN OUR OWN CORPUS** — a written declaration nobody checked against reality,
steering a decision. It would have told the next build that read-honesty was an open question it
could answer locally. **The R1/R2 counts below are UNCHANGED and still OWED** — 30 confirmed
instances, 9 HTTP-body sites, 7 auth reads — binding the rule does not repair the 30.

⚠️ **THE AUTH CARVE-OUT IS NOT RULED AND IS NOT SWEPT UP BY THIS** — see the sharp-edge note at the
end of this section. Binding R1/R2 does **not** decide `callerPermission.ts`.

**R1 — A READ WHOSE ERROR PATH RETURNS A VALUE MUST KEEP "FAILED" DISTINGUISHABLE FROM "EMPTY."**

A9 says *absent is not empty*. This is **A9 on the READ side**, where the platform never carried it:
the rule was enforced for what a surface DISPLAYS and never for what the code BELIEVES. A read that
fails and returns a fallback has not merely lost a value — **it has manufactured a fact**, and every
consumer downstream treats that fact as observed.

**The minimal form, and this is what makes it cheap enough to be real: it does NOT require knowing
the correct value. It requires only that information is not DESTROYED.** A read may legitimately
fail; it may legitimately return a default. **What it may not do is emit the same output for
"loaded and narrow," "absent," and "errored."**

**The two founding instances each take THREE distinct inputs and emit ONE output:**

| Site | loaded-and-narrow | absent | errored | emitted |
|---|---|---|---|---|
| `SocialSetup.tsx:67-74` | instagram-only config | no row | PostgREST error (`.catch` cannot see it) | `defaultChannels()` — instagram-only |
| `Campaigns.tsx:50-56` | tenant has no campaigns | RLS returned nothing | query errored | `[]` → "No campaigns yet" |

🔴 **WHY IT IS A RULE AND NOT TWO FIXES — the class was COUNTED, per #174: 30 confirmed instances,
a floor rather than a total (61 further sites match the shape and were not individually read).**
And the decisive result: **`readPricingConfig` ALREADY RETURNS `{ data, error }` CORRECTLY, and all
SEVEN of its callers destructure only `data` and throw the error away.** **The shared helper did the
right thing and every call site undid it — so a helper cannot fix this class, because the helper was
never the problem.**

**R2 — the same discipline applies to an HTTP body, and it is where the second error surface hides.**
`await res.json().catch(() => ({}))` **before** an `res.ok` check converts a platform-level failure
into an empty object, so the handler's own error and a Vercel timeout become one screen. **Nine
sites.**

**⚠️ AUTH READS ARE THE SHARP EDGE AND MAY WARRANT A DIFFERENT ANSWER — 7 sites, and
`callerPermission.ts:148` is a SECURITY path:** a failed `auth.getUser()` is indistinguishable from
*no user*. **That is #75's open ruling — a check whose error path is "allow" is not a check —
arriving at a second location.** Rule these together or rule them apart, but do not let one answer
be assumed for both.

**Enforcement:** review-only today. 🔴 **Unlike §5, this class IS mechanically detectable — the count
above was produced by four greps — so it is capable of being a cap.** None was built: minting one
before David rules answers a ruling with a constant (the #188 precedent). Full measurement, method,
and per-site listing: `docs/audits/social-campaign-path-recon-2026-08-22.md` → **THE COUNT**.

## System-managed field registry (the F2/F3 set — David to confirm)

The canonical locked set in `systemManagedFields.ts`, keyed by DB field name (a grid locks the field wherever it shows it):

| Field key | Label | What sets it / why locked |
|-----------|-------|---------------------------|
| `created_at` | Added | Set on row creation; records when the item appeared. |
| `updated_at` | Last touched | Bumped on every write; tracks the most recent edit. |
| `receipt_id` | Receipt | Linked by the receipt/invoice-scan flow; ties the row to its source receipt. |
| `source` | Source | Set from where the record entered — checkout, invoice scan, or by hand. |
| `qb_customer_id` | QuickBooks | Set by the QuickBooks sync; holds the QB id. |
| `id` | ID | System row identifier, assigned automatically. |
| `business_id` | Business | Owning business, set for tenant scoping. |

Per-grid coverage (locks the field only where that grid shows it as a column):
- **business_inventory** (`/inventory`): `created_at`, `updated_at`, `receipt_id`.
- **cost_objects / assets** (`/assets`): `created_at`, `updated_at` (shown), `id`/`business_id` (registry, not shown as columns).
- **customers** (`/customers`): `source`, `qb_customer_id`, `created_at`.

**Flagged for David (NOT locked — a decision, not an omission):** `customers.price_tier` is display-only in the grid today but is BUSINESS data (not system-written) → a candidate for future inline-edit, NOT a system lock. Left unlocked deliberately.

---

## How this is enforced

1. **Fix in the shared control → all consumers inherit.** A grid standard lands in `DataSheet.tsx`; a field-lock lands in `systemManagedFields.ts`; a modal convention lands in `sheetStyles.modal`. No per-consumer copies to keep in sync.
2. **The compliance board is glanceable.** [/ui-standards.html](../../ui-standards.html) renders control × standard from a manifest, so remaining gaps (escape/focus-trap/backdrop) are visible, not buried.
3. **New controls are measured here.** A new grid, modal, or form is checked against §1/§2/§3/§4 in its build (CLAUDE.md §1.6 gate item 5 — UI/modals). A control below the bar is a KNOWN amber/red row, reconciled or explicitly deferred — never a silent gap.
4. **A new edit surface is measured against §4 BEFORE it is written.** The question is not "is this component good?" but "does this record already have an edit surface?" — if it does, mount that one (E1). A build that adds a second editor for a record already covered is re-derivation, and it is caught here or not at all.

5. 🔴 **THE ORDER OF OPERATIONS — THE DESIGN DOC MOVES FIRST, THE WIDGET MOVES ONCE, THE SURFACES INHERIT (David, 2026-09-03).** When a display question is open, it is answered in exactly this order:

   **① THIS DOC IS UPDATED → ② THEN THE SHARED DISPLAY WIDGET IS UPDATED, ONCE → ③ SURFACES USE THE WIDGET.**

   **NOT:** each surface reasoning about the question separately. **This is the code-reuse rule (CLAUDE.md §6 r8, rule of three) applied to DESIGN** — the same operation settled in one place instead of drifting into near-duplicate answers per screen — and it is why the same display question must not be re-asked once it has been answered here.

   **AND THE CLAUSE THAT GIVES IT TEETH — A BUILD SPEC IS NOT A HIGHER AUTHORITY THAN THIS DOCUMENT.** Where a build prompt contradicts a filed standard, **the STANDARD WINS and the contradiction goes back to David as a question.** It is **never silently built either way** — not to the prompt, and not to the standard while the prompt says otherwise. A prompt that re-asks a settled display question is itself the defect: the answer is to amend the prompt and rerun it, not to build around it. (The instance: 2026-09-03, a receipts prompt asked David to re-rule list ordering and modal-vs-route, both of which the corpus had already settled — see the divergence report of that date.)

   ⚠️ **THE COROLLARY, AND IT IS THE HALF THAT ACTUALLY COSTS SOMETHING: WHERE THIS DOC IS SILENT, IT IS AMENDED BEFORE THE WIDGET IS TOUCHED — NOT AFTER, AND NOT INSTEAD.** A question this doc does not answer is a **gap in the standard**, and answering it in a component is how the next surface comes to re-derive it. Silence is not permission to decide locally.
