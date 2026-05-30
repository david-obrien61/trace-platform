import { PMI as PMIModule } from '@trace/shared/modules/PMI';
import { useBusinessContext } from '@trace/shared/context';

const CULTIVAR_ASSET_TYPES = [
  'Tractor', 'Truck', 'Trailer', 'Loader', 'Skid Steer',
  'Sprayer', 'Mower', 'Chainsaw', 'Blower', 'Generator', 'Other',
];

const CULTIVAR_SERVICE_TYPES = [
  'Oil Change', 'Filter Replacement', 'Fluid Check / Top-Off',
  'Belt / Chain', 'Blade Sharpen / Replace', 'Tire Inspection',
  'Full Inspection', 'Repair', 'Other',
];

export default function PMI() {
  const { businessId, loading } = useBusinessContext();

  if (loading || !businessId) return null;

  return (
    <PMIModule
      businessId={businessId}
      assetLabel="Equipment"
      assetTypes={CULTIVAR_ASSET_TYPES}
      serviceTypes={CULTIVAR_SERVICE_TYPES}
    />
  );
}
