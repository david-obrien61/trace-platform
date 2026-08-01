import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnerSignup } from '@trace/shared/auth';
import type { OwnerSignupConfig } from '@trace/shared/auth';
import { catalogSeedRows } from '../registry/tileRegistry';

// Add-a-business page for already-authenticated users.
// Uses OwnerSignup with businessType='general' and no verticalSteps
// (no nursery onboarding — the user just gets a businesses row).
// Session detection in OwnerSignup fires on mount and skips the
// email/password fields automatically when a session is found.

const addBusinessConfig: OwnerSignupConfig = {
  businessLabel:    'business',
  businessType:     'general',
  logo:             '🏢',
  primaryColor:     '#27500A',
  backgroundColor:  '#EAF3DE',
  cardColor:        '#fff',
  pinLength:        4,
  memberTable:      'business_members',
  memberFKColumn:   'business_id',
  ownerRole:        'OWNER',
  // Same catalog on the general path. A `general` business gets a row for the cultivar-scoped
  // modules too — see catalogSeedRows()'s own note on why filtering by vertical here would
  // reintroduce the missing-row defect the moment a business changes business_type.
  moduleCatalog:    catalogSeedRows(),
  signInPath:       '/login',
  collectPhone:     true,
  collectAddress:   true,
  collectWebsite:   true,
  verticalSteps:    [], // no vertical-specific onboarding for general business type
  onSuccess:        () => {
    // fallback — the component override below handles navigation via useNavigate
    window.location.href = '/dashboard';
  },
};

export function AddBusiness() {
  const navigate = useNavigate();

  return (
    <OwnerSignup
      config={{
        ...addBusinessConfig,
        onSuccess: (_businessId, _memberId) => {
          console.log('[TRACE:BUSINESS] AddBusiness: onSuccess → /dashboard', {
            businessId: _businessId,
            path: 'add-business-complete',
          });
          navigate('/dashboard');
        },
      }}
      navigate={navigate}
    />
  );
}
