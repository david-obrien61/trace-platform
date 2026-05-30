/**
 * MODULE: AUDIT (Invoice Intelligence)
 * VERSION: v1.1.0
 * DESC: Upload a shop invoice image. Claude vision reads and audits in one pass —
 *       flags missing charges, fluids topped off from inventory at no charge,
 *       uncaptured consumables, and leakage patterns.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSearch, Upload, AlertTriangle, CheckCircle2, TrendingUp,
  Package, Droplets, Wrench, DollarSign, History, ChevronDown,
  ChevronUp, X, ArrowRight, Camera, ThumbsDown
} from 'lucide-react';
import DataBridge from '../DataBridge';
import AIEngine from '@trace/shared/ai/AIEngine';
import { supabase } from '../supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

const severityStyle = (s) => ({
  HIGH:   { bar: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',    icon: <AlertTriangle size={12} className="text-red-400" /> },
  MEDIUM: { bar: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: <AlertTriangle size={12} className="text-orange-400" /> },
  LOW:    { bar: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: <AlertTriangle size={12} className="text-yellow-400" /> },
}[s] || { bar: 'bg-slate-600', badge: 'bg-slate-700 text-slate-400 border-slate-600', icon: null });

const categoryIcon = (cat) => ({
  FLUID:       <Droplets size={14} className="text-blue-400" />,
  PART:        <Wrench size={14} className="text-slate-400" />,
  CONSUMABLE:  <Package size={14} className="text-amber-400" />,
  LABOR:       <DollarSign size={14} className="text-emerald-400" />,
}[cat] || <Package size={14} className="text-slate-400" />);

// Maps a finding item name to a concept key for cross-shop alias learning
const deriveConcept = (item = '', category = '') => {
  const t = item.toLowerCase();
  if (/hazmat|disposal|environmental|waste|eco|recycl|recovery fee/.test(t)) return 'WASTE_DISPOSAL_FEE';
  if (/shop supply|shop supplies|shop fee|consumable|material/.test(t)) return 'SHOP_SUPPLIES_FEE';
  if (/crush washer|drain plug|dp seal|drain washer|plug gasket/.test(t)) return 'OIL_DRAIN_SEAL';
  if (/oil filter|air filter|cabin filter/.test(t)) return 'FILTER_' + t.split(' ')[0].toUpperCase();
  if (category === 'FLUID') return 'FLUID_TOPOFF';
  return 'GENERAL_' + item.toUpperCase().replace(/\s+/g, '_').slice(0, 30);
};

// ── Dismiss Button — captures false positives and feeds concept alias learning ─
const DismissButton = ({ item, category, onDismiss }) => {
  const [open, setOpen]   = useState(false);
  const [label, setLabel] = useState('');
  const [sent, setSent]   = useState(false);

  const submit = async () => {
    const concept = deriveConcept(item, category);
    const shopId  = DataBridge.getShopId();
    // Log to concept_aliases for cross-shop learning
    if (label.trim()) {
      await supabase.from('concept_aliases').upsert(
        { concept, alias: label.trim(), shop_id: shopId, status: 'PENDING' },
        { onConflict: 'concept,alias', ignoreDuplicates: false }
      ).then(({ data, error }) => {
        if (!error) {
          // Increment confirmed_count if alias already exists
          supabase.rpc('increment_alias_count', { p_concept: concept, p_alias: label.trim() });
        }
      });
    }
    DataBridge.trackEvent('AUDIT', 'finding_dismissed', { concept, flagged_item: item, invoice_label: label.trim() || null, category });
    setSent(true);
    setTimeout(() => onDismiss(item), 800);
  };

  if (sent) return <p className="text-[8px] text-emerald-400 font-black uppercase">Thanks — noted</p>;

  return open ? (
    <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
      <p className="text-[8px] text-slate-400 uppercase tracking-widest">What did your invoice call this?</p>
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="e.g. Environmental Fee (optional)"
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors">Submit</button>
        <button onClick={() => { submit(); }} className="bg-slate-700 hover:bg-slate-600 text-slate-400 text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors">Skip</button>
      </div>
    </div>
  ) : (
    <button
      onClick={e => { e.stopPropagation(); setOpen(true); }}
      className="mt-1.5 flex items-center gap-1 text-[8px] text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
    >
      <ThumbsDown size={9} /> False positive
    </button>
  );
};

// Resize + compress image before sending — phone cameras produce 4032x3024 (~4MB).
// Claude only needs ~1200px to read invoice text clearly; this cuts payload 10x.
const compressImage = (file, maxPx = 1600, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const b64 = canvas.toDataURL(mimeType, quality).split(',')[1];
        resolve({ b64, mimeType });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

// ── Result Card ───────────────────────────────────────────────────────────────

const AuditResult = ({ result, onSaveToLeakage, onClear }) => {
  const [showInvoice, setShowInvoice] = useState(false);
  const [dismissed, setDismissed]     = useState(new Set());
  const inv   = result.invoice_summary || {};
  const miss  = (result.missing_charges || []).filter(i => !dismissed.has(i.item));
  const unc   = (result.inventory_consumed_uncharged || []).filter(i => !dismissed.has(i.item));
  const patt  = result.leakage_patterns || [];
  const flags = result.flags || [];
  const recovery = [...miss, ...unc].reduce((sum, i) =>
    sum + Number(i.estimated_value || (i.qty_estimate * i.unit_cost) || 0), 0);

  return (
    <div className="space-y-5">

      {/* RECOVERY HERO */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Recovery Potential This Invoice</p>
          <p className="text-4xl font-black text-white">${Number(recovery).toFixed(2)}</p>
          <p className="text-[9px] text-slate-400 mt-1 uppercase font-mono">
            {miss.length} missing charge{miss.length !== 1 ? 's' : ''} · {unc.length} uncharged inventory item{unc.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSaveToLeakage}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] py-2 px-3 rounded-xl uppercase tracking-widest transition-colors"
          >
            Log to OMNI
          </button>
          <button
            onClick={onClear}
            className="bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[9px] py-2 px-3 rounded-xl uppercase tracking-widest transition-colors"
          >
            New Scan
          </button>
        </div>
      </div>

      {/* INVOICE SUMMARY (collapsible) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowInvoice(v => !v)}
          className="w-full flex justify-between items-center p-4 text-left"
        >
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Invoice Summary</p>
            <p className="text-sm font-bold text-white mt-0.5">
              {inv.customer || 'Unknown Customer'} · {inv.vehicle || ''} · ${Number(inv.total_billed || 0).toFixed(2)} billed
            </p>
          </div>
          {showInvoice ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </button>
        {showInvoice && inv.services?.length > 0 && (
          <div className="border-t border-slate-700 p-4 space-y-1">
            {inv.services.map((s, i) => (
              <p key={i} className="text-[10px] font-mono text-slate-400">• {s}</p>
            ))}
          </div>
        )}
      </div>

      {/* MISSING CHARGES */}
      {miss.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertTriangle size={12} /> Missing Charges
          </p>
          <div className="space-y-3">
            {miss.map((item, i) => {
              const st = severityStyle(item.severity);
              return (
                <div key={i} className={`bg-slate-800 border rounded-2xl p-4 flex gap-3 ${item.severity === 'HIGH' ? 'border-red-500/30' : 'border-slate-700'}`}>
                  <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${st.bar}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {categoryIcon(item.category)}
                        <p className="text-sm font-bold text-white">{item.item}</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${st.badge}`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-sm font-black text-emerald-400 flex-shrink-0">
                        +${Number(item.estimated_value || 0).toFixed(2)}
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">{item.reason}</p>
                    <DismissButton item={item.item} category={item.category} onDismiss={name => setDismissed(p => new Set([...p, name]))} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UNCHARGED INVENTORY */}
      {unc.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Package size={12} /> Inventory Consumed — Not Billed
          </p>
          <div className="space-y-2">
            {unc.map((item, i) => (
              <div key={i} className="bg-slate-800 border border-orange-500/20 rounded-2xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-white">{item.item}</p>
                    {item.inventory_match && (
                      <p className="text-[8px] text-orange-400 font-mono mt-0.5">↳ matched: {item.inventory_match}</p>
                    )}
                    <p className="text-[9px] text-slate-500 mt-1">
                      Est. {item.qty_estimate} unit{item.qty_estimate !== 1 ? 's' : ''} · ${Number(item.unit_cost || 0).toFixed(2)} each
                    </p>
                  </div>
                  <p className="text-sm font-black text-orange-400 flex-shrink-0 ml-4">
                    −${(Number(item.qty_estimate || 1) * Number(item.unit_cost || 0)).toFixed(2)}
                  </p>
                </div>
                <DismissButton item={item.item} category="FLUID" onDismiss={name => setDismissed(p => new Set([...p, name]))} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEAKAGE PATTERNS */}
      {patt.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingUp size={12} /> Recurring Leakage Patterns Detected
          </p>
          <div className="space-y-3">
            {patt.map((p, i) => (
              <div key={i} className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-bold text-white flex-1 pr-4">{p.pattern}</p>
                  {p.monthly_loss_est > 0 && (
                    <p className="text-sm font-black text-purple-400 flex-shrink-0">
                      ~${Number(p.monthly_loss_est).toFixed(0)}/mo
                    </p>
                  )}
                </div>
                {p.example && (
                  <p className="text-[9px] text-slate-500 mt-1 italic">e.g. {p.example}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTION FLAGS */}
      {flags.length > 0 && (
        <div className="space-y-2">
          {flags.map((f, i) => (
            <div key={i} className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex gap-3 items-start">
              <ArrowRight size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-white font-bold">{f.message}</p>
                {f.action && <p className="text-[8px] text-slate-500 mt-0.5 uppercase tracking-widest">{f.action}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── History Entry ─────────────────────────────────────────────────────────────

const HistoryEntry = ({ entry, onReopen }) => {
  const inv = entry.invoice_summary || entry.invoice || {};
  const recovery = entry.recovery_potential || 0;
  return (
    <div
      onClick={() => onReopen(entry)}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-slate-600 transition-colors"
    >
      <div>
        <p className="text-xs font-bold text-white">{inv.customer || inv.customerName || 'Invoice'}</p>
        <p className="text-[9px] text-slate-500 mt-0.5">
          {new Date(entry.auditedAt).toLocaleDateString()} · {inv.vehicle || ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0 ml-4">
        <p className="text-sm font-black text-emerald-400">+${Number(recovery).toFixed(2)}</p>
        <p className="text-[8px] text-slate-600 uppercase">potential</p>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const IgnitionAudit = () => {
  const shopId  = DataBridge.getShopId();
  const shopInfo = DataBridge.load('shop_info') || {};
  const tier    = shopInfo.tier || 'TRIAL';

  // Track module open once per mount
  React.useEffect(() => {
    DataBridge.trackEvent('AUDIT', 'module_opened', { tier });
  }, []);

  const fileRef = useRef(null);
  const [preview,   setPreview]   = useState(null);
  const [b64,       setB64]       = useState(null);
  const [mimeType,  setMimeType]  = useState('image/jpeg');
  const [stage,     setStage]     = useState('IDLE');
  const [progress,  setProgress]  = useState(0);
  const [result,    setResult]    = useState(null);
  const [history,   setHistory]   = useState(() => DataBridge.getAuditHistory());
  const [error,     setError]     = useState(null);

  const STEPS = [
    'Compressing image…',
    'Reading invoice…',
    'Auditing for gaps…',
    'Calculating recovery…',
  ];

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPreview(URL.createObjectURL(file));
    setError(null);
    try {
      const { b64: compressed, mimeType: mime } = await compressImage(file);
      setB64(compressed);
      setMimeType(mime);
    } catch {
      // fallback: read as-is without compression
      const reader = new FileReader();
      reader.onload = (e) => setB64(e.target.result.split(',')[1]);
      reader.readAsDataURL(file);
      setMimeType(file.type || 'image/jpeg');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const runAudit = async () => {
    if (!b64) return;
    setStage('SCANNING');
    setError(null);

    let step = 0;
    const tick = setInterval(() => {
      step++;
      setProgress(step);
      if (step >= STEPS.length - 1) clearInterval(tick);
    }, 1800);

    try {
      const res = await AIEngine.auditInvoice(b64, shopId, tier, mimeType);
      clearInterval(tick);
      setProgress(STEPS.length);
      if (!res.ok) throw new Error(res.error || 'Audit returned no result');
      setResult(res);
      setStage('RESULT');
      DataBridge.trackEvent('AUDIT', 'scan_completed', {
        tier,
        recovery_potential: res.recovery_potential || 0,
        missing_charges:    (res.missing_charges || []).length,
        uncharged_items:    (res.inventory_consumed_uncharged || []).length,
      });
    } catch (err) {
      clearInterval(tick);
      setError(`Audit failed: ${err.message}`);
      setStage('IDLE');
    }
  };

  const saveToLeakage = () => {
    if (!result) return;
    DataBridge.saveAuditResult(result);
    // Also push to transaction_history so OMNI leakage picks it up
    const existing = DataBridge.load('transaction_history') || [];
    const miss = result.missing_charges || [];
    miss.forEach(m => {
      existing.push({
        customer: result.invoice_summary?.customer || 'Invoice Audit',
        tier: 'STANDARD',
        standardPrice: Number(m.estimated_value || 0),
        actualPrice: 0,
        timestamp: Date.now(),
        source: 'INVOICE_AUDIT',
        item: m.item,
      });
    });
    DataBridge.save('transaction_history', existing);
    const updated = DataBridge.getAuditHistory();
    setHistory(updated);
    DataBridge.trackEvent('AUDIT', 'result_logged_to_omni', {
      tier,
      recovery_potential: result.recovery_potential || 0,
      items_logged: miss.length,
    });
    alert(`Saved to OMNI leakage log. ${miss.length} item${miss.length !== 1 ? 's' : ''} recorded.`);
  };

  const clearResult = () => {
    setResult(null);
    setPreview(null);
    setB64(null);
    setStage('IDLE');
    setProgress(0);
    setError(null);
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-200 min-h-screen">

      {/* HEADER */}
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">AUDIT // Invoice Intelligence</h2>
          <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">AI Invoice Leakage Detector</p>
        </div>
        {history.length > 0 && stage !== 'HISTORY' && (
          <button
            onClick={() => setStage('HISTORY')}
            className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
          >
            <History size={12} /> History ({history.length})
          </button>
        )}
        {stage === 'HISTORY' && (
          <button
            onClick={() => setStage('IDLE')}
            className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
          >
            ← New Scan
          </button>
        )}
      </header>

      {/* ── HISTORY VIEW ── */}
      {stage === 'HISTORY' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-slate-600 text-sm font-black uppercase py-12">No audits yet</p>
          ) : (
            history.map((entry, i) => (
              <HistoryEntry
                key={entry.id || i}
                entry={entry}
                onReopen={(e) => { setResult(e); setStage('RESULT'); }}
              />
            ))
          )}
        </div>
      )}

      {/* ── IDLE: UPLOAD ZONE ── */}
      {stage === 'IDLE' && (
        <div className="space-y-6">
          {/* DROP ZONE */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !preview && fileRef.current?.click()}
            className={`relative rounded-3xl border-2 border-dashed transition-all ${
              preview
                ? 'border-blue-500/40 cursor-default'
                : 'border-slate-700 hover:border-blue-500/50 cursor-pointer'
            }`}
          >
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Invoice" className="w-full rounded-3xl max-h-72 object-contain bg-black" />
                <button
                  onClick={(e) => { e.stopPropagation(); clearResult(); }}
                  className="absolute top-3 right-3 bg-black/70 rounded-full p-1.5 hover:bg-black"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                  <Upload size={28} className="text-slate-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-white uppercase italic tracking-tighter">Drop invoice here</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">or tap to upload · JPG, PNG, PDF</p>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </div>

          {/* CAMERA / FILE BUTTONS */}
          {!preview && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-[10px] py-4 rounded-2xl uppercase tracking-widest transition-colors"
              >
                <Upload size={16} /> Upload File
              </button>
              <button
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.setAttribute('capture', 'environment');
                    fileRef.current.click();
                  }
                }}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-[10px] py-4 rounded-2xl uppercase tracking-widest transition-colors"
              >
                <Camera size={16} /> Take Photo
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
              <p className="text-[10px] text-red-400 font-bold">{error}</p>
            </div>
          )}

          {/* WHAT IT FINDS */}
          {!preview && (
            <div className="bg-slate-800/50 border border-slate-800 rounded-3xl p-5 space-y-3">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">What the AI looks for</p>
              {[
                ['PART',       'Missing parts — e.g. crush washer on every oil change'],
                ['FLUID',      'Fluids marked "no charge" that came from your inventory'],
                ['CONSUMABLE', 'Shop supplies, gloves, rags never captured on invoices'],
                ['PATTERN',    'Recurring leakage — why you\'re running out of stock'],
              ].map(([type, desc]) => (
                <div key={type} className="flex items-start gap-3">
                  {categoryIcon(type)}
                  <p className="text-[10px] text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {preview && (
            <button
              onClick={runAudit}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 transition-colors"
            >
              <FileSearch size={20} /> Analyze Invoice
            </button>
          )}
        </div>
      )}

      {/* ── SCANNING: PROGRESS ── */}
      {stage === 'SCANNING' && (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30 animate-pulse">
            <FileSearch size={36} className="text-blue-500" />
          </div>
          <div className="w-full max-w-xs space-y-3">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  i < progress
                    ? 'bg-emerald-500 border-emerald-400'
                    : i === progress
                    ? 'border-blue-400 animate-pulse bg-blue-500/20'
                    : 'border-slate-700 bg-slate-800'
                }`}>
                  {i < progress && <CheckCircle2 size={8} className="text-white" />}
                </div>
                <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                  i < progress ? 'text-emerald-400' : i === progress ? 'text-white' : 'text-slate-600'
                }`}>
                  {step}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-600 uppercase font-mono tracking-widest animate-pulse mt-4">
            This may take 10–20 seconds…
          </p>
        </div>
      )}

      {/* ── RESULT ── */}
      {stage === 'RESULT' && result && (
        result.raw ? (
          // Fallback if JSON parse failed
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-3">Raw AI Response</p>
              <pre className="text-[9px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">{result.raw}</pre>
            </div>
            <button onClick={clearResult} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-colors">
              New Scan
            </button>
          </div>
        ) : (
          <AuditResult
            result={result}
            onSaveToLeakage={saveToLeakage}
            onClear={clearResult}
          />
        )
      )}
    </div>
  );
};

export default IgnitionAudit;
