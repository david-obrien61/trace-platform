# Runbook: Conduit Margin Evidence Capture
**Date:** 2026-06-03  
**Type:** Discovery capture — first documented data point  
**Status:** Complete ✅

---

## What this runbook is

Process notes for the creation of `docs/discovery/conduit-margin-evidence-2026-06-03.md`. That file is the customer-facing artifact (well, internal-facing — the discovery document itself). This runbook captures the process, where source materials live, what this data point means for the Conduit thesis, and what next steps look like.

---

## What the discovery document captures

A receipt-level comparison between:
- Capital Land Design's full-service quote for a Liberty Hill residential masonry project (May 26, 2026): **$4,651.27**
- Actual cost when David self-supplied materials + used Juan for labor only: **~$2,022**
- Savings: **~$2,629 (57%)**

Key markup findings by line item:
- Mortar: **4.9×** markup on commodity price
- Cinder blocks: **3.7×**
- Concrete: **2.6×**
- Rebar: **2.1×**
- Sand (with delivery): **1.6×** — within normal contractor range

See the discovery document for full analysis.

---

## Where source receipts live

All source materials are in David's personal records:

- **McCoy's Building Supply receipt** — Liberty Hill store #117, June 1, 2026, $482.09. Itemized: rebar, concrete mix, hollow block, mortar mix, fuel surcharge.
- **Imperial Products Supply** — masonry sand + supersack delivery, $100 total ($70 sand + $30 container).
- **Capital Land Design quote** — dated May 26, 2026. Line-item quote document.
- **Juan's labor** — $1,400, verbal agreement. No invoice document (small operator, cash-likely).

These are not stored in the trace-platform repo. They're personal financial records. If the receipts are ever needed for a sales conversation or investor context, David has originals.

---

## Why this document exists (not just THOUGHTS.md)

This evidence is specific, quantitative, and reusable. It will likely come up in:
- Customer discovery conversations (showing this to prospects evaluating Conduit)
- Investor or partner conversations about Conduit's value proposition
- Internal product development (what the margin intelligence tile needs to show)
- Andrew's sales conversations if he's doing Liberty Hill-area prospecting

THOUGHTS.md is for strategic framing. A discovery document with actual numbers is the primary artifact for those conversations — it should be findable and citable independently of THOUGHTS.md narrative.

---

## What this data point proves (and doesn't prove)

**Supports:**
- Pricing inefficiency is real and documentable, not theoretical
- Markup varies dramatically by line item (4.9× on mortar vs. 1.6× on sand) — line-item visibility matters
- Small operators may systematically undersell their own work (Juan at $1,400 for skilled masonry)
- The knowledge asymmetry is worth ~57% of the invoice total

**Does not prove:**
- Industry-wide pattern — this is one project, one contractor, one market
- That contractor markup is uniformly unjustified — some markup is legitimate service value
- That all trades show similar variance — this data is masonry only

**Honest status:** First data point. Thesis is supported. Not validated at scale.

---

## What's needed to strengthen the thesis

To move from "supported" to "validated" requires 5–10 more documented comparisons:

1. Different trade categories — HVAC, electrical, roofing, plumbing, concrete/flatwork
2. Multiple regional markets — Liberty Hill results may not generalize to Austin, DFW, Houston
3. Supplier price data to build "typical markup range" reference tables (the hard problem — this is the competitive moat)
4. Customer interviews about how they currently evaluate quotes
5. Contractor interviews about their own pricing visibility and competitive pressure

**Next steps for additional discovery:**
- Andrew has existing relationships in trades/construction through prior work — these are warm entry points for interviews
- Whittlesey and 989rock serve the stone/aggregate market locally; worth understanding their wholesale vs. retail pricing
- McCoy's vs. Home Depot price comparison for commodity materials would start to build a reference table

---

## docs/discovery/ directory

This document created the `docs/discovery/` directory in the repo. Future files of this type — customer or market discovery artifacts that are specific, quantitative, and reusable — belong here.

Not for:
- General strategic framing (→ THOUGHTS.md)
- Customer ingest data (→ docs/customer-ingests/)
- Audit findings about the codebase (→ docs/audits/)
- Runbooks for setup operations (→ docs/runbooks/)

For:
- Documented comparisons with receipts or specific data
- Customer interview notes with specific quotes or data points
- Market research with specific numbers
- Any discovery artifact that will be cited in sales or product conversations

---

*Per CLAUDE.md Part 9, Step 12 (runbook capture).*
