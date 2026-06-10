# Runbook: Start a New TRACE Vertical From Scratch

**Purpose:** Complete checklist for standing up a new vertical — from zero to deployed, isolated,
auto-deploying, and ready to write business logic.

**Date first written:** 2026-05-28  
**Estimated time:** 60–90 minutes for the scaffold. Zero time guessing.

**What this covers:**
- Creating the monorepo package
- Supabase project (isolated, never shared)
- RLS from day one (not retrofitted)
- Vercel project + GitHub auto-deploy
- TenantProvider pattern
- First deploy verification

**What this does NOT cover:**
- Promoting an existing single-tenant vertical to multi-tenant → see `runbook-make-a-vertical-multi-tenant.md`
- Business logic — this ends at a working shell with auth, DB, and deploy working

---

## DECISIONS BEFORE YOU WRITE A LINE OF CODE

Answer these before touching the keyboard:

| Question | Why it matters |
|---|---|
| What is the vertical name? (`conduit-os`, `kinna-os`, etc.) | Used everywhere — package name, folder, Supabase project, Vercel project, env vars |
| What is the tenant root table? (`shops`, `organizations`, `nurseries`) | Every RLS policy chains to this |
| What auth model? (email/password for multi-tenant; PIN-only only for single-device single-shop) | Determines TenantProvider shape and whether RLS is even possible |
| Does it need QuickBooks? | Adds QBO env vars and oauth callback |
| Does it need AI features at launch? | If yes, plan the Vercel functions before writing the modules |

**Rule:** Every new vertical that handles data for more than one customer uses email/password →
Supabase Auth → `auth.uid()` → `owner_id` isolation. PIN-only is locked to Ignition OS
single-device use case. Do not extend it.

---

## STEP 1 — Create the Monorepo Package

```bash
# From trace-platform/ root
mkdir -p packages/<vertical-name>/modules
mkdir -p packages/<vertical-name>/stubs
mkdir -p packages/<vertical-name>/api
mkdir -p packages/<vertical-name>/src/context
mkdir -p packages/<vertical-name>/src/pages
mkdir -p packages/<vertical-name>/src/hooks
```

### 1a. package.json

```json
{
  "name": "@trace/<vertical-name>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@trace/shared": "*",
    "@supabase/supabase-js": "^2.105.1",
    "lucide-react": "^1.8.0",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "vite": "^8.0.0"
  }
}
```

Add any vertical-specific deps (e.g., `react-native-web` for Ignition OS, `qrcode.react` for
Cultivar). Keep it minimal — every dep is a future maintenance burden.

### 1b. vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175, // increment per vertical: cultivar=5173, ignition=5174, next=5175
    strictPort: true,
  },
  resolve: {
    alias: {
      '@trace/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
```

If the vertical has React Native source files (migrating from mobile): copy the full alias block
from `packages/ignition-os/vite.config.js` and its `stubs/` directory.

### 1c. index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><Vertical Name></title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

### 1d. main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### 1e. Wire into root monorepo

In `trace-platform/package.json`, add:
```json
"dev:<vertical>": "npm run dev --workspace=packages/<vertical-name>",
"build:<vertical>": "npm run build --workspace=packages/<vertical-name>"
```

Then run from repo root:
```bash
npm install
```

### 1f. Verify build

```bash
cd packages/<vertical-name>
npx vite build
```

Must produce zero errors before moving to Step 2. A broken build before any business logic means
the scaffold itself is wrong. Fix it now.

---

## STEP 2 — Create the Supabase Project

**Rule: One Supabase project per vertical. Never share.**

Sharing a Supabase project between verticals means auth users, RLS policies, and data are
co-mingled. A misconfigured policy on one vertical can expose the other's data.

### 2a. Create the project

1. Supabase dashboard → New Project
2. Name: `<vertical-name>` (e.g., `conduit-os`)
3. Region: `us-east-1` (consistent with existing projects)
4. Get from Settings → API:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_KEY` (server-side only, never in browser)

### 2b. Auth settings

Settings → Authentication → Email:
- **Email confirmations: OFF** (confirm you want this — speeds up dev; enable before public launch)
- **Minimum password length:** 8+

### 2c. Write the initial migration

Create `packages/<vertical-name>/supabase/migrations/001_initial_schema.sql`.

**Template — copy and fill in:**

```sql
-- ============================================================
-- MIGRATION: 001_initial_schema
-- Vertical: <vertical-name>
-- Date: <YYYY-MM-DD>
-- ============================================================

-- ── Tenant root table ────────────────────────────────────────
-- One row per business. owner_id ties to Supabase auth.users.
CREATE TABLE IF NOT EXISTS <tenant_table> (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid REFERENCES auth.users(id),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Enable RLS on EVERY table at creation time ───────────────
-- Never create a table without immediately enabling RLS.
-- A table with RLS disabled is open to all authenticated users.
ALTER TABLE <tenant_table> ENABLE ROW LEVEL SECURITY;

-- ── RLS policies — tenant root table ─────────────────────────
-- SELECT: owner can read their own row
CREATE POLICY "owner_select_<tenant_table>"
  ON <tenant_table> FOR SELECT
  USING (owner_id = auth.uid());

-- INSERT: authenticated user can insert (sets owner_id in app code)
CREATE POLICY "authenticated_insert_<tenant_table>"
  ON <tenant_table> FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: owner can update their own row
CREATE POLICY "owner_update_<tenant_table>"
  ON <tenant_table> FOR UPDATE
  USING (owner_id = auth.uid());
```

**For every child table, add:**

```sql
CREATE TABLE IF NOT EXISTS <child_table> (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  <tenant_id_col> uuid NOT NULL REFERENCES <tenant_table>(id) ON DELETE CASCADE,
  -- ... other columns
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE <child_table> ENABLE ROW LEVEL SECURITY;

-- SELECT: join through tenant table to confirm ownership
CREATE POLICY "owner_select_<child_table>"
  ON <child_table> FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM <tenant_table>
      WHERE <tenant_table>.id = <child_table>.<tenant_id_col>
        AND <tenant_table>.owner_id = auth.uid()
    )
  );

-- INSERT: same ownership check
CREATE POLICY "owner_insert_<child_table>"
  ON <child_table> FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM <tenant_table>
      WHERE <tenant_table>.id = <child_table>.<tenant_id_col>
        AND <tenant_table>.owner_id = auth.uid()
    )
  );
```

### 2d. Apply the migration

Paste the SQL into Supabase SQL editor → Run.

**Never run migrations from `psql` directly against the prod Supabase URL — always through the
dashboard SQL editor for visibility and audit trail.**

### 2e. Verify RLS is active

In Supabase SQL editor:

```sql
-- Must return 'on' for every table you just created
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Any table showing `f` (off) is a bug. Fix it before writing any application code.

---

## STEP 3 — Create the Vercel Project

### 3a. Create the project

1. Vercel dashboard → Add New Project → Import `david-obrien61/trace-platform`
2. **Root Directory:** leave blank (repo root)
3. **Build Command (override):** `npm run build:<vertical-name>`
4. **Output Directory (override):** `packages/<vertical-name>/dist`
5. **Framework Preset:** Other (do not let Vercel auto-detect — the root package.json doesn't have a default build)

### 3b. Environment variables

Add at minimum:

```
VITE_SUPABASE_URL      = <project URL from Step 2a>
VITE_SUPABASE_ANON_KEY = <anon key from Step 2a>
SUPABASE_SERVICE_KEY   = <service key from Step 2a>
SUPABASE_URL           = <project URL from Step 2a>
```

Add vertical-specific keys (QBO, Blotato, AI keys) as needed.

**VITE_ prefix = exposed to browser bundle. Never put SERVICE_KEY or secret keys with VITE_ prefix.**

### 3c. Connect GitHub

Settings → Git → Connect to `david-obrien61/trace-platform`, branch `main`.

Every push to `main` now auto-deploys this vertical.

### 3d. Note the deployed URL

Format: `<project-name>.vercel.app`. Add a custom domain later (GoDaddy → Vercel DNS).

---

## STEP 4 — Core App Scaffold

These four files are required before any business logic works.

### 4a. Supabase re-export

`packages/<vertical-name>/supabase.ts`:

```typescript
// Re-export from shared — reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
export { supabase } from '../shared/src/supabase/client';
```

### 4b. TenantProvider

`packages/<vertical-name>/src/context/TenantProvider.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../supabase';

interface TenantContextValue {
  tenantId: string | null;
  tenantError: string | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: null,
  tenantError: null,
  loading: true,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId]     = useState<string | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          setTenantId(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('<tenant_table>')
          .select('id')
          .eq('owner_id', session.user.id)
          .single();

        if (error || !data) {
          setTenantError('Account not linked to a <tenant>. Contact support.');
          setTenantId(null);
        } else {
          setTenantId(data.id);
          setTenantError(null);
        }
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, tenantError, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
```

Replace `<tenant_table>` and `<tenant>` with your vertical's root table name.

### 4c. App shell

`packages/<vertical-name>/src/App.tsx`:

```tsx
import React from 'react';
import { TenantProvider, useTenant } from './context/TenantProvider';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

function AppContent() {
  const { tenantId, tenantError, loading } = useTenant();

  if (loading) return <div className="p-8 text-center">Loading…</div>;
  if (tenantError) return <div className="p-8 text-red-500">{tenantError}</div>;
  if (!tenantId) return <LoginPage />;
  return <Dashboard />;
}

export default function App() {
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  );
}
```

### 4d. Stub pages (enough to build)

`packages/<vertical-name>/src/pages/LoginPage.tsx` and `Dashboard.tsx` — minimal stubs that
import from `@trace/shared` for auth and components. Replace with real pages as you build.

---

## STEP 5 — First Deploy Gate

Do not write business logic until this gate passes.

### 5a. Local build

```bash
cd packages/<vertical-name>
npx vite build
# Must: zero errors, dist/ folder created
```

### 5b. Push to main

```bash
git add packages/<vertical-name>
git commit -m "Add <vertical-name> scaffold — builds clean"
git push
```

Vercel triggers automatically. Watch the build log in the Vercel dashboard.

### 5c. Smoke test

1. Open deployed URL
2. Create a test account (email/password)
3. Confirm you land on the auth-gated screen (LoginPage if no tenant row, Dashboard if one exists)
4. In Supabase: manually insert a `<tenant_table>` row with `owner_id` = your test user's UID
5. Refresh — confirm you reach Dashboard
6. Create a second test account with NO tenant row — confirm it sees the "Account not linked" error, not Dashboard

If step 6 passes: tenant isolation is working from day one. If it fails: stop and fix TenantProvider before writing any other code.

### 5d. Cross-tenant RLS smoke test

With two accounts (A has tenant row, B has no tenant row):

```sql
-- As account A's JWT: should return 1 row
SELECT * FROM <tenant_table>;

-- As account B's JWT: should return 0 rows
SELECT * FROM <tenant_table>;
```

Use Supabase Table Editor (logged in as each user) or the anon client with each user's session token. Any row showing up for the wrong user is a policy bug. Fix it now, before data exists.

---

## RLS POLICY QUICK REFERENCE

Copy-paste templates for the three most common table shapes.

### Tenant root table (e.g., nurseries, shops, organizations)

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON <t> FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "insert_own" ON <t> FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update_own" ON <t> FOR UPDATE USING (owner_id = auth.uid());
```

### Direct child table (has <tenant>_id column)

```sql
ALTER TABLE <c> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON <c> FOR SELECT
  USING (EXISTS (SELECT 1 FROM <t> WHERE <t>.id = <c>.<tenant_id_col> AND <t>.owner_id = auth.uid()));
CREATE POLICY "insert_own" ON <c> FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM <t> WHERE <t>.id = <c>.<tenant_id_col> AND <t>.owner_id = auth.uid()));
CREATE POLICY "update_own" ON <c> FOR UPDATE
  USING (EXISTS (SELECT 1 FROM <t> WHERE <t>.id = <c>.<tenant_id_col> AND <t>.owner_id = auth.uid()));
```

### Public read table (e.g., plant catalog, price lists)

```sql
ALTER TABLE <p> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON <p> FOR SELECT USING (true);
CREATE POLICY "owner_insert"  ON <p> FOR INSERT TO authenticated WITH CHECK (true);
```

---

## COMMON FAILURE MODES

| Symptom | Root Cause | Fix |
|---|---|---|
| Logged-in user sees no data | RLS SELECT policy missing on a table | Add `CREATE POLICY "select_own" ON <t> FOR SELECT USING (...)` |
| User sees ALL rows, not just their own | Policy uses `USING (true)` instead of `USING (owner_id = auth.uid())` | Replace with owner-scoped expression |
| New user sees another user's data | TenantProvider has fallback to a hardcoded ID | Remove all fallbacks — no-tenant state must show error, not default tenant |
| Build fails with module not found | Forgot to run `npm install` from root after adding package.json | Run `npm install` from repo root |
| Vercel build succeeds but app 404s on deep links | Missing SPA rewrite in vercel.json | Add `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` |
| VITE_SUPABASE_URL is undefined in production | Variable name typo or missing from Vercel project | Check Vercel project → Settings → Environment Variables |

---

## COMPLETE CHECKLIST

**Monorepo package**
- [ ] `packages/<vertical>/package.json` — name, deps, build script
- [ ] `packages/<vertical>/vite.config.ts` — @trace/shared alias, port
- [ ] `packages/<vertical>/index.html` — Tailwind CDN, root div
- [ ] `packages/<vertical>/main.tsx` — ReactDOM.createRoot
- [ ] Root `package.json` — `dev:<v>` and `build:<v>` scripts added
- [ ] `npm install` from repo root passes
- [ ] `npx vite build` from package dir passes — zero errors

**Supabase**
- [ ] New project created — separate from all other verticals
- [ ] URL, anon key, service key noted
- [ ] Auth: email confirmation OFF
- [ ] Tenant root table created with `owner_id uuid`
- [ ] RLS enabled on ALL tables
- [ ] SELECT + INSERT + UPDATE policies on all tables
- [ ] `rowsecurity = on` confirmed in SQL editor for all tables

**Vercel**
- [ ] New Vercel project created
- [ ] Imported from `david-obrien61/trace-platform`
- [ ] Build command overridden: `npm run build:<vertical>`
- [ ] Output directory overridden: `packages/<vertical>/dist`
- [ ] GitHub connected to main branch
- [ ] All env vars added (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL)

**Core scaffold**
- [ ] `supabase.ts` re-export created
- [ ] TenantProvider created — resolves auth.uid() → tenant_id
- [ ] App shell: loading → error → login → dashboard gates in order
- [ ] Login page builds and renders

**First deploy gate**
- [ ] Local build clean
- [ ] Vercel build clean after push to main
- [ ] Test account A: sees Dashboard after manual tenant row insert
- [ ] Test account B: sees "Account not linked" error, NOT Dashboard data
- [ ] Cross-tenant RLS: account B cannot SELECT account A's rows

**Documentation**
- [ ] CLAUDE.md: add new Supabase project section, new Vercel env vars section
- [ ] CLAUDE.md: Desktop folder map updated
- [ ] `docs/built-inventory.md`: Repo Map row added
- [ ] PLATFORM_AUDIT.md: new vertical section started

---

*Update this runbook whenever a new vertical reveals a gap or a better pattern.*
*Current worked examples: Cultivar OS (full), Ignition OS (scaffold complete, business logic pre-existing).*
