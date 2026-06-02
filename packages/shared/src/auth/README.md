# Shared Auth — Vertical Adapter Contract

The multi-tenant invite/accept system in `packages/shared/src/auth/` handles:
- **Owner** invites a team member → creates an `invitations` row + inactive `business_members` row
- **Member** clicks the link → `AcceptInvite` component collects email + password
- **Server** validates token, creates Supabase auth account, activates the member row
- **Member** is signed in and redirected to the vertical's dashboard

To wire this into a new vertical, you need:

1. Two Vercel serverless functions
2. One React route
3. An `onRedirectTo` path

That's it. The shared package handles everything else.

---

## 1. Two Vercel Functions

### GET `/api/members/preview-invite`

```typescript
// packages/{vertical}/api/members/preview-invite.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { previewInvitation } from '@trace/shared/auth';

const serviceSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token required' });

  const result = await previewInvitation(serviceSupabase, token);
  return res.status(200).json(result);
}
```

**Response shape:**
```jsonc
// Valid token:
{ "valid": true, "businessName": "LAWNS Tree Farm", "invitedName": "Lauren Bishop", "role": "MANAGER" }

// Invalid/used/expired:
{ "valid": false, "reason": "used" }   // or "invalid" or "expired"
```

---

### POST `/api/members/accept-invite`

```typescript
// packages/{vertical}/api/members/accept-invite.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { acceptInvitation } from '@trace/shared/auth';

const serviceSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token, email, password, displayName } = req.body ?? {};
  if (!token || !email || !password) return res.status(400).json({ error: 'token, email, and password required' });

  try {
    const result = await acceptInvitation(serviceSupabase, { token, email, password, displayName });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    const status =
      msg === 'INVALID_TOKEN'         ? 410 :  // Gone
      msg === 'MEMBER_ROW_NOT_FOUND'  ? 500 :
      msg.startsWith('AUTH_CREATE')   ? 422 :
      500;
    return res.status(status).json({ error: msg });
  }
}
```

**Request body:**
```json
{ "token": "abc123...", "email": "lauren@lawns.com", "password": "chosen-password", "displayName": "Lauren" }
```

**Response (200):**
```json
{ "businessId": "uuid", "businessName": "LAWNS Tree Farm", "memberId": "uuid", "role": "MANAGER", "permissions": ["view_orders", "manage_deliveries"] }
```

**Error responses:**
| HTTP | `error` string        | Meaning |
|------|-----------------------|---------|
| 410  | `INVALID_TOKEN`       | Token not found, used, or expired |
| 422  | `AUTH_CREATE_FAILED`  | Email already registered with incompatible state |
| 500  | `MEMBER_ROW_NOT_FOUND`| Data integrity issue — contact admin |

---

## 2. One React Route

Wire a route in your vertical's router at the path your invite links point to.
The route must be **public** (not behind `PrivateRoute`).

```tsx
// In your router (e.g. packages/{vertical}/src/router.tsx)
import { AcceptInvite } from '@trace/shared/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from './auth'; // your configureAuth({ strategy: 'email' }) instance

function AcceptInvitePage() {
  const navigate = useNavigate();
  return (
    <AcceptInvite
      apiBase=""                    // empty string = same-origin Vercel functions
      onRedirectTo="/dashboard"
      supabaseSignIn={auth.signIn}
      navigate={navigate}
    />
  );
}

// Add to your router:
<Route path="/join" element={<AcceptInvitePage />} />
```

---

## 3. Invite link format

Your invite links must point to the route above:

```
https://your-vertical.vercel.app/join?token={64-char-hex-token}
```

Optionally pre-fill the email field:
```
https://your-vertical.vercel.app/join?token={token}&email={encoded-email}
```

The `createInvitation` function in `invitations.ts` generates this link automatically when you pass `inviteBaseUrl` and optionally `inviteBasePath`:

```typescript
import { createInvitation } from '@trace/shared/auth';

const { inviteLink } = await createInvitation(
  supabase,           // owner's authenticated client
  {
    businessId,
    name: 'Lauren Bishop',
    email: 'lauren@lawns.com',
    role: 'MANAGER',
    permissions: ['view_orders', 'manage_deliveries'],
  },
  'https://cultivar-os.app', // inviteBaseUrl
  '/join'                    // inviteBasePath (default)
);
// inviteLink = "https://cultivar-os.app/join?token=abc123..."
```

---

## 4. Role and permission names

Roles are free-form strings. The shared layer stores whatever you pass and makes no assumptions.

Each vertical defines its own role names in the UI (e.g. `OWNER`, `MANAGER`, `STAFF`).
Each vertical also defines what permissions each role gets by default.

Recommended pattern — define these in your vertical's auth config:

```typescript
// packages/{vertical}/src/auth.ts
export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  OWNER:   ['all'],
  MANAGER: ['view_orders', 'manage_deliveries', 'view_customers'],
  STAFF:   ['view_orders'],
};
```

Pass the relevant permission array when calling `createInvitation`.
Use `checkPermission(member.permissions, 'view_orders')` at the call site to gate UI.

---

## 5. What stays in the vertical (not shared)

| Concern | Where it lives |
|---|---|
| Role name constants | `packages/{vertical}/src/auth.ts` |
| Default permission bundles | `packages/{vertical}/src/auth.ts` |
| Post-acceptance redirect path | Passed as prop to `AcceptInvite` |
| `preview-invite` Vercel function | `packages/{vertical}/api/members/preview-invite.ts` |
| `accept-invite` Vercel function | `packages/{vertical}/api/members/accept-invite.ts` |
| Staff management UI (invite modal, member list) | `packages/{vertical}/src/` |
| Email delivery of invite links | Vertical-specific (Resend, SendGrid, etc.) |
| SMS delivery | Vertical-specific |
| PIN gesture layer (Ignition only) | `packages/ignition-os/` — never shared |

---

## 6. Future extensions (not built yet)

- **Device gesture handlers** — biometric or PIN unlock layered on top of email auth.
  When added, the vertical passes a `deviceGestureHandler` prop to `AcceptInvite`
  and the component adds a device enrollment step after account creation.

- **Email delivery** — currently the invite link is returned to the owner for manual sharing.
  When added, each vertical passes an `emailSender(to, inviteLink)` function to
  `createInvitation` and it fires after the DB rows are created.

- **SECURITY DEFINER cross-member reads** — v1 uses the service key endpoint for all
  cross-member reads (one member seeing other members' roles). V2 adds a
  `get_business_members(business_id uuid)` Postgres function with SECURITY DEFINER
  so the frontend can call it without needing a service key proxy.

---

*This contract is the integration spec for Prompt 3 (Cultivar integration).*
*If this README conflicts with the code, the code wins — README is documentation, not source of truth.*
