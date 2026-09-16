# RECON — do we receive and keep everything QuickBooks sends?

**Date:** 2026-09-16 (verified via `date`) · **Type:** recon, **report only — nothing changed in code, schema or data.**
**Source:** the three capture files in `~/Downloads`, realm `9341455222430707`, pulled 2026-09-10 — NOT the database:
`qbo-customers-…-2026-09-10T15-18-28-266Z.json` (1,959) · `qbo-invoices-…-2026-09-10T15-19-05-341Z.json` (1,496) · `qbo-items-…-2026-09-10T15-18-19-698Z.json` (673). Each file says `complete: true` and `expected_total == retrieved_total`.
**Code audited:** `origin/main` at `bb92786` — the same `packages/` code as David's tree at `9bf54b5`. The unmerged `feat/contact-record` branch renames the customer billing columns and changes nothing below.
**Method:** every leaf of every object was walked, arrays collapsed to `[]`, so the field list comes from the data rather than from a list somebody wrote. Each field was then traced through the code to where it ends up. Customer and invoice examples are masked with the platform's own `maskExample` (letters → `x`, digits after the third → `•`); item examples are the catalogue and are shown as-is.

> **The standard (David):** *"The findings report tells a customer what is in their books. If we are wrong about their own data, they will not trust us with the import or anything after it."*

**Status key**
- ✅ **LANDS** — written to a column, on every import.
- 🟡 **PARTIAL** — written only in some cases, or only for part of the population (named in the row).
- 📖 **READ, NOT STORED** — the code parses it, for the books report or for a decision, and it is never saved.
- ⚪ **DECLARED-IGNORED** — somebody wrote down that it is ignored, and why.
- 🔴 **UNREAD — UNDECLARED** — nobody decided. **This is the defect.**

🔴 **Nothing is kept verbatim.** `api/qbo/router.ts:428`: *"bodies go to the operator's own download folder and nowhere else."* A field no parser reads is not stored anywhere on the platform, so every 🔴 row below is data we do not keep, not data we keep but don't use.

---

## 1. THE QUERY — is the export everything QuickBooks holds, or everything we asked for?

**Everything we asked for. And what we ask for is less than everything, in three measurable ways and one that still needs checking.**

The capture files record their own queries (`packages/shared/src/quickbooks/qboRead.ts:123`, sent by `packages/cultivar-os/api/qbo/router.ts:503`):
```
select count(*) from <Entity>
select * from <Entity> startposition N maxresults 1000      &minorversion=65
```

**It is NOT a projection.** `select *` asks for the whole object, and every returned object carries `sparse: false` (Intuit's marker for "this is the full entity") — 1,959 / 1,496 / 673 of 1,959 / 1,496 / 673. **So within the rows returned, a missing field means the business doesn't use it — with one exception, `CustomField` (gap ④).**

**① 🔴 INACTIVE CUSTOMERS AND ITEMS ARE NEVER ASKED FOR, AND THE EXPORT CANNOT SHOW IT.** Intuit's query language quietly applies `Active = true` to list entities (customers and items) unless the query says `WHERE Active IN (true, false)`. Ours never says it. **The export: `Active = false` on 0 of 1,959 customers and 0 of 673 items.** And the count query gets the same filter, so `expected_total == retrieved_total` holds, and "complete: true" is true only about active records.
**Measured, not just inferred from the docs:** **30 invoice lines worth $25,022.50 point at 9 items that are NOT in the item export** — all nine show up on the invoice as `(deleted)`, which is how QuickBooks labels an item made inactive (`Oak:Lacey Oak 45G (deleted)` ×10, `Military Discount 5 (deleted)` ×7, `Oak:Lacey Oak 30G (deleted)` ×4, `NZCM30 (deleted)` ×3, and five more). **So the findings report sees sales of products it cannot find in the catalogue.**
For customers the same test comes back clean: **every `CustomerRef` on all 1,496 invoices is present in the customer export.** Inactive customers with no invoice in the window can't be counted from these files — that takes the query with the filter.

**② 🔴 WHOLE ENTITIES ARE NEVER QUERIED.** Only `Customer`, `Item` and `Invoice` are read. The invoices themselves point at the rest: **`LinkedTxn` on 1,430 invoices references `Estimate` and `Payment` records**, and one invoice is marked *"Canceled Order 9.4.2026 Refunded"* ($8,183.70, `3648.639`) whose refund must live in a `RefundReceipt` or `CreditMemo` — **neither is read, so that order counts as a sale.** The item list also names `Deposit`, `Credit` and `Bank Deposit/Customer Overpayment Refund`. `SalesReceipt`, `CreditMemo`, `RefundReceipt`, `Payment` and `Estimate` all hold sales facts the findings report currently can't see.

**③ 🟡 `minorversion=65` IS IGNORED BY INTUIT.** Since 2025-08-01, any minor version below 75 is ignored and the response is minor version 75. So the data we receive is v75 whatever we write, and the `65` in the code misdescribes the request. **Nothing is missing because of it** — but it is a written claim nothing checks, and the day Intuit moves the floor again it will be wrong without anyone noticing.

**④ ⚠️ UNVERIFIED — `CustomField` IS EMPTY ON ALL 1,496 INVOICES, AND THAT MAY BE THE QUERY.** QuickBooks has two custom-field systems. Custom fields created in the newer one (Settings → Custom Fields) are **not returned in the invoice `CustomField` array** unless the request adds `include=enhancedAllCustomFields`. Ours doesn't. **So an empty array can mean "LAWNS has no custom fields" or "we did not ask" — identical in the export, which is exactly the trap David named.** One screen settles it: does LAWNS's QuickBooks show any custom fields under Settings → Custom Fields? (`PrivateNote` carries *"Will Call Date Not Accurate"*, which reads like somebody tracking a date that has no field of its own.)

---

## 2. THE ANSWER IN ONE TABLE

| Entity | Fields in export | ✅ | 🟡 | 📖 | ⚪ | 🔴 undeclared | Is there a declaration at all? |
|---|---|---|---|---|---|---|---|
| **Customer (1,959)** | 56 | 14 | 3 | 0 | 26 | **13** | ✅ yes — `CUSTOMER_FIELD_MAP` + `CUSTOMER_IGNORED_SOURCE_FIELDS`, checked by the import preview |
| **Item (673)** | 27 | 4 | 1 | 5 | 0 | **17** | 🔴 **none** |
| **Invoice (1,496)** | 105 | 0 | 31 | 5 | 0 | **69** | 🔴 **none** |

**Of the three you named:** `QB type` → Item `Type`, 📖 parsed and dropped by the writer · `Mobile` → Customer, 🟡 fallback only, **15 different numbers dropped** · `ShipAddr.Line1/Line2/City/PostalCode` → Customer, 🔴 undeclared on purpose so the preview shows them, **imported by nothing**.

---

## 3. THE THREE TABLES

### 3a. Customer — 1,959 objects

| Field | Objects carrying it | Example | Status | Where it lands / why not |
|---|---|---|---|---|
| `Active` | 1,959 of 1,959 | `true` | ⚪ DECLARED-IGNORED | QuickBooks' own active flag. `customers.status` exists and nothing has ruled how the two reconcile — importing it would pick that ruling by accident. |
| `AlternatePhone.FreeFormNumber` | 2 of 1,959 | `(801) •••-••••` | ⚪ DECLARED-IGNORED | A second phone. `customers.phone` is single-valued; a second number needs a decision about which one a delivery calls. |
| `Balance` | 1,959 of 1,959 | `0` | ⚪ DECLARED-IGNORED | An accounts-receivable figure that belongs to QuickBooks and goes stale the moment it is copied. Read live, never stored. |
| `BalanceWithJobs` | 1,959 of 1,959 | `0` | ⚪ DECLARED-IGNORED | An accounts-receivable figure including sub-customer jobs. As Balance: it belongs to QuickBooks and goes stale the moment it is copied. |
| `BillAddr.City` | 1,425 of 1,959 | `xxxxxxx` | ✅ LANDS | `city` + mirror `billing_city` |
| `BillAddr.Country` | 50 of 1,959 | `United States` | ⚪ DECLARED-IGNORED | Single-country business. As CurrencyRef. |
| `BillAddr.CountrySubDivisionCode` | 1,114 of 1,959 | `Tx` | ✅ LANDS | `state` + mirror `billing_state` |
| `BillAddr.Id` | 1,623 of 1,959 | `1` | ⚪ DECLARED-IGNORED | Intuit's internal id for the address row. Not an address. |
| `BillAddr.Line1` | 1,460 of 1,959 | `122• xxxxxxxx xxxx` | 🟡 PARTIAL | `address_line1` + mirror `billing_line1` — **unless it holds a phone**, then it goes to `phone` if that is empty (`resolveBillingAddress`) |
| `BillAddr.Line2` | 477 of 1,959 | `270• xxxx xxxxxx xxxx` | 🟡 PARTIAL | **Read to decide which line is the street, never mapped.** Lands in `address_line1` only when `Line1` is a phone (≈457 of 477); otherwise dropped (suite / unit numbers). Not in the map, not declared → the preview audit flags it |
| `BillAddr.Line3` | 10 of 1,959 | `xxxxxxx, xx 786••` | 🔴 UNREAD — UNDECLARED | Nobody decided. 10 carry it (e.g. a city/state/zip line) |
| `BillAddr.PostalCode` | 1,126 of 1,959 | `786••` | ✅ LANDS | `zip` + mirror `billing_zip` |
| `BillWithParent` | 1,959 of 1,959 | `false` | ⚪ DECLARED-IGNORED | A billing-rollup preference that only means anything with the job hierarchy. |
| `CompanyName` | 571 of 1,959 | `x.x. xxxxxxxxxxx` | ✅ LANDS | `organization_name`; also decides `customer_type` |
| `CurrencyRef.name` | 1,959 of 1,959 | `United States Dollar` | ⚪ DECLARED-IGNORED | The display name of the currency. As CurrencyRef.value: a single-currency business, so a column for it would hold one value forever. |
| `CurrencyRef.value` | 1,959 of 1,959 | `USD` | ⚪ DECLARED-IGNORED | Single-currency business. A column for it would be a field with one value forever. |
| `CustomerTypeRef.value` | 34 of 1,959 | `614616` | 🔴 UNREAD — UNDECLARED | QuickBooks' own customer TYPE (2 values). Nobody decided |
| `DefaultTaxCodeRef.value` | 1,959 of 1,959 | `3` | ⚪ DECLARED-IGNORED | The COMPANY default tax code — "3" on all 1,946 records including every taxable one. `qboCustomerAdapter` refuses to read it and this is the same refusal, stated where a reader is asking why it is not imported. |
| `DisplayName` | 1,959 of 1,959 | `x xxxxxx` | ✅ LANDS | `display_name` |
| `domain` | 1,959 of 1,959 | `QBO` | ⚪ DECLARED-IGNORED | Always "QBO". A constant, not a fact about this customer. |
| `FamilyName` | 1,836 of 1,959 | `xxxxxx` | ✅ LANDS | `last_name` (persons only) |
| `Fax.FreeFormNumber` | 1 of 1,959 | `512 •••-••••` | ⚪ DECLARED-IGNORED | A fax number. No surface would show it. |
| `FullyQualifiedName` | 1,959 of 1,959 | `x xxxxxx` | ⚪ DECLARED-IGNORED | Declared ignored; used only as a last-resort name when `DisplayName` and `CompanyName` are both empty |
| `GivenName` | 1,905 of 1,959 | `x` | ✅ LANDS | `first_name` (persons only; NULL for organizations, David 2026-09-07) |
| `Id` | 1,959 of 1,959 | `40` | ✅ LANDS | `qb_customer_id` |
| `IsProject` | 1,959 of 1,959 | `false` | 🔴 UNREAD — UNDECLARED | Nobody decided (all `false` today) |
| `Job` | 1,959 of 1,959 | `false` | ⚪ DECLARED-IGNORED | Marks a sub-customer. The parent/child model is not built here; see ParentRef. |
| `MetaData.CreateTime` | 1,959 of 1,959 | `2025-08-23T15:10:07-07:00` | ⚪ DECLARED-IGNORED | When the row was made IN QUICKBOOKS. `customers.created_at` is when it was made HERE, and conflating them would date our record to a book we do not own. |
| `MetaData.LastUpdatedTime` | 1,959 of 1,959 | `2025-12-04T13:01:14-08:00` | ⚪ DECLARED-IGNORED | When the row last changed IN QUICKBOOKS. As MetaData.CreateTime: that is their clock, and `customers.updated_at` is ours. |
| `MiddleName` | 88 of 1,959 | `xxxx` | ⚪ DECLARED-IGNORED | No column. Folding it into first_name would change a name we display. |
| `Mobile.FreeFormNumber` | 704 of 1,959 | `(254) •••-••••` | 🟡 PARTIAL | `customers.phone` — **only when `PrimaryPhone` is empty.** Measured: 38 land · 651 equal `PrimaryPhone` (nothing lost) · **15 carry a DIFFERENT number and are dropped.** Declared as mapped, so the audit never flags it |
| `Notes` | 9 of 1,959 | `xxxx x xxxxx xxxx xx xxxx xx xxxxx xxxxx` | ✅ LANDS | `notes` |
| `PaymentMethodRef.value` | 31 of 1,959 | `3` | 🔴 UNREAD — UNDECLARED | Preferred payment method. Nobody decided |
| `PreferredDeliveryMethod` | 1,959 of 1,959 | `None` | ⚪ DECLARED-IGNORED | How Intuit sends the INVOICE (print/email/none). Not a delivery method for a truck, and naming it one is exactly the confusion to avoid. |
| `PrimaryEmailAddr.Address` | 1,736 of 1,959 | `xxxxxxx555@xxxxx.xxx` | ✅ LANDS | `email` |
| `PrimaryPhone.FreeFormNumber` | 1,448 of 1,959 | `(956) •••-••••` | ✅ LANDS | `customers.phone` (wins over `Mobile`) |
| `PrintOnCheckName` | 1,959 of 1,959 | `x xxxxxx` | ⚪ DECLARED-IGNORED | A cheque-printing preference. We do not print cheques. |
| `ResaleNum` | 9 of 1,959 | `174••••••••` | ✅ LANDS | `tax_exempt_cert_ref` — also updated on existing customers |
| `SalesTermRef.name` | 2 of 1,959 | `Due on receipt` | 🔴 UNREAD — UNDECLARED | Payment terms (Due on receipt / Net 30). Nobody decided |
| `SalesTermRef.value` | 2 of 1,959 | `1` | 🔴 UNREAD — UNDECLARED | As `SalesTermRef.name` |
| `ShipAddr.City` | 740 of 1,959 | `xxxxxx` | 🔴 UNREAD — UNDECLARED | As `ShipAddr.Line1` |
| `ShipAddr.Country` | 40 of 1,959 | `United States` | ⚪ DECLARED-IGNORED | Single-country business. As BillAddr.Country. |
| `ShipAddr.CountrySubDivisionCode` | 682 of 1,959 | `TX` | 🔴 UNREAD — UNDECLARED | As `ShipAddr.Line1` |
| `ShipAddr.Id` | 1,959 of 1,959 | `4` | ⚪ DECLARED-IGNORED | Intuit's internal id for the ship-to address row. Not an address, and not a key anything here could resolve. |
| `ShipAddr.Line1` | 766 of 1,959 | `(254) •••-••••` | 🔴 UNREAD — UNDECLARED | **Left undeclared ON PURPOSE** (`importFieldAudit.ts:191`) so the preview flags it — but **nothing imports it.** 766 carry it |
| `ShipAddr.Line2` | 478 of 1,959 | `270• xxxx xxxxxx xxxx` | 🔴 UNREAD — UNDECLARED | As `ShipAddr.Line1` — flagged by the preview, imported by nothing |
| `ShipAddr.Line3` | 10 of 1,959 | `xxxxxxx, xx 786••` | 🔴 UNREAD — UNDECLARED | Not in the "left on purpose" comment; nobody decided |
| `ShipAddr.PostalCode` | 689 of 1,959 | `787••` | 🔴 UNREAD — UNDECLARED | As `ShipAddr.Line1` |
| `sparse` | 1,959 of 1,959 | `false` | ⚪ DECLARED-IGNORED | Says whether Intuit sent a partial record, not anything about the customer. |
| `Suffix` | 1 of 1,959 | `Jr.` | ⚪ DECLARED-IGNORED | No column, and folding it into last_name would change a name we display. As MiddleName. |
| `SyncToken` | 1,959 of 1,959 | `0` | ⚪ DECLARED-IGNORED | Intuit optimistic-concurrency token. Meaningless outside QuickBooks. |
| `Taxable` | 1,959 of 1,959 | `true` | ✅ LANDS | `tax_exempt` (inverted, via `exemptionOf`) — also updated on existing customers |
| `TaxExemptionReasonId` | 27 of 1,959 | `9` | ✅ LANDS | `tax_exempt_reason` — also updated on existing customers |
| `Title` | 1 of 1,959 | `Mr` | ⚪ DECLARED-IGNORED | No column, and folding it into first_name would change a name we display. As MiddleName. |
| `V4IDPseudonym` | 1,959 of 1,959 | `002••••x••xx•••••••x••x•x•••x•xxxx•x•x` | 🔴 UNREAD — UNDECLARED | Intuit's pseudonymous id. Plumbing — but undeclared |
| `WebAddr.URI` | 2 of 1,959 | `xxxx://xxx.xxxxxxx.xxx` | ⚪ DECLARED-IGNORED | A website. No column, and no surface asks for one. |

### 3b. Item — 673 objects (635 sellable + 38 `Category` rows the import skips)

| Field | Objects carrying it | Example | Status | Where it lands / why not |
|---|---|---|---|---|
| `Active` | 673 of 673 | `true` | 📖 READ, NOT STORED | Parsed; not written. ⚠️ **And the query never asks for inactive items** — see §1 |
| `Description` | 623 of 673 | `Augur Holes, and install water monitor p` | ✅ LANDS | `description` verbatim; `name` and `size` are READ OUT OF IT (`readProductFromDescription`) → `name`, `size`, `unit_*` |
| `domain` | 673 of 673 | `QBO` | 🔴 UNREAD — UNDECLARED | Plumbing — no item declaration |
| `ExpenseAccountRef.name` | 27 of 673 | `Purchases` | 🔴 UNREAD — UNDECLARED | The COST account (27 items, "Purchases"). Nobody decided |
| `ExpenseAccountRef.value` | 27 of 673 | `101` | 🔴 UNREAD — UNDECLARED | As `ExpenseAccountRef.name` |
| `FullyQualifiedName` | 673 of 673 | `AH` | 📖 READ, NOT STORED | Carried as `fullyQualifiedName` for the import report; not written |
| `Id` | 673 of 673 | `102` | ✅ LANDS | `business_inventory.qb_item_id` |
| `IncomeAccountRef.name` | 635 of 673 | `Landscaping/Installation Services` | 📖 READ, NOT STORED | Read by the books report (`summariseItems` — "makes the Nursery-Stock/Services split real"); **not written.** Separates plants from fees — see §4 |
| `IncomeAccountRef.value` | 635 of 673 | `5` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `Level` | 551 of 673 | `1` | 🔴 UNREAD — UNDECLARED | Depth in the category tree. Nobody decided |
| `MetaData.CreateTime` | 673 of 673 | `2025-08-23T19:24:54-07:00` | 🔴 UNREAD — UNDECLARED | Plumbing — declared ignored for CUSTOMERS, but items have no declaration |
| `MetaData.LastUpdatedTime` | 673 of 673 | `2025-09-13T14:38:17-07:00` | 🔴 UNREAD — UNDECLARED | As `MetaData.CreateTime` |
| `Name` | 673 of 673 | `AH` | 🟡 PARTIAL | `name` **only when there is no Description** — otherwise the item code (`AP45`, `C45gal`) is kept nowhere |
| `ParentRef.name` | 551 of 673 | `Blackberry` | 🔴 UNREAD — UNDECLARED | **THE QUICKBOOKS CATEGORY** (`Oak`, `Holly`, `Fertilizer`, `Chemicals`…). 551 items. Nobody decided — see §4 |
| `ParentRef.value` | 551 of 673 | `1010000021` | 🔴 UNREAD — UNDECLARED | The category id. As `ParentRef.name` |
| `PurchaseCost` | 635 of 673 | `0` | 📖 READ, NOT STORED | Parsed for the report; not written (`unit_cost` exists). **0 on every item** in this export, so nothing is lost today |
| `PurchaseDesc` | 7 of 673 | `Greenleaf (5gal)` | 🔴 UNREAD — UNDECLARED | The purchase-side description — **names the VENDOR** (`Greenleaf (5gal)`, `Cedar Creek Farms (5gal)`). 7 items. Nobody decided |
| `Sku` | 1 of 673 | `CBBM1Y` | ✅ LANDS | `sku` (1 item carries one) |
| `sparse` | 673 of 673 | `false` | 🔴 UNREAD — UNDECLARED | Plumbing — no item declaration |
| `SubItem` | 551 of 673 | `true` | 🔴 UNREAD — UNDECLARED | Marks an item as belonging to a category. Nobody decided |
| `SyncToken` | 673 of 673 | `2` | 🔴 UNREAD — UNDECLARED | Plumbing — no item declaration |
| `Taxable` | 635 of 673 | `true` | 🔴 UNREAD — UNDECLARED | Whether the item is taxed. Nobody decided |
| `TaxClassificationRef.name` | 406 of 673 | `Optional shipping fees where ownership t` | 🔴 UNREAD — UNDECLARED | Intuit's tax category text. Nobody decided |
| `TaxClassificationRef.value` | 406 of 673 | `EUC-13010204-V1-00100000` | 🔴 UNREAD — UNDECLARED | As `TaxClassificationRef.name` |
| `TrackQtyOnHand` | 635 of 673 | `false` | 🔴 UNREAD — UNDECLARED | Whether QuickBooks tracks stock (false on all). Nobody decided |
| `Type` | 673 of 673 | `Service` | 📖 READ, NOT STORED | **THE "QB type" FIELD.** Parsed and carried as `qboType`; `Category` rows are skipped on it; then **`rowForItem` does not write it.** The 447 retired rows have it in `attributes` from an earlier importer; the 647 live rows do not. Nobody decided to drop it |
| `UnitPrice` | 635 of 673 | `5` | ✅ LANDS | `sell_price` (+ `price_basis = quickbooks_item_price`); never coerced to 0 |

### 3c. Invoice — 1,496 objects

⚠️ **Invoices reach the database only through delivery stops.** `deliveryIngestWriter` makes a stop for a **future** `ShipDate` (23 of 1,496 in this export); `historyOrderWriter` makes an order only for an invoice already tied to a stop. Everything else is read by the books report and kept nowhere. So even ✅-looking fields are 🟡 for invoices.

| Field | Objects carrying it | Example | Status | Where it lands / why not |
|---|---|---|---|---|
| `AllowIPNPayment` | 1,496 of 1,496 | `false` | 🔴 UNREAD — UNDECLARED | Online-payment switch. Nobody decided |
| `AllowOnlineACHPayment` | 1,496 of 1,496 | `true` | 🔴 UNREAD — UNDECLARED | As above |
| `AllowOnlineAffirmPayment` | 1,496 of 1,496 | `true` | 🔴 UNREAD — UNDECLARED | As above |
| `AllowOnlineCreditCardPayment` | 1,496 of 1,496 | `true` | 🔴 UNREAD — UNDECLARED | As above |
| `AllowOnlinePayment` | 1,496 of 1,496 | `true` | 🔴 UNREAD — UNDECLARED | As above |
| `AllowOnlinePayPalPayment` | 1,496 of 1,496 | `true` | 🔴 UNREAD — UNDECLARED | As above |
| `ApplyTaxAfterDiscount` | 1,496 of 1,496 | `false` | 🔴 UNREAD — UNDECLARED | Changes how tax is computed. Nobody decided |
| `Balance` | 1,496 of 1,496 | `2975` | 📖 READ, NOT STORED | Books report only (open balance: 12 invoices, $26,645.77) |
| `BillAddr.City` | 136 of 1,496 | `xxxxxxxxxx` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillAddr.Country` | 14 of 1,496 | `United States` | 🔴 UNREAD — UNDECLARED | Nobody decided (holds a PHONE on at least one invoice) |
| `BillAddr.CountrySubDivisionCode` | 134 of 1,496 | `TX` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillAddr.Id` | 1,388 of 1,496 | `3599` | 🔴 UNREAD — UNDECLARED | Plumbing — no invoice declaration |
| `BillAddr.Line1` | 1,295 of 1,496 | `(805) •••-••••` | 🟡 PARTIAL | Fallback for the stop address when ShipAddr is unusable (`parseShipTo`) — future-dated stops only |
| `BillAddr.Line2` | 1,244 of 1,496 | `280 xxxxxxx xxxxx xxxxxx` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillAddr.Line3` | 1,015 of 1,496 | `311• xxxxxxxxxx xxxx` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillAddr.Line4` | 608 of 1,496 | `xxxxxxxxx, xx  786••` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillAddr.Line5` | 44 of 1,496 | `xxxxxxxxxx, xx  786••` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillAddr.PostalCode` | 132 of 1,496 | `787••` | 🟡 PARTIAL | As `BillAddr.Line1` |
| `BillEmail.Address` | 1,393 of 1,496 | `xxxxxxxxxxx@xxxxxxx-xx.xxx` | 🔴 UNREAD — UNDECLARED | Where the invoice was emailed — **1,393 invoices**, can differ from the customer record. Nobody decided |
| `BillEmailBcc.Address` | 123 of 1,496 | `xxxxxxxxx@xxxxxxx.xxx` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `BillEmailCc.Address` | 18 of 1,496 | `xxxxxxxx@xxxxxxxxxxxxxxx.xxxxxxxx` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `CurrencyRef.name` | 1,496 of 1,496 | `United States Dollar` | 🔴 UNREAD — UNDECLARED | Constant — declared ignored for customers only |
| `CurrencyRef.value` | 1,496 of 1,496 | `USD` | 🔴 UNREAD — UNDECLARED | As above |
| `CustomerMemo.value` | 1,474 of 1,496 | `Thank you for your purchase today! Pleas` | 🔴 UNREAD — UNDECLARED | The message printed to the customer (11 distinct boilerplate texts). Nobody decided |
| `CustomerRef.name` | 1,496 of 1,496 | `xxxx xx xxxxxxx` | 🟡 PARTIAL | order `decoded.customerName` → `orders` / `order_items` (only for invoices already tied to a stop); stop matching |
| `CustomerRef.value` | 1,496 of 1,496 | `237` | 🟡 PARTIAL | Matches the invoice to a customer (stops, orders, books report); the id itself is not stored on the order |
| `CustomField[]` | 1,496 of 1,496 | *(empty array)* | 🔴 UNREAD — UNDECLARED | 🔴 **Empty on all 1,496 — possibly because we never asked** (§1) |
| `DeliveryInfo.DeliveryErrorType` | 11 of 1,496 | `Bounced Email` | 🔴 UNREAD — UNDECLARED | **Bounced Email / Undeliverable** — 11 invoices never reached the customer. Nobody decided |
| `DeliveryInfo.DeliveryTime` | 385 of 1,496 | `2026-09-09T20:58:01-07:00` | 🔴 UNREAD — UNDECLARED | As above |
| `DeliveryInfo.DeliveryType` | 391 of 1,496 | `Email` | 🔴 UNREAD — UNDECLARED | How the INVOICE was delivered (Email). Nobody decided |
| `Deposit` | 4 of 1,496 | `2000` | 🔴 UNREAD — UNDECLARED | A deposit taken on the invoice (4 invoices, up to $5,000). Nobody decided |
| `DepositToAccountRef.name` | 4 of 1,496 | `Chase Checking  (5866)` | 🔴 UNREAD — UNDECLARED | As `Deposit` |
| `DepositToAccountRef.value` | 4 of 1,496 | `12` | 🔴 UNREAD — UNDECLARED | As `Deposit` |
| `DocNumber` | 1,496 of 1,496 | `3648.670` | 🟡 PARTIAL | `orders.qb_doc_number` → `orders` / `order_items` (only for invoices already tied to a stop); into `deliveries.notes` text |
| `domain` | 1,496 of 1,496 | `QBO` | 🔴 UNREAD — UNDECLARED | Plumbing |
| `DueDate` | 1,496 of 1,496 | `2026-09-09` | 📖 READ, NOT STORED | Books report only |
| `EInvoiceStatus` | 388 of 1,496 | `Sent` | 🔴 UNREAD — UNDECLARED | Sent / Viewed / Paid. Nobody decided |
| `EmailStatus` | 1,496 of 1,496 | `xxxxxxxxx` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `FreeFormAddress` | 1,496 of 1,496 | `true` | 🔴 UNREAD — UNDECLARED | Says the addresses are free text (true/false). Nobody decided |
| `Id` | 1,496 of 1,496 | `10690` | 🟡 PARTIAL | `deliveries.qb_invoice_id` → `deliveries` (future-dated stops only: **23 of 1,496** in this export); `orders.qb_invoice_id` → `orders` / `order_items` (only for invoices already tied to a stop) |
| `Line[].Amount` | 1,496 of 1,496 (5,281 occurrences) | `1350` | 🟡 PARTIAL | `order_items` → `orders` / `order_items` (only for invoices already tied to a stop); books report |
| `Line[].CustomExtensions[]` | 1,496 of 1,496 (3,914 occurrences) | *(empty array)* | 🔴 UNREAD — UNDECLARED | Always empty here |
| `Line[].Description` | 1,496 of 1,496 (3,912 occurrences) | `Little Gem Magnolia - 30 gallon` | 🟡 PARTIAL | `order_items.description` → `orders` / `order_items` (only for invoices already tied to a stop); size and discount/install words read by the books report |
| `Line[].DetailType` | 1,496 of 1,496 (5,477 occurrences) | `SalesItemLineDetail` | 🟡 PARTIAL | Classifies each line (goods / discount / note / subtotal) for orders and the report |
| `Line[].DiscountLineDetail.DiscountAccountRef.name` | 67 of 1,496 | `Discounts given` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `Line[].DiscountLineDetail.DiscountAccountRef.value` | 67 of 1,496 | `92` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `Line[].DiscountLineDetail.DiscountPercent` | 61 of 1,496 | `10` | 📖 READ, NOT STORED | Books report only |
| `Line[].DiscountLineDetail.PercentBased` | 67 of 1,496 | `true` | 📖 READ, NOT STORED | Books report only |
| `Line[].Id` | 1,496 of 1,496 (3,914 occurrences) | `1` | 🔴 UNREAD — UNDECLARED | Intuit's line id — the only stable key for a line. Nobody decided |
| `Line[].LineNum` | 1,496 of 1,496 (3,914 occurrences) | `1` | 🔴 UNREAD — UNDECLARED | Line order. Nobody decided |
| `Line[].LinkedTxn[].TxnId` | 97 of 1,496 (369 occurrences) | `10635` | 🔴 UNREAD — UNDECLARED | Per-line estimate link. Nobody decided |
| `Line[].LinkedTxn[].TxnType` | 97 of 1,496 (369 occurrences) | `Estimate` | 🔴 UNREAD — UNDECLARED | As above |
| `Line[].SalesItemLineDetail.ItemAccountRef.name` | 1,488 of 1,496 (3,717 occurrences) | `Sales of Nursery Stock` | 📖 READ, NOT STORED | Books report only (the revenue bucket per line) |
| `Line[].SalesItemLineDetail.ItemAccountRef.value` | 1,488 of 1,496 (3,717 occurrences) | `94` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `Line[].SalesItemLineDetail.ItemRef.name` | 1,488 of 1,496 (3,717 occurrences) | `Magnolia:LGM30` | 🟡 PARTIAL | As `ItemRef.value` |
| `Line[].SalesItemLineDetail.ItemRef.value` | 1,488 of 1,496 (3,717 occurrences) | `770` | 🟡 PARTIAL | order line → catalogue anchor → `orders` / `order_items` (only for invoices already tied to a stop); books report |
| `Line[].SalesItemLineDetail.Qty` | 1,483 of 1,496 (3,695 occurrences) | `2` | 🟡 PARTIAL | `order_items.quantity` → `orders` / `order_items` (only for invoices already tied to a stop); books report |
| `Line[].SalesItemLineDetail.TaxClassificationRef.value` | 1,415 of 1,496 (3,417 occurrences) | `EUC-09020802-V1-00120000` | 🔴 UNREAD — UNDECLARED | Intuit's per-line tax category. Nobody decided |
| `Line[].SalesItemLineDetail.TaxCodeRef.value` | 1,488 of 1,496 (3,717 occurrences) | `TAX` | 🔴 UNREAD — UNDECLARED | 🔴 **Per-line TAX / NON** — 300 non-taxable lines. Orders are written with an invoice-level tax total only. Nobody decided |
| `Line[].SalesItemLineDetail.UnitPrice` | 1,468 of 1,496 (3,647 occurrences) | `675` | 🟡 PARTIAL | `order_items.unit_price` → `orders` / `order_items` (only for invoices already tied to a stop); books report |
| `LinkedTxn[]` | 66 of 1,496 | *(empty array)* | 🔴 UNREAD — UNDECLARED | Empty on 66. As above |
| `LinkedTxn[].TxnId` | 1,430 of 1,496 (1,705 occurrences) | `10635` | 🔴 UNREAD — UNDECLARED | 🔴 **Links to ESTIMATES and PAYMENTS** — 1,430 invoices. Neither entity is ever queried (§1). Nobody decided |
| `LinkedTxn[].TxnType` | 1,430 of 1,496 (1,705 occurrences) | `Estimate` | 🔴 UNREAD — UNDECLARED | As `LinkedTxn[].TxnId` |
| `MetaData.CreateTime` | 1,496 of 1,496 | `2026-09-09T14:10:09-07:00` | 🔴 UNREAD — UNDECLARED | Plumbing — no invoice declaration |
| `MetaData.LastModifiedByRef.value` | 1,496 of 1,496 | `9341455222415162` | 🔴 UNREAD — UNDECLARED | WHICH QUICKBOOKS USER last changed it (5 users). Nobody decided |
| `MetaData.LastUpdatedTime` | 1,496 of 1,496 | `2026-09-09T20:58:05-07:00` | 🔴 UNREAD — UNDECLARED | Plumbing — no invoice declaration |
| `PaymentMethodRef.name` | 13 of 1,496 | `ACH` | 🔴 UNREAD — UNDECLARED | ACH / Credit Card. Nobody decided |
| `PaymentMethodRef.value` | 13 of 1,496 | `6` | 🔴 UNREAD — UNDECLARED | As above |
| `PaymentRefNum` | 8 of 1,496 | `364•.•••` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `PrintStatus` | 1,496 of 1,496 | `NotSet` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `PrivateNote` | 31 of 1,496 | `xxxx xxxx xxxx xxx xxxxxxxx` | 🔴 UNREAD — UNDECLARED | 🔴 **THE ONLY VOID MARKER QUICKBOOKS SENDS** — `Voided` on 17 invoices (all $0, qty 0), `Canceled Order … Refunded` on one **$8,183.70** invoice the report counts as a sale, `Waiting For Permits`, `Will Call Date Not Accurate`. 31 invoices. Nobody decided |
| `SalesTermRef.name` | 1,464 of 1,496 | `Due on receipt` | 🔴 UNREAD — UNDECLARED | Payment terms (Due on receipt, Net 30, 50% Down). 1,464. Nobody decided |
| `SalesTermRef.value` | 1,464 of 1,496 | `1` | 🔴 UNREAD — UNDECLARED | As above |
| `ScheduledPaymentId` | 1 of 1,496 | `prd618020067613411` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `ShipAddr.City` | 75 of 1,496 | `xxx xxxxx` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipAddr.Country` | 1 of 1,496 | `(713) 960-3171` | 🔴 UNREAD — UNDECLARED | Nobody decided (holds a PHONE on its one invoice) |
| `ShipAddr.CountrySubDivisionCode` | 77 of 1,496 | `Tx` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipAddr.Id` | 1,059 of 1,496 | `7730` | 🔴 UNREAD — UNDECLARED | Plumbing — no invoice declaration |
| `ShipAddr.Line1` | 1,030 of 1,496 | `xxxx xx xxxxxxx` | 🟡 PARTIAL | Parsed line-by-line into the stop address (`parseShipTo`) → `deliveries` (future-dated stops only: **23 of 1,496** in this export) |
| `ShipAddr.Line2` | 909 of 1,496 | `xxxx xx xxxxxxx` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipAddr.Line3` | 817 of 1,496 | `xx  787••` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipAddr.Line4` | 657 of 1,496 | `xxxxxxxxxx, xx  786••` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipAddr.Line5` | 59 of 1,496 | `xxxxxxxxxx, xx  786••` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipAddr.PostalCode` | 80 of 1,496 | `787••` | 🟡 PARTIAL | As `ShipAddr.Line1` |
| `ShipDate` | 607 of 1,496 | `2026-09-13` | 🟡 PARTIAL | `deliveries.delivery_date` → `deliveries` (future-dated stops only: **23 of 1,496** in this export) |
| `ShipFromAddr.Id` | 10 of 1,496 | `729•` | 🔴 UNREAD — UNDECLARED | Nobody decided |
| `ShipFromAddr.Line1` | 10 of 1,496 | `400 xxxxxxxxx xxxx` | 🔴 UNREAD — UNDECLARED | The yard address shipped FROM (10). Nobody decided |
| `ShipFromAddr.Line2` | 10 of 1,496 | `xxxxxxx, xx 786••-••••` | 🔴 UNREAD — UNDECLARED | As above |
| `ShipMethodRef.name` | 179 of 1,496 | `M` | 🔴 UNREAD — UNDECLARED | 🔴 **WHO DELIVERED / WAS IT PICKED UP** — `Pick Up` 21, `Picked Up` 8, `Delivery` 17, `customer` 11, crew initials (`M` 83, `C` 12, `Mauro`, `Rommel`, `Terry`)… 179 invoices. Nobody decided — see §4 |
| `ShipMethodRef.value` | 179 of 1,496 | `M` | 🔴 UNREAD — UNDECLARED | As `ShipMethodRef.name` |
| `sparse` | 1,496 of 1,496 | `false` | 🔴 UNREAD — UNDECLARED | Plumbing |
| `SyncToken` | 1,496 of 1,496 | `2` | 🔴 UNREAD — UNDECLARED | Plumbing — no invoice declaration |
| `TaxExemptionRef.name` | 14 of 1,496 | `320••••••••` | 🔴 UNREAD — UNDECLARED | The exemption certificate number (14). Nobody decided |
| `TaxExemptionRef.value` | 91 of 1,496 | `3` | 🔴 UNREAD — UNDECLARED | 🔴 **The exemption applied to THIS sale** — 91 invoices. Nobody decided |
| `TotalAmt` | 1,496 of 1,496 | `2975` | 🟡 PARTIAL | order document total → `orders` / `order_items` (only for invoices already tied to a stop); books report |
| `TrackingNum` | 3 of 1,496 | `xxxxxx xx 2/4/2•••` | 🔴 UNREAD — UNDECLARED | `Picked Up 2/4/2026` — a fulfilment fact typed here. 3 invoices. Nobody decided |
| `TxnDate` | 1,496 of 1,496 | `2026-09-09` | 🟡 PARTIAL | order document date → `orders` / `order_items` (only for invoices already tied to a stop); books report |
| `TxnTaxDetail.TaxLine[].Amount` | 1,487 of 1,496 (2,332 occurrences) | `0` | 🔴 UNREAD — UNDECLARED | The per-rate tax breakdown (2% local / 6.25% state). Nobody decided |
| `TxnTaxDetail.TaxLine[].DetailType` | 1,487 of 1,496 (2,332 occurrences) | `TaxLineDetail` | 🔴 UNREAD — UNDECLARED | As above |
| `TxnTaxDetail.TaxLine[].TaxLineDetail.NetAmountTaxable` | 1,487 of 1,496 (2,332 occurrences) | `0` | 🔴 UNREAD — UNDECLARED | As above |
| `TxnTaxDetail.TaxLine[].TaxLineDetail.PercentBased` | 1,487 of 1,496 (2,332 occurrences) | `true` | 🔴 UNREAD — UNDECLARED | As above |
| `TxnTaxDetail.TaxLine[].TaxLineDetail.TaxPercent` | 1,487 of 1,496 (2,332 occurrences) | `2` | 🔴 UNREAD — UNDECLARED | As above |
| `TxnTaxDetail.TaxLine[].TaxLineDetail.TaxRateRef.value` | 1,487 of 1,496 (2,332 occurrences) | `6` | 🔴 UNREAD — UNDECLARED | As above |
| `TxnTaxDetail.TotalTax` | 1,496 of 1,496 | `0` | 🟡 PARTIAL | order tax → `orders` / `order_items` (only for invoices already tied to a stop) |
| `TxnTaxDetail.TxnTaxCodeRef.value` | 1,496 of 1,496 | `6` | 🔴 UNREAD — UNDECLARED | Which tax code the invoice used. Nobody decided |

---

## 4. WHAT THE UNDECLARED FIELDS WOULD HAVE ANSWERED

These are not plumbing. Each one is a question the platform currently says it cannot answer.

**① Plant vs material — QuickBooks already says, and we drop it.** The item export has **38 categories** (`Type = Category`) and **551 of 635 sellable items sit under one** (`ParentRef`): `Oak`, `Holly`, `Redbud`, `Crape Myrtle`… beside `Fertilizer`, `Chemicals`, `Service`. Separately, **`IncomeAccountRef` is on 635 items**: `Sales of Nursery Stock` 553 · `Sales of Product Income` 36 · `Landscaping/Installation Services` 23 · `Discounts given` 7 · `Income` 6 · `Delivery Income` 5 · and one each of `Late Fee Income`, `Refund`, `QuickBooks Payments Sales`, `COGS – Warranty Work`, `Add-On / Change Order Income`. **A discount, a late fee and a delivery charge are already told apart from a plant in their own books.** Neither field is stored (`ParentRef` is never read at all). ⚠️ **It is not a clean answer on its own** — `Type = Service` is used for 37 items under plant categories, 20 `Sales of Nursery Stock` items have no category, and `Fertilizer` appears under both income accounts — so it is **evidence the business owner could confirm**, not a column to trust blindly. This bears directly on the plant/material filing on branch `docs/plant-material-distinction` (not yet merged), which says *"nothing stored"*: true about our table, and **false about their books.**

**② Who delivered, and was it picked up.** `ShipMethodRef` on **179 invoices** holds free text: pick-up spellings (29), delivery spellings (22), `customer` (11), and crew initials or names (`M` 83, `C` 12, `Mauro`, `Rommel`, `Terry`, `Cuda`). `TrackingNum` carries *"Picked Up 2/4/2026"* on 3 more. The platform currently holds that **self-collect has no invoice line** — true about the lines, but on these 179 invoices the fact is **written elsewhere on the invoice and we don't read it.** It is typed inconsistently, so it is evidence, not a clean field.

**③ Voided and cancelled sales.** QuickBooks marks a void only in `PrivateNote` (`Voided`, **17 invoices**, all $0 and qty 0 — harmless to totals, but **counted as invoices**). The **$8,183.70** cancelled-and-refunded order (`3648.639`) has a full total and zero balance and **reads as paid revenue.**

**④ Per-line tax.** `TaxCodeRef` says **TAX or NON on every goods line — 300 are NON.** `TaxExemptionRef` names the exemption used on **91 invoices.** `TxnTaxDetail.TaxLine[]` splits the tax by rate (2% / 6.25%). We keep one tax total per order.

**⑤ Contact that never arrives.** `Mobile` — **15 customers carry a second, different number that is dropped** (the other 689 either land or equal `PrimaryPhone`). `ShipAddr` — **766 customers carry one; nothing imports it** (the preview flags it on purpose). `BillEmail` — **1,393 invoices** were emailed to an address that can differ from the customer record. `DeliveryInfo.DeliveryErrorType` — **11 invoices bounced or were undeliverable**, so the customer never received them.

**⑥ The item code and the vendor.** `Name` (`AP45`, `C45gal`) is kept only when there is no description, so the code LAWNS types into invoices is lost on 623 items. `PurchaseDesc` names the **vendor** on 7 items (`Greenleaf`, `Cedar Creek Farms`).

---

## 5. WHAT IS DECLARED, AND WHERE

- **Customers:** `packages/shared/src/quickbooks/importFieldAudit.ts` — `CUSTOMER_FIELD_MAP` (16 paths) + `CUSTOMER_IGNORED_SOURCE_FIELDS` (32 paths, each with a reason). The import preview runs `auditImportFields` over the raw records and **shows** any field that carries data and is in neither list. **This is the model the other two entities lack.**
  - ⚠️ **`Mobile` is declared as MAPPED, so the audit is silent about the 15 numbers it drops.** Being on the map does not mean being written: the adapter uses it only as a fallback.
  - ⚠️ **Six declared paths are absent from this export** — `ParentRef.value`, `Level`, `BillAddr.Lat/Long`, `ShipAddr.Lat/Long`. Harmless (the audit reports mapped paths nobody carries, not ignored ones), but the ignored list is describing records this pull doesn't contain.
- **Items: no declaration of any kind.** `itemList.parseItemList` reads 10 fields and `itemImportWriter.rowForItem` writes 5 of them (`Name` only as a fallback). Nothing flags the rest.
- **Invoices: no declaration of any kind,** and two independent parsers (`invoiceList.parseInvoiceList` for the books report, `shipmentIngest.parseShipmentList` for stops) read different subsets.

---

## 6. NEED / WANT — options (three-lens)

- **NEED (cheapest):** ① add `WHERE Active IN (true, false)` to the item and customer page queries **and** their count queries, and keep `Active`; ② run `auditImportFields` — the check already built and proven for customers — over items and invoices, with a declared-ignored list for each, so every field in §3 has an explicit decision. No schema change is needed to make the gap *visible*.
- **MIDDLE:** store the raw bodies (a capture table, or the file itself, per import run), so a field nobody has decided about is *kept* until somebody does. This turns every 🔴 row from "lost" into "not yet used."
- **WANT:** read the linked entities (`Estimate`, `Payment`, `SalesReceipt`, `CreditMemo`, `RefundReceipt`), ask for `include=enhancedAllCustomFields`, set `minorversion=75`, and give each 🔴 field a decision David owns.

**None taken.** Report only.
