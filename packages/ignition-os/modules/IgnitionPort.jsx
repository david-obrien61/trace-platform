/**
 * FILE: IgnitionPort.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Customer portal view for presenting repair estimates and collecting digital signatures.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { Check, ChevronRight, ArrowLeft, Database, Store, Lock, Unlock, Wrench, XCircle, Send } from 'lucide-react';
import DataBridge from '../DataBridge';
import { MarginEngine } from '../MarginEngine';
import CustomerApprovalPortal from './CustomerApprovalPortal';

const STYLE_DEBUG = false;

const IgnitionPort = ({ activeJob, allJobs = [], onUpdateJob, onSelectJob }) => {
  const [viewMode, setViewMode] = useState('LIST');
  const [pricingData, setPricingData] = useState({});
  const [tasks, setTasks] = useState([]);
  const [laborRate, setLaborRate] = useState('');
  const [incidentals, setIncidentals] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const [approvalJob, setApprovalJob] = useState(null);
  const vendors = DataBridge.getVendors();

  const handleProceedToSignature = () => {
    const pricedParts = activeJob.suggestedParts?.map(part => {
      const pState = pricingData[part.id] || {};
      return {
        ...part,
        wholesaleCost: parseFloat(pState.cost) || 0,
        retailPrice: MarginEngine.calculateRetail(pState.cost) * part.qty,
        source: pState.source || 'INVENTORY',
        vendor: pState.vendor || 'SHOP_STOCK'
      };
    }) || [];
    const updatedJob = { ...activeJob, suggestedParts: pricedParts, tasks, incidentals };
    if (onUpdateJob) onUpdateJob(updatedJob);
    setViewMode('SIGNATURE');
  };

  const handleSendSMS = () => {
    const pricedParts = activeJob.suggestedParts?.map(part => {
      const pState = pricingData[part.id] || {};
      return {
        ...part,
        wholesaleCost: parseFloat(pState.cost) || 0,
        retailPrice: MarginEngine.calculateRetail(pState.cost) * part.qty,
        source: pState.source || 'INVENTORY',
        vendor: pState.vendor || 'SHOP_STOCK'
      };
    }) || [];
    const updatedJob = { ...activeJob, suggestedParts: pricedParts, tasks, incidentals, status: 'PENDING_CUSTOMER_APPROVAL', sentAt: new Date().toISOString() };
    if (onUpdateJob) onUpdateJob(updatedJob);
    setApprovalJob(updatedJob);
  };

  if (approvalJob) {
    return (
      <CustomerApprovalPortal
        job={approvalJob}
        onAuthorized={(sigDataUrl) => {
          const now = new Date().toISOString();
          const vendorParts = (approvalJob.suggestedParts || []).filter(p => p.source === 'VENDOR');
          let purchaseOrders = [];
          if (vendorParts.length > 0) {
            const byVendor = vendorParts.reduce((acc, p) => {
              const v = p.vendor || 'Unknown Vendor';
              if (!acc[v]) acc[v] = [];
              acc[v].push(p);
              return acc;
            }, {});
            purchaseOrders = Object.entries(byVendor).map(([vendor, parts]) => ({
              id: `PO-${Date.now()}-${vendor.replace(/\s+/g, '').slice(0, 8)}`,
              woId: approvalJob.jobId || approvalJob.id,
              vendor, parts, status: 'ORDERED', createdAt: now,
              customerName: approvalJob.name,
              vehicle: [approvalJob.year, approvalJob.make, approvalJob.model].filter(Boolean).join(' '),
            }));
            const existing = DataBridge.load('purchase_orders') || [];
            DataBridge.save('purchase_orders', [...existing, ...purchaseOrders]);
          }
          const authorizedJob = { ...approvalJob, status: 'AUTHORIZED', signature: sigDataUrl, authorizedAt: now, purchaseOrders };
          if (onUpdateJob) onUpdateJob(authorizedJob);
          DataBridge.smartSync('ESTIMATE_APPROVED', { wo_id: authorizedJob.jobId || authorizedJob.id, signature: sigDataUrl, timestamp: now, status: 'AUTHORIZED', purchase_orders: purchaseOrders });
          setApprovalJob(null);
          setViewMode('LIST');
        }}
        onClose={() => setApprovalJob(null)}
      />
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  if (viewMode === 'LIST') {
    const openBuilder = (job) => {
      if (onSelectJob) onSelectJob(job);
      const rates = DataBridge.getSystemRates();
      const jobRate = job?.customerTier === 'FLEET' ? rates.BASE - 10 : (job?.customerTier === 'FF' ? rates.BASE - 25 : rates.BASE);
      setLaborRate(jobRate);
      const enrichedParts = (job?.suggestedParts || []).map((p, idx) => ({ ...p, id: p.id || `PART-${Date.now()}-${idx}` }));
      let initialTasks = (job?.tasks || []).map((t, idx) => ({
        ...t, id: t.id || `TASK-${Date.now()}-${idx}`,
        description: t.description || 'General Labor',
        suggested_hours: t.suggested_hours || 0,
        billed_hours: t.billed_hours !== undefined ? t.billed_hours : (t.suggested_hours || 0),
        rate: t.rate || jobRate,
      }));
      if (initialTasks.length === 0) {
        if (job?.transcription?.toLowerCase().includes('turbo'))
          initialTasks.push({ id: `TASK-${Date.now()}`, description: 'Turbocharger R&R', suggested_hours: 3.5, billed_hours: 3.5, rate: jobRate });
        else if (job?.transcription?.toLowerCase().includes('oil'))
          initialTasks.push({ id: `TASK-${Date.now()}`, description: 'Standard Oil Change', suggested_hours: 0.5, billed_hours: 0.5, rate: jobRate });
      }
      setTasks(initialTasks);
      setIncidentals(job?.incidentals || '35.00');
      const initialPricing = {};
      enrichedParts.forEach((p, idx) => {
        let defaultCost = '45.00';
        if (p.name.toLowerCase().includes('turbo')) defaultCost = '450.00';
        if (p.name.toLowerCase().includes('oil')) defaultCost = '15.00';
        if (p.name.toLowerCase().includes('gasket')) defaultCost = '28.50';
        initialPricing[p.id] = { source: 'VENDOR', vendor: vendors[idx % vendors.length]?.name || 'NAPA Auto Parts', cost: defaultCost, locked: false };
      });
      setPricingData(initialPricing);
      if (onSelectJob) onSelectJob({ ...job, suggestedParts: enrichedParts, tasks: initialTasks });
      setViewMode('BUILDER');
    };

    // NON-1:1: col.color/dot/text were Tailwind class strings → refactored to hex values
    const cols = [
      { key: 'FROM_TECH',  label: 'From Tech',          sub: 'Needs pricing',        borderColor: '#f97316', dotColor: '#f97316', textColor: '#fb923c', jobs: allJobs.filter(j => j.status === 'NEEDS_ESTIMATE'),             clickable: true  },
      { key: 'ACTIONED',   label: 'Actioned',            sub: 'Estimate built',       borderColor: '#3b82f6', dotColor: '#3b82f6', textColor: '#60a5fa', jobs: allJobs.filter(j => j.status === 'READY'),                      clickable: true  },
      { key: 'AWAITING',   label: 'Awaiting Signature',  sub: 'Sent to customer',     borderColor: '#f59e0b', dotColor: '#f59e0b', textColor: '#fbbf24', jobs: allJobs.filter(j => j.status === 'PENDING_CUSTOMER_APPROVAL'),   clickable: true  },
      { key: 'AUTHORIZED', label: 'Authorized',          sub: 'Customer approved',    borderColor: '#10b981', dotColor: '#10b981', textColor: '#34d399', jobs: allJobs.filter(j => j.status === 'AUTHORIZED'),                  clickable: false },
    ];

    const fmt$ = (n) => `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const jobTotal = (job) => {
      const parts = (job.suggestedParts || []).reduce((s, p) => s + (p.retailPrice || 0), 0);
      const labor = (job.tasks || []).reduce((s, t) => s + ((t.billed_hours || 0) * (t.rate || 0)), 0);
      const diag = parts > 0 ? 195 : 0;
      return parts + labor + diag + (parseFloat(job.incidentals) || 0);
    };

    return (
      <div style={{ padding: '24px', background: '#020617', minHeight: '100vh', color: '#e2e8f0', paddingBottom: '96px' }}>
        <header style={{ marginBottom: '32px', borderBottom: '1px solid #1e293b', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, fontStyle: 'italic', color: '#10b981', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Estimates // Pipeline</h2>
            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
              {allJobs.filter(j => ['NEEDS_ESTIMATE','READY','PENDING_CUSTOMER_APPROVAL','AUTHORIZED'].includes(j.status)).length} active work orders
            </p>
          </div>
        </header>

        {/* NON-1:1: grid-cols-1 md:grid-cols-2 xl:grid-cols-4 → always 4 cols (kanban board, desktop-first) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {cols.map(col => (
            <div key={col.key} style={{ background: 'rgba(15,23,42,0.5)', borderTop: `2px solid ${col.borderColor}`, borderRadius: '16px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.dotColor }} />
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: col.textColor }}>{col.label}</p>
                    <p style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.sub}</p>
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 900, padding: '2px 8px', borderRadius: '9999px', backgroundColor: col.dotColor, color: '#000000' }}>
                  {col.jobs.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {col.jobs.length === 0 && (
                  <div style={{ border: '1px dashed #1e293b', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '9px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 900 }}>Empty</p>
                  </div>
                )}
                {col.jobs.map(job => {
                  const total = jobTotal(job);
                  const vendorParts = (job.suggestedParts || []).filter(p => p.source === 'VENDOR');
                  const inventoryParts = (job.suggestedParts || []).filter(p => p.source === 'INVENTORY');
                  const poCreated = job.purchaseOrders?.length > 0;

                  return (
                    <div
                      key={job.jobId || job.id}
                      onClick={col.clickable ? () => openBuilder(job) : undefined}
                      className={col.clickable ? 'ign-card-hover' : ''}
                      style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', cursor: col.clickable ? 'pointer' : 'default' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>{job.jobId || job.id}</p>
                        {col.clickable && <ChevronRight size={12} style={{ color: '#475569' }} />}
                      </div>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '2px' }}>{job.name || 'Unknown Customer'}</p>
                      <p style={{ fontSize: '10px', color: '#64748b' }}>{[job.year, job.make, job.model].filter(Boolean).join(' ')}</p>

                      {total > 0 && (
                        <p style={{ fontSize: '14px', fontWeight: 900, marginTop: '8px', color: col.textColor }}>{fmt$(total)}</p>
                      )}

                      {col.key === 'AUTHORIZED' && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {poCreated ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                              <p style={{ fontSize: '9px', color: '#34d399', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {job.purchaseOrders.length} PO{job.purchaseOrders.length !== 1 ? 's' : ''} Issued
                              </p>
                            </div>
                          ) : vendorParts.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {/* NON-1:1: animate-pulse → ign-pulse */}
                              <div className="ign-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                              <p style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parts Ordering…</p>
                            </div>
                          ) : null}
                          {inventoryParts.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                              <p style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{inventoryParts.length} from stock</p>
                            </div>
                          )}
                          {job.authorizedAt && (
                            <p style={{ fontSize: '8px', color: '#334155', fontFamily: 'monospace', marginTop: '4px' }}>
                              {new Date(job.authorizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      )}

                      {col.key === 'AWAITING' && job.sentAt && (
                        <p style={{ fontSize: '9px', color: '#d97706', fontWeight: 900, marginTop: '8px', textTransform: 'uppercase' }}>
                          Sent {Math.round((Date.now() - new Date(job.sentAt).getTime()) / 60000)}m ago
                        </p>
                      )}

                      {col.key === 'FROM_TECH' && job.transcription && (
                        // NON-1:1: line-clamp-2 → -webkit-box clamping
                        <p style={{ fontSize: '9px', color: '#475569', fontStyle: 'italic', marginTop: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{job.transcription}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── DATA MAPPING FOR BUILDER & SIGNATURE ─────────────────────────────────────
  const data = {
    id: activeJob?.jobId || activeJob?.id || "WO-999",
    vehicle: activeJob ? `${activeJob.year || ''} ${activeJob.make || ''} ${activeJob.model || ''}`.trim().toUpperCase() : "Unknown Asset",
    items: activeJob?.suggestedParts?.map(part => ({ desc: `${part.name} (x${part.qty})`, retail: part.retailPrice || 0 })) || [],
  };
  if (data.items.length > 0 && !data.items.find(i => i.desc.includes('Diagnostic'))) {
    data.items.unshift({ desc: "Standard Diagnostic Fee", retail: 195.00 });
  }
  if (activeJob?.tasks?.length > 0) {
    activeJob.tasks.forEach(task => {
      if (task.billed_hours > 0) {
        data.items.push({ desc: `Labor: ${task.description} (${task.billed_hours} hrs @ $${task.rate}/hr)`, retail: task.billed_hours * task.rate });
      }
    });
  }
  if (activeJob?.incidentals > 0) {
    data.items.push({ desc: "Shop Supplies & Env. Fees", retail: activeJob.incidentals });
  }
  data.total = data.items.reduce((sum, item) => sum + item.retail, 0);

  // ── SIGNATURE APPROVAL (handleFinalApproval) ──────────────────────────────────
  const handleFinalApproval = () => {
    if (!isSigned || !legalConsent) {
      alert("Please tap to sign and check the consent box to authorize work.");
      return;
    }
    const signature = "DIGITAL_AUTOSIGN_" + (activeJob?.name || activeJob?.unit || "CUSTOMER");
    const updatedJob = { ...activeJob, status: 'AUTHORIZED' };
    if (onUpdateJob) onUpdateJob(updatedJob);
    DataBridge.smartSync('ESTIMATE_APPROVED', { wo_id: data.id, signature, timestamp: new Date().toISOString(), status: 'AUTHORIZED' });
    setIsApproved(true);
  };

  if (isApproved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#020617', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 10px 15px rgba(6,78,59,0.2)' }}>
          <Check size={40} style={{ color: '#ffffff' }} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic' }}>Work Authorized</h2>
        <p style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '12px', marginTop: '8px', textTransform: 'uppercase' }}>The shop has been notified. We're on it.</p>
      </div>
    );
  }

  // ── BUILDER VIEW ──────────────────────────────────────────────────────────────
  if (viewMode === 'BUILDER') {
    return (
      <div style={{ padding: '24px', background: '#020617', minHeight: '100vh', color: '#e2e8f0', paddingBottom: '96px' }}>
        {/* NON-1:1: hover:text-white → dropped */}
        <button onClick={() => setViewMode('LIST')} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Back to Queue
        </button>

        <header style={{ marginBottom: '32px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#10b981', marginBottom: '4px' }}>Estimate Builder</h2>
              <h3 style={{ fontSize: '30px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>{activeJob?.name || 'Unknown Customer'}</h3>
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{data.vehicle}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '24px' }}>WO #{data.id}</p>
            </div>
          </div>
        </header>

        {/* NON-1:1: grid-cols-1 lg:grid-cols-3 → always 2-col 1:2 split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* LEFT: AI TRANSCRIPTION & PARTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.25)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Reported Issue</h3>
              <p style={{ fontSize: '14px', color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.6 }}>"{activeJob?.complaint || activeJob?.problem || 'No specific problem reported during intake.'}"</p>
            </div>

            {activeJob?.advisories && (
              <div style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.25)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Advisory Notes</h3>
                <p style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '12px' }}>Not Authorized This Visit</p>
                {activeJob.advisories.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>· {line}</p>
                ))}
              </div>
            )}

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.25)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Tech Diagnostic Notes</h3>
              <p style={{ fontSize: '14px', color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.6 }}>"{activeJob?.transcription || 'No diagnostic notes provided.'}"</p>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.25)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>AI Extracted Parts</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeJob?.suggestedParts?.map((part, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 700, color: '#cbd5e1', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
                    <span>{part.name}</span>
                    <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>QTY {part.qty}</span>
                  </li>
                ))}
                {(!activeJob?.suggestedParts || activeJob.suggestedParts.length === 0) && (
                  <li style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No parts extracted.</li>
                )}
              </ul>
            </div>
          </div>

          {/* RIGHT: PRICING ENGINE & SOURCING */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} /> Asset Sourcing & Pricing Engine
              </h3>
              {activeJob?.suggestedParts?.map((part) => {
                const pState = pricingData[part.id] || { source: 'INVENTORY', vendor: '', cost: '', locked: false };
                const retail = MarginEngine.calculateRetail(pState.cost);
                const isLocked = pState.locked;

                return (
                  <div key={part.id} style={{ background: '#0f172a', border: `1px solid ${isLocked ? 'rgba(16,185,129,0.5)' : '#1e293b'}`, borderRadius: '16px', padding: '20px', boxShadow: isLocked ? '0 0 15px rgba(16,185,129,0.1)' : '0 20px 25px rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase' }}>{part.name} <span style={{ color: '#10b981' }}>x{part.qty}</span></h4>
                      {isLocked ? (
                        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12}/> LOCKED</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, source: 'INVENTORY'}})} style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', borderRadius: '4px', background: pState.source === 'INVENTORY' ? '#2563eb' : '#1e293b', color: pState.source === 'INVENTORY' ? '#ffffff' : '#64748b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Database size={12} /> Inventory</button>
                          <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, source: 'VENDOR'}})} style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', borderRadius: '4px', background: pState.source === 'VENDOR' ? '#ea580c' : '#1e293b', color: pState.source === 'VENDOR' ? '#ffffff' : '#64748b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Store size={12} /> Vendor</button>
                        </div>
                      )}
                    </div>

                    {!isLocked ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'flex-end', background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                        {pState.source === 'VENDOR' ? (
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Query Vendor Network</label>
                            {/* NON-1:1: focus:border-orange-500 → ign-input class */}
                            <select value={pState.vendor} onChange={e => setPricingData({...pricingData, [part.id]: {...pState, vendor: e.target.value}})} className="ign-input" style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', color: '#ffffff', fontWeight: 700, fontSize: '12px', outline: 'none' }}>
                              <option value="">-- Select Partner --</option>
                              {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Stock Location</label>
                            <div style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>Aisle 4, Bin B</div>
                          </div>
                        )}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Unit Wholesale Cost ($)</label>
                          {/* NON-1:1: focus:border-blue-500 → ign-input class */}
                          <input type="number" value={pState.cost} onChange={e => setPricingData({...pricingData, [part.id]: {...pState, cost: e.target.value}})} className="ign-input" style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', color: '#ffffff', fontWeight: 900, fontSize: '14px', outline: 'none' }} placeholder="0.00" />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Source: <strong style={{ color: pState.source === 'INVENTORY' ? '#60a5fa' : '#fb923c' }}>{pState.source === 'INVENTORY' ? 'SHOP INVENTORY' : pState.vendor}</strong></span>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Cost: <strong style={{ color: '#ffffff' }}>${parseFloat(pState.cost || 0).toFixed(2)}</strong></span>
                      </div>
                    )}

                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.1em' }}>Calculated Retail (x{part.qty})</span>
                        {/* NON-1:1: tabular-nums → fontVariantNumeric */}
                        <span style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>${(retail * part.qty).toFixed(2)}</span>
                      </div>
                      {!isLocked ? (
                        <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, locked: true}})} disabled={!pState.cost} style={{ fontSize: '10px', fontWeight: 900, padding: '12px 24px', borderRadius: '12px', textTransform: 'uppercase', background: pState.cost ? '#059669' : '#1e293b', color: pState.cost ? '#ffffff' : '#64748b', boxShadow: pState.cost ? '0 10px 15px rgba(6,78,59,0.4)' : 'none', border: 'none', cursor: pState.cost ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={14} /> Lock Part</button>
                      ) : (
                        <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, locked: false}})} style={{ background: '#1e293b', color: '#94a3b8', fontSize: '10px', fontWeight: 900, padding: '12px 24px', borderRadius: '12px', textTransform: 'uppercase', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Unlock size={14} /> Edit</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LABOR & INCIDENTALS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.25)' }}>
              {/* NON-1:1: sm:flex-row → always row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wrench size={16} /> Labor Tasks
                </h3>
                {/* NON-1:1: focus:border-blue-500 → ign-input */}
                <select
                  onChange={(e) => {
                    const guide = DataBridge.getLaborGuide()[e.target.value];
                    if (guide) {
                      setTasks([...tasks, { id: `TASK-${Date.now()}`, description: guide.job, suggested_hours: guide.hours, billed_hours: guide.hours, rate: parseFloat(laborRate) || 0 }]);
                    }
                    e.target.value = '';
                  }}
                  className="ign-input"
                  style={{ background: '#020617', border: '1px solid #1e293b', color: '#94a3b8', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', borderRadius: '8px', padding: '8px 12px', outline: 'none' }}
                >
                  <option value="">-- Add Standard Labor Task --</option>
                  {Object.entries(DataBridge.getLaborGuide()).map(([key, d]) => (
                    <option key={key} value={key}>{d.job} ({d.hours} hrs)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tasks.map((task, idx) => (
                  // NON-1:1: grid-cols-12 col-span-6/2/2/2 → gridTemplateColumns proportional
                  <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '6fr 2fr 2fr 2fr', gap: '16px', alignItems: 'center', background: '#020617', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                    <div>
                      <label style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Task Description</label>
                      <input type="text" value={task.description} onChange={(e) => {
                        const newTasks = [...tasks];
                        newTasks[idx].description = e.target.value;
                        setTasks(newTasks);
                      }} style={{ width: '100%', background: 'transparent', color: '#ffffff', fontWeight: 700, fontSize: '12px', outline: 'none', border: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Suggested</label>
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace' }}>{task.suggested_hours} hrs</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Billed</label>
                      {/* NON-1:1: focus:border-emerald-500 → ign-input */}
                      <input type="number" value={task.billed_hours} onChange={(e) => {
                        const newTasks = [...tasks];
                        newTasks[idx].billed_hours = parseFloat(e.target.value) || 0;
                        setTasks(newTasks);
                      }} className="ign-input" style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '6px', color: '#ffffff', fontWeight: 900, fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <label style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Task Total</label>
                      <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '14px' }}>${(task.billed_hours * task.rate).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px', border: '1px dashed #1e293b', borderRadius: '12px', fontSize: '10px', color: '#64748b', fontWeight: 900, textTransform: 'uppercase' }}>
                    No labor tasks added. Select from the guide above.
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Global Hourly Rate {activeJob?.customerTier && <span style={{ color: '#10b981' }}>({activeJob.customerTier})</span>}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700 }}>$</span>
                    {/* NON-1:1: focus:border-blue-500 → ign-input */}
                    <input type="number" value={laborRate} onChange={e => { const r = parseFloat(e.target.value) || 0; setLaborRate(r); setTasks(tasks.map(t => ({...t, rate: r}))); }} className="ign-input" style={{ width: '100%', background: '#020617', border: '1px solid #334155', borderRadius: '8px', paddingLeft: '28px', paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px', color: '#ffffff', fontWeight: 900, outline: 'none' }} placeholder="165" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Shop Supplies</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700 }}>$</span>
                    {/* NON-1:1: focus:border-blue-500 → ign-input */}
                    <input type="number" value={incidentals} onChange={e => setIncidentals(e.target.value)} className="ign-input" style={{ width: '100%', background: '#020617', border: '1px solid #334155', borderRadius: '8px', paddingLeft: '28px', paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px', color: '#ffffff', fontWeight: 900, outline: 'none' }} placeholder="35.00" />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              {/* NON-1:1: active:scale-95 → ign-card-hover */}
              <button onClick={handleProceedToSignature} className="ign-card-hover" style={{ flex: 1, background: '#059669', padding: '24px', borderRadius: '32px', color: '#ffffff', fontWeight: 900, textTransform: 'uppercase', fontSize: '14px', boxShadow: '0 20px 25px rgba(6,78,59,0.4)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                In-Person Kiosk Sign
              </button>
              <button onClick={handleSendSMS} className="ign-card-hover" style={{ flex: 1, background: '#2563eb', padding: '24px', borderRadius: '32px', color: '#ffffff', fontWeight: 900, textTransform: 'uppercase', fontSize: '14px', boxShadow: '0 20px 25px rgba(30,58,138,0.4)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <Send size={18} /> Present to Customer
              </button>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em', textAlign: 'center', marginTop: '16px' }}>Hand device to customer · Twilio SMS integration coming soon.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── SIGNATURE VIEW ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', background: '#020617', minHeight: '100vh', color: '#e2e8f0', paddingBottom: '96px' }}>
      <button onClick={() => setViewMode('BUILDER')} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <ArrowLeft size={14} /> Back to Builder
      </button>

      <header style={{ marginBottom: '32px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '14px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', marginBottom: '4px' }}>Customer Authorization</h1>
            <h3 style={{ fontSize: '30px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>{activeJob?.name || 'Unknown Customer'}</h3>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{data.vehicle}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '24px' }}>WO #{data.id}</p>
          </div>
        </div>
      </header>

      <div style={{ background: '#0f172a', borderRadius: '24px', border: '1px solid #1e293b', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <table style={{ width: '100%', textAlign: 'left', fontSize: '11px' }}>
          <thead style={{ background: 'rgba(30,41,59,0.5)', color: '#64748b', textTransform: 'uppercase', fontWeight: 900, fontStyle: 'italic' }}>
            <tr>
              <th style={{ padding: '16px' }}>Description</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody style={{ color: '#e2e8f0' }}>
            {data.items.map((item, i) => (
              <tr key={i} style={{ borderTop: '1px solid rgba(30,41,59,0.5)' }}>
                <td style={{ padding: '16px', fontWeight: 700 }}>{item.desc}</td>
                <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace' }}>${item.retail ? item.retail.toFixed(2) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '24px', background: 'rgba(37,99,235,0.1)', borderTop: '1px solid rgba(59,130,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', fontStyle: 'italic' }}>Grand Total</span>
          <span style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>${data.total ? data.total.toFixed(2) : "0.00"}</span>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '40px', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <p style={{ textAlign: 'center', fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>Tap to Authorize Repair</p>

        {/* NON-1:1: hover:bg-slate-100 on unsigned state → dropped */}
        <div
          onClick={() => setIsSigned(true)}
          style={{ border: `2px ${isSigned ? 'solid' : 'dashed'} ${isSigned ? '#10b981' : '#cbd5e1'}`, background: isSigned ? '#ecfdf5' : '#f8fafc', borderRadius: '16px', marginBottom: '24px', height: '128px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {isSigned ? (
            <span style={{ fontSize: '36px', color: '#047857', fontFamily: "'Brush Script MT', 'Caveat', cursive" }}>
              {activeJob?.name || activeJob?.unit || 'Customer Authorized'}
            </span>
          ) : (
            <span style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tap Here to Sign</span>
          )}
        </div>

        {isSigned && (
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <input
              type="checkbox"
              id="legalConsent"
              checked={legalConsent}
              onChange={(e) => setLegalConsent(e.target.checked)}
              style={{ marginTop: '4px', width: '20px', height: '20px', cursor: 'pointer', accentColor: '#10b981' }}
            />
            <label htmlFor="legalConsent" style={{ fontSize: '12px', fontWeight: 700, color: '#475569', lineHeight: 1.4, cursor: 'pointer', userSelect: 'none' }}>
              By checking this box, you are approving the estimate and legally authorizing the shop to perform the listed repairs.
            </label>
          </div>
        )}

        <button
          onClick={handleFinalApproval}
          disabled={!isSigned || !legalConsent}
          style={{ width: '100%', padding: '24px', borderRadius: '32px', fontWeight: 900, textTransform: 'uppercase', fontSize: '18px', background: (isSigned && legalConsent) ? '#059669' : '#e2e8f0', color: (isSigned && legalConsent) ? '#ffffff' : '#94a3b8', boxShadow: (isSigned && legalConsent) ? '0 20px 25px rgba(6,78,59,0.4)' : 'none', border: 'none', cursor: (isSigned && legalConsent) ? 'pointer' : 'not-allowed' }}
        >
          Authorize Work
        </button>
      </div>
    </div>
  );
};

export default IgnitionPort;
