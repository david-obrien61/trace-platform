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
  updateMemberRole,
  removeMember,
  checkPermission,
} from './members';

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

// Shared React component for the invite acceptance page
export { AcceptInvite } from './AcceptInvite';

// Shared multi-step owner signup with PIN gesture layer
export { OwnerSignup } from './OwnerSignup';
export type { OwnerSignupConfig, VerticalStep, VerticalStepProps } from './OwnerSignup';
