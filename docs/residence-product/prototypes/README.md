# Residence Product — Prototypes (REFERENCE ARTIFACTS, not wired)

These are clickable, in-memory, mocked-backend prototypes from the Lightning design
session. They are **reference only** — design intent made tangible, NOT app code.
Do **not** import or wire them into any package. When the residence product is built
for real, it is built fresh on the shared spine per `../RESIDENCE-PRODUCT-BUILD-PLAN.md`;
these files are the visual/interaction spec it builds toward.

- **KitchenLoop.jsx** — the tile. Tabs: This Week (calendar, past=history/future=editable),
  Capture (whiteboard reader), Recipes (+ technique notes, cumin ingredient-form demo),
  Pantry (+ shelf-scan), Orders (+ variant memory, farmers-market ZIP finder), Freezers,
  Costs (make-vs-buy), Health.
- **DeliveryVsDrive.jsx** — money-only vs money+time acquisition decision; verdict can flip.
- **SmartComparison.jsx** — database-smart vs assistant-smart, side by side (real ranch data).

Status: tsc-verified as standalone files at authoring time; NOT proven in the app
(BUILDER-COMPLETE ≠ OWNER-PROVEN).
