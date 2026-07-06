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
 *               MEMBER write → business_members row (name/phone ONLY) scoped to user_id+business_id
 *               via the bm_self_update RLS policy. EMAIL is the LOGIN CREDENTIAL (auth.users.email) —
 *               shown READ-ONLY, never self-editable (account-lockout/takeover vector).
 * OUTPUTS:      Click-to-edit identity rows (name/phone). Email renders read-only. On save:
 *               optimistic local state + context reload() so the header switches from email to name
 *               immediately. Plus a PIN self-change control (current → new) via the shared agnostic
 *               changeOwnPin over business_members.pin_hash (bm_self_update; NO new table/column/fn).
 *               AUTHORITY BOUNDARY: this file writes name/phone/pin_hash ONLY — never email, role,
 *               or permissions.
 */
import { useEffect, useState } from 'react';
import { Card } from '@trace/shared/components/Card';
import { useBusinessContext } from '@trace/shared/context';
import { changeOwnPin } from '@trace/shared/auth';
import { normalizePhone } from '@trace/shared/utils/normalizePhone';
import { supabase } from '../lib/supabase';

const GREEN = '#27500A';
const PIN_LEN = 4; // matches the reset-screen default (ResetPin pinLength)

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

// Change-PIN control — the member's daily unlock gesture, self-serviced from Your Profile.
// Collapsed → "Change PIN"; expanded → current PIN (only when one is set) + new + confirm.
function ChangePinSection({
  hasPin, onChange,
}: {
  hasPin: boolean;
  onChange: (currentPin: string, newPin: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const digits = (s: string) => s.replace(/\D/g, '');

  function close() {
    setOpen(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setError(null);
  }

  async function commit() {
    const cur = currentPin.trim(), nu = newPin.trim(), cf = confirmPin.trim();
    if (hasPin && cur.length !== PIN_LEN) { setError('Enter your current PIN.'); return; }
    if (nu.length !== PIN_LEN || !/^\d+$/.test(nu)) { setError(`PIN must be ${PIN_LEN} digits.`); return; }
    if (nu !== cf) { setError('New PINs do not match.'); return; }
    setSaving(true); setError(null);
    try {
      await onChange(cur, nu);
      close();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change PIN.');
    } finally {
      setSaving(false);
    }
  }

  const pinInput: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    border: '1px solid var(--gray-200, #d6dccb)', borderRadius: 8, fontSize: '1rem',
    letterSpacing: '0.3em', marginBottom: 10,
  };

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--gray-400, #6b7280)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          PIN
        </span>
        {!open && (
          <button
            onClick={() => { setOpen(true); setError(null); }}
            style={{ background: 'none', border: 'none', color: GREEN, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
        )}
      </div>

      {open ? (
        <div style={{ marginTop: 8 }}>
          {hasPin && (
            <input
              inputMode="numeric" pattern={`\\d{${PIN_LEN}}`} maxLength={PIN_LEN}
              placeholder="Current PIN" autoFocus value={currentPin}
              onChange={(e) => setCurrentPin(digits(e.target.value))}
              style={pinInput}
            />
          )}
          <input
            inputMode="numeric" pattern={`\\d{${PIN_LEN}}`} maxLength={PIN_LEN}
            placeholder={`New ${PIN_LEN}-digit PIN`} autoFocus={!hasPin} value={newPin}
            onChange={(e) => setNewPin(digits(e.target.value))}
            style={pinInput}
          />
          <input
            inputMode="numeric" pattern={`\\d{${PIN_LEN}}`} maxLength={PIN_LEN}
            placeholder="Confirm new PIN" value={confirmPin}
            onChange={(e) => setConfirmPin(digits(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') close(); }}
            style={pinInput}
          />
          {error && <p style={{ color: '#A32D2D', fontSize: '0.8125rem', margin: '0 0 6px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { void commit(); }} disabled={saving}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : hasPin ? 'Change PIN' : 'Set PIN'}
            </button>
            <button
              onClick={close} disabled={saving}
              style={{ background: 'none', color: 'var(--gray-400, #6b7280)', border: 'none', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: '8px 4px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-400, #6b7280)', margin: '6px 0 0' }}>
          {done ? 'PIN updated ✓' : hasPin ? 'Your daily unlock PIN is set.' : 'No PIN set — set one for quick unlock.'}
        </p>
      )}
    </div>
  );
}

export function Profile() {
  const { isOwner, userName, userEmail, businessId, reload, loading } = useBusinessContext();

  // business_members-row fields. Owner AND member both HAVE a member row (OwnerSignup creates the
  // owner's at signup; BusinessProvider just dedupes it out of resolution when the owner is resolved
  // via businesses.owner_id). Personal PHONE lives on that row for both; name/email are member-only
  // here (owner name = full_name in auth metadata, owner login email = userEmail).
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);  // membership row id — needed to change own PIN
  const [hasPin, setHasPin] = useState(false);                     // is a pin_hash set (drives change vs first-set copy)
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(user?.id ?? null);
      console.log('[TRACE:PROFILE] load', { path: isOwner ? 'owner' : 'member', userId: user?.id, businessId });
      if (user && businessId) {
        // Owner and member both read their own member row here — the owner needs it for PHONE
        // (their name/email come from auth metadata, so memberName/memberEmail are member-only).
        const { data } = await supabase
          .from('business_members')
          .select('id, name, phone, email, pin_hash')
          .eq('user_id', user.id)
          .eq('business_id', businessId)
          .maybeSingle();
        if (cancelled) return;
        setMemberPhone((data?.phone as string) ?? '');
        setMemberId((data?.id as string) ?? null);           // may be null for legacy owners w/o a member row → Change PIN hidden
        setHasPin(Boolean(data?.pin_hash));
        if (!isOwner) {
          setMemberName((data?.name as string) ?? userName ?? '');
          setMemberEmail((data?.email as string) ?? user.email ?? '');
        }
      }
      setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [isOwner, businessId, userName]);

  // OWNER NAME → auth metadata (full_name is the person source of truth). NEVER role/permissions.
  // (Owner PHONE is handled by saveMemberField('phone') below — it writes the owner's own member row.)
  async function saveOwnerName(next: string) {
    const { error } = await supabase.auth.updateUser({ data: { full_name: next } });
    if (error) throw error;
    console.log('[TRACE:PROFILE] save', { path: 'owner', field: 'full_name', ok: true });
    reload(); // refetch identity → header switches from email to name immediately
  }

  // MEMBER: name/phone → own business_members row, scoped to user_id+business_id (bm_self_update
  // RLS). EMAIL IS INTENTIONALLY NOT WRITABLE — it is the login credential (auth.users.email) and
  // must never be self-editable (account-lockout / takeover vector). This function can only ever
  // touch name/phone; email has no code path here (belt-and-suspenders: the affordance is gone AND
  // the writer can't write it). AUTHORITY BOUNDARY: never role or permissions.
  async function saveMemberField(field: 'name' | 'phone', next: string) {
    if (!userId || !businessId) throw new Error('Not signed in.');
    // PERSON NAME source of truth = auth.user_metadata.full_name (same write the owner
    // path uses). A member editing their OWN name writes full_name first; the
    // business_members.name row is kept in sync only as a display-fallback so Team
    // lists don't show a stale copy. phone stays on the membership row.
    if (field === 'name') {
      const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: next } });
      if (authErr) throw authErr;
    }
    // PHONE goes through the ONE shared storage normalization (R1/R3/profile); name keeps
    // its existing trim behavior.
    const normalizedPhone = field === 'phone' ? normalizePhone(next) : null;
    const patch: Record<string, string | null> = {
      [field]: field === 'name' ? next : normalizedPhone,
    };
    const { error } = await supabase
      .from('business_members')
      .update(patch)            // name/phone ONLY — email/role/permissions intentionally absent
      .eq('user_id', userId)
      .eq('business_id', businessId);
    if (error) throw error;
    if (field === 'name') setMemberName(next);
    if (field === 'phone') setMemberPhone(normalizedPhone ?? '');
    console.log('[TRACE:PROFILE] save', { path: 'member', field, ok: true });
    reload();
  }

  // PIN self-change — the member (or owner-operator, both have a member row) changes THEIR OWN PIN.
  // Re-auth with the current PIN → set new, over the shared agnostic changeOwnPin (reuses hashPin +
  // setOwnPin on business_members.pin_hash under bm_self_update; NO new table/column/Vercel function).
  // The live Supabase session is the real auth boundary; the current-PIN check is a confirmation.
  async function saveOwnPin(currentPin: string, newPin: string) {
    if (!userId || !businessId || !memberId) throw new Error('Not signed in.');
    await changeOwnPin(supabase, memberId, businessId, userId, currentPin, newPin);
    setHasPin(true);
    console.log('[TRACE:PROFILE] pin-changed', { by: 'self', hadPin: hasPin });
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
                  label="Phone"
                  value={memberPhone}
                  placeholder="Your phone number"
                  type="tel"
                  onSave={(v) => saveMemberField('phone', v)}
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
                {/* Email is the LOGIN CREDENTIAL — read-only, never self-editable. */}
                <EditableRow
                  label="Login email"
                  value={memberEmail || (userEmail ?? '')}
                  readOnly
                />
              </>
            )}

            {/* PIN self-change — both owner-operator and member have a member row w/ pin_hash.
                Hidden for legacy accounts without a resolved member row (memberId null). */}
            {!busy && memberId && <ChangePinSection hasPin={hasPin} onChange={saveOwnPin} />}
          </div>
        </Card>
      </div>
    </div>
  );
}
