/**
 * FILE: IgnitionPort.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Customer portal view for presenting repair estimates and collecting digital signatures.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { Check, ChevronRight, ArrowLeft, Database, Store, Lock, Unlock, Wrench, Plus, Zap, XCircle, Send } from 'lucide-react';
import DataBridge from '../DataBridge';
import { MarginEngine } from '../MarginEngine';
import CustomerApprovalPortal from './CustomerApprovalPortal';

const IgnitionPort = ({ activeJob, allJobs = [], onUpdateJob, onSelectJob }) => {
  const [viewMode, setViewMode] = useState('LIST'); // 'LIST', 'BUILDER', 'SIGNATURE'
  const [pricingData, setPricingData] = useState({}); // Stores pricing/sourcing state for each part
  const [tasks, setTasks] = useState([]); // Stores { id, description, suggested_hours, billed_hours, rate }
  const [laborRate, setLaborRate] = useState('');
  const [incidentals, setIncidentals] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const [approvalJob, setApprovalJob] = useState(null);
  const vendors = DataBridge.getVendors();

  const handleProceedToSignature = () => {
    // Map the locked pricing data into the job object
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
    
    const updatedJob = { ...activeJob, suggestedParts: pricedParts, tasks: tasks, incidentals: incidentals };
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

  // ── Customer approval portal overlay ─────────────────────────────────────────
  if (approvalJob) {
    return (
      <CustomerApprovalPortal
        job={approvalJob}
        onAuthorized={(sigDataUrl) => {
          const now = new Date().toISOString();

          // ── Auto-generate purchase orders for vendor-sourced parts ──────────
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
              vendor,
              parts,
              status: 'ORDERED',
              createdAt: now,
              customerName: approvalJob.name,
              vehicle: [approvalJob.year, approvalJob.make, approvalJob.model].filter(Boolean).join(' '),
            }));
            const existing = DataBridge.load('purchase_orders') || [];
            DataBridge.save('purchase_orders', [...existing, ...purchaseOrders]);
          }

          const authorizedJob = {
            ...approvalJob,
            status: 'AUTHORIZED',
            signature: sigDataUrl,
            authorizedAt: now,
            purchaseOrders,
          };
          if (onUpdateJob) onUpdateJob(authorizedJob);
          DataBridge.smartSync('ESTIMATE_APPROVED', {
            wo_id: authorizedJob.jobId || authorizedJob.id,
            signature: sigDataUrl,
            timestamp: now,
            status: 'AUTHORIZED',
            purchase_orders: purchaseOrders,
          });
          setApprovalJob(null);
          setViewMode('LIST');
        }}
        onClose={() => setApprovalJob(null)}
      />
    );
  }

  // ==========================================
  // VIEW 1: KANBAN ESTIMATE BOARD
  // ==========================================
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

    const cols = [
      {
        key: 'FROM_TECH',
        label: 'From Tech',
        sub: 'Needs pricing',
        color: 'border-orange-500',
        dot: 'bg-orange-500',
        text: 'text-orange-400',
        jobs: allJobs.filter(j => j.status === 'NEEDS_ESTIMATE'),
        clickable: true,
      },
      {
        key: 'ACTIONED',
        label: 'Actioned',
        sub: 'Estimate built',
        color: 'border-blue-500',
        dot: 'bg-blue-500',
        text: 'text-blue-400',
        jobs: allJobs.filter(j => j.status === 'READY'),
        clickable: true,
      },
      {
        key: 'AWAITING',
        label: 'Awaiting Signature',
        sub: 'Sent to customer',
        color: 'border-amber-500',
        dot: 'bg-amber-500',
        text: 'text-amber-400',
        jobs: allJobs.filter(j => j.status === 'PENDING_CUSTOMER_APPROVAL'),
        clickable: true,
      },
      {
        key: 'AUTHORIZED',
        label: 'Authorized',
        sub: 'Customer approved',
        color: 'border-emerald-500',
        dot: 'bg-emerald-500',
        text: 'text-emerald-400',
        jobs: allJobs.filter(j => j.status === 'AUTHORIZED'),
        clickable: false,
      },
    ];

    const fmt$ = (n) => `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const jobTotal = (job) => {
      const parts = (job.suggestedParts || []).reduce((s, p) => s + (p.retailPrice || 0), 0);
      const labor = (job.tasks || []).reduce((s, t) => s + ((t.billed_hours || 0) * (t.rate || 0)), 0);
      const diag = parts > 0 ? 195 : 0;
      return parts + labor + diag + (parseFloat(job.incidentals) || 0);
    };

    return (
      <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
        <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black italic text-emerald-500 uppercase tracking-tighter">Estimates // Pipeline</h2>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
              {allJobs.filter(j => ['NEEDS_ESTIMATE','READY','PENDING_CUSTOMER_APPROVAL','AUTHORIZED'].includes(j.status)).length} active work orders
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {cols.map(col => (
            <div key={col.key} className={`bg-slate-900/50 border-t-2 ${col.color} rounded-2xl p-4`}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${col.text}`}>{col.label}</p>
                    <p className="text-[8px] text-slate-600 uppercase tracking-wider">{col.sub}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.dot} text-black`}>
                  {col.jobs.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {col.jobs.length === 0 && (
                  <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center">
                    <p className="text-[9px] text-slate-700 uppercase tracking-widest font-black">Empty</p>
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
                      className={`bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all ${col.clickable ? 'cursor-pointer hover:border-slate-600 active:scale-[0.98]' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">{job.jobId || job.id}</p>
                        {col.clickable && <ChevronRight size={12} className="text-slate-600" />}
                      </div>
                      <p className="text-xs font-bold text-slate-300 mb-0.5">{job.name || 'Unknown Customer'}</p>
                      <p className="text-[10px] text-slate-500">{[job.year, job.make, job.model].filter(Boolean).join(' ')}</p>

                      {total > 0 && (
                        <p className={`text-sm font-black mt-2 ${col.text}`}>{fmt$(total)}</p>
                      )}

                      {/* Authorized column: parts order status */}
                      {col.key === 'AUTHORIZED' && (
                        <div className="mt-3 space-y-1">
                          {poCreated ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <p className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">
                                {job.purchaseOrders.length} PO{job.purchaseOrders.length !== 1 ? 's' : ''} Issued
                              </p>
                            </div>
                          ) : vendorParts.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <p className="text-[9px] text-amber-400 font-black uppercase tracking-wider">Parts Ordering…</p>
                            </div>
                          ) : null}
                          {inventoryParts.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <p className="text-[9px] text-blue-400 font-black uppercase tracking-wider">{inventoryParts.length} from stock</p>
                            </div>
                          )}
                          {job.authorizedAt && (
                            <p className="text-[8px] text-slate-700 font-mono mt-1">
                              {new Date(job.authorizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Awaiting column: time waiting */}
                      {col.key === 'AWAITING' && job.sentAt && (
                        <p className="text-[9px] text-amber-600 font-black mt-2 uppercase">
                          Sent {Math.round((Date.now() - new Date(job.sentAt).getTime()) / 60000)}m ago
                        </p>
                      )}

                      {/* From tech: transcription snippet */}
                      {col.key === 'FROM_TECH' && job.transcription && (
                        <p className="text-[9px] text-slate-600 italic mt-2 line-clamp-2">"{job.transcription}"</p>
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

  // ==========================================
  // VIEW 2 & 3: DATA MAPPING FOR BUILDER & SIGNATURE
  // ==========================================
  const data = {
    id: activeJob?.jobId || activeJob?.id || "WO-999",
    vehicle: activeJob ? `${activeJob.year || ''} ${activeJob.make || ''} ${activeJob.model || ''}`.trim().toUpperCase() : "Unknown Asset",
    items: activeJob?.suggestedParts?.map(part => ({
      desc: `${part.name} (x${part.qty})`,
      retail: part.retailPrice || 0
    })) || [],
  };
  // Add standard diag fee if parts exist
  if (data.items.length > 0 && !data.items.find(i => i.desc.includes('Diagnostic'))) {
     data.items.unshift({ desc: "Standard Diagnostic Fee", retail: 195.00 });
  }
  
  // Map the granular Labor Tasks to the final receipt
  if (activeJob?.tasks?.length > 0) {
    activeJob.tasks.forEach(task => {
      if (task.billed_hours > 0) {
        data.items.push({
          desc: `Labor: ${task.description} (${task.billed_hours} hrs @ $${task.rate}/hr)`,
          retail: task.billed_hours * task.rate
        });
      }
    });
  }
  if (activeJob?.incidentals > 0) {
    data.items.push({
      desc: "Shop Supplies & Env. Fees",
      retail: activeJob.incidentals
    });
  }

  data.total = data.items.reduce((sum, item) => sum + item.retail, 0);

  // ==========================================
  // VIEW 3: CUSTOMER SIGNATURE CANVAS
  // ==========================================
  const handleFinalApproval = () => {
    if (!isSigned || !legalConsent) {
      alert("Please tap to sign and check the consent box to authorize work.");
      return;
    }
    
    const signature = "DIGITAL_AUTOSIGN_" + (activeJob?.name || activeJob?.unit || "CUSTOMER");
    const updatedJob = { ...activeJob, status: 'AUTHORIZED' };
    if (onUpdateJob) onUpdateJob(updatedJob);
    
    DataBridge.smartSync('ESTIMATE_APPROVED', {
      wo_id: data.id,
      signature: signature,
      timestamp: new Date().toISOString(),
      status: 'AUTHORIZED'
    });

    setIsApproved(true);
  };

  if (isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/20">
          <Check size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic">Work Authorized</h2>
        <p className="text-slate-500 font-mono text-xs mt-2 uppercase">The shop has been notified. We're on it.</p>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: THE ESTIMATE BUILDER (PRE-PRICING)
  // ==========================================
  if (viewMode === 'BUILDER') {
    return (
      <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
        <button onClick={() => setViewMode('LIST')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Queue
        </button>

        <header className="mb-8 border-b border-slate-800 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-black italic uppercase tracking-tighter text-emerald-500 mb-1">Estimate Builder</h2>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{activeJob?.name || 'Unknown Customer'}</h3>
              <p className="text-lg font-bold text-slate-300 uppercase tracking-wide">{data.vehicle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">WO #{data.id}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: AI TRANSCRIPTION & PARTS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest mb-4">Reported Issue</h3>
              <p className="text-sm text-slate-300 italic leading-relaxed">"{activeJob?.complaint || activeJob?.problem || 'No specific problem reported during intake.'}"</p>
            </div>

            {activeJob?.advisories && (
              <div className="bg-slate-900 border border-slate-600 rounded-3xl p-6 shadow-xl">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Advisory Notes</h3>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-3">Not Authorized This Visit</p>
                {activeJob.advisories.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm text-slate-500 leading-relaxed">· {line}</p>
                ))}
              </div>
            )}
            
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-4">Tech Diagnostic Notes</h3>
              <p className="text-sm text-slate-300 italic leading-relaxed">"{activeJob?.transcription || 'No diagnostic notes provided.'}"</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">AI Extracted Parts</h3>
              <ul className="space-y-3">
                {activeJob?.suggestedParts?.map((part, i) => (
                  <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-300 border-b border-slate-800 pb-2">
                    <span>{part.name}</span>
                    <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">QTY {part.qty}</span>
                  </li>
                ))}
                {(!activeJob?.suggestedParts || activeJob.suggestedParts.length === 0) && (
                  <li className="text-xs text-slate-500 italic">No parts extracted.</li>
                )}
              </ul>
            </div>
          </div>

          {/* RIGHT: PRICING ENGINE & SOURCING WORKFLOW */}
          <div className="lg:col-span-2">
             <div className="space-y-4 mb-6">
               <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Database size={16} /> Asset Sourcing & Pricing Engine
               </h3>
               {activeJob?.suggestedParts?.map((part) => {
                  const pState = pricingData[part.id] || { source: 'INVENTORY', vendor: '', cost: '', locked: false };
                  const retail = MarginEngine.calculateRetail(pState.cost);
                  const isLocked = pState.locked;

                  return (
                    <div key={part.id} className={`bg-slate-900 border rounded-2xl p-5 transition-all ${isLocked ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-slate-800 shadow-xl'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black text-white uppercase">{part.name} <span className="text-emerald-500">x{part.qty}</span></h4>
                        {isLocked ? (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded flex items-center gap-1"><Lock size={12}/> LOCKED</span>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, source: 'INVENTORY'}})} className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors flex items-center gap-1 ${pState.source === 'INVENTORY' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}><Database size={12} /> Inventory</button>
                            <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, source: 'VENDOR'}})} className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors flex items-center gap-1 ${pState.source === 'VENDOR' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}><Store size={12} /> Vendor</button>
                          </div>
                        )}
                      </div>

                      {!isLocked ? (
                        <div className="grid grid-cols-2 gap-4 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
                          {pState.source === 'VENDOR' ? (
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Query Vendor Network</label>
                              <select value={pState.vendor} onChange={e => setPricingData({...pricingData, [part.id]: {...pState, vendor: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-bold text-xs outline-none focus:border-orange-500">
                                <option value="">-- Select Partner --</option>
                                {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Stock Location</label>
                              <div className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-emerald-500 font-mono font-bold text-xs flex items-center gap-2">Aisle 4, Bin B</div>
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Unit Wholesale Cost ($)</label>
                            <input type="number" value={pState.cost} onChange={e => setPricingData({...pricingData, [part.id]: {...pState, cost: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-black text-sm outline-none focus:border-blue-500 transition-colors" placeholder="0.00" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-emerald-500/20">
                          <span className="text-xs text-slate-400 font-black uppercase">Source: <strong className={pState.source === 'INVENTORY' ? 'text-blue-400' : 'text-orange-400'}>{pState.source === 'INVENTORY' ? 'SHOP INVENTORY' : pState.vendor}</strong></span>
                          <span className="text-xs text-slate-400 font-black uppercase">Cost: <strong className="text-white">${parseFloat(pState.cost || 0).toFixed(2)}</strong></span>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Calculated Retail (x{part.qty})</span>
                          <span className="text-2xl font-black text-white tabular-nums">${(retail * part.qty).toFixed(2)}</span>
                        </div>
                        {!isLocked ? (
                          <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, locked: true}})} className={`text-[10px] font-black px-6 py-3 rounded-xl uppercase transition-all shadow-lg flex items-center gap-2 ${pState.cost ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} disabled={!pState.cost}><Lock size={14} /> Lock Part</button>
                        ) : (
                          <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, locked: false}})} className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-black px-6 py-3 rounded-xl uppercase transition-all flex items-center gap-2"><Unlock size={14} /> Edit</button>
                        )}
                      </div>
                    </div>
                  );
               })}
             </div>
             
             {/* LABOR & INCIDENTALS */}
             <div className="space-y-4 mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                 <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                   <Wrench size={16} /> Labor Tasks
                 </h3>
                 <select 
                   onChange={(e) => {
                     const guide = DataBridge.getLaborGuide()[e.target.value];
                     if (guide) {
                       setTasks([...tasks, {
                         id: `TASK-${Date.now()}`,
                         description: guide.job,
                         suggested_hours: guide.hours,
                         billed_hours: guide.hours,
                         rate: parseFloat(laborRate) || 0
                       }]);
                     }
                     e.target.value = ''; // Reset dropdown after selection
                   }}
                   className="bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                 >
                   <option value="">-- Add Standard Labor Task --</option>
                   {Object.entries(DataBridge.getLaborGuide()).map(([key, data]) => (
                     <option key={key} value={key}>{data.job} ({data.hours} hrs)</option>
                   ))}
                 </select>
               </div>
               
               <div className="space-y-3">
                 {tasks.map((task, idx) => (
                   <div key={task.id} className="grid grid-cols-12 gap-4 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                     <div className="col-span-6">
                       <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Task Description</label>
                       <input type="text" value={task.description} onChange={(e) => {
                         const newTasks = [...tasks];
                         newTasks[idx].description = e.target.value;
                         setTasks(newTasks);
                       }} className="w-full bg-transparent text-white font-bold text-xs outline-none" />
                     </div>
                     <div className="col-span-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Suggested</label>
                       <div className="text-slate-400 text-xs font-mono">{task.suggested_hours} hrs</div>
                     </div>
                     <div className="col-span-2">
                       <label className="text-[9px] font-black text-emerald-500 uppercase block mb-1">Billed</label>
                       <input type="number" value={task.billed_hours} onChange={(e) => {
                         const newTasks = [...tasks];
                         newTasks[idx].billed_hours = parseFloat(e.target.value) || 0;
                         setTasks(newTasks);
                       }} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-black text-xs outline-none focus:border-emerald-500" />
                     </div>
                     <div className="col-span-2 text-right">
                       <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Task Total</label>
                       <div className="text-white font-black text-sm">${(task.billed_hours * task.rate).toFixed(2)}</div>
                     </div>
                   </div>
                 ))}
                 {tasks.length === 0 && (
                   <div className="text-center p-4 border border-dashed border-slate-800 rounded-xl text-[10px] text-slate-500 font-black uppercase">
                     No labor tasks added. Select from the guide above.
                   </div>
                 )}
               </div>

               {/* Global Rate & Incidentals */}
               <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Global Hourly Rate {activeJob?.customerTier && <span className="text-emerald-500">({activeJob.customerTier})</span>}</label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                     <input type="number" value={laborRate} onChange={e => {
                         const newRate = parseFloat(e.target.value) || 0;
                         setLaborRate(newRate);
                         setTasks(tasks.map(t => ({...t, rate: newRate})));
                     }} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 transition-colors" placeholder="165" />
                   </div>
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Shop Supplies</label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                     <input type="number" value={incidentals} onChange={e => setIncidentals(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 transition-colors" placeholder="35.00" />
                   </div>
                 </div>
               </div>
             </div>

             <div className="flex gap-4">
               <button onClick={handleProceedToSignature} className="flex-1 bg-emerald-600 hover:bg-emerald-500 p-6 rounded-[2rem] text-white font-black uppercase text-sm shadow-xl shadow-emerald-900/40 active:scale-95 transition-all flex justify-center items-center gap-2">
                  In-Person Kiosk Sign
               </button>
               <button onClick={handleSendSMS} className="flex-1 bg-blue-600 hover:bg-blue-500 p-6 rounded-[2rem] text-white font-black uppercase text-sm shadow-xl shadow-blue-900/40 active:scale-95 transition-all flex justify-center items-center gap-2">
                  <Send size={18} /> Present to Customer
               </button>
             </div>
             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest text-center mt-4">Hand device to customer · Twilio SMS integration coming soon.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
      <button onClick={() => setViewMode('BUILDER')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Builder
      </button>
      <header className="mb-8 border-b border-slate-800 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-sm font-black text-emerald-500 uppercase italic tracking-tighter mb-1">Customer Authorization</h1>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{activeJob?.name || 'Unknown Customer'}</h3>
            <p className="text-lg font-bold text-slate-300 uppercase tracking-wide">{data.vehicle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">WO #{data.id}</p>
          </div>
        </div>
      </header>

      {/* ITEM SUMMARY */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden mb-6 shadow-2xl">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-800/50 text-slate-500 uppercase font-black italic">
            <tr>
              <th className="p-4">Description</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {data.items.map((item, i) => (
              <tr key={i} className="border-t border-slate-800/50">
                <td className="p-4 font-bold">{item.desc}</td>
                <td className="p-4 text-right font-mono">${item.retail ? item.retail.toFixed(2) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 bg-blue-600/10 border-t border-blue-500/20 flex justify-between items-center">
          <span className="text-xs font-black text-blue-400 uppercase italic">Grand Total</span>
          <span className="text-2xl font-black text-white font-mono">${data.total ? data.total.toFixed(2) : "0.00"}</span>
        </div>
      </div>

      {/* THE CLOSER: SIGNATURE BOX */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl">
        <p className="text-center text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Tap to Authorize Repair</p>
        
        {/* TAP TO SIGN BOX */}
        <div 
          onClick={() => setIsSigned(true)}
          className={`border-2 ${isSigned ? 'border-emerald-500 bg-emerald-50' : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'} rounded-2xl mb-6 h-32 flex items-center justify-center cursor-pointer transition-colors`}
        >
          {isSigned ? (
            <span className="text-4xl text-emerald-700" style={{ fontFamily: "'Brush Script MT', 'Caveat', cursive" }}>
              {activeJob?.name || activeJob?.unit || 'Customer Authorized'}
            </span>
          ) : (
            <span className="text-slate-400 font-bold uppercase tracking-widest">Tap Here to Sign</span>
          )}
        </div>

        {/* LEGAL CONSENT */}
        {isSigned && (
          <div className="mb-6 flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <input 
              type="checkbox" 
              id="legalConsent" 
              checked={legalConsent} 
              onChange={(e) => setLegalConsent(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="legalConsent" className="text-xs font-bold text-slate-600 leading-tight cursor-pointer select-none">
              By checking this box, you are approving the estimate and legally authorizing the shop to perform the listed repairs.
            </label>
          </div>
        )}

        <button 
          onClick={handleFinalApproval}
          disabled={!isSigned || !legalConsent}
          className={`w-full p-6 rounded-[2rem] font-black uppercase text-lg shadow-xl transition-all ${
            (isSigned && legalConsent) 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 active:scale-95' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          Authorize Work
        </button>
      </div>
    </div>
  );
};

export default IgnitionPort;
