# DECISION — Cost Category dimension (Schedule C–aligned, QBO-mappable)
**Captured:** 2026-06-17
**Status:** Canonical. Adopt the standard (Schedule C / QBO chart-of-accounts), do not invent.
Foundation for the categorized P&L top block and the spreadsheet-grid view. Labor categories
(category=labor / contract-labor) live inside this dimension — see DECISION-labor-cost-model.md.

---

## WHY (don't reinvent the wheel)
Category is a REAL third dimension, distinct from what we already have:
- **nature** (CapEx / COGS / OpEx) ≈ the ACCOUNT-TYPE axis = HOW a cost is recovered / which report.
  (Already built, GAAP-grounded.)
- **shape** (one-time / recurring-fixed / per-occasion / …) = the cadence/structure axis. (Built.)
- **category** (labor / utilities / subscriptions / supplies / …) = WHAT the money was spent on =
  the P&L line-item axis. (NEW.)
These are orthogonal and all standard. A $100 software sub = nature:OpEx, shape:recurring_fixed,
category:software-subscriptions. The tractor = nature:CapEx, category:equipment.

## THE STANDARD (research-grounded)
- Expense categories are based on **IRS Schedule C** — the form every small business already files.
  QuickBooks categories map to Schedule C lines. Adopt this → aligned with BOTH the tax form AND QBO.
- **Target ~15–20 categories**, NOT 85. CPA guidance: most service businesses need 15–20 well-chosen
  categories; more = burden, fewer = useful detail gets lumped together and the P&L loses meaning.
  Narrow the standard list to the ~15–20 that fit the verticals (nursery / farm / trades).
- Categories are DATA (per-business, customizable), not hardcoded — AC-1. Seed with the standard
  ~15–20; allow add/merge (QBO supports custom + merge).

## CANDIDATE category set (~15–20, narrow to verticals — finalize at build)
Labor (Wages) · Contract labor (1099) · Software/subscriptions ("Apps/software/web services") ·
Utilities (electric/water/gas/internet) · Supplies · Materials/Inventory (COGS) · Rent/lease ·
Insurance · Taxes & licenses · Repairs & maintenance · Advertising/marketing · Vehicle/fuel ·
Professional fees (legal/CPA) · Bank/processing fees · Equipment (asset/CapEx) · Other.

## WHAT IT ENABLES
- Categorized P&L top block: group costs BY category → labor line, utilities line, subscriptions line,
  … → "money out" total → (later) money in / revenue → reconcile (net). This is how OWNERS see money,
  vs one blob "$12,279.67". Directly fixes the misleading single-number top block.
- Spreadsheet-grid: category becomes a column / a group-by axis.
- QBO transfer: category maps to QBO chart-of-accounts line by construction.

## BUILD
- Add `cost_category` to cost_objects (text, per-business value set seeded with the standard ~15–20,
  customizable; honest null/"Other" allowed). Robust shape now.
- Labor pulled in as category=labor / contract-labor (see labor-model doc).
- The categorized P&L top block and the grid build ON this dimension (sequenced after it exists).

## DEFERRED / NAMED
- Revenue / money-in / reconcile: needs a REVENUE input we don't capture yet — its own build, after
  category. The P&L is "money out" by category until revenue is modeled, then becomes full reconcile.
- Account-type rollup (Income/Expense/Asset/Liability/Equity) beyond nature: not needed yet; nature
  covers the expense/capex split we use.
