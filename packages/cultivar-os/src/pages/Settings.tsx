import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SharedSettings } from '@trace/shared/pages/Settings';
import { CostToProduceSettings } from '@trace/shared/components/CostToProduceSettings';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '../lib/supabase';
import {
  getMembersByBusiness,
  removeMember,
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
} from '@trace/shared/auth';
import type { Member, Invitation } from '@trace/shared/auth';
import {
  ROLES, DEFAULT_PERMISSIONS, ROLE_LABELS, ROLE_DESCRIPTIONS,
} from '../auth/roles';
import type { CultivarRole } from '../auth/roles';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px',
  border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: '0.9375rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

// ── Nursery-specific install price section ─────────────────────────────────────

function NurserySection({ businessId }: { businessId: string }) {
  const [installPrice, setInstallPrice] = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  useEffect(() => {
    supabase
      .from('nursery_profiles')
      .select('default_install_price')
      .eq('business_id', businessId)
      .single()
      .then(({ data }) => {
        if (data?.default_install_price != null) {
          setInstallPrice(String(data.default_install_price));
        }
      });
  }, [businessId]);

  async function save() {
    setSaving(true);
    setSaveMsg('');
    const price = parseFloat(installPrice);
    const { error } = await supabase
      .from('nursery_profiles')
      .upsert(
        { business_id: businessId, default_install_price: isNaN(price) ? null : price },
        { onConflict: 'business_id' },
      );
    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    }
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <p style={{
        fontSize: '0.6875rem', fontWeight: 700, color: GRAY,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
      }}>
        Nursery Settings
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Default install price (per plant)
        </label>
        <input
          type="number"
          value={installPrice}
          onChange={e => setInstallPrice(e.target.value)}
          placeholder="225.00"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
          onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
        />
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
          Used when staff selects "Install" at checkout. Override per plant on the plant profile.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          width: '100%', padding: '13px 20px',
          background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff',
          fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
          cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save Nursery Settings'}
      </button>
      {saveMsg && (
        <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? RED : GREEN, marginTop: 8, textAlign: 'center' }}>
          {saveMsg}
        </p>
      )}
    </div>
  );
}

// ── Team section ───────────────────────────────────────────────────────────────

type InvitePhase = 'list' | 'form' | 'link';

function TeamSection({ businessId }: { businessId: string }) {
  const [members, setMembers]         = useState<Member[]>([]);
  const [pending, setPending]         = useState<Invitation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');

  // invite form
  const [phase, setPhase]             = useState<InvitePhase>('list');
  const [inviteName, setInviteName]   = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState<CultivarRole>('MANAGER');
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink]   = useState('');
  const [copied, setCopied]           = useState(false);

  // revoke
  const [revoking, setRevoking]       = useState<string | null>(null);
  const [removing, setRemoving]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [m, p] = await Promise.all([
        getMembersByBusiness(supabase, businessId),
        getPendingInvitations(supabase, businessId),
      ]);
      setMembers(m);
      setPending(p);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load team';
      // Table likely doesn't exist yet — show a helpful message instead of hard error
      if (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('42P01')) {
        setLoadError('Team management will be available once David applies the migrations. Run scripts/apply-migrations.mjs with a Supabase PAT first.');
      } else {
        setLoadError(msg);
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [businessId]);

  async function sendInvite() {
    if (!inviteName.trim()) { setInviteError('Name is required.'); return; }
    setInviting(true);
    setInviteError('');
    try {
      const baseUrl = window.location.origin;
      const { inviteLink: link } = await createInvitation(
        supabase,
        {
          businessId,
          name:        inviteName.trim(),
          email:       inviteEmail.trim() || undefined,
          role:        inviteRole,
          permissions: DEFAULT_PERMISSIONS[inviteRole],
        },
        baseUrl,
        '/join',
      );
      setInviteLink(link);
      setPhase('link');
      load(); // refresh list
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create invite';
      if (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('42P01')) {
        setInviteError('Migrations not yet applied. Run scripts/apply-migrations.mjs first.');
      } else {
        setInviteError(msg);
      }
    }
    setInviting(false);
  }

  async function handleRevoke(invitationId: string) {
    setRevoking(invitationId);
    try {
      await revokeInvitation(supabase, invitationId);
      setPending(prev => prev.filter(i => i.id !== invitationId));
    } catch { /* silently ignore — list will refresh on next load */ }
    setRevoking(null);
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    try {
      await removeMember(supabase, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch { /* silently ignore */ }
    setRemoving(null);
  }

  function resetInviteForm() {
    setPhase('list');
    setInviteName('');
    setInviteEmail('');
    setInviteRole('MANAGER');
    setInviteError('');
    setInviteLink('');
    setCopied(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const roleColor: Record<CultivarRole, string> = {
    OWNER:   '#dcfce7',
    MANAGER: '#eff6ff',
    STAFF:   '#f9fafb',
  };
  const roleText: Record<CultivarRole, string> = {
    OWNER:   '#166534',
    MANAGER: '#1d4ed8',
    STAFF:   GRAY,
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 700, color: GRAY,
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
        }}>
          Team
        </p>
        {phase === 'list' && (
          <button
            onClick={() => setPhase('form')}
            style={{
              background: GREEN, color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
            }}
          >
            + Invite Team Member
          </button>
        )}
      </div>

      {/* Error / loading */}
      {loading && (
        <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading team…</p>
      )}
      {loadError && (
        <p style={{ fontSize: '0.8125rem', color: '#b45309', lineHeight: 1.5, background: '#fffbeb', padding: '10px 12px', borderRadius: 8, border: '1px solid #fcd34d' }}>
          ⚠ {loadError}
        </p>
      )}

      {/* Member list */}
      {!loading && !loadError && phase === 'list' && (
        <>
          {members.length === 0 && pending.length === 0 && (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
              No team members yet. Invite Lauren to get started.
            </p>
          )}

          {members.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: pending.length > 0 ? 16 : 0 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: DARK }}>{m.name}</p>
                    {m.email && (
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: GRAY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.email}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: roleColor[m.role as CultivarRole] ?? '#f3f4f6',
                      color:      roleText[m.role as CultivarRole]  ?? GRAY,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {ROLE_LABELS[m.role as CultivarRole] ?? m.role}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem', padding: '3px 9px', borderRadius: 20,
                      background: m.active ? '#dcfce7' : '#f3f4f6',
                      color:      m.active ? '#166534' : GRAY,
                      fontWeight: 600,
                    }}>
                      {m.active ? 'Active' : 'Pending'}
                    </span>
                    {/* OWNER can't be removed from their own team */}
                    {m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={removing === m.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '1rem', lineHeight: 1, padding: '2px 4px' }}
                        title="Remove member"
                      >
                        {removing === m.id ? '…' : '×'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending invitations */}
          {pending.length > 0 && (
            <>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Pending invites
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(inv => (
                  <div key={inv.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fcd34d',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: DARK }}>{inv.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#b45309' }}>
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: roleColor[inv.role as CultivarRole] ?? '#f3f4f6',
                      color:      roleText[inv.role as CultivarRole]  ?? GRAY,
                      textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 8,
                    }}>
                      {ROLE_LABELS[inv.role as CultivarRole] ?? inv.role}
                    </span>
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      disabled={revoking === inv.id}
                      style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '5px 10px', color: RED, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {revoking === inv.id ? '…' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Invite form */}
      {phase === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.9375rem', color: DARK }}>
            New invite
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Name <span style={{ color: RED }}>*</span>
            </label>
            <input
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Lauren Bishop"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
              onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email (optional — for pre-filling the invite page)
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="lauren@lawnstrees.com"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
              onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Role
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(ROLES.filter(r => r !== 'OWNER') as CultivarRole[]).map(role => (
                <label
                  key={role}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    padding: '10px 12px', borderRadius: 9,
                    border: `1.5px solid ${inviteRole === role ? GREEN : '#d1d5db'}`,
                    background: inviteRole === role ? '#f0f7e8' : '#fff',
                  }}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={role}
                    checked={inviteRole === role}
                    onChange={() => setInviteRole(role)}
                    style={{ marginTop: 2, accentColor: GREEN, flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: DARK }}>
                      {ROLE_LABELS[role]}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: GRAY }}>
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {inviteError && (
            <p style={{ fontSize: '0.8125rem', color: RED, background: '#fef2f2', padding: '8px 12px', borderRadius: 8, margin: 0 }}>
              {inviteError}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteName.trim()}
              style={{
                flex: 1, padding: '13px 20px', background: (inviting || !inviteName.trim()) ? '#e5e7eb' : GREEN,
                color: (inviting || !inviteName.trim()) ? GRAY : '#fff',
                fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
                cursor: (inviting || !inviteName.trim()) ? 'default' : 'pointer',
              }}
            >
              {inviting ? 'Creating invite…' : 'Generate Invite Link'}
            </button>
            <button
              onClick={resetInviteForm}
              style={{ padding: '13px 16px', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: GRAY, fontWeight: 600, fontSize: '0.875rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Link display */}
      {phase === 'link' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>🔗</div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: GREEN }}>
              Invite link ready!
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: GRAY }}>
              Copy this link and send it to {inviteName || 'your team member'}.
              It expires in 7 days.
            </p>
          </div>

          <div style={{
            background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10,
            padding: '12px 14px', wordBreak: 'break-all', fontSize: '0.8125rem',
            color: DARK, fontFamily: 'monospace', lineHeight: 1.5,
          }}>
            {inviteLink}
          </div>

          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '13px 20px',
              background: copied ? '#f0fdf4' : GREEN,
              color: copied ? '#166534' : '#fff',
              fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: copied ? '1.5px solid #86efac' : 'none',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied to clipboard' : 'Copy Link'}
          </button>

          <p style={{ fontSize: '0.75rem', color: GRAY, textAlign: 'center', margin: 0 }}>
            No email integration yet — paste this link directly into a text or email.
          </p>

          <button
            onClick={resetInviteForm}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: DARK, fontWeight: 600, fontSize: '0.875rem' }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────

export function Settings() {
  const navigate = useNavigate();
  const { businessId, isOwner, userPermissions } = useBusinessContext();

  const canManageSettings = isOwner || (userPermissions ?? []).includes('manage_settings');

  // Redirect members without settings permission back to dashboard
  if (businessId && !canManageSettings) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const accountingConnectUrl = businessId
    ? `/api/qbo/auth-url?business_id=${businessId}`
    : undefined;

  const verticalContent = businessId ? (
    <>
      <CostToProduceSettings />
      <NurserySection businessId={businessId} />
      <TeamSection businessId={businessId} />
    </>
  ) : undefined;

  return (
    <SharedSettings
      onBack={() => navigate('/dashboard')}
      accountingConnectUrl={accountingConnectUrl}
      verticalSection={verticalContent}
    />
  );
}
