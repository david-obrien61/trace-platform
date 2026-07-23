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

// Financial-data permission vocabulary (the v1 role wall) — single source of truth
export {
  VIEW_COSTS,
  VIEW_PRICING_CONFIG,
  VIEW_WAGES,
  VIEW_MARGIN,
  FINANCIAL_PERMISSIONS,
  ALL_FINANCIAL_PERMISSIONS,
  FINANCIAL_ROLE_DEFAULTS,
  financialDefaultsForRole,
  applyFinancialDependencies,
} from './financialPermissions';
export type { FinancialPermission } from './financialPermissions';

// Action-permission vocabulary — behavior-gating perms (not tile perms) — single source
export {
  OVERRIDE_MAINTENANCE,
  VIEW_CUSTOMERS,
  IMPORT_PRICING,
  ACTION_PERMISSIONS,
  ALL_ACTION_PERMISSIONS,
  UNWIRED_ACTION_PERMISSIONS,
  ACTION_ROLE_DEFAULTS,
  actionDefaultsForRole,
} from './actionPermissions';
export type { ActionPermission } from './actionPermissions';

// Abuse guards for business creation — shipped OFF, genuine kill-switches
export { runBusinessCreationGuards } from './businessGuards';
export type { GuardResult } from './businessGuards';
