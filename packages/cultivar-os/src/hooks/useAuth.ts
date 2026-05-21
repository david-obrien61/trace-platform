import { auth } from '../lib/auth';

export function useAuth() {
  const { session, loading, isAuthenticated } = auth.useSession();
  return { session, loading, isAuthenticated };
}
