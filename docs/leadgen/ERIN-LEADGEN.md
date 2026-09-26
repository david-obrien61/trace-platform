<!-- ────────────────────────────────────────────────────────────────────────────────────────
  FILED 2026-09-25 by HISTORY (ledger #418), on David's instruction, from his working tree.

  PROVENANCE: the text below is VERBATIM from `~/Desktop/trace-platform/docs/go-live/
  2026-09-18-lawns-reload-checklist.md`, which had been overwritten with this brief. It is filed
  here so it stops living in a file named after something else — the reload checklist itself is
  intact on `main` at that path and was not touched, and David's checkout was not modified.

  🔴 ONE THING IS MISSING AND IT IS NOT INVENTED HERE. David's instruction named "the version with
  the 'Connect to HubSpot — don't replace it' section". THIS VERSION HAS NO SUCH SECTION, and that
  phrase appears nowhere on the machine — not in his tree, not on the Desktop, not anywhere in git
  history. The only HubSpot text that exists is in a DIFFERENT document,
  `~/Desktop/Erin-campaigns-brief.md` ("ERIN'S MARKETING SERVICE — THE AGENCY DESIGN", v2
  2026-09-23), and it says something else entirely: that Mailchimp/HubSpot *agency accounts* are
  prior art for one-operator-many-clients access. That is not "connect, don't replace".

  So this file is the brief AS IT EXISTS. The missing section is recorded as an open question in
  MORNING-2026-09-26/HISTORY.md rather than reconstructed — writing a "Connect to HubSpot" section
  from the surrounding context would put words in David's mouth about a third-party integration,
  which is exactly the class R-26 exists for. Paste the section in and it belongs right here.
──────────────────────────────────────────────────────────────────────────────────────── -->

SESSION: ERIN-LEADGEN

Brief from David (2026-09-24). You are building the LEAD GENERATOR TILE for TRACE — a general tile any vertical can switch on, not a LAWNS-only feature. Work on your own branch; Connor reviews and merges. Read CLAUDE.md first and follow it (Rules 23–27; one heavy job at a time under ~/Desktop/trace-heavy.lock only if you share David's machine).

WHAT IT IS: one engine — FIND → QUALIFY → REACH → MEASURE — used for three kinds of list:
1. A business's OWN customers (first use: LAWNS offering a fertilising plan to people whose trees it planted; later: extended warranty when the 6-month warranty ends).
2. A business's TRADE prospects (e.g. landscapers; home builders with new subdivisions — visited by LAWNS's external sales, Tyler).
3. TRACE's own prospects (small businesses with obvious gaps — Andrew's list).
Industry standard to follow: the sales pipeline (lead → qualified → contacted → replied → converted / lost) with CAMPAIGN ATTRIBUTION (every message carries a campaign tag; every sale records its source). Model it that way; cite it in your design note.

PHASE 1 — build this first (no scraping yet):
- A PIPELINE board: leads in stages (the standard stages above), searchable, using the SHARED list/datasheet look and search — never a new list component.
- Lead source for phase 1: a business's existing customers, filtered (e.g. "customers LAWNS planted for in the last 12 months, by town"). Names always through the shared customerDisplayName().
- A CAMPAIGN: name, offer, message template, audience. Messages are tailored per lead from its data (their tree, size, town).
- REACH without cost or keys: the message opens pre-filled in the user's own phone Messages (sms: link) or mail app (mailto:), reusing the existing route-handoff pattern. TRACE cannot know it was sent — record "opened", never "sent".
- ATTRIBUTION: every message carries a campaign code; checkout/orders record the campaign when a lead buys (coordinate this touchpoint with Connor — it touches checkout, which the core team owns).
- SCOREBOARD per campaign: leads · contacted · replied · converted · revenue. The number David wants: "we sent 5, 2 replied, 1 bought, $X."
- Opt-out respected per lead (a lead who says no is never messaged again); email carries the sender's business name, address and an opt-out line (US CAN-SPAM).

PHASE 2 — later, after the core team lifts these into packages/shared (DO NOT build them yourself):
- Business DISCOVERY (Andrew's scraper — Google Maps listings by area) and WEBSITE ANALYSIS (reviews, mobile, online booking → "what's missing" + a suggested opening line), as shared server-side services.
- Location / address lookup (being built now by the core team).
Design phase 1 so a phase-2 source is just another "lead source" plugging into the same pipeline.

HARD RULES:
- You NEVER hold or see an API key. Anything calling an outside service goes through an existing TRACE server endpoint; api/ is capped at 12 functions by David's choice — no new endpoint files.
- Multi-tenant: every row carries business_id; access via explicit permission strings (propose new ones, e.g. leads:read / leads:update / campaigns:send — Connor confirms).
- Reuse, don't copy: shared list/datasheet, shared search, customerDisplayName(), the sms:/mailto: handoff. If you need something that exists in a vertical, ask Connor to lift it into shared rather than copying it.
- Test mode: nothing you do in test mode reaches a real customer.
- Never paste customer data into a chat.

FIRST DELIVERABLE (report back before building): a one-page design note — the tables you'd add, the screens (pipeline, campaign, scoreboard), which shared pieces you reuse, the attribution touchpoint with checkout, and the permission strings. Connor and David approve it; then build phase 1.
