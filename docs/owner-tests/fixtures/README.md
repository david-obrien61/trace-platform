# Owner-test fixtures — FABRICATED DATA

Everything in this directory is **fabricated test data**. It describes no real grower,
no real price list, and no real stock. It exists only to exercise the CSV catalog-import
surface end to end.

## `test-grower-pricelist-FIXTURE.csv`

A deliberately messy grower price list. Byte-for-byte it contains, on purpose:

- a **UTF-8 BOM** and **CRLF** line endings
- a header (`Ready`) that is **not** a recognised synonym — it must fall to L3 value-inference
- a `Cont.` column that **is** a size synonym
- a `Wholesale` column that is **currency-shaped but load-bearing** — held in the attribute
  bag and flagged "looks like a real field; nothing computes on it"
- five descriptive unmapped columns (`Sun`, `Height`, `Spread`, `Notes`, `Zone`) → the bag
- a **possessive** name (`Basham's …`) and an **apostrophe** name (`Hearts A'fire …`)
- a **wrapping-quoted** name (`'Sierra' Mexican Red Oak`)
- a **size-less row in a multi-size family** (`Alley Cat`) → held AMBIGUOUS
- a **counted-lot conflict** row (`Shoal Creek Vitex`, qty 99) → held, never overwrites by default
- **`$0.00` and blank** prices → both resolve to UNKNOWN (null), never `0`
- a **missing qty** and **missing SKU** row
- a quoted field with an **embedded comma** (`Full sun, part shade`)
- a quoted field with an **embedded newline** (`'Sierra'` Notes)
- a name with **leading/trailing whitespace** (`  Shoal Creek Vitex  `)
- a **blank line** mid-file

The variety names match the ones the owner-test cards (`docs/owner-tests/inventory-full-surface-test.md`
→ `## SURFACE: csv-import`) reference, so the live run resolves them against LAWNS's real
catalog. If David places his own fixture, it should replace this one and preserve these cases.
