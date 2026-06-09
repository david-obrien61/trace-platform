import { configureAuth } from '@trace/shared/auth';

export const auth = configureAuth({
  strategy: 'email',
  vertical: 'trace-app',
  tenantTable: 'businesses',
  defaultRole: 'owner',
  redirectAfterLogin: '/dashboard',
});
