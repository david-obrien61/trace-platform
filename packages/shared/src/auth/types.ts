// Shared multi-tenant member types.
// Role strings are free-form — each vertical defines its own role names.
// The shared layer stores and passes them; it never validates against a fixed enum.

export type Role = string;

export interface Member {
  id: string;
  business_id: string;
  user_id: string | null;       // null until invitation accepted
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  permissions: string[];        // vertical-defined permission IDs
  active: boolean;              // false=invited, true=enrolled
  invite_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  token: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  used: boolean;
  expires_at: string;
  created_at: string;
}

export interface Device {
  id: string;
  member_id: string;
  business_id: string;
  device_label: string | null;
  device_fingerprint: string | null;
  biometric_enrolled: boolean;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
}

// Contract a vertical must satisfy to use the shared invite/accept system.
// See packages/shared/auth/README.md for full documentation.
export interface VerticalAdapter {
  // Role names the vertical recognises (e.g. ['OWNER', 'MANAGER', 'STAFF'])
  roles: readonly string[];
  // Default permission bundle per role. Key = role name, value = array of permission IDs.
  defaultPermissions: Record<string, string[]>;
  // Where to send the member after they accept their invite (e.g. '/dashboard').
  postAcceptanceRedirect: string;
  // Base URL for invite links (defaults to window.location.origin at runtime).
  // Set explicitly in server-side contexts.
  inviteBaseUrl?: string;
}

export interface AcceptInviteResult {
  businessId: string;
  businessName: string;
  memberId: string;
  role: Role;
  permissions: string[];
}

// Returned by the preview endpoint so AcceptInvite can show business name before login.
export type InvitePreview =
  | { valid: true;  businessName: string; invitedName: string; role: string }
  | { valid: false; reason: 'invalid' | 'used' | 'expired' };
