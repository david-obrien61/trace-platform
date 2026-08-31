import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Settings as SharedSettings } from '@trace/shared/pages/Settings';
import { CostToProduceSettings } from '@trace/shared/components/CostToProduceSettings';
import { useBusinessContext } from '@trace/shared/context';
import { useQboConnect } from '@trace/shared/quickbooks/useQboConnect';
import { generateQR } from '@trace/shared/qr/generate';
import { BUSINESS_MODULE_COLUMNS, setBusinessModuleState, type BusinessModuleRow } from '@trace/shared/business-logic/moduleState';
import { readReviewAskConfig, reviewCopyProblems, isUsableReviewUrl, DEFAULT_REVIEW_GUIDANCE } from '../lib/deliveryFulfilment';
import { supabase } from '../lib/supabase';
import {
  getMembersByBusiness,
  removeMember,
  rosterActionLock,
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
} from '@trace/shared/auth';
import type { Member, Invitation } from '@trace/shared/auth';
import {
  ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS,
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

// ── Invite QR — the SAME invite token as a scannable code (one token, two formats). Reuses the
//    shared generateQR helper (qrcode is a vertical dep). No new invite backend. ─────────────────
function InviteQr({ link }: { link: string }) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    let live = true;
    generateQR(link, { width: 180, margin: 1 }).then((u) => { if (live) setDataUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [link]);
  if (!dataUrl) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <img src={dataUrl} alt="Invite QR code" width={180} height={180} style={{ borderRadius: 10, border: '1px solid #e5e7eb' }} />
      <span style={{ fontSize: '0.75rem', color: GRAY }}>Or scan this QR to join</span>
    </div>
  );
}

// ── Nursery-specific install price section ─────────────────────────────────────

function NurserySection({ businessId }: { businessId: string }) {
  const [installPrice, setInstallPrice] = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  useEffect(() => {
    // maybeSingle (not single): zero rows → { data: null } instead of a 406 error
    // (tech-debt #35). A nursery with no profile row yet is the normal first-run case.
    supabase
      .from('nursery_profiles')
      .select('default_install_price')
      .eq('business_id', businessId)
      .maybeSingle()
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

// ── Review ask (follow-up module) ──────────────────────────────────────────────
//
// The ENTIRE new input this capability needs: the business's own Google review link, copied once
// from their Google Business Profile. Stored in `business_modules.config` for `followup_engine`
// — NOT a new column — which also makes the module's `configured` flag mean something real.
//
// 🔴 THE GUIDANCE LINE IS VALIDATED, NOT TRUSTED, and the refusal is the feature. Google's Rating
// Manipulation policy prohibits incentives, sentiment screening, and requesting that specific
// content be included (including content identifying a staff member). An owner typing "mention the
// crew by name and get 10% off" is not being difficult — it is the obvious thing to write. The
// field says no, in words, with the reason, BEFORE it is saved.
function ReviewAskSection({ businessId }: { businessId: string }) {
  const [url, setUrl]           = useState('');
  const [guidance, setGuidance] = useState('');
  const [enabled, setEnabled]   = useState<boolean | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');

  useEffect(() => {
    supabase
      .from('business_modules')
      .select(BUSINESS_MODULE_COLUMNS)
      .eq('business_id', businessId)
      .eq('module_key', 'followup_engine')
      .maybeSingle()
      .then(({ data }) => {
        const row = (data ?? null) as BusinessModuleRow | null;
        setEnabled(!!row?.enabled);
        const cfg = readReviewAskConfig(row?.config ?? null);
        setUrl(cfg.reviewUrl ?? '');
        setGuidance(cfg.guidance ?? '');
      });
  }, [businessId]);

  const problems = reviewCopyProblems(guidance);
  const urlBad   = url.trim().length > 0 && !isUsableReviewUrl(url);

  async function save() {
    if (problems.length > 0 || urlBad) return;   // refused, not warned
    setSaving(true); setSaveMsg('');
    // Same actor resolution the cost-to-produce writer uses — the RPC records who changed it.
    const actor = (await supabase.auth.getUser()).data.user?.id ?? null;
    const res = await setBusinessModuleState(supabase, businessId, 'followup_engine', {
      configured: !!url.trim(),
      config: { review_url: url.trim() || null, review_guidance: guidance.trim() || null },
    }, actor);
    setSaveMsg(res.applied && !res.error ? 'Saved' : 'Error: ' + (res.reason ?? res.error?.message ?? 'not saved'));
    if (res.applied && !res.error) setTimeout(() => setSaveMsg(''), 2000);
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <p style={{
        fontSize: '0.6875rem', fontWeight: 700, color: GRAY,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
      }}>
        Asking for reviews
      </p>
      {/* The header is a CLAIM (§6 r18): it must hold for every row beneath it, including the
          case where the business does not have the module at all. */}
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 14 }}>
        {enabled === null ? 'Loading…'
          : enabled
            ? 'After a crew marks a stop done, they can show the customer a code that opens your review page.'
            : 'Your plan doesn’t include the Follow-Up module, so nothing is shown to a crew or a customer. These settings are saved for when it’s turned on.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Your Google review link
        </label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://g.page/r/…/review"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
          onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
        />
        <p style={{ fontSize: '0.75rem', color: urlBad ? RED : '#9ca3af', marginTop: 2 }}>
          {urlBad
            ? 'That doesn’t look like a web address — it should start with https://'
            : 'From your Google Business Profile → Ask for reviews. Nothing is shown until this is set.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          What the customer reads
        </label>
        <input
          type="text"
          value={guidance}
          onChange={e => setGuidance(e.target.value)}
          placeholder={DEFAULT_REVIEW_GUIDANCE}
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
          onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
        />
        {problems.length > 0 ? (
          <div style={{ fontSize: '0.75rem', color: RED, marginTop: 2 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Google’s review policy doesn’t allow this line:</p>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {problems.map((why, i) => <li key={i}>{why}</li>)}
            </ul>
          </div>
        ) : (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
            Leave blank to use: “{DEFAULT_REVIEW_GUIDANCE}” · You can’t offer anything in return for a
            review, ask only happy customers, or tell people what to write — Google prohibits all three.
          </p>
        )}
      </div>

      <button
        onClick={() => { void save(); }}
        disabled={saving || problems.length > 0 || urlBad}
        style={{
          width: '100%', padding: '13px 20px',
          background: saving || problems.length > 0 || urlBad ? '#e5e7eb' : GREEN,
          color: saving || problems.length > 0 || urlBad ? GRAY : '#fff',
          fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
          cursor: saving || problems.length > 0 || urlBad ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save review settings'}
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
  const navigate = useNavigate();
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

  // 🔴 `removeMember` is a DIRECT client write fenced on `businesses.owner_id` (bm_owner_all), and
  // the 2026-08-28 access pass widened only the roster READ. This second team surface reads the
  // roster through the same `getMembersByBusiness`, so it inherits the same hazard: an OWNER-ROLE
  // member who is not the account holder would now see every row and be refused by every × on it.
  // One shared decision (`rosterActionLock`), not a second spelling of it — §6 r8.
  const { isOwner } = useBusinessContext();
  const lockRemove = rosterActionLock('remove', { isAccountHolder: isOwner });

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
      // 🔴 THE PERMISSION ARRAY NO LONGER TRAVELS FROM THIS BROWSER (2026-08-28). It was resolved
      // here and POSTed; `create_invitation` now resolves it server-side from the SAME floor this
      // call used to read, so the mint still reads the resolved floor (ruling 2026-07-23) and the
      // client can no longer influence what it reads.
      const { inviteLink: link } = await createInvitation(
        supabase,
        {
          businessId,
          name:  inviteName.trim(),
          email: inviteEmail.trim() || undefined,
          role:  inviteRole,
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => navigate('/team')}
              style={{
                background: 'none', color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 8,
                padding: '8px 14px', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
              }}
            >
              Team &amp; roles console →
            </button>
            <button
              onClick={() => setPhase('form')}
              style={{
                background: GREEN, color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
              }}
            >
              + Invite Team Member
            </button>
          </div>
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
                        disabled={removing === m.id || !lockRemove.allowed}
                        title={lockRemove.reason ?? 'Remove member'}
                        style={{ background: 'none', border: 'none', cursor: lockRemove.allowed ? 'pointer' : 'not-allowed', color: '#d1d5db', fontSize: '1rem', lineHeight: 1, padding: '2px 4px', opacity: lockRemove.allowed ? 1 : 0.5 }}
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

          {/* Same token, second format — scan to open the join page (Lauren's QR join). */}
          <InviteQr link={inviteLink} />

          <p style={{ fontSize: '0.75rem', color: GRAY, textAlign: 'center', margin: 0 }}>
            No email integration yet — paste this link, or have them scan the QR.
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
  const { section: sectionParam } = useParams<{ section?: string }>();
  const { businessId, can, reload } = useBusinessContext();

  // RULE 2a (ledger #50): a section param renders JUST that section as a direct menu destination.
  // Business Profile + Accounting + Services are isolated destinations; an unknown param falls back
  // to the full page rather than a blank screen. Services was orphaned at /settings/all — it is now
  // a discoverable Admin nav destination at /settings/services (nav rewire 2026-07-07).
  const section: 'business' | 'accounting' | 'services' | undefined =
    sectionParam === 'business' || sectionParam === 'accounting' || sectionParam === 'services'
      ? sectionParam
      : undefined;

  // [TRACE:NAV] which Settings section-destination resolved (ON by default, STD-003).
  console.log('[TRACE:NAV] settings section', { param: sectionParam ?? null, resolved: section ?? 'full' });

  // The SAME QBO connect action the Dashboard uses (popup + poll). On connect, reload the
  // business context so the Accounting card flips to "connected". Fixes the broken Settings
  // path, which used a dead <a href> that navigated away with no OAuth poll.
  const { connect: qbConnect, connecting: qbConnecting, error: qbConnectError } = useQboConnect({
    businessId,
    onConnected: () => { reload(); },
  });

  // This page WRITES business settings, so it takes the write string, not the coarse legacy one.
  // manage_settings split five ways (settings:read/update, team:read/update, pricing_recipe:update);
  // reading the whole legacy string here granted four capabilities this screen never uses.
  const canManageSettings = can('settings:update');

  // Redirect members without settings permission back to dashboard
  if (businessId && !canManageSettings) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  // RETIRED 2026-07-27. This was a plain <a href> to /api/qbo/auth-url — a browser NAVIGATION,
  // which cannot carry a Bearer token. Now that the endpoint proves the caller (MB_D-015) the link
  // would 403 every time: a dead affordance (§1.6 item 5), and a worse one than before because it
  // LOOKS like the connect button. The live path is `onConnectAccounting` (useQboConnect — popup +
  // poll), which fetches with the token; the shared Settings already prefers it and the comment
  // there already called this href "the broken Settings connect path".
  const accountingConnectUrl = undefined;

  // The vertical sections (cost config / install price / team) live on the FULL page only — when a
  // section filter is active the shared page renders just that one card, so we pass nothing here.
  const verticalContent = (businessId && !section) ? (
    <>
      <CostToProduceSettings />
      <NurserySection businessId={businessId} />
      <ReviewAskSection businessId={businessId} />
      <TeamSection businessId={businessId} />
    </>
  ) : undefined;

  // No onBack: the persistent breadcrumb (AppLayout) is the canonical "up" affordance (Nav C2).
  return (
    <SharedSettings
      section={section}
      onMoreSettings={() => navigate('/settings/all')}
      accountingConnectUrl={accountingConnectUrl}
      onConnectAccounting={() => void qbConnect()}
      accountingConnecting={qbConnecting}
      accountingError={qbConnectError}
      // Accounting has its own direct destination (/settings/accounting) + the Dashboard prompt,
      // so the full page omits the redundant third copy (Item 4). Same useQboConnect hook drives all.
      accountingHasOwnDestination
      verticalSection={verticalContent}
    />
  );
}
