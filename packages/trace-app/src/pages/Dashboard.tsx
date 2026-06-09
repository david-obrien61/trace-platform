import { useBusinessContext } from '@trace/shared/context';
import { auth } from '../lib/auth';

const TRACE_BUSINESS_DEBUG = true; // [TRACE:BUSINESS] STD-003 — comment out when proven

export function Dashboard() {
  const { business, businessId, businesses, setActiveBusinessId, isOwner, loading, businessError } =
    useBusinessContext();
  const { user } = auth.useSession();

  if (TRACE_BUSINESS_DEBUG) {
    console.log('[TRACE:BUSINESS] trace-app Dashboard resolved', {
      businessId,
      name: business?.name,
      type: business?.business_type,
      isOwner,
      totalBusinesses: businesses.length,
    });
  }

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--gray-600)' }}>Loading…</p>
      </div>
    );
  }

  if (businessError === 'no_business') {
    return (
      <div className="page" style={{ padding: 24, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏢</div>
          <h2 style={{ fontWeight: 600, color: 'var(--gray-800)', marginBottom: 8 }}>
            No business found
          </h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', marginBottom: 24 }}>
            Your account isn't linked to a TRACE business yet.
          </p>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
            Add a business from Cultivar OS using the + Business button in the dashboard header.
          </p>
        </div>
        <button
          onClick={() => auth.signOut()}
          className="btn btn-secondary"
          style={{ marginTop: 'auto' }}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!business) return null;

  return (
    <div className="page">
      {/* Header */}
      <div style={{
        padding: '16px',
        background: 'var(--white)',
        borderBottom: '1px solid var(--gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--green-primary)' }}>
            {business.name}
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--gray-600)', textTransform: 'capitalize' }}>
            {isOwner ? 'Owner' : 'Member'} · {business.business_type}
          </p>
        </div>
        <button
          onClick={() => auth.signOut()}
          style={{
            background: 'none',
            border: '1px solid var(--gray-200)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: '0.8125rem',
            color: 'var(--gray-600)',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      {/* Business switcher — shown only when multiple businesses */}
      {businesses.length > 1 && (
        <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: 8 }}>
            Switch business
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {businesses.map(b => (
              <button
                key={b.id}
                onClick={() => setActiveBusinessId(b.id)}
                style={{
                  background: b.id === businessId ? 'var(--green-primary)' : 'var(--white)',
                  color: b.id === businessId ? 'var(--white)' : 'var(--gray-800)',
                  border: `1.5px solid ${b.id === businessId ? 'var(--green-primary)' : 'var(--gray-200)'}`,
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Business info */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--gray-200)',
          borderRadius: 12,
          padding: '16px',
        }}>
          <p style={{
            fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
          }}>
            Business info
          </p>
          <Row label="Name" value={business.name} />
          {business.phone && <Row label="Phone" value={business.phone} />}
          {business.address && <Row label="Address" value={business.address} />}
          {business.email && <Row label="Email" value={business.email} />}
          {business.website && <Row label="Website" value={business.website} />}
          <Row label="Signed in as" value={user?.email ?? '—'} />
        </div>

        {/* Placeholder — modules come in future vertical sessions */}
        <div style={{
          background: 'var(--sage-bg)',
          border: '1.5px dashed var(--sage-border)',
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--green-primary)', fontWeight: 600, marginBottom: 4 }}>
            Modules coming soon
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
            This is the TRACE general business dashboard.
            <br />Vertical-specific modules are configured per business type.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '6px 0',
      borderBottom: '1px solid var(--gray-100)',
      gap: 12,
    }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--gray-800)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
