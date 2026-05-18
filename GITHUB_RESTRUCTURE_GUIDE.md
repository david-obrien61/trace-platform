# TRACE Platform — GitHub Restructure Guide
**Solo builder edition · david-obrien61 · May 2026**
**Goal: One monorepo to rule them all. Existing repos imported. No code rewritten.**

---

## WHAT WE HAVE TODAY

| Repo | URL | Language | Status |
|---|---|---|---|
| ignition | github.com/david-obrien61/ignition | JavaScript | Ignition OS auto shop |
| CoolRunning | github.com/david-obrien61/CoolRunning | Python | Home automation |
| CAI | github.com/david-obrien61/CAI | JavaScript | Diesel shop app — 47 commits — most active |
| trace-assessment-app | github.com/david-obrien61/trace-assessment-app | — | CoolRunnings PWA — created May 14 |

## WHAT WE'RE BUILDING

```
github.com/david-obrien61/trace-platform    ← NEW — parent monorepo
├── packages/
│   ├── shared/          ← extracted reusable code from CAI + ignition
│   ├── ignition-os/     ← imported from ignition + CAI repos
│   ├── cultivar-os/     ← NEW — nursery SaaS
│   ├── coolrunnings/    ← imported from CoolRunning repo
│   └── assessment-app/  ← imported from trace-assessment-app
├── MASTER_BRIEF.md
├── CULTIVAR_OS_CLAUDE_CODE_BRIEF.md
└── README.md
```

## THE RULE BEFORE ANYTHING ELSE

**Do not delete or archive the existing repos yet.**
Keep them alive as backups until cultivar-os is demoed and working.
The monorepo imports copies — originals stay untouched.

---

## PHASE 1 — CREATE THE MONOREPO (30 minutes)

### Step 1 — Create trace-platform on GitHub

1. Go to github.com/david-obrien61
2. Click the **+** button top right → **New repository**
3. Repository name: `trace-platform`
4. Description: `TRACE Enterprises — Built with CAI platform monorepo`
5. Set to **Private** (you can make it public later)
6. Check **Add a README file**
7. Click **Create repository**

### Step 2 — Clone it to your computer

Open VS Code terminal (Ctrl+` or Terminal menu):

```bash
cd ~/Desktop
git clone https://github.com/david-obrien61/trace-platform
cd trace-platform
```

### Step 3 — Create the folder structure

```bash
mkdir -p packages/shared/src
mkdir -p packages/ignition-os
mkdir -p packages/cultivar-os/src
mkdir -p packages/coolrunnings
mkdir -p packages/assessment-app
```

### Step 4 — Add the top-level files

```bash
# Create root package.json for the monorepo
cat > package.json << 'EOF'
{
  "name": "trace-platform",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev:cultivar": "npm run dev --workspace=packages/cultivar-os",
    "dev:ignition": "npm run dev --workspace=packages/ignition-os",
    "build:cultivar": "npm run build --workspace=packages/cultivar-os",
    "build:ignition": "npm run build --workspace=packages/ignition-os"
  }
}
EOF

# Create root .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env.local
.env.*.local
dist/
.DS_Store
*.log
.vercel
EOF
```

### Step 5 — Add MASTER_BRIEF.md

Copy your existing MASTER_BRIEF.md into the trace-platform root folder.
If you don't have it locally, paste the contents and save as MASTER_BRIEF.md

```bash
# Then commit everything so far
git add .
git commit -m "Initialize trace-platform monorepo structure"
git push
```

---

## PHASE 2 — IMPORT EXISTING REPOS (Session 1 for Claude Code)

This is the most important step. Paste this entire prompt into Claude Code:

```
Read MASTER_BRIEF.md before we begin.

I have an existing GitHub account at github.com/david-obrien61 with these repos:
- david-obrien61/CAI (JavaScript — diesel shop app, 47 commits, most active)
- david-obrien61/ignition (JavaScript — Ignition OS)
- david-obrien61/CoolRunning (Python — home automation)
- david-obrien61/trace-assessment-app (CoolRunnings PWA)

We are building a new monorepo at david-obrien61/trace-platform.

Step 1 — Clone and audit CAI repo first (most code lives here):
git clone https://github.com/david-obrien61/CAI /tmp/cai-audit

Read every file in /tmp/cai-audit and produce this report:

SUPABASE:
- Does a Supabase client exist? Where?
- What tables are defined?
- Is there RLS/multi-tenant logic?

AUTH:
- How does login work?
- Is it PIN-based, email/password, or both?

QUICKBOOKS:
- Is there a QB integration? Which files?
- Does it create invoices? Sync payments?

STRIPE:
- Is there a billing module? Where?
- Does the trial engine (14-day clock + data blur) exist?

BARCODE/QR:
- Is there barcode scanning or QR generation code?
- Does it connect to a Brother or Zebra label printer?

COMPONENTS:
- List all reusable React/JS components
- Which are generic (Button, Card, Input) vs Ignition-specific?

AI ROUTER:
- Does AIEngine.js exist? What does it do?
- Does ai_router.py exist?

Step 2 — After the CAI audit, clone and audit ignition:
git clone https://github.com/david-obrien61/ignition /tmp/ignition-audit

Check what exists in ignition that does NOT exist in CAI.

Step 3 — Produce the final reuse map:

MOVE TO packages/shared/ (reusable by all projects):
- file → why it's shared

MOVE TO packages/ignition-os/ (Ignition specific):
- file → why it stays scoped

BUILD NEW for packages/cultivar-os/:
- module → why it doesn't exist yet

Step 4 — After I approve the reuse map, execute the imports:
- Copy shared code to packages/shared/src/
- Copy ignition code to packages/ignition-os/
- Update import paths where needed
- Commit: git commit -m "Import and organize existing codebases"

Do not build any Cultivar OS code until I approve the reuse map.
```

---

## PHASE 3 — WHAT CLAUDE CODE WILL FIND AND WHERE IT GOES

Based on the MASTER_BRIEF, here is what we expect to find and where it should land:

### Expected in CAI repo (47 commits — most complete)

```
CAI/
├── src/
│   ├── lib/
│   │   ├── AIEngine.js          → packages/shared/src/ai/router.js
│   │   ├── DataBridge.js        → packages/shared/src/supabase/bridge.js
│   │   └── MarginEngine.js      → packages/ignition-os/src/lib/margin.js
│   ├── components/
│   │   ├── [generic UI]         → packages/shared/src/components/
│   │   └── [ignition-specific]  → packages/ignition-os/src/components/
│   ├── pages/
│   │   └── [all pages]          → packages/ignition-os/src/pages/
│   └── api/
│       ├── quickbooks.py        → packages/shared/src/quickbooks/
│       ├── ai_router.py         → packages/shared/src/ai/
│       └── [ignition routes]    → packages/ignition-os/api/
```

### Expected in ignition repo

```
ignition/
└── [likely earlier version or specific tiles]
    → compare with CAI, take the newer version
```

### What definitely needs to be built new for Cultivar OS

```
packages/cultivar-os/src/
├── pages/
│   ├── PlantProfile.tsx    ← NEW — no equivalent in ignition
│   ├── AddOns.tsx          ← NEW — no equivalent in ignition
│   └── Dashboard.tsx       ← ADAPT from ignition dashboard
├── hooks/
│   ├── usePlant.ts         ← NEW
│   └── useCart.ts          ← NEW
└── api/
    └── plants.py           ← NEW
```

---

## PHASE 4 — SHARED PACKAGE STRUCTURE

After Claude Code completes the audit and import, packages/shared/ should look like this:

```
packages/shared/
├── package.json
└── src/
    ├── supabase/
    │   ├── client.js         ← Supabase singleton (from CAI)
    │   ├── auth.js           ← login, session, role check (from CAI)
    │   └── bridge.js         ← DataBridge.js — local-first sync (from CAI)
    ├── ai/
    │   ├── router.js         ← AIEngine.js (from CAI)
    │   └── ai_router.py      ← FastAPI AI router (from CAI)
    ├── quickbooks/
    │   ├── oauth.js          ← QB OAuth flow (from CAI)
    │   └── invoice.js        ← invoice creation (from CAI)
    ├── stripe/
    │   ├── billing.js        ← subscription management (from CAI)
    │   └── trial.js          ← 14-day clock + data blur (from CAI)
    ├── qr/
    │   ├── generate.js       ← QR/barcode generation (from CAI)
    │   └── print.js          ← label printer integration (from CAI)
    ├── notifications/
    │   ├── sms.js            ← Twilio (from CAI if exists)
    │   └── email.js          ← email integration (from CAI if exists)
    └── components/
        ├── Button.jsx        ← generic only (from CAI)
        ├── Card.jsx          ← generic only (from CAI)
        ├── Badge.jsx         ← generic only (from CAI)
        └── LoadingSpinner.jsx
```

### packages/shared/package.json

```json
{
  "name": "@trace/shared",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "exports": {
    "./supabase": "./src/supabase/client.js",
    "./auth": "./src/supabase/auth.js",
    "./quickbooks": "./src/quickbooks/oauth.js",
    "./stripe": "./src/stripe/billing.js",
    "./qr": "./src/qr/generate.js",
    "./components/*": "./src/components/*.jsx"
  }
}
```

### How Cultivar OS imports from shared

```javascript
// In packages/cultivar-os/src/lib/supabase.ts
import { createClient } from '@trace/shared/supabase'

// In packages/cultivar-os/src/hooks/usePlant.ts
import { supabase } from '@trace/shared/supabase'

// In packages/cultivar-os/api/orders.py
from shared.quickbooks.invoice import create_invoice
from shared.stripe.billing import create_subscription
```

---

## PHASE 5 — CULTIVAR OS SESSION PROMPTS (updated for real codebase)

Use these after Phase 2 is complete and shared/ is populated.

### Session 2 — Plant profile page

```
Read MASTER_BRIEF.md and CULTIVAR_OS_CLAUDE_CODE_BRIEF.md.

The shared/ package is now populated from our existing CAI codebase.
Build packages/cultivar-os/src/pages/PlantProfile.tsx

Requirements:
- Import Supabase client from @trace/shared/supabase
- Fetch plant by tagId from the plants table (public, no auth)
- Fetch plant_events for this plant ordered by occurred_at
- Display: species, container, price, install price, age (today - arrived_at)
- Show PlantTimeline component — one dot per event, container transition shown
- Show QtySelector component
- "Add to cart" button navigates to /plant/:tagId/addons
- Must work on mobile — 48px min button height
- Deploy to Vercel when done

Test URL: cultivar-os.app/plant/SCV-0031
```

### Session 3 — Add-ons screen

```
Read MASTER_BRIEF.md and CULTIVAR_OS_CLAUDE_CODE_BRIEF.md.

Build packages/cultivar-os/src/pages/AddOns.tsx

Requirements:
- Import Supabase client from @trace/shared/supabase
- Fetch addons from addons table filtered by nursery_id
- Show TransportToggle: "I'll transport myself" / "LAWNS is delivering"
- When transport=self: show NettingPrompt (red border, pre-checked, $10/tree)
  - Description: "Protects branches and bark on the drive home. Applied before loading."
- Show all addons where trigger_rule='always'
  - Compost pre-checked, description: "Best applied in the planting hole — right now, not later."
  - Fertilizer not pre-checked, description: "Goes in the planting hole — cannot add after planting."
- Cart state managed with Zustand store
- "Review my cart" navigates to /checkout/review
```

### Session 4 — Checkout + QB invoice

```
Read MASTER_BRIEF.md and CULTIVAR_OS_CLAUDE_CODE_BRIEF.md.

Build checkout flow AND QuickBooks integration.

Import QB functions from @trace/shared/quickbooks — DO NOT rewrite.
If QB integration doesn't exist in shared/ yet, build it there first.

Checkout flow:
1. CustomerCapture.tsx — name, email (required), phone, address (optional)
2. CartReview.tsx — line items, tax (8.25%), total
3. POST /api/order — creates order in Supabase + QB invoice in sandbox
4. Confirmation.tsx — "Invoice sent to your email"

QB invoice must appear in sandbox dashboard when order is submitted.
This is the demo moment — it must work perfectly.
```

### Session 5 — Owner dashboard

```
Read MASTER_BRIEF.md and CULTIVAR_OS_CLAUDE_CODE_BRIEF.md.

Build packages/cultivar-os/src/pages/Dashboard.tsx

Reuse auth from @trace/shared/auth — DO NOT rewrite login logic.
If auth pattern differs for nursery owners vs shop owners, add nursery role
to the existing role system — do not create a parallel system.

Dashboard shows:
- Total plants tracked
- Live inventory value (sum of base_price for status='available')
- Installs this week
- Today's sales
- Leakage alert if any orders flagged (leakage_flag=true)

Login: layna@lawnstrees.com (add to Supabase auth before demo)
```

---

## WHAT TO DO RIGHT NOW — ORDERED STEPS

### Today (15 minutes)
- [ ] Go to github.com/david-obrien61
- [ ] Create new repo: trace-platform (Private)
- [ ] Clone to Desktop: `git clone https://github.com/david-obrien61/trace-platform`
- [ ] Create folder structure (copy commands from Phase 1 above)
- [ ] Copy MASTER_BRIEF.md into root
- [ ] Copy CULTIVAR_OS_CLAUDE_CODE_BRIEF.md into root
- [ ] git add . && git commit -m "Initialize monorepo" && git push

### Saturday AM — before physical work (30 minutes)
- [ ] Open VS Code
- [ ] Open trace-platform folder
- [ ] Open Claude Code terminal
- [ ] Paste the Phase 2 Session 1 prompt (the big audit prompt above)
- [ ] Let Claude Code audit CAI and ignition repos
- [ ] Review and approve the reuse map
- [ ] Let Claude Code execute the import and populate shared/

### Saturday PM — after planting
- [ ] Session 2: Plant profile page
- [ ] Deploy to Vercel
- [ ] Test cultivar-os.app/plant/SCV-0031 on your phone

---

## IMPORTANT NOTES FOR CLAUDE CODE

Add these rules to every session prompt:

```
Rules for this session:
1. Before writing any new function, check if it exists in packages/shared/
2. If it exists in shared/ — import it, do not rewrite
3. If it needs to be shared — build it in packages/shared/ first, then import
4. Never modify packages/ignition-os/ code directly
5. Never duplicate a function that exists in shared/
6. After each completed task: git add . && git commit -m "task description"
7. If you find something in CAI or ignition that should move to shared/ — flag it before moving
```

---

## THE FOUR REPOS — FINAL DESTINATION

| Current repo | Becomes | Action |
|---|---|---|
| david-obrien61/CAI | packages/ignition-os + packages/shared | Import, organize, extract shared |
| david-obrien61/ignition | packages/ignition-os (merge with CAI) | Audit first — take newer version |
| david-obrien61/CoolRunning | packages/coolrunnings | Import as-is |
| david-obrien61/trace-assessment-app | packages/assessment-app | Import as-is |
| NEW | packages/cultivar-os | Build from brief |
| NEW | packages/shared | Extracted from CAI + ignition |

**Keep all four original repos alive until cultivar-os demo is complete.**
Archive them after the LAWNS meeting — not before.

---

*TRACE Enterprises · github.com/david-obrien61/trace-platform*
*Read this file at the start of every Claude Code session.*
