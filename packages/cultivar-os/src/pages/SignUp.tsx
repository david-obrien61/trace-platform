import { useNavigate } from 'react-router-dom';
import { OwnerSignup } from '@trace/shared/auth';
import type { OwnerSignupConfig } from '@trace/shared/auth';

const cultivarConfig: OwnerSignupConfig = {
  businessLabel:   'nursery',
  businessType:    'nursery',
  logo:            '🌿',
  pinLength:       4,
  memberTable:     'business_members',
  memberFKColumn:  'business_id',
  ownerRole:       'OWNER',
  ownerPermissions: ['manage_settings', 'manage_team', 'view_orders', 'process_orders', 'view_reports'],
  signInPath:      '/login',
  collectPhone:    true,
  collectAddress:  true,
  collectWebsite:  true,
  examples: {
    businessName: 'e.g. LAWNS Tree Farm',
    address:      '400 Honeycomb Mesa, Leander TX',
  },
  onSuccess:       (_businessId, _memberId) => {
    // onSuccess fires after PIN setup + optional biometric.
    // BusinessProvider will resolve the businesses row via auth.uid() on next render.
    // Navigate to /dashboard — OnboardingWizard will redirect if profile is incomplete.
    window.location.href = '/dashboard';
  },
};

export function SignUp() {
  const navigate = useNavigate();
  return (
    <OwnerSignup
      config={{
        ...cultivarConfig,
        onSuccess: (_businessId, _memberId) => navigate('/dashboard'),
      }}
      navigate={navigate}
    />
  );
}
