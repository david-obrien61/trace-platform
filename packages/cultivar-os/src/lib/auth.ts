import { configureAuth } from '@trace/shared/auth';

export const auth = configureAuth({
  strategy: 'email',
  vertical: 'cultivar-os',
  tenantTable: 'nurseries',
  defaultRole: 'owner',
  redirectAfterLogin: '/dashboard',
});
