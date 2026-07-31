export { configureAuth } from './configureAuth';
export type {
  AuthConfig,
  AuthObject,
  SessionUser,
  UseSessionResult,
  VerticalId,
} from './configureAuth';

// Multi-tenant member management
export type {
  Member,
  Invitation,
  Device,
  Role,
  VerticalAdapter,
  AcceptInviteResult,
  InvitePreview,
} from './types';

// Client-side: runs with owner's authenticated Supabase session
export {
  getMembersByBusiness,
  removeMember,
  setMemberActive,
  setMemberPhone,
  checkPermission,
} from './members';

// PIN-reset spine (D-31) — owner arms (nulls pin_hash), member sets own PIN via own session
export {
  armPinReset,
  loadOwnMemberships,
  setOwnPin,
  changeOwnPin,
} from './pinReset';
export type { OwnMembership } from './pinReset';

// Device spine (D-31) — owner-side reads/writes + member self-service reads of member_devices
export {
  listDevicesByBusiness,
  listOwnDevices,
  setDeviceActive,
  deleteDevice,
} from './devices';

// Three-tier role-definition store (role-config console — visibility axis, MB_D-010).
// READ-ONLY since 2026-07-23: writes moved to the funnel (roleFunnel.ts).
export {
  getRoleDefinitions,
  resolveRoles,
  resolveRoleDefaults,
} from './roleDefinitions';
export type { RoleDefinitionRow, ResolvedRole, RoleSource } from './roleDefinitions';

// THE PERMISSION FUNNEL (David's ruling 2026-07-23, OPTION 1) — the ONLY way a role→permission
// fact changes: save_role_permissions / assign_member_role RPCs + the pure blast-radius diff.
export {
  saveRolePermissions,
  assignMemberRole,
  diffPermissions,
} from './roleFunnel';
export type {
  RoleSaveOp,
  RoleSaveResult,
  AffectedMember,
  MemberRoleResult,
  PermissionDiff,
} from './roleFunnel';

// Client-side invite management (owner session) + server-side expiry cleanup
export {
  createInvitation,
  revokeInvitation,
  getPendingInvitations,
  expireInvitations,
} from './invitations';
export type { CreateInvitationInput, CreateInvitationResult } from './invitations';

// Server-side: call from Vercel functions with service key
export { previewInvitation, acceptInvitation } from './acceptInvitation';
export type { AcceptInvitationInput } from './acceptInvitation';

// Self-device-handoff (D-31) — client issue (own session) + server exchange (service key).
// Authenticates an EXISTING member onto a new device via QR — no account creation, no typing.
export { issueDeviceHandoff, exchangeDeviceHandoff } from './deviceHandoff';
export type {
  IssueDeviceHandoffResult,
  ExchangeDeviceHandoffInput,
  ExchangeDeviceHandoffResult,
} from './deviceHandoff';

// Shared React component for the invite acceptance page
export { AcceptInvite } from './AcceptInvite';

// Shared React component for the new-device handoff landing page (mounted at /device-handoff)
export { DeviceHandoff } from './DeviceHandoffScreen';

// AGNOSTIC route-entry permission gate (D-31 / security class fix) — every react-router +
// BusinessProvider vertical inherits "a gated route refuses unauthorized entry from ANY door".
export { PermissionRoute } from './PermissionRoute';

// Shared React component for the PIN-reset screen (D-31 spine — mounted at /reset-pin)
export { ResetPin } from '../components/auth/ResetPin';

// Shared multi-step owner signup with PIN gesture layer
export { OwnerSignup } from './OwnerSignup';
export type { OwnerSignupConfig, VerticalStep, VerticalStepProps } from './OwnerSignup';

// Permission check helpers — pure functions, AC-1 clean, no vertical nouns
export { can, hasRole, canAccessModule, expandRoles, deriveAllowed } from './permissions';
export type { PermissionPolicy, SessionLike } from './permissions';

// THE PERMISSION MANIFEST — the ONE source for what a permission is (spec v3, 2026-07-26).
// Absorbs and replaces financialPermissions.ts, actionPermissions.ts, the two UNWIRED_*
// lists, and roles.ts PERMISSIONS — five representations of one fact became one (STD-011).
export {
  // the model
  PERMISSION_MANIFEST,
  CATALOG_PERMISSIONS,
  DERIVED_PERMISSIONS,
  PERMISSION_CATEGORY_ORDER,
  impliedBy,
  permissionCategory,
  permissionLabel,
  ALL_MODEL_PERMISSIONS,
  splitPermission,
  dependenciesOf,
  unmetDependencies,
  createWithoutRead,
  applyPermissionDependencies,
  // the legacy register + the alias layer it seeds
  LEGACY_PERMISSIONS,
  ALL_LEGACY_PERMISSIONS,
  LEGACY_PERMISSION,
  ALIAS_PAIRS,
  MAPPABLE_LEGACY,
  STRIPPED_AT_BACKFILL,
  // the Roles-page filter (replaces UNWIRED_ACTION_PERMISSIONS + UNWIRED_REGISTRY_PERMISSIONS)
  HIDDEN_PERMISSIONS,
  // spec §4 — what granting a confidential permission actually hands over
  CONFIDENTIAL_EXPOSURE,
  // the declared-unwired set — the invariant capQ enforces across bundles + the R-B2 list
  DECLARED_UNWIRED_PERMISSIONS,
  PLANNED_PERMISSIONS,
  UNGRANTABLE_PERMISSIONS,
  MEMBERSHIP_SENTINEL,
  // fresh-role seed data (NOT a backfill input — see R-A on DEFAULT_BUNDLES)
  DEFAULT_BUNDLES,
  OWNER_DEFAULT_BUNDLE,
  // the owner's COMPUTED set — what can() reads for an OWNER-role session (ruling 2026-07-30)
  OWNER_LOCKED_SET,
  MANAGER_DEFAULT_BUNDLE,
  STAFF_DEFAULT_BUNDLE,
  // legacy string constants — live until Phase 7 CONTRACT
  VIEW_COSTS,
  VIEW_PRICING_CONFIG,
  VIEW_WAGES,
  VIEW_MARGIN,
  VIEW_CUSTOMERS,
  OVERRIDE_MAINTENANCE,
  APPLY_TAX_EXEMPT,
  APPLY_DISCOUNT,
  IMPORT_PRICING,
  ALL_FINANCIAL_PERMISSIONS,
  ALL_ACTION_PERMISSIONS,
} from './permissionManifest';
export type {
  ManifestEntry,
  LegacyEntry,
  PermissionStatus,
  PermissionSensitivity,
  LegacyFate,
} from './permissionManifest';

// Abuse guards for business creation — shipped OFF, genuine kill-switches
export { runBusinessCreationGuards } from './businessGuards';
export type { GuardResult } from './businessGuards';

// the CLIENT half of MB_D-015 — attach the caller's token to our own service-key endpoints
export { authHeaders } from './authHeaders';
