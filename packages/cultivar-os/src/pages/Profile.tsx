/**
 * Profile — the personal identity surface for the LOGGED-IN user (/profile).
 *
 * PURPOSE:      Industry-standard "Your Profile" page reached from the header avatar menu (primary)
 *               and the Settings nav node (secondary). Edits ONLY the signed-in person's own
 *               identity — never the business, never role/permissions. A DIFFERENT axis from
 *               Business Profile (the businesses-row editor in Settings), which this never touches.
 * DEPENDENCIES: useBusinessContext (isOwner / userName / userEmail / businessId / reload) — the one
 *               canonical identity source · supabase (shared client, re-exported by lib/supabase).
 *               OWNER write → auth.updateUser({ data:{ full_name } }) (owners have no member row).
 *               MEMBER write → business_members row (name/phone/email) scoped to user_id+business_id
 *               via the bm_self_update RLS policy.
 * OUTPUTS:      Click-to-edit identity rows. On save: optimistic local state + context reload() so
 *               the header switches from email to name immediately. AUTHORITY BOUNDARY: this file
 *               writes name/phone/email ONLY and never role or permissions.
 */
import { useEffect, useState } from 'react';
import { Card } from '@trace/shared/components/Card';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '../lib/supabase';

const GREEN = '#27500A';

// One click-to-edit row. Shows the value + an Edit button; editing reveals an input + Save/Cancel.
function EditableRow({
  label, value, placeholder, type = 'text', readOnly = false, required = false, onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  onSave?: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  async function commit() {
    if (!onSave) return;
    const next = draft.trim();
    if (required && !next) { setError('This can’t be empty.'); return; }
    setSaving(true); setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--gray-100, #eef1ea)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--gray-400, #6b7280)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {label}
        </span>
        {!readOnly && !editing && (
          <button
            onClick={() => { setDraft(value); setError(null); setEditing(true); }}
            style={{
              background: 'none', border: 'none', color: GREEN,
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: 0,
            }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ marginTop: 8 }}>
          <input
            type={type}
            value={draft}
            placeholder={placeholder}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              border: '1px solid var(--gray-200, #d6dccb)', borderRadius: 8, fontSize: '1rem',
            }}
          />
          {error && <p style={{ color: '#A32D2D', fontSize: '0.8125rem', marginTop: 6 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={commit}
              disabled={saving}
              style={{
                background: GREEN, color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); }}
              disabled={saving}
              style={{
                background: 'none', color: 'var(--gray-400, #6b7280)', border: 'none',
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: '8px 4px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p style={{
          fontSize: '1rem', color: value ? 'var(--gray-800, #1f2937)' : 'var(--gray-400, #9ca3af)',
          margin: '6px 0 0',
        }}>
          {value || (readOnly ? '—' : placeholder || 'Not set')}
        </p>
      )}
    </div>
  );
}

export function Profile() {
  const { isOwner, userName, userEmail, businessId, reload, loading } = useBusinessContext();

  // Member-row fields (name/phone/email) — fetched for the member path; owner path edits auth metadata.
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(user?.id ?? null);
      console.log('[TRACE:PROFILE] load', { path: isOwner ? 'owner' : 'member', userId: user?.id, businessId });
      if (!isOwner && user && businessId) {
        const { data } = await supabase
          .from('business_members')
          .select('name, phone, email')
          .eq('user_id', user.id)
          .eq('business_id', businessId)
          .maybeSingle();
        if (cancelled) return;
        setMemberName((data?.name as string) ?? userName ?? '');
        setMemberPhone((data?.phone as string) ?? '');
        setMemberEmail((data?.email as string) ?? user.email ?? '');
      }
      setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [isOwner, businessId, userName]);

  // OWNER: name only → auth metadata (owners have no member row). NEVER role/permissions.
  async function saveOwnerName(next: string) {
    const { error } = await supabase.auth.updateUser({ data: { full_name: next } });
    if (error) throw error;
    console.log('[TRACE:PROFILE] save', { path: 'owner', field: 'full_name', ok: true });
    reload(); // refetch identity → header switches from email to name immediately
  }

  // MEMBER: name/phone/email → own business_members row, scoped to user_id+business_id (bm_self_update
  // RLS). AUTHORITY BOUNDARY: this update lists ONLY name/phone/email — never role or permissions.
  async function saveMemberField(field: 'name' | 'phone' | 'email', next: string) {
    if (!userId || !businessId) throw new Error('Not signed in.');
    // PERSON NAME source of truth = auth.user_metadata.full_name (same write the owner
    // path uses). A member editing their OWN name writes full_name first; the
    // business_members.name row is kept in sync only as a display-fallback so Team
    // lists don't show a stale copy. phone/email stay on the membership row.
    if (field === 'name') {
      const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: next } });
      if (authErr) throw authErr;
    }
    const patch: Record<string, string | null> = { [field]: field === 'name' ? next : (next || null) };
    const { error } = await supabase
      .from('business_members')
      .update(patch)            // name/phone/email ONLY — role/permissions intentionally absent
      .eq('user_id', userId)
      .eq('business_id', businessId);
    if (error) throw error;
    if (field === 'name') setMemberName(next);
    if (field === 'phone') setMemberPhone(next);
    if (field === 'email') setMemberEmail(next);
    console.log('[TRACE:PROFILE] save', { path: 'member', field, ok: true });
    reload();
  }

  const busy = loading || fetching;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg, #EAF3DE)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--gray-800, #1f2937)', margin: '0 0 4px' }}>
          Your Profile
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-400, #6b7280)', margin: '0 0 20px' }}>
          Your personal account details. This is separate from your business settings.
        </p>

        <Card className="card" padding="none">
          <div style={{ padding: '20px 20px 4px' }}>
            {/* Avatar + identity summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 8 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 999, background: GREEN, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.25rem', fontWeight: 700, flexShrink: 0,
              }}>
                {((isOwner ? userName : memberName) ?? userEmail ?? '?').trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--gray-800, #1f2937)', margin: 0 }}>
                  {(isOwner ? userName : memberName) || userEmail || 'You'}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--gray-400, #6b7280)', margin: '2px 0 0' }}>
                  {userEmail}
                </p>
              </div>
            </div>

            {busy ? (
              <div className="skeleton" style={{ height: 16, width: 180, borderRadius: 4, margin: '16px 0' }} />
            ) : isOwner ? (
              <>
                <EditableRow
                  label="Name"
                  value={userName ?? ''}
                  placeholder="Your name"
                  required
                  onSave={saveOwnerName}
                />
                <EditableRow
                  label="Login email"
                  value={userEmail ?? ''}
                  readOnly
                />
              </>
            ) : (
              <>
                <EditableRow
                  label="Name"
                  value={memberName}
                  placeholder="Your name"
                  required
                  onSave={(v) => saveMemberField('name', v)}
                />
                <EditableRow
                  label="Phone"
                  value={memberPhone}
                  placeholder="Your phone number"
                  type="tel"
                  onSave={(v) => saveMemberField('phone', v)}
                />
                <EditableRow
                  label="Email"
                  value={memberEmail}
                  placeholder="Your contact email"
                  type="email"
                  onSave={(v) => saveMemberField('email', v)}
                />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
