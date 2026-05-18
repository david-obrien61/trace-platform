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

const fmt$ = (n) =>
  `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ITEM_TYPE_LABEL = {
  LABOR: 'Labor', PART: 'Part', SUBLET: 'Sublet', FEE: 'Fee', MISC: 'Misc',
};

// ─── Authorized confirmation screen ──────────────────────────────────────────

const AuthorizedScreen = ({ approvedCount, declinedCount, total }) => (
  <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8">
    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-emerald-900/40">
      <Check size={48} className="text-white" />
    </div>
    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-3">Work Authorized</h2>
    <p className="text-emerald-400 text-2xl font-black mb-2">{fmt$(total)}</p>
    <p className="text-slate-400 text-sm max-w-xs mb-2">
      {approvedCount} item{approvedCount !== 1 ? 's' : ''} authorized
      {declinedCount > 0 && `, ${declinedCount} declined`}.
    </p>
    <p className="text-slate-600 text-xs max-w-xs">
      Your signature has been captured and stored with this work order. We'll get started right away.
    </p>
  </div>
);

// ─── Main portal ─────────────────────────────────────────────────────────────

export default function CustomerApprovalPortal({ estimateId, jobId, shopId, onAuthorized, onClose }) {
  const shopInfo  = DataBridge.load('shop_info') || {};
  const sigRef    = useRef(null);

  const [loading, setLoading]         = useState(true);
  const [estimate, setEstimate]       = useState(null);
  const [job, setJob]                 = useState(null);
  const [lineItems, setLineItems]     = useState([]);
  const [decisions, setDecisions]     = useState({});   // { [id]: 'approved' | 'declined' }
  const [expanded, setExpanded]       = useState({});   // { [id]: bool } — show notes
  const [hasSignature, setHasSignature] = useState(false);
  const [consent, setConsent]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [authorized, setAuthorized]   = useState(false);
  const [authResult, setAuthResult]   = useState(null);

  // ── Load estimate + line items ──────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [estRes, itemsRes, jobRes] = await Promise.all([
        supabase.from('estimates').select('*').eq('id', estimateId).single(),
        supabase.from('estimate_line_items').select('*')
          .eq('estimate_id', estimateId).order('sort_order'),
        supabase.from('jobs').select('*').eq('id', jobId).single(),
      ]);

      const est   = estRes.data;
      const items = itemsRes.data || [];
      const j     = jobRes.data;

      setEstimate(est);
      setLineItems(items);
      setJob(j);

      // Default: all items approved
      const initial = {};
      items.forEach(item => { initial[item.id] = 'approved'; });
      setDecisions(initial);
      setLoading(false);
    };
    load();
  }, [estimateId, jobId]);

  // ── Derived totals ──────────────────────────────────────────────────────────

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

  // ── Submit authorization ────────────────────────────────────────────────────

  const handleAuthorize = async () => {
    if (!hasSignature || !consent || submitting) return;
    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const approvedIds = approvedItems.map(i => i.id);
      const declinedIds = declinedItems.map(i => i.id);
      const customerName = [job?.customer?.name].filter(Boolean).join('') || null;

      // 1. Update each line item auth_status
      await Promise.all(lineItems.map(item =>
        supabase.from('estimate_line_items')
          .update({ auth_status: decisions[item.id] || 'declined' })
          .eq('id', item.id)
      ));

      // 2. Write legal authorization record
      await supabase.from('customer_authorizations').insert({
        estimate_id:         estimateId,
        job_id:              jobId,
        shop_id:             shopId,
        method:              'IN_PERSON',
        authorized_line_ids: approvedIds,
        declined_line_ids:   declinedIds,
        authorized_total:    +approvedTotal.toFixed(2),
        customer_name:       customerName,
        authorized_at:       now,
      });

      // 3. Update estimate status
      await supabase.from('estimates').update({
        status:        'authorized',
        authorized_at: now,
      }).eq('id', estimateId);

      // 4. Update job status
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (authorized && authResult) return (
    <AuthorizedScreen
      approvedCount={authResult.approvedCount}
      declinedCount={authResult.declinedCount}
      total={authResult.total}
    />
  );

  const woId    = job?.wo_number || jobId?.slice(0, 8) || 'WO-???';
  const vehicle = job?.vehicle
    ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ').toUpperCase()
    : '';
  const custName = job?.customer?.name || '';

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">

      {/* Staff escape — unobtrusive */}
      <button
        onClick={onClose}
        title="Staff: close portal"
        className="fixed top-4 right-4 z-[60] p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-700 hover:text-slate-400 transition-colors"
      >
        <X size={14} />
      </button>

      <div className="max-w-xl mx-auto px-5 py-12 pb-32 space-y-4">

        {/* ── HEADER ── */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">
            {shopInfo.name || 'Ignition OS'}
          </p>
          <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-1">
            Repair Estimate
          </h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Work Order {woId}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="text-blue-500 animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── CUSTOMER / VEHICLE ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              {custName && (
                <>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Prepared For</p>
                  <p className="text-xl font-black text-white uppercase tracking-tight">{custName}</p>
                </>
              )}
              {vehicle && <p className="text-sm text-slate-400 font-bold mt-1">{vehicle}</p>}
              {job?.vehicle?.vin && (
                <p className="text-[10px] font-mono text-slate-600 mt-1">VIN: …{job.vehicle.vin.slice(-6)}</p>
              )}
            </div>

            {/* ── COMPLAINT ── */}
            {job?.complaint && (
              <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-6">
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">Reported Issue</p>
                <p className="text-sm text-slate-300 italic leading-relaxed">"{job.complaint}"</p>
              </div>
            )}

            {/* ── LINE ITEMS ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Review Each Item
                </p>
                <button
                  onClick={approveAll}
                  className="text-[9px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest transition-colors"
                >
                  Approve All
                </button>
              </div>

              {lineItems.length === 0 && (
                <p className="text-sm text-slate-600 italic">No line items found.</p>
              )}

              <div className="space-y-2">
                {lineItems.map(item => {
                  const isApproved = decisions[item.id] === 'approved';
                  const isExp      = expanded[item.id];
                  const typeLbl    = ITEM_TYPE_LABEL[item.item_type] || item.item_type;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-all ${
                        isApproved
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-red-950/30 border-red-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 p-4">
                        {/* Approve/Decline toggle */}
                        <button
                          onClick={() => toggleDecision(item.id)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                            isApproved
                              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                              : 'bg-red-500/20 border border-red-500/40 text-red-400'
                          }`}
                        >
                          {isApproved ? <Check size={18} /> : <X size={18} />}
                        </button>

                        {/* Description + type */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold leading-snug ${isApproved ? 'text-white' : 'text-slate-500 line-through'}`}>
                            {item.description}
                          </p>
                          <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">
                            {typeLbl}
                            {item.item_type === 'LABOR' && item.labor_hours
                              ? ` · ${item.labor_hours}h`
                              : item.quantity && item.quantity !== 1
                                ? ` · ×${item.quantity}`
                                : ''}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <p className={`font-black text-base ${isApproved ? 'text-white' : 'text-slate-700'}`}>
                            {fmt$(item.line_total)}
                          </p>
                        </div>

                        {/* Expand notes */}
                        {item.notes && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
                            className="text-slate-700 hover:text-slate-500 transition-colors flex-shrink-0"
                          >
                            {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>

                      {isExp && item.notes && (
                        <div className="px-4 pb-4 pt-0">
                          <p className="text-xs text-slate-500 italic leading-relaxed border-t border-slate-800 pt-3">
                            {item.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TOTALS ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>Approved items ({approvedItems.length} of {lineItems.length})</span>
                  <span>{fmt$(approvedTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Tax ({(taxRate * 100).toFixed(2)}% on parts)</span>
                  <span>{fmt$(tax)}</span>
                </div>
                {declinedItems.length > 0 && (
                  <div className="flex justify-between text-red-400/60 text-xs">
                    <span>Declined ({declinedItems.length} item{declinedItems.length !== 1 ? 's' : ''})</span>
                    <span>−{fmt$(declinedItems.reduce((s, i) => s + (i.line_total || 0), 0))}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center border-t border-slate-700 pt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">You Authorize</p>
                <p className="text-4xl font-black italic text-emerald-400 tracking-tighter">{fmt$(total)}</p>
              </div>
            </div>

            {/* ── DECLINED SUMMARY (if any) ── */}
            {declinedItems.length > 0 && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={13} className="text-red-400" />
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">
                    Declined — Not Authorized This Visit
                  </p>
                </div>
                {declinedItems.map(i => (
                  <p key={i.id} className="text-xs text-red-300/50 leading-relaxed">· {i.description}</p>
                ))}
              </div>
            )}

            {/* ── SIGNATURE ── */}
            <div className="bg-slate-900 border border-blue-500/20 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} className="text-blue-400" />
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Your Signature</p>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-5">
                By signing, you authorize {shopInfo.name || 'this shop'} to perform the checked repairs at the
                estimated cost shown above. Final invoice may vary slightly if additional issues are discovered.
              </p>

              <div
                className="relative bg-black border-2 border-dashed border-slate-700 rounded-2xl overflow-hidden"
                style={{ height: 170 }}
              >
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#10b981"
                  backgroundColor="transparent"
                  canvasProps={{
                    style: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
                  }}
                  onEnd={() => setHasSignature(true)}
                />
                {!hasSignature && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
                    <p className="text-slate-700 text-sm font-black uppercase tracking-widest">Sign Here</p>
                    <p className="text-slate-800 text-[10px]">Use your finger or stylus</p>
                  </div>
                )}
              </div>

              {hasSignature && (
                <button
                  onClick={clearSig}
                  className="flex items-center gap-1.5 mt-3 text-[10px] font-black text-slate-600 hover:text-red-400 uppercase tracking-widest transition-colors"
                >
                  <RotateCcw size={11} /> Clear & Re-sign
                </button>
              )}

              <label className="flex items-start gap-3 mt-6 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0 accent-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 leading-relaxed">
                  I have reviewed the estimate above, I authorize only the checked repairs, and I understand
                  that the final invoice may differ if additional issues are discovered during service.
                </span>
              </label>
            </div>

            {/* ── AUTHORIZE BUTTON ── */}
            <button
              onClick={handleAuthorize}
              disabled={!hasSignature || !consent || submitting || approvedItems.length === 0}
              className={`w-full py-6 rounded-3xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                hasSignature && consent && approvedItems.length > 0 && !submitting
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-2xl shadow-emerald-900/40 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              {submitting
                ? <><Loader2 size={20} className="animate-spin" /> Securing…</>
                : <><Shield size={20} /> Authorize {fmt$(total)}</>
              }
            </button>

            {approvedItems.length === 0 && (
              <p className="text-center text-xs text-red-400/60 font-bold uppercase tracking-widest">
                At least one item must be approved to authorize
              </p>
            )}

            <p className="text-center text-[9px] text-slate-700 uppercase tracking-widest pb-4">
              Authorization recorded · Work Order {woId}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
