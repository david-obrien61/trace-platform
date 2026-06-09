/**
 * MODULE: Admin Subscription Manager
 * VERSION: v0.4.0
 * DESC: Master marketplace for Ignition OS. Manages the $X Umbrella fee,
 * individual module trials, and automated data ingestion (VIN/Telematics).
 */

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Zap, FileSpreadsheet, Camera,
  ShieldCheck, Crown, Clock, DollarSign, Settings
} from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (39 classNames converted):
// (1) md:grid-cols-3 responsive → fixed flex-wrap row (flagged: no breakpoint)
// (2) hover:bg-blue-600/10, hover:bg-emerald-600/10, hover:bg-purple-600/10 → dropped (cosmetic on stub buttons)
// (3) group-hover:scale-110 on icons → dropped (group hover not possible inline)
// (4) hover:bg-blue-600/20 on start-trial button → dropped (cosmetic; button still functional)
// [TRACE:STYLE] AdminSubscription converted, 39 classNames → inline, 4 non-1:1 categories

const AdminSubscription = () => {
  // 1. Platform Pricing State ($X Umbrella)
  const [umbrellaPrice, setUmbrellaPrice] = useState(299);

  // 2. Module Marketplace & Trial State
  const [subscriptions, setSubscriptions] = useState(
    DataBridge.load('system_subscriptions') || {
      FLUX: { active: true, tier: 'BASIC', trialActive: false },
      PREDICTIVE: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      ESTIMATOR: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      CODE: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      STOK: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      PROT: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      HUB: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      PROC: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }
    }
  );

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] AdminSubscription converted, 39 classNames → inline, 4 non-1:1 categories');

  // Sync pricing/subs to DataBridge when changed
  useEffect(() => {
    const currentSubs = DataBridge.load('system_subscriptions');
    if (currentSubs) {
      let merged = { ...currentSubs };
      let changed = false;
      if (!currentSubs.CODE) { merged.CODE = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.STOK) { merged.STOK = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.PROT) { merged.PROT = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.HUB)  { merged.HUB  = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.PROC) { merged.PROC  = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (changed) {
        setSubscriptions(merged);
        DataBridge.save('system_subscriptions', merged);
      }
    }
  }, []);

  const persistChanges = (newSubs) => {
    setSubscriptions(newSubs);
    DataBridge.save('system_subscriptions', newSubs);
  };

  const startTrial = (modId) => {
    const updated = {
      ...subscriptions,
      [modId]: {
        ...subscriptions[modId],
        active: true,
        tier: 'PRO',
        trialActive: true,
        trialStartedAt: new Date().toISOString()
      }
    };
    persistChanges(updated);
  };

  const calculateDaysLeft = (startDate) => {
    if (!startDate) return 30;
    const start = new Date(startDate);
    const today = new Date();
    const diff = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diff);
  };

  const ingestionCards = [
    { color: '#3b82f6', bg: 'rgba(37,99,235,0.05)', border: 'rgba(59,130,246,0.20)', Icon: Zap,           label: 'Telematics Sync',  desc: 'Connect Samsara / Geotab / Motive' },
    { color: '#10b981', bg: 'rgba(5,150,105,0.05)',  border: 'rgba(16,185,129,0.20)', Icon: FileSpreadsheet, label: 'Legacy Importer',  desc: 'Drag & Drop Fleet Spreadsheets' },
    { color: '#a855f7', bg: 'rgba(147,51,234,0.05)', border: 'rgba(168,85,247,0.20)', Icon: Camera,          label: 'VIN Sniper OCR',   desc: 'Mobile Barcode & Plate Scanning' },
  ];

  return (
    <div style={{ padding: 24, backgroundColor: '#020617', color: '#e2e8f0', minHeight: '100%', fontFamily: 'sans-serif' }}>
      <header style={{
        marginBottom: 40,
        borderBottom: '1px solid #1e293b',
        paddingBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', color: '#ffffff' }}>
            IGNITION MARKETPLACE
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Platform Administration // v0.4.0
          </p>
        </div>
        <div style={{
          backgroundColor: '#0f172a',
          padding: '8px 16px',
          borderRadius: 12,
          border: '1px solid #334155',
          textAlign: 'right',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Umbrella Fee</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
            ${umbrellaPrice}<span style={{ fontSize: 12, color: '#64748b' }}>/mo</span>
          </p>
        </div>
      </header>

      {/* SECTION 1: DATA INGESTION */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <Zap size={18} style={{ color: '#3b82f6' }} />
          <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'monospace' }}>
            Fast-Track Onboarding
          </h3>
        </div>
        {/* md:grid-cols-3 → flex-wrap row; flagged: no breakpoint equivalent */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {ingestionCards.map(({ color, bg, border, Icon, label, desc }) => (
            <button
              key={label}
              style={{
                flex: '1 1 calc(33% - 12px)',
                minWidth: 160,
                padding: 24,
                backgroundColor: bg,
                border: `1px solid ${border}`,
                borderRadius: 16,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              <Icon size={28} style={{ margin: '0 auto 12px', color }} />
              <p style={{ fontWeight: 700, color: '#ffffff', fontSize: 14, textTransform: 'uppercase' }}>{label}</p>
              <p style={{ fontSize: 9, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>{desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 2: MODULE SUBSCRIPTIONS */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <ShoppingBag size={18} style={{ color: '#3b82f6' }} />
          <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontFamily: 'monospace' }}>
            Active Subscriptions
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.keys(subscriptions).map(key => {
            const mod = subscriptions[key];
            const daysLeft = calculateDaysLeft(mod.trialStartedAt);

            return (
              <div key={key} style={{
                padding: 24,
                borderRadius: 24,
                border: `1px solid ${mod.active ? 'rgba(59,130,246,0.30)' : '#1e293b'}`,
                backgroundColor: mod.active ? '#0f172a' : 'rgba(15,23,42,0.40)',
                boxShadow: mod.active ? '0 10px 15px -3px rgba(30,58,138,0.10)' : 'none',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 20,
                      fontStyle: 'italic',
                      backgroundColor: mod.active ? '#2563eb' : '#1e293b',
                      color: mod.active ? '#ffffff' : '#475569',
                    }}>
                      {key[0]}
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 900, color: '#ffffff', fontStyle: 'italic', letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
                        {key} MODULE
                      </h4>
                      {mod.trialActive ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <Clock size={12} style={{ color: '#fb923c' }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                            Trial: {daysLeft} Days Remaining
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {mod.tier} TIER
                        </span>
                      )}
                    </div>
                  </div>
                  {!mod.active ? (
                    <button
                      onClick={() => startTrial(key)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(37,99,235,0.10)',
                        color: '#3b82f6',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 8,
                        border: '1px solid rgba(59,130,246,0.30)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      Start Free Trial
                    </button>
                  ) : (
                    <span style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(6,46,26,0.40)',
                      color: '#10b981',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: '1px solid rgba(16,185,129,0.20)',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <ShieldCheck size={14} /> Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminSubscription;
