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

const STYLE_DEBUG = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_META = {
  HIGH:   {
    barColor: '#ef4444',
    badgeBg: 'rgba(239,68,68,0.1)', badgeColor: '#f87171', badgeBd: 'rgba(239,68,68,0.2)',
    icon: <AlertTriangle size={12} style={{ color: '#f87171' }} />,
  },
  MEDIUM: {
    barColor: '#f97316',
    badgeBg: 'rgba(249,115,22,0.1)', badgeColor: '#fb923c', badgeBd: 'rgba(249,115,22,0.2)',
    icon: <AlertTriangle size={12} style={{ color: '#fb923c' }} />,
  },
  LOW:    {
    barColor: '#eab308',
    badgeBg: 'rgba(234,179,8,0.1)', badgeColor: '#fbbf24', badgeBd: 'rgba(234,179,8,0.2)',
    icon: <AlertTriangle size={12} style={{ color: '#fbbf24' }} />,
  },
};
const DEFAULT_SEVERITY = {
  barColor: '#475569',
  badgeBg: '#1e293b', badgeColor: '#94a3b8', badgeBd: '#475569',
  icon: null,
};
const severityStyle = (s) => SEVERITY_META[s] || DEFAULT_SEVERITY;

const categoryIcon = (cat) => ({
  FLUID:      <Droplets size={14} style={{ color: '#60a5fa' }} />,
  PART:       <Wrench size={14} style={{ color: '#94a3b8' }} />,
  CONSUMABLE: <Package size={14} style={{ color: '#fbbf24' }} />,
  LABOR:      <DollarSign size={14} style={{ color: '#34d399' }} />,
}[cat] || <Package size={14} style={{ color: '#94a3b8' }} />);

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

// ── Dismiss Button ─────────────────────────────────────────────────────────────
const DismissButton = ({ item, category, onDismiss }) => {
  const [open, setOpen]   = useState(false);
  const [label, setLabel] = useState('');
  const [sent, setSent]   = useState(false);

  const submit = async () => {
    const concept = deriveConcept(item, category);
    const shopId  = DataBridge.getShopId();
    if (label.trim()) {
      await supabase.from('concept_aliases').upsert(
        { concept, alias: label.trim(), shop_id: shopId, status: 'PENDING' },
        { onConflict: 'concept,alias', ignoreDuplicates: false }
      ).then(({ data, error }) => {
        if (!error) {
          supabase.rpc('increment_alias_count', { p_concept: concept, p_alias: label.trim() });
        }
      });
    }
    DataBridge.trackEvent('AUDIT', 'finding_dismissed', { concept, flagged_item: item, invoice_label: label.trim() || null, category });
    setSent(true);
    setTimeout(() => onDismiss(item), 800);
  };

  if (sent) return <p style={{ fontSize: 8, color: '#34d399', fontWeight: 900, textTransform: 'uppercase' }}>Thanks — noted</p>;

  return open ? (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
      <p style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>What did your invoice call this?</p>
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="e.g. Environmental Fee (optional)"
        className="ign-input"
        style={{
          width: '100%', backgroundColor: '#334155', border: '1px solid #475569',
          borderRadius: 8, padding: '6px 8px', fontSize: 10, color: '#ffffff',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} style={{
          backgroundColor: '#2563eb', color: '#ffffff', fontSize: 8, fontWeight: 900,
          padding: '6px 12px', borderRadius: 8, textTransform: 'uppercase',
          letterSpacing: '0.1em', border: 'none', cursor: 'pointer',
        }}>Submit</button>
        <button onClick={() => { submit(); }} style={{
          backgroundColor: '#334155', color: '#94a3b8', fontSize: 8, fontWeight: 900,
          padding: '6px 12px', borderRadius: 8, textTransform: 'uppercase',
          letterSpacing: '0.1em', border: 'none', cursor: 'pointer',
        }}>Skip</button>
      </div>
    </div>
  ) : (
    <button
      onClick={e => { e.stopPropagation(); setOpen(true); }}
      style={{
        marginTop: 6, display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 8, color: '#475569', textTransform: 'uppercase',
        letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer',
      }}
    >
      <ThumbsDown size={9} /> False positive
    </button>
  );
};

// Resize + compress image before sending
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* RECOVERY HERO */}
      <div style={{
        backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 24, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Recovery Potential This Invoice</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', margin: 0 }}>${Number(recovery).toFixed(2)}</p>
          <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', fontFamily: 'monospace' }}>
            {miss.length} missing charge{miss.length !== 1 ? 's' : ''} · {unc.length} uncharged inventory item{unc.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onSaveToLeakage} style={{
            backgroundColor: '#059669', color: '#ffffff', fontWeight: 900,
            fontSize: 9, padding: '8px 12px', borderRadius: 12,
            textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', cursor: 'pointer',
          }}>Log to OMNI</button>
          <button onClick={onClear} style={{
            backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: 900,
            fontSize: 9, padding: '8px 12px', borderRadius: 12,
            textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', cursor: 'pointer',
          }}>New Scan</button>
        </div>
      </div>

      {/* INVOICE SUMMARY (collapsible) */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
        <button
          onClick={() => setShowInvoice(v => !v)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 16, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Invoice Summary</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginTop: 2, margin: 0 }}>
              {inv.customer || 'Unknown Customer'} · {inv.vehicle || ''} · ${Number(inv.total_billed || 0).toFixed(2)} billed
            </p>
          </div>
          {showInvoice
            ? <ChevronUp size={14} style={{ color: '#64748b' }} />
            : <ChevronDown size={14} style={{ color: '#64748b' }} />}
        </button>
        {showInvoice && inv.services?.length > 0 && (
          <div style={{ borderTop: '1px solid #334155', padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {inv.services.map((s, i) => (
              <p key={i} style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', margin: 0 }}>• {s}</p>
            ))}
          </div>
        )}
      </div>

      {/* MISSING CHARGES */}
      {miss.length > 0 && (
        <div>
          <p style={{
            fontSize: 10, fontWeight: 900, color: '#f87171', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={12} /> Missing Charges
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {miss.map((item, i) => {
              const st = severityStyle(item.severity);
              return (
                <div key={i} style={{
                  backgroundColor: '#1e293b',
                  border: item.severity === 'HIGH' ? '1px solid rgba(239,68,68,0.3)' : '1px solid #334155',
                  borderRadius: 16, padding: 16, display: 'flex', gap: 12,
                }}>
                  <div style={{ width: 4, borderRadius: 9999, flexShrink: 0, alignSelf: 'stretch', backgroundColor: st.barColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {categoryIcon(item.category)}
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: 0 }}>{item.item}</p>
                        <span style={{
                          fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 4,
                          textTransform: 'uppercase', backgroundColor: st.badgeBg,
                          color: st.badgeColor, border: `1px solid ${st.badgeBd}`,
                        }}>
                          {item.severity}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 900, color: '#34d399', flexShrink: 0, margin: 0 }}>
                        +${Number(item.estimated_value || 0).toFixed(2)}
                      </p>
                    </div>
                    <p style={{ fontSize: 9, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>{item.reason}</p>
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
          <p style={{
            fontSize: 10, fontWeight: 900, color: '#fb923c', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Package size={12} /> Inventory Consumed — Not Billed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unc.map((item, i) => (
              <div key={i} style={{
                backgroundColor: '#1e293b', border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 16, padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: 0 }}>{item.item}</p>
                    {item.inventory_match && (
                      <p style={{ fontSize: 8, color: '#fb923c', fontFamily: 'monospace', marginTop: 2 }}>↳ matched: {item.inventory_match}</p>
                    )}
                    <p style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
                      Est. {item.qty_estimate} unit{item.qty_estimate !== 1 ? 's' : ''} · ${Number(item.unit_cost || 0).toFixed(2)} each
                    </p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 900, color: '#fb923c', flexShrink: 0, marginLeft: 16, margin: 0 }}>
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
          <p style={{
            fontSize: 10, fontWeight: 900, color: '#c084fc', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <TrendingUp size={12} /> Recurring Leakage Patterns Detected
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {patt.map((p, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 16, padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', flex: 1, paddingRight: 16, margin: 0 }}>{p.pattern}</p>
                  {p.monthly_loss_est > 0 && (
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#c084fc', flexShrink: 0, margin: 0 }}>
                      ~${Number(p.monthly_loss_est).toFixed(0)}/mo
                    </p>
                  )}
                </div>
                {p.example && (
                  <p style={{ fontSize: 9, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>e.g. {p.example}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTION FLAGS */}
      {flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flags.map((f, i) => (
            <div key={i} style={{
              backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <ArrowRight size={12} style={{ color: '#60a5fa', marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, color: '#ffffff', fontWeight: 700, margin: 0 }}>{f.message}</p>
                {f.action && <p style={{ fontSize: 8, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{f.action}</p>}
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
      style={{
        backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16,
        padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', margin: 0 }}>{inv.customer || inv.customerName || 'Invoice'}</p>
        <p style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
          {new Date(entry.auditedAt).toLocaleDateString()} · {inv.vehicle || ''}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 900, color: '#34d399', margin: 0 }}>+${Number(recovery).toFixed(2)}</p>
        <p style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase' }}>potential</p>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const IgnitionAudit = () => {
  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionAudit mounted');

  const shopId  = DataBridge.getShopId();
  const shopInfo = DataBridge.load('shop_info') || {};
  const tier    = shopInfo.tier || 'TRIAL';

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
    <div style={{ padding: 24, backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>

      {/* HEADER */}
      <header style={{
        marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', margin: 0 }}>
            AUDIT // Invoice Intelligence
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            AI Invoice Leakage Detector
          </p>
        </div>
        {history.length > 0 && stage !== 'HISTORY' && (
          <button
            onClick={() => setStage('HISTORY')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase',
              letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <History size={12} /> History ({history.length})
          </button>
        )}
        {stage === 'HISTORY' && (
          <button
            onClick={() => setStage('IDLE')}
            style={{
              fontSize: 9, fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase',
              letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            ← New Scan
          </button>
        )}
      </header>

      {/* ── HISTORY VIEW ── */}
      {stage === 'HISTORY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#475569', fontSize: 14, fontWeight: 900, textTransform: 'uppercase', padding: '48px 0' }}>No audits yet</p>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* DROP ZONE */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !preview && fileRef.current?.click()}
            style={{
              position: 'relative', borderRadius: 24,
              border: preview ? '2px dashed rgba(59,130,246,0.4)' : '2px dashed #334155',
              cursor: preview ? 'default' : 'pointer',
            }}
          >
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} alt="Invoice" style={{ width: '100%', borderRadius: 24, maxHeight: 288, objectFit: 'contain', backgroundColor: '#000000', display: 'block' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); clearResult(); }}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '50%',
                    padding: 6, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={14} style={{ color: '#ffffff' }} />
                </button>
              </div>
            ) : (
              <div style={{ padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 64, height: 64, backgroundColor: '#1e293b', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #334155',
                }}>
                  <Upload size={28} style={{ color: '#64748b' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', margin: 0 }}>Drop invoice here</p>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, textTransform: 'uppercase', fontFamily: 'monospace' }}>or tap to upload · JPG, PNG, PDF</p>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </div>

          {/* CAMERA / FILE BUTTONS */}
          {!preview && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#1e293b', border: '1px solid #334155',
                  color: '#ffffff', fontWeight: 900, fontSize: 10, padding: '16px 0',
                  borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
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
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#1e293b', border: '1px solid #334155',
                  color: '#ffffff', fontWeight: 900, fontSize: 10, padding: '16px 0',
                  borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                <Camera size={16} /> Take Photo
              </button>
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 10, color: '#f87171', fontWeight: 700, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* WHAT IT FINDS */}
          {!preview && (
            <div style={{
              backgroundColor: 'rgba(30,41,59,0.5)', border: '1px solid #1e293b',
              borderRadius: 24, padding: 20,
            }}>
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>What the AI looks for</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['PART',       'Missing parts — e.g. crush washer on every oil change'],
                  ['FLUID',      'Fluids marked "no charge" that came from your inventory'],
                  ['CONSUMABLE', 'Shop supplies, gloves, rags never captured on invoices'],
                  ['PATTERN',    'Recurring leakage — why you\'re running out of stock'],
                ].map(([type, desc]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {categoryIcon(type)}
                    <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <button
              onClick={runAudit}
              className="ign-card-hover"
              style={{
                width: '100%', backgroundColor: '#2563eb', color: '#ffffff',
                fontWeight: 900, padding: '20px 0', borderRadius: 16,
                fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: '0 20px 25px rgba(37,99,235,0.3)', border: 'none', cursor: 'pointer',
              }}
            >
              <FileSearch size={20} /> Analyze Invoice
            </button>
          )}
        </div>
      )}

      {/* ── SCANNING: PROGRESS ── */}
      {stage === 'SCANNING' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 24 }}>
          <div className="ign-pulse" style={{
            width: 80, height: 80, backgroundColor: 'rgba(37,99,235,0.2)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
          }}>
            <FileSearch size={36} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((step, i) => {
              const isDone    = i < progress;
              const isCurrent = i === progress;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: isDone ? '2px solid #6ee7b7' : isCurrent ? '2px solid #60a5fa' : '2px solid #334155',
                    backgroundColor: isDone ? '#10b981' : isCurrent ? 'rgba(59,130,246,0.2)' : '#1e293b',
                  }}>
                    {isDone && <CheckCircle2 size={8} style={{ color: '#ffffff' }} />}
                  </div>
                  <p style={{
                    fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: isDone ? '#34d399' : isCurrent ? '#ffffff' : '#475569',
                    margin: 0,
                  }}>
                    {step}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="ign-pulse" style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.1em', marginTop: 16 }}>
            This may take 10–20 seconds…
          </p>
        </div>
      )}

      {/* ── RESULT ── */}
      {stage === 'RESULT' && result && (
        result.raw ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>Raw AI Response</p>
              <pre style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result.raw}</pre>
            </div>
            <button onClick={clearResult} style={{
              width: '100%', backgroundColor: '#1e293b', color: '#ffffff',
              fontWeight: 900, padding: '16px 0', borderRadius: 16,
              fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em',
              border: 'none', cursor: 'pointer',
            }}>
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
