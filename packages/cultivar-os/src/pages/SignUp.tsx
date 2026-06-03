import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnerSignup } from '@trace/shared/auth';
import type { OwnerSignupConfig, VerticalStep } from '@trace/shared/auth';
import { DiscoveryGlimpse } from '@trace/shared/discovery/DiscoveryGlimpse';

const NURSERY_SEED_INSIGHTS = [
  'Seasonal inventory patterns detected — netting and mulch show strong upsell potential',
  'Pricing signals suggest customers expect add-on services at checkout',
  'Service area maps to suburban residential — high-value delivery and install candidates',
];

const discoveryStep: VerticalStep = {
  label: 'Your business',
  render: (props) => (
    <DiscoveryGlimpse
      {...props}
      discoveryEndpoint="/api/discovery/ingest"
      vertical="nursery"
      primaryColor="#27500A"
      seedInsights={NURSERY_SEED_INSIGHTS}
    />
  ),
};

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
  verticalSteps:   [discoveryStep],
  onSuccess:       (_businessId, _memberId) => {
    window.location.href = '/onboarding';
  },
};

export function SignUp() {
  const navigate = useNavigate();
  return (
    <OwnerSignup
      config={{
        ...cultivarConfig,
        onSuccess: (_businessId, _memberId) => navigate('/onboarding'),
      }}
      navigate={navigate}
    />
  );
}
