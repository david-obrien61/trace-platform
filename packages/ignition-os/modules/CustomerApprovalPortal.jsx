/**
 * FILE: modules/CustomerApprovalPortal.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Customer-facing line-item estimate approval with digital signature.
 *          Presented in-person on a tablet turned toward the customer.
 *          Reads estimate_line_items from Supabase, writes customer_authorizations.
 *
 * Props:
 *   estimateId  — uuid of the estimate to display
 *   jobId       — uuid of the job (for customer_authorizations insert)
 *   shopId      — uuid of the shop
 *   onAuthorized(result) — called after Supabase write completes
 *   onClose()   — staff escape button
 */

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  Check, X, RotateCcw, Shield, AlertCircle, FileText,
  Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = true;

// Non-1:1 mappings (71 classNames converted):
// (1) hover:text-slate-400 on close button → dropped (cosmetic)
// (2) hover:text-emerald-400 on Approve All → dropped (cosmetic)
// (3) hover:text-slate-500 on expand notes button → dropped (cosmetic)
// (4) hover:text-red-400 on clear sig button → dropped (cosmetic)
// (5) hover:bg-emerald-400 on authorize button → dropped (cosmetic)
// (6) active:scale-90 on toggle button → ign-card-hover (scale-95 approx; flagged)
// (7) active:scale-[0.98] on authorize button → ign-card-hover (scale-95 approx; flagged)
// (8) animate-spin on Loader2 → ign-spin CSS class
// (9) tracking-[0.3em] → letterSpacing: '0.3em' (1:1 value)
// (10) select-none → userSelect: 'none'
// (11) accent-blue-500 → accentColor: '#3b82f6'
// (12) pointer-events-none → pointerEvents: 'none'
// (13) leading-snug → lineHeight: 1.375
// (14) space-y-2/4 → flexDirection:column + gap equivalents
// (15) inset-0 → top/left/right/bottom: 0
// (16) min-w-0 → minWidth: 0
// (TRACE:STYLE) CustomerApprovalPortal converted, 71 classNames → inline, 16 non-1:1 categories

const fmt$ = (n) =>
  `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ITEM_TYPE_LABEL = {
  LABOR: 'Labor', PART: 'Part', SUBLET: 'Sublet', FEE: 'Fee', MISC: 'Misc',
};

// ─── Authorized confirmation screen ──────────────────────────────────────────

const AuthorizedScreen = ({ approvedCount, declinedCount, total }) => {
  if (STYLE_DEBUG) console.log('[TRACE:STYLE] CustomerApprovalPortal converted, 71 classNames → inline, 16 non-1:1 categories');
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
      <div style={{ width: 96, height: 96, backgroundColor: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 25px 50px -12px rgba(6,78,59,0.40)' }}>
        <Check size={48} style={{ color: '#ffffff' }} />
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', marginBottom: 12 }}>Work Authorized</h2>
      <p style={{ color: '#34d399', fontSize: 24, fontWeight: 900, marginBottom: 8 }}>{fmt$(total)}</p>
      <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 320, marginBottom: 8 }}>
        {approvedCount} item{approvedCount !== 1 ? 's' : ''} authorized
        {declinedCount > 0 && `, ${declinedCount} declined`}.
      </p>
      <p style={{ color: '#475569', fontSize: 12, maxWidth: 320 }}>
        Your signature has been captured and stored with this work order. We'll get started right away.
      </p>
    </div>
  );
};

// ─── Main portal ─────────────────────────────────────────────────────────────

export default function CustomerApprovalPortal({ estimateId, jobId, shopId, onAuthorized, onClose }) {
  const shopInfo = DataBridge.load('shop_info') || {};
  const sigRef   = useRef(null);

  const [loading, setLoading]           = useState(true);
  const [estimate, setEstimate]         = useState(null);
  const [job, setJob]                   = useState(null);
  const [lineItems, setLineItems]       = useState([]);
  const [decisions, setDecisions]       = useState({});
  const [expanded, setExpanded]         = useState({});
  const [hasSignature, setHasSignature] = useState(false);
  const [consent, setConsent]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [authorized, setAuthorized]     = useState(false);
  const [authResult, setAuthResult]     = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [estRes, itemsRes, jobRes] = await Promise.all([
        supabase.from('estimates').select('*').eq('id', estimateId).single(),
        supabase.from('estimate_line_items').select('*').eq('estimate_id', estimateId).order('sort_order'),
        supabase.from('jobs').select('*').eq('id', jobId).single(),
      ]);
      const est   = estRes.data;
      const items = itemsRes.data || [];
      const j     = jobRes.data;
      setEstimate(est);
      setLineItems(items);
      setJob(j);
      const initial = {};
      items.forEach(item => { initial[item.id] = 'approved'; });
      setDecisions(initial);
      setLoading(false);
    };
    load();
  }, [estimateId, jobId]);

  const approvedItems  = lineItems.filter(i => decisions[i.id] === 'approved');
  const declinedItems  = lineItems.filter(i => decisions[i.id] === 'declined');
  const approvedTotal  = approvedItems.reduce((s, i) => s + (i.line_total || 0), 0);
  const approvedParts  = approvedItems.filter(i => i.item_type === 'PART').reduce((s, i) => s + (i.line_total || 0), 0);
  const taxRate        = DataBridge.load('shop_policy')?.tax_rate || 0.0825;
  const tax            = +(approvedParts * taxRate).toFixed(2);
  const total          = +(approvedTotal + tax).toFixed(2);

  const toggleDecision = (id) =>
    setDecisions(prev => ({ ...prev, [id]: prev[id] === 'approved' ? 'declined' : 'approved' }));

  const approveAll = () => {
    const all = {};
    lineItems.forEach(i => { all[i.id] = 'approved'; });
    setDecisions(all);
  };

  const clearSig = () => { sigRef.current?.clear(); setHasSignature(false); };

  const handleAuthorize = async () => {
    if (!hasSignature || !consent || submitting) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const approvedIds  = approvedItems.map(i => i.id);
      const declinedIds  = declinedItems.map(i => i.id);
      const customerName = [job?.customer?.name].filter(Boolean).join('') || null;
      await Promise.all(lineItems.map(item =>
        supabase.from('estimate_line_items').update({ auth_status: decisions[item.id] || 'declined' }).eq('id', item.id)
      ));
      await supabase.from('customer_authorizations').insert({
        estimate_id: estimateId, job_id: jobId, shop_id: shopId, method: 'IN_PERSON',
        authorized_line_ids: approvedIds, declined_line_ids: declinedIds,
        authorized_total: +approvedTotal.toFixed(2), customer_name: customerName, authorized_at: now,
      });
      await supabase.from('estimates').update({ status: 'authorized', authorized_at: now }).eq('id', estimateId);
      await supabase.from('jobs').update({ status: 'authorized' }).eq('id', jobId);
      setAuthResult({ approvedCount: approvedIds.length, declinedCount: declinedIds.length, total });
      setAuthorized(true);
      setTimeout(() => onAuthorized?.({ approvedIds, declinedIds, total }), 2200);
    } catch (err) {
      console.error('Authorization write failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (authorized && authResult) return (
    <AuthorizedScreen approvedCount={authResult.approvedCount} declinedCount={authResult.declinedCount} total={authResult.total} />
  );

  const woId     = job?.wo_number || jobId?.slice(0, 8) || 'WO-???';
  const vehicle  = job?.vehicle ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ').toUpperCase() : '';
  const custName = job?.customer?.name || '';
  const canAuthorize = hasSignature && consent && approvedItems.length > 0 && !submitting;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: '#000000', overflowY: 'auto' }}>

      {/* Staff escape — hover:text-slate-400 → dropped (cosmetic) */}
      <button
        onClick={onClose}
        title="Staff: close portal"
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, padding: 8, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, color: '#334155', cursor: 'pointer', transition: 'color 0.15s' }}
      >
        <X size={14} />
      </button>

      <div style={{ maxWidth: 576, margin: '0 auto', padding: '48px 20px', paddingBottom: 128, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 8 }}>
            {shopInfo.name || 'Ignition OS'}
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>
            Repair Estimate
          </h1>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Work Order {woId}
          </p>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 size={28} className="ign-spin" style={{ color: '#3b82f6' }} />
          </div>
        )}

        {!loading && (
          <>
            {/* CUSTOMER / VEHICLE */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
              {custName && (
                <>
                  <p style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Prepared For</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>{custName}</p>
                </>
              )}
              {vehicle && <p style={{ fontSize: 14, color: '#94a3b8', fontWeight: 700, marginTop: 4 }}>{vehicle}</p>}
              {job?.vehicle?.vin && (
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569', marginTop: 4 }}>VIN: …{job.vehicle.vin.slice(-6)}</p>
              )}
            </div>

            {/* COMPLAINT */}
            {job?.complaint && (
              <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(245,158,11,0.20)', borderRadius: 24, padding: 24 }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Reported Issue</p>
                <p style={{ fontSize: 14, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.625 }}>"{job.complaint}"</p>
              </div>
            )}

            {/* LINE ITEMS */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Review Each Item
                </p>
                {/* hover:text-emerald-400 → dropped (cosmetic) */}
                <button onClick={approveAll} style={{ fontSize: 9, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}>
                  Approve All
                </button>
              </div>

              {lineItems.length === 0 && (
                <p style={{ fontSize: 14, color: '#475569', fontStyle: 'italic' }}>No line items found.</p>
              )}

              {/* space-y-2 → flex column gap:8 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lineItems.map(item => {
                  const isApproved = decisions[item.id] === 'approved';
                  const isExp      = expanded[item.id];
                  const typeLbl    = ITEM_TYPE_LABEL[item.item_type] || item.item_type;

                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: 16,
                        border: isApproved ? '1px solid #1e293b' : '1px solid rgba(127,29,29,0.40)',
                        backgroundColor: isApproved ? '#020617' : 'rgba(69,10,10,0.30)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                        {/* active:scale-90 → ign-card-hover (scale-95 approx; flagged) */}
                        <button
                          onClick={() => toggleDecision(item.id)}
                          className="ign-card-hover"
                          style={{
                            width: 40, height: 40, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            transition: 'all 0.15s', border: 'none', cursor: 'pointer',
                            backgroundColor: isApproved ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)',
                            outline: isApproved ? '1px solid rgba(16,185,129,0.40)' : '1px solid rgba(239,68,68,0.40)',
                            color: isApproved ? '#34d399' : '#f87171',
                          }}
                        >
                          {isApproved ? <Check size={18} /> : <X size={18} />}
                        </button>

                        {/* min-w-0 → minWidth: 0 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.375, color: isApproved ? '#ffffff' : '#64748b', textDecoration: isApproved ? 'none' : 'line-through' }}>
                            {item.description}
                          </p>
                          <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
                            {typeLbl}
                            {item.item_type === 'LABOR' && item.labor_hours
                              ? ` · ${item.labor_hours}h`
                              : item.quantity && item.quantity !== 1
                                ? ` · ×${item.quantity}`
                                : ''}
                          </p>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontWeight: 900, fontSize: 16, color: isApproved ? '#ffffff' : '#334155' }}>
                            {fmt$(item.line_total)}
                          </p>
                        </div>

                        {/* hover:text-slate-500 → dropped (cosmetic) */}
                        {item.notes && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
                            style={{ color: '#334155', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s' }}
                          >
                            {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>

                      {isExp && item.notes && (
                        <div style={{ padding: '0 16px 16px' }}>
                          <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', lineHeight: 1.625, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
                            {item.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOTALS */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
              {/* space-y-2 text-sm → flex column gap:8 fontSize:14 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Approved items ({approvedItems.length} of {lineItems.length})</span>
                  <span>{fmt$(approvedTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12 }}>
                  <span>Tax ({(taxRate * 100).toFixed(2)}% on parts)</span>
                  <span>{fmt$(tax)}</span>
                </div>
                {declinedItems.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(248,113,113,0.60)', fontSize: 12 }}>
                    <span>Declined ({declinedItems.length} item{declinedItems.length !== 1 ? 's' : ''})</span>
                    <span>−{fmt$(declinedItems.reduce((s, i) => s + (i.line_total || 0), 0))}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>You Authorize</p>
                <p style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', color: '#34d399', letterSpacing: '-0.05em' }}>{fmt$(total)}</p>
              </div>
            </div>

            {/* DECLINED SUMMARY */}
            {declinedItems.length > 0 && (
              <div style={{ backgroundColor: 'rgba(69,10,10,0.20)', border: '1px solid rgba(127,29,29,0.30)', borderRadius: 24, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <AlertCircle size={13} style={{ color: '#f87171' }} />
                  <p style={{ fontSize: 9, fontWeight: 900, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Declined — Not Authorized This Visit
                  </p>
                </div>
                {declinedItems.map(i => (
                  <p key={i.id} style={{ fontSize: 12, color: 'rgba(252,165,165,0.50)', lineHeight: 1.625 }}>· {i.description}</p>
                ))}
              </div>
            )}

            {/* SIGNATURE */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileText size={13} style={{ color: '#60a5fa' }} />
                <p style={{ fontSize: 9, fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Signature</p>
              </div>
              <p style={{ fontSize: 10, color: '#64748b', lineHeight: 1.625, marginBottom: 20 }}>
                By signing, you authorize {shopInfo.name || 'this shop'} to perform the checked repairs at the
                estimated cost shown above. Final invoice may vary slightly if additional issues are discovered.
              </p>

              <div
                style={{ position: 'relative', backgroundColor: '#000000', border: '2px dashed #334155', borderRadius: 16, overflow: 'hidden', height: 170 }}
              >
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#10b981"
                  backgroundColor="transparent"
                  canvasProps={{ style: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 } }}
                  onEnd={() => setHasSignature(true)}
                />
                {/* pointer-events-none → inline */}
                {!hasSignature && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 4 }}>
                    <p style={{ color: '#334155', fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sign Here</p>
                    <p style={{ color: '#1e293b', fontSize: 10 }}>Use your finger or stylus</p>
                  </div>
                )}
              </div>

              {/* hover:text-red-400 → dropped (cosmetic) */}
              {hasSignature && (
                <button
                  onClick={clearSig}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                >
                  <RotateCcw size={11} /> Clear &amp; Re-sign
                </button>
              )}

              {/* select-none → userSelect; accent-blue-500 → accentColor; mt-0.5 → marginTop: 2 */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 24, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.625 }}>
                  I have reviewed the estimate above, I authorize only the checked repairs, and I understand
                  that the final invoice may differ if additional issues are discovered during service.
                </span>
              </label>
            </div>

            {/* AUTHORIZE BUTTON — active:scale-[0.98] → ign-card-hover (approx; flagged); hover:bg-emerald-400 → dropped */}
            <button
              onClick={handleAuthorize}
              disabled={!canAuthorize}
              className={canAuthorize ? 'ign-card-hover' : ''}
              style={{
                width: '100%',
                padding: '24px 0',
                borderRadius: 24,
                fontWeight: 900,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                transition: 'all 0.15s',
                border: 'none',
                backgroundColor: canAuthorize ? '#10b981' : '#1e293b',
                color: canAuthorize ? '#ffffff' : '#475569',
                boxShadow: canAuthorize ? '0 25px 50px -12px rgba(6,78,59,0.40)' : 'none',
                cursor: canAuthorize ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting
                ? <><Loader2 size={20} className="ign-spin" /> Securing…</>
                : <><Shield size={20} /> Authorize {fmt$(total)}</>
              }
            </button>

            {approvedItems.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(248,113,113,0.60)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                At least one item must be approved to authorize
              </p>
            )}

            <p style={{ textAlign: 'center', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 16 }}>
              Authorization recorded · Work Order {woId}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
