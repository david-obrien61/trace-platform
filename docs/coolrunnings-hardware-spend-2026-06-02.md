# CoolRunnings Hardware Spend — Liberty Hill Demo Environment
**Date:** 2026-06-02  
**Author:** Claude Code (read-only audit)  
**Status:** Consolidation complete — source files NOT modified  
**Scope:** All smart home hardware purchased or identified for the Liberty Hill demo install

---

## Sources Searched

| Source | Found | Smart Home Data |
|---|---|---|
| `CoolRunning/MASTER_BRIEF-2.md` | ✅ | Full installed hardware list (lines 283-303, 659-696); zero prices |
| `CoolRunning/BACKLOG.md` | ✅ | "Purchased & On-Hand" list; "To Purchase" with estimated prices |
| `CoolRunning/CLAUDE.md` | ✅ | Status notes; confirms Ecobee returned, meross in place |
| `CoolRunning/GEMINI.md` | ✅ | Confirms same hardware state as of May 7, 2026 |
| `Downloads/AmazonOrdersCoolRunning.pdf` | ✅ | 3 relevant orders with totals; items partially identified |
| `Downloads/Amazon.com : NSpanel pro 120.pdf` | ✅ | Confirms NSPanel Pro 120 = $129.90; cart visible in sidebar |
| `Downloads/Amazon.com : sonoff ifan04-h.pdf` | ✅ | Confirms iFAN04 = $19.90; MINI Duo-L = $21.90 in cart |
| `Downloads/Amazon.com : zbminil2.pdf` | ✅ | Confirms ZBMINIL2 = $19.90 |
| `Downloads/receipts.csv` | ✅ | GoDaddy domain purchases only — no hardware |

---

## Amazon Orders (Smart Home Hardware)

Three orders from April–May 2026 contain smart home hardware.

### Order 1 — May 5, 2026 — $43.08
**Order #114-5475872-2301835**

| Item | Qty | Unit | Total |
|---|---|---|---|
| SONOFF ZBMINIL2 Zigbee Smart Switch (no neutral) | 1 | ~$19.90 | ~$19.90 |
| SONOFF iFAN04 WiFi Fan Controller | 1 | ~$19.90 | ~$19.90 |
| Remaining (tax / cable accessory) | — | — | ~$3.28 |
| **Order total** | | | **$43.08** |

Unit prices confirmed from search PDFs (current listing prices). Remaining $3.28 likely sales tax or a small wiring accessory not captured in the PDF summary.

---

### Order 2 — May 5, 2026 — $417.31
**Order #114-2466808-9152255**

| Item | Qty | Unit | Total |
|---|---|---|---|
| SONOFF NSPanel Pro 120 (4.7" Zigbee control panel) | 2 | $129.90 | $259.80 |
| SONOFF MINI Duo-L (Zigbee dual switch, no neutral) | 3 | $21.90 | $65.70 |
| meross MTS300HK Smart Thermostat | 1 | ~$91.81 | ~$91.81 |
| **Order total** | | | **$417.31** |

NSPanel Pro and MINI Duo-L unit prices confirmed from search cart PDFs. meross price derived: $417.31 − $259.80 − $65.70 = $91.81.

---

### Order 3 — April 19, 2026 — $490.92 gross
**Order #112-4539097-0045019**

| Item | Qty | Unit Estimate | Total Estimate | Notes |
|---|---|---|---|---|
| SONOFF SNZB-02D Temp/Humidity Sensor (4-pack) | 2 packs | ~$52 | ~$104 | 8 sensors total; priced from market range for 4-pack |
| Eve Energy Smart Outlet (3-pack) | 2 packs | ~$78 | ~$156 | 6 outlets total; BACKLOG cites "Eve Energy 2-pack ~$65" |
| Ecobee Smart Thermostat | 1 | ~$160 | RETURNED | Return credit issued; net cost = $0 |
| DisplayPort adapter + non-hardware items | — | — | ~$30 | Not smart home hardware |
| **Net smart home spend from this order** | | | **~$260** | Gross $490.92 minus Ecobee return minus non-hardware |

Note: Per-item prices in this order are estimates. The Ecobee return was confirmed in CLAUDE.md and GEMINI.md. Actual return credit amount not confirmed — $160 is a typical Ecobee Smart Thermostat price.

---

## Full Hardware Inventory

### Installed — Prices Confirmed or Derived

| Item | Qty | Unit | Total | Confidence |
|---|---|---|---|---|
| SONOFF NSPanel Pro 120 | 2 | $129.90 | $259.80 | Confirmed — order + search PDF |
| SONOFF MINI Duo-L (Zigbee, no neutral) | 3 | $21.90 | $65.70 | Confirmed — order + cart in search PDF |
| meross MTS300HK Smart Thermostat | 1 | $91.81 | $91.81 | Derived from order total |
| SONOFF iFAN04 WiFi Fan Controller | 1 | $19.90 | $19.90 | Confirmed — order + search PDF |
| SONOFF ZBMINIL2 Zigbee Switch (no neutral) | 1 | $19.90 | $19.90 | Confirmed — order + search PDF |

### Installed — Estimated (from Order 3, complicated by Ecobee return)

| Item | Qty | Unit Estimate | Total Estimate | Basis |
|---|---|---|---|---|
| SONOFF SNZB-02D Temp/Humidity Sensor | 8 (2 4-packs) | ~$52/pack | ~$104 | Market rate for 4-pack |
| Eve Energy Smart Outlet | 6 (2 3-packs) | ~$78/pack | ~$156 | BACKLOG: "Eve Energy 2-pack ~$65" → scaled |

### Installed — COST UNKNOWN (no purchase record found)

| Item | Qty | Market Range | Notes |
|---|---|---|---|
| **HP ProDesk 600 G6** (Home Assistant server) | 1 | $200–$450 | Most expensive item in the build. No Amazon order, no receipt. Likely purchased used/refurbished. |
| HA Connect ZBT-2 Zigbee USB Coordinator | 2 | $20–30 ea / $40–60 | Listed in BACKLOG "Purchased & On-Hand." No Amazon order found in filtered PDF. |
| RAK7268 LoRa Gateway | 1 | $150–200 | Listed in MASTER_BRIEF. No purchase record in any searched file. |
| Apple TV (HomeKit hub) | 1 | $129+ | Listed in BACKLOG "Purchased & On-Hand." No order found — may be pre-existing household device. |
| Orbit B-hyve 12-station Irrigation Timer | 1 | $80–100 | Listed in MASTER_BRIEF. No Amazon order or receipt. |
| Irrigation manifold | 2 | $15–30 ea / $30–60 | Listed in MASTER_BRIEF alongside irrigation timer. No purchase record. |

### Status Conflict — Apollo MSR-2 mmWave Presence Sensor

**MASTER_BRIEF-2.md** (line ~290): Lists Apollo MSR-2 ×5 as **installed** hardware.  
**BACKLOG.md**: Lists Apollo MSR-2 under **"Under Consideration"** at $35–50 each.

These cannot both be correct. If installed: $175–$250 additional spend not captured anywhere. If still planned: not a cost yet.

**David must confirm:** Are the Apollo MSR-2 sensors physically installed at Liberty Hill or not?

---

## Spend Summary

### Confirmed + Estimated Amazon Smart Home Orders

| Order | Date | Smart Home Net |
|---|---|---|
| #114-5475872 | May 5, 2026 | $43.08 |
| #114-2466808 | May 5, 2026 | $417.31 |
| #112-4539097 | Apr 19, 2026 | ~$260 (net of Ecobee return) |
| **Amazon smart home subtotal** | | **~$720** |

### Full Picture with COST UNKNOWN Items

| Category | Low Estimate | High Estimate |
|---|---|---|
| Amazon confirmed/estimated smart home | $700 | $740 |
| HP ProDesk 600 G6 | $200 | $450 |
| ZBT-2 coordinators ×2 | $40 | $60 |
| RAK LoRa gateway | $150 | $200 |
| Apple TV | $0 (pre-existing) | $129 |
| Orbit irrigation + manifolds | $110 | $160 |
| **Total estimate** | **~$1,200** | **~$1,739** |

*Add $175–$250 if Apollo MSR-2 ×5 confirmed purchased.*

---

## Proposed Addition to `docs/trace-expenses.md`

> **DO NOT APPLY — proposed only. Source file not modified per audit scope.**

Add the following section after the existing May 12 cost audit entry:

```
### CoolRunnings Hardware — Liberty Hill Demo Environment
Audit date: 2026-06-02

**Confirmed Amazon Purchases (smart home hardware)**

| Item | Qty | Cost |
|---|---|---|
| SONOFF NSPanel Pro 120 | 2 | $259.80 |
| SONOFF MINI Duo-L (Zigbee) | 3 | $65.70 |
| meross MTS300HK Smart Thermostat | 1 | ~$91.81 |
| SONOFF iFAN04 WiFi Fan Controller | 1 | ~$19.90 |
| SONOFF ZBMINIL2 Zigbee Switch | 1 | ~$19.90 |
| SONOFF SNZB-02D 4-pack ×2 (8 sensors) | 2 packs | ~$104 |
| Eve Energy 3-Pack ×2 (6 outlets) | 2 packs | ~$156 |
| Subtotal — Amazon smart home | | **~$717** |

**Installed hardware with no purchase record**

| Item | Low Estimate |
|---|---|
| HP ProDesk 600 G6 (HA server) | $200 |
| HA Connect ZBT-2 ×2 | $40 |
| RAK LoRa Gateway | $150 |
| Apple TV (if purchased) | $0–$129 |
| Orbit irrigation + manifolds | $110 |
| Subtotal — COST UNKNOWN | **~$500–$629** |

**Total estimated hardware spend: $1,200–$1,346**
(+$175–$250 if Apollo MSR-2 ×5 confirmed purchased)
```

---

## Honest Assessment

**The current `trace-expenses.md` total of $329.68 does not include any hardware costs.** It was a cash flow audit only. The actual TRACE infrastructure investment at Liberty Hill is materially larger.

**Known floor (Amazon smart home orders only):** ~$720

**Conservative total including COST UNKNOWN items:** ~$1,200

**Realistic total:** $1,300–$1,600 depending on HP ProDesk sourcing and Apollo sensor status.

**The single biggest gap is the HP ProDesk 600 G6.** It is the server that runs everything — Home Assistant, Docker containers, all automation. It is also the most expensive individual item, likely $200–$450, and has zero cost documentation anywhere in any file searched.

### What's Still Missing

To close the gaps, check:

1. **HP ProDesk** — search credit/debit card or bank statements for a ~$200–450 computer purchase between February–April 2026. Could also be Craigslist or Facebook Marketplace cash purchase.
2. **ZBT-2 coordinators** — likely an Amazon order not in the filtered PDF; check full Amazon order history for "ZBT-2" or "Zigbee dongle".
3. **RAK LoRa gateway** — may be on rakwireless.com or a different Amazon account; check bank statements.
4. **Apple TV** — confirm whether this is a pre-existing household device (no cost to attribute) or a new purchase.
5. **Orbit irrigation** — likely Home Depot, Lowe's, or Amazon; check bank statements for ~$80–130 hardware store purchase.
6. **Apollo MSR-2** — David to confirm: installed or still planned?

---

*This document was produced as a read-only audit per CLAUDE.md Step 12.*  
*No files in `CoolRunning/`, `docs/trace-expenses.md`, or any other source were modified.*
